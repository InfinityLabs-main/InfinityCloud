"""
Роутер VPS-серверов — CRUD и управление.

Эндпоинты:
  GET    /api/v1/servers              — Список серверов пользователя
  POST   /api/v1/servers              — Создать VPS
  GET    /api/v1/servers/{id}         — Детали VPS
  POST   /api/v1/servers/{id}/action  — Действие (start/stop/restart/suspend)
  PUT    /api/v1/servers/{id}/rdns    — Обновить rDNS
  DELETE /api/v1/servers/{id}         — Удалить VPS (soft)
"""
from __future__ import annotations

import uuid
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.deps import get_current_user
from app.exceptions import InsufficientFundsError
from app.models.os_template import OSTemplate
from app.models.plan import Plan
from app.models.server import Server
from app.models.user import User
from app.schemas.server import ServerAction, ServerCreate, ServerListOut, ServerOut, ServerRdns
from app.services.billing import charge_user

router = APIRouter()


def _server_to_out(server: Server) -> ServerOut:
    """Преобразует модель в схему ответа."""
    ip = server.ip_address.address if server.ip_address else None
    return ServerOut(
        id=server.id,
        user_id=server.user_id,
        plan_id=server.plan_id,
        node_id=server.node_id,
        proxmox_vmid=server.proxmox_vmid,
        hostname=server.hostname,
        os_template=server.os_template,
        status=server.status,
        rdns=server.rdns,
        ip_address=ip,
        created_at=server.created_at,
        updated_at=server.updated_at,
    )


@router.get("", response_model=ServerListOut)
async def list_servers(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Список VPS текущего пользователя."""
    result = await db.execute(
        select(Server)
        .where(Server.user_id == current_user.id, Server.status != "deleted")
        .order_by(Server.created_at.desc())
    )
    servers = result.scalars().all()
    return ServerListOut(
        items=[_server_to_out(s) for s in servers],
        total=len(servers),
    )


@router.post("", response_model=ServerOut, status_code=status.HTTP_201_CREATED)
async def create_server(
    body: ServerCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Создать новый VPS-сервер.
    Логика:
      1. Валидируем os_template по whitelist в БД
      2. Проверяем idempotency_key (IntegrityError fallback)
      3. Блокируем баланс (with_for_update) и списываем первый час
      4. Создаём запись Server со статусом "creating"
      5. Отправляем задачу create_vm в Celery
    """
    # 1. Валидация os_template по whitelist из БД
    tpl_result = await db.execute(
        select(OSTemplate).where(OSTemplate.slug == body.os_template, OSTemplate.is_active == True)  # noqa
    )
    if tpl_result.scalar_one_or_none() is None:
        raise HTTPException(status_code=400, detail=f"Шаблон ОС '{body.os_template}' недоступен")

    # 2. Idempotency check
    idem_key = body.idempotency_key or str(uuid.uuid4())

    # 3. Проверяем план
    plan_result = await db.execute(select(Plan).where(Plan.id == body.plan_id, Plan.is_active == True))  # noqa
    plan = plan_result.scalar_one_or_none()
    if plan is None:
        raise HTTPException(status_code=404, detail="Тариф не найден")

    # 4. Блокируем баланс пользователя (with_for_update) и списываем первый час
    user_result = await db.execute(
        select(User).where(User.id == current_user.id).with_for_update()
    )
    user = user_result.scalar_one()

    if user.balance < plan.price_per_hour:
        raise InsufficientFundsError()

    # Списываем первый час сразу
    tx = await charge_user(
        db=db,
        user_id=user.id,
        amount=plan.price_per_hour,
        description=f"Первый час: {plan.name}",
    )
    if tx is None:
        raise InsufficientFundsError()

    # 5. Создаём запись (IntegrityError при дубле idempotency_key)
    server = Server(
        user_id=user.id,
        plan_id=plan.id,
        hostname=body.hostname,
        os_template=body.os_template,
        status="creating",
        idempotency_key=idem_key,
    )
    db.add(server)
    try:
        await db.flush()
    except IntegrityError:
        await db.rollback()
        raise HTTPException(status_code=409, detail="Сервер с таким idempotency_key уже создаётся")

    await db.refresh(server)

    # Привязываем transaction к серверу
    tx.server_id = server.id
    await db.flush()

    # 6. Отправляем задачу в Celery
    from tasks.vm_tasks import create_vm_task
    create_vm_task.delay(server.id)

    return _server_to_out(server)


@router.get("/{server_id}", response_model=ServerOut)
async def get_server(
    server_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Получить детали VPS."""
    result = await db.execute(
        select(Server).where(Server.id == server_id, Server.user_id == current_user.id)
    )
    server = result.scalar_one_or_none()
    if server is None:
        raise HTTPException(status_code=404, detail="Сервер не найден")
    return _server_to_out(server)


@router.post("/{server_id}/action", response_model=ServerOut)
async def server_action(
    server_id: int,
    body: ServerAction,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Выполнить действие над VPS: start|stop|restart|suspend|unsuspend"""
    result = await db.execute(
        select(Server).where(Server.id == server_id, Server.user_id == current_user.id)
    )
    server = result.scalar_one_or_none()
    if server is None:
        raise HTTPException(status_code=404, detail="Сервер не найден")

    if server.status == "creating":
        raise HTTPException(status_code=400, detail="Сервер ещё создаётся")

    # Отправляем задачу на выполнение действия
    from tasks.vm_tasks import vm_action_task
    vm_action_task.delay(server.id, body.action)

    # Обновляем статус оптимистично
    action_status_map = {
        "start": "running",
        "stop": "stopped",
        "restart": "running",
        "suspend": "suspended",
        "unsuspend": "running",
    }
    server.status = action_status_map.get(body.action, server.status)
    await db.flush()
    await db.refresh(server)

    return _server_to_out(server)


@router.put("/{server_id}/rdns", response_model=ServerOut)
async def update_rdns(
    server_id: int,
    body: ServerRdns,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Обновить rDNS записи VPS."""
    result = await db.execute(
        select(Server).where(Server.id == server_id, Server.user_id == current_user.id)
    )
    server = result.scalar_one_or_none()
    if server is None:
        raise HTTPException(status_code=404, detail="Сервер не найден")

    server.rdns = body.rdns
    if server.ip_address:
        server.ip_address.rdns = body.rdns

    await db.flush()
    await db.refresh(server)
    return _server_to_out(server)


@router.delete("/{server_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_server(
    server_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Удалить VPS (soft-delete)."""
    result = await db.execute(
        select(Server).where(Server.id == server_id, Server.user_id == current_user.id)
    )
    server = result.scalar_one_or_none()
    if server is None:
        raise HTTPException(status_code=404, detail="Сервер не найден")

    server.status = "deleting"
    await db.flush()

    from tasks.vm_tasks import delete_vm_task
    delete_vm_task.delay(server.id)
