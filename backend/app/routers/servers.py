"""
Роутер VPS-серверов — CRUD и управление.

Эндпоинты:
  GET    /api/servers              — Список серверов пользователя
  POST   /api/servers              — Создать VPS
  GET    /api/servers/{id}         — Детали VPS
  POST   /api/servers/{id}/action  — Действие (start/stop/restart/suspend)
  PUT    /api/servers/{id}/rdns    — Обновить rDNS
  DELETE /api/servers/{id}         — Удалить VPS
"""
from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.deps import get_current_user
from app.exceptions import InsufficientFundsError
from app.models.plan import Plan
from app.models.server import Server
from app.models.user import User
from app.schemas.server import ServerAction, ServerCreate, ServerListOut, ServerOut, ServerRdns

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
        select(Server).where(Server.user_id == current_user.id).order_by(Server.created_at.desc())
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

    Request body:
        {
            "plan_id": 1,
            "hostname": "my-server",
            "os_template": "ubuntu-22.04",
            "idempotency_key": "optional-unique-key"
        }

    Логика:
      1. Проверяем idempotency_key (защита от дублей)
      2. Проверяем баланс (>= plan.price_per_hour)
      3. Создаём запись Server со статусом "creating"
      4. Отправляем задачу create_vm в Celery
    """
    # Idempotency check
    idem_key = body.idempotency_key or str(uuid.uuid4())
    existing = await db.execute(select(Server).where(Server.idempotency_key == idem_key))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Сервер с таким idempotency_key уже создаётся")

    # Проверяем план
    plan_result = await db.execute(select(Plan).where(Plan.id == body.plan_id, Plan.is_active == True))  # noqa
    plan = plan_result.scalar_one_or_none()
    if plan is None:
        raise HTTPException(status_code=404, detail="Тариф не найден")

    # Проверяем баланс
    if current_user.balance < plan.price_per_hour:
        raise InsufficientFundsError()

    # Создаём запись
    server = Server(
        user_id=current_user.id,
        plan_id=plan.id,
        hostname=body.hostname,
        os_template=body.os_template,
        status="creating",
        idempotency_key=idem_key,
    )
    db.add(server)
    await db.flush()
    await db.refresh(server)

    # Отправляем задачу в Celery (импорт внутри, чтобы избежать circular import)
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
    """
    Выполнить действие над VPS.

    Request body: {"action": "start"}  — start|stop|restart|suspend|unsuspend
    """
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
    """Удалить VPS."""
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
