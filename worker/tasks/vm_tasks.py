"""
Celery-задачи для управления VM через Proxmox API.

Задачи:
  create_vm_task   — Создание VM (выбор ноды, клонирование, запуск)
  delete_vm_task   — Удаление VM (soft-delete)
  vm_action_task   — Действия start/stop/restart/suspend
"""
from __future__ import annotations

import asyncio
import json
import os
import sys

import redis as sync_redis
from celery import Task
from celery.utils.log import get_task_logger
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from tasks.celery_app import celery_app

logger = get_task_logger(__name__)

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "..", "backend"))

DATABASE_URL = os.environ.get(
    "DATABASE_URL",
    "postgresql+asyncpg://infinity:infinity_secret@postgres:5432/infinity_cloud",
)
REDIS_URL = os.environ.get("REDIS_URL", "redis://localhost:6379/0")

_engine = create_async_engine(DATABASE_URL, pool_size=5)
_session_factory = async_sessionmaker(bind=_engine, class_=AsyncSession, expire_on_commit=False)


def _run_async(coro):
    """Запуск async-кода из sync Celery-задачи."""
    loop = asyncio.new_event_loop()
    try:
        return loop.run_until_complete(coro)
    finally:
        loop.close()


def _publish_status(user_id: int, server_id: int, status: str, **extra):
    """Публикует изменение статуса VPS в Redis PubSub для WebSocket relay."""
    try:
        r = sync_redis.from_url(REDIS_URL)
        r.publish("vps_status", json.dumps({
            "event": "status_change",
            "user_id": user_id,
            "server_id": server_id,
            "status": status,
            **extra,
        }))
        r.close()
    except Exception:
        pass


@celery_app.task(
    bind=True,
    name="tasks.vm_tasks.create_vm_task",
    max_retries=3,
    default_retry_delay=30,
    acks_late=True,
)
def create_vm_task(self: Task, server_id: int) -> dict:
    """
    Задача создания VM:
    1. Загрузить Server из БД
    2. Выбрать ноду (Least-Used) с блокировкой
    3. Выделить IP-адрес (with_for_update skip_locked)
    4. Вызвать Proxmox API: clone → configure → start
    5. Обновить статус в БД
    6. Отправить email и WebSocket уведомления
    """
    logger.info(f"[create_vm] Начало создания VM для server_id={server_id}")

    async def _create():
        from app.models.ip_address import IPAddress
        from app.models.node import Node
        from app.models.plan import Plan
        from app.models.server import Server
        from app.models.user import User
        from app.services.node_selector import select_node
        from app.services.proxmox import ProxmoxClient

        async with _session_factory() as db:
            result = await db.execute(select(Server).where(Server.id == server_id))
            server = result.scalar_one_or_none()
            if server is None:
                logger.error(f"[create_vm] Server id={server_id} не найден")
                return {"error": "server_not_found"}

            if server.status != "creating":
                logger.warning(f"[create_vm] Server id={server_id} уже в статусе {server.status}")
                return {"status": server.status}

            plan_result = await db.execute(select(Plan).where(Plan.id == server.plan_id))
            plan = plan_result.scalar_one()

            try:
                # Выбираем ноду (с блокировкой — внутри select_node)
                node = await select_node(
                    db,
                    required_cpu=plan.cpu_cores,
                    required_ram_mb=plan.ram_mb,
                    required_disk_gb=plan.disk_gb,
                )
                server.node_id = node.id

                # Выделяем IP с блокировкой (skip_locked для конкурентности)
                ip_result = await db.execute(
                    select(IPAddress).where(
                        IPAddress.node_id == node.id,
                        IPAddress.is_allocated == False,  # noqa
                    ).with_for_update(skip_locked=True).limit(1)
                )
                ip = ip_result.scalar_one_or_none()
                if ip:
                    ip.is_allocated = True
                    server.ip_id = ip.id

                # Сохраняем VMID перед вызовом Proxmox (для retry)
                client = ProxmoxClient(node)
                if server.proxmox_vmid is None:
                    vmid = await client.get_next_vmid()
                    server.proxmox_vmid = vmid
                    await db.flush()
                else:
                    vmid = server.proxmox_vmid

                await client.create_vm(
                    node_name=node.name,
                    vmid=vmid,
                    template=server.os_template,
                    cores=plan.cpu_cores,
                    memory_mb=plan.ram_mb,
                    disk_gb=plan.disk_gb,
                    hostname=server.hostname,
                    ip_address=ip.address if ip else "dhcp",
                    gateway=ip.gateway if ip else "",
                )

                await client.start_vm(node.name, vmid)

                server.status = "running"
                logger.info(f"[create_vm] ✅ VM создана: vmid={vmid} на {node.name}")

            except Exception as exc:
                server.status = "error"
                server.note = str(exc)[:500]
                logger.error(f"[create_vm] ❌ Ошибка: {exc}")
                await db.commit()
                _publish_status(server.user_id, server.id, "error")
                raise self.retry(exc=exc, countdown=30 * (2 ** self.request.retries))

            await db.commit()

            # Уведомления
            _publish_status(server.user_id, server.id, "running",
                            hostname=server.hostname,
                            ip_address=ip.address if ip else None)

            # Email-уведомление
            try:
                from app.services.email import render_vps_created, send_email
                user_r = await db.execute(select(User).where(User.id == server.user_id))
                user = user_r.scalar_one_or_none()
                if user:
                    subj, body = render_vps_created(
                        server.hostname,
                        ip.address if ip else None,
                        plan.name,
                    )
                    await send_email(user.email, subj, body)
            except Exception as e:
                logger.error(f"[create_vm] Ошибка email: {e}")

            return {"status": "running", "vmid": server.proxmox_vmid}

    return _run_async(_create())


