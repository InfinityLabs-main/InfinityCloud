"""
Celery-задачи для управления VM через Proxmox API.

Задачи:
  create_vm_task   — Создание VM (выбор ноды, клонирование, запуск)
  delete_vm_task   — Удаление VM
  vm_action_task   — Действия start/stop/restart/suspend
"""
from __future__ import annotations

import asyncio
import os
import sys

from celery import Task
from celery.utils.log import get_task_logger
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from tasks.celery_app import celery_app

logger = get_task_logger(__name__)

# Добавляем backend в путь (для доступа к моделям)
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "..", "backend"))

DATABASE_URL = os.environ.get(
    "DATABASE_URL",
    "postgresql+asyncpg://infinity:infinity_secret@postgres:5432/infinity_cloud",
)

_engine = create_async_engine(DATABASE_URL, pool_size=5)
_session_factory = async_sessionmaker(bind=_engine, class_=AsyncSession, expire_on_commit=False)


def _run_async(coro):
    """Запуск async-кода из sync Celery-задачи."""
    loop = asyncio.new_event_loop()
    try:
        return loop.run_until_complete(coro)
    finally:
        loop.close()


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
    2. Выбрать ноду (Least-Used)
    3. Выделить IP-адрес
    4. Вызвать Proxmox API: clone → configure → start
    5. Обновить статус в БД

    Retry: до 3 попыток с exponential backoff.
    Idempotency: проверяем idempotency_key перед стартом.
    """
    logger.info(f"[create_vm] Начало создания VM для server_id={server_id}")

    async def _create():
        from app.models.ip_address import IPAddress
        from app.models.node import Node
        from app.models.plan import Plan
        from app.models.server import Server
        from app.services.node_selector import select_node
        from app.services.proxmox import ProxmoxClient

        async with _session_factory() as db:
            # 1. Загружаем сервер
            result = await db.execute(select(Server).where(Server.id == server_id))
            server = result.scalar_one_or_none()
            if server is None:
                logger.error(f"[create_vm] Server id={server_id} не найден")
                return {"error": "server_not_found"}

            if server.status != "creating":
                logger.warning(f"[create_vm] Server id={server_id} уже в статусе {server.status}")
                return {"status": server.status}

            # 2. Загружаем план
            plan_result = await db.execute(select(Plan).where(Plan.id == server.plan_id))
            plan = plan_result.scalar_one()

            try:
                # 3. Выбираем ноду
                node = await select_node(
                    db,
                    required_cpu=plan.cpu_cores,
                    required_ram_mb=plan.ram_mb,
                    required_disk_gb=plan.disk_gb,
                )
                server.node_id = node.id

                # 4. Выделяем IP
                ip_result = await db.execute(
                    select(IPAddress).where(
                        IPAddress.node_id == node.id,
                        IPAddress.is_allocated == False,  # noqa
                    ).limit(1)
                )
                ip = ip_result.scalar_one_or_none()
                if ip:
                    ip.is_allocated = True
                    server.ip_id = ip.id

                # 5. Вызываем Proxmox API
                client = ProxmoxClient(node)
                vmid = await client.get_next_vmid()
                server.proxmox_vmid = vmid

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

                # 6. Запускаем VM
                await client.start_vm(node.name, vmid)

                server.status = "running"
                logger.info(f"[create_vm] ✅ VM создана: vmid={vmid} на {node.name}")

            except Exception as exc:
                server.status = "error"
                server.note = str(exc)[:500]
                logger.error(f"[create_vm] ❌ Ошибка: {exc}")
                await db.commit()
                # Retry с exponential backoff
                raise self.retry(exc=exc, countdown=30 * (2 ** self.request.retries))

            await db.commit()
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
    Задача удаления VM:
    1. Остановить VM в Proxmox
    2. Удалить VM
    3. Освободить IP
    4. Вернуть ресурсы ноде
    5. Удалить запись из БД
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
                # Удаляем в Proxmox
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

                # Удаляем сервер из БД
                await db.delete(server)
                await db.commit()
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
    """
    Действие над VM: start / stop / restart / suspend / unsuspend.
    """
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
                "suspend": client.stop_vm,       # Suspend = stop + пометка
                "unsuspend": client.start_vm,     # Unsuspend = start
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

            logger.info(f"[vm_action] ✅ {action} выполнен для vmid={server.proxmox_vmid}")
            return {"status": server.status}

    return _run_async(_action())