@celery_app.task(
    bind=True,
    name="tasks.vm_tasks.delete_vm_task",
    max_retries=3,
    default_retry_delay=15,
)
def delete_vm_task(self: Task, server_id: int) -> dict:
    """
    Задача удаления VM (soft-delete):
    1. Остановить VM в Proxmox
    2. Удалить VM
    3. Освободить IP
    4. Вернуть ресурсы ноде
    5. Пометить запись как deleted (soft-delete)
    """
    logger.info(f"[delete_vm] Удаление VM для server_id={server_id}")

    async def _delete():
        from app.models.ip_address import IPAddress
        from app.models.node import Node
        from app.models.plan import Plan
        from app.models.server import Server
        from app.services.proxmox import ProxmoxClient

        async with _session_factory() as db:
            result = await db.execute(select(Server).where(Server.id == server_id))
            server = result.scalar_one_or_none()
            if server is None:
                return {"error": "not_found"}

            try:
                if server.node_id and server.proxmox_vmid:
                    node_result = await db.execute(select(Node).where(Node.id == server.node_id))
                    node = node_result.scalar_one_or_none()
                    if node:
                        client = ProxmoxClient(node)
                        await client.delete_vm(node.name, server.proxmox_vmid)

                        # Возвращаем ресурсы
                        plan_result = await db.execute(select(Plan).where(Plan.id == server.plan_id))
                        plan = plan_result.scalar_one()
                        node.used_cpu = max(0, node.used_cpu - plan.cpu_cores)
                        node.used_ram_mb = max(0, node.used_ram_mb - plan.ram_mb)
                        node.used_disk_gb = max(0, node.used_disk_gb - plan.disk_gb)

                # Освобождаем IP
                if server.ip_id:
                    ip_result = await db.execute(select(IPAddress).where(IPAddress.id == server.ip_id))
                    ip = ip_result.scalar_one_or_none()
                    if ip:
                        ip.is_allocated = False

                # Soft-delete (не удаляем запись из БД)
                server.status = "deleted"
                await db.commit()

                _publish_status(server.user_id, server.id, "deleted")
                logger.info(f"[delete_vm] ✅ VM удалена: server_id={server_id}")
                return {"status": "deleted"}

            except Exception as exc:
                logger.error(f"[delete_vm] ❌ Ошибка: {exc}")
                server.status = "error"
                server.note = f"Delete failed: {str(exc)[:200]}"
                await db.commit()
                raise self.retry(exc=exc)

    return _run_async(_delete())


@celery_app.task(
    name="tasks.vm_tasks.vm_action_task",
    max_retries=2,
    default_retry_delay=10,
)
def vm_action_task(server_id: int, action: str) -> dict:
    """Действие над VM: start / stop / restart / suspend / unsuspend."""
    logger.info(f"[vm_action] server_id={server_id} action={action}")

    async def _action():
        from app.models.node import Node
        from app.models.server import Server
        from app.services.proxmox import ProxmoxClient

        async with _session_factory() as db:
            result = await db.execute(select(Server).where(Server.id == server_id))
            server = result.scalar_one_or_none()
            if not server or not server.node_id or not server.proxmox_vmid:
                return {"error": "invalid_server"}

            node_result = await db.execute(select(Node).where(Node.id == server.node_id))
            node = node_result.scalar_one()
            client = ProxmoxClient(node)

            action_map = {
                "start": client.start_vm,
                "stop": client.stop_vm,
                "restart": client.restart_vm,
                "suspend": client.stop_vm,
                "unsuspend": client.start_vm,
            }

            func = action_map.get(action)
            if func:
                await func(node.name, server.proxmox_vmid)

            status_map = {
                "start": "running",
                "stop": "stopped",
                "restart": "running",
                "suspend": "suspended",
                "unsuspend": "running",
            }
            server.status = status_map.get(action, server.status)
            await db.commit()

            _publish_status(server.user_id, server.id, server.status)
            logger.info(f"[vm_action] ✅ {action} выполнен для vmid={server.proxmox_vmid}")
            return {"status": server.status}

    return _run_async(_action())
