"""
Роутер админ-панели — CRUD тарифов, нод, серверов, пользователей.
Все эндпоинты защищены: требуется role=admin.

Эндпоинты:
  # Тарифы
  POST   /api/admin/plans          — Создать тариф
  PUT    /api/admin/plans/{id}     — Обновить тариф
  DELETE /api/admin/plans/{id}     — Удалить тариф

  # Ноды
  GET    /api/admin/nodes          — Список нод
  POST   /api/admin/nodes          — Добавить ноду
  PUT    /api/admin/nodes/{id}     — Обновить ноду
  DELETE /api/admin/nodes/{id}     — Удалить ноду
  POST   /api/admin/nodes/test     — Проверить подключение к Proxmox

  # Серверы
  GET    /api/admin/servers        — Все VPS
  POST   /api/admin/servers/{id}/action — Управление любым VPS
  DELETE /api/admin/servers/{id}   — Удалить VPS

  # Пользователи
  GET    /api/admin/users          — Список пользователей
  POST   /api/admin/users/{id}/deposit — Пополнить баланс юзеру
  PUT    /api/admin/users/{id}/toggle  — Заблокировать/разблокировать
  PUT    /api/admin/users/{id}/role    — Сменить роль
  POST   /api/admin/users/{id}/reset-password — Сброс пароля

  # Статистика
  GET    /api/admin/stats          — Дашборд-статистика

  # Транзакции
  GET    /api/admin/transactions   — Все транзакции

  # Логи
  GET    /api/admin/logs           — Лог активности
"""
from __future__ import annotations

import httpx
from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from sqlalchemy import case, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from sqlalchemy.orm import selectinload

from app.database import get_db
from app.deps import get_current_admin
from app.models.activity_log import ActivityLog
from app.models.node import Node
from app.models.plan import Plan
from app.models.server import Server
from app.models.ticket import Ticket, TicketAttachment, TicketMessage
from app.models.transaction import Transaction
from app.models.user import User
from app.schemas.node import NodeCreate, NodeOut, NodeUpdate
from app.schemas.plan import PlanCreate, PlanOut, PlanUpdate
from app.schemas.server import ServerAction, ServerOut
from app.schemas.ticket import (
    CompensationRequest,
    MessageCreate,
    TicketDetailOut,
    TicketListOut,
    TicketOut,
    TicketStatusUpdate,
    TicketVpsAction,
)
from app.schemas.transaction import TransactionListOut, TransactionOut
from app.schemas.user import BalanceDeposit, UserOut
from app.services.auth import hash_password
from app.services.billing import deposit_user as billing_deposit_user
from app.services.billing import deposit_user

router = APIRouter()


# ── Дополнительные схемы ──────────────────────────────

class NodeTestRequest(BaseModel):
    hostname: str
    port: int = 8006
    api_user: str
    api_token_name: str
    api_token_value: str


class UserToggle(BaseModel):
    is_active: bool


class UserRole(BaseModel):
    role: str = Field(pattern="^(user|admin)$")


class UserResetPassword(BaseModel):
    new_password: str = Field(min_length=6, max_length=128)


# ═══════════════════════════════════════════════════════
#  ТАРИФЫ
# ═══════════════════════════════════════════════════════

@router.post("/plans", response_model=PlanOut, status_code=status.HTTP_201_CREATED)
async def create_plan(
    body: PlanCreate,
    admin: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    """Создать новый тариф."""
    plan = Plan(**body.model_dump())
    db.add(plan)
    await db.flush()
    await db.refresh(plan)
    return plan


@router.put("/plans/{plan_id}", response_model=PlanOut)
async def update_plan(
    plan_id: int,
    body: PlanUpdate,
    admin: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    """Обновить тариф."""
    result = await db.execute(select(Plan).where(Plan.id == plan_id))
    plan = result.scalar_one_or_none()
    if plan is None:
        raise HTTPException(status_code=404, detail="Тариф не найден")

    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(plan, field, value)

    await db.flush()
    await db.refresh(plan)
    return plan


@router.delete("/plans/{plan_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_plan(
    plan_id: int,
    admin: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    """Удалить тариф (soft — is_active=False)."""
    result = await db.execute(select(Plan).where(Plan.id == plan_id))
    plan = result.scalar_one_or_none()
    if plan is None:
        raise HTTPException(status_code=404, detail="Тариф не найден")
    plan.is_active = False
    await db.flush()


# ═══════════════════════════════════════════════════════
#  НОДЫ
# ═══════════════════════════════════════════════════════

@router.get("/nodes", response_model=list[NodeOut])
async def list_nodes(
    admin: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    """Список всех нод."""
    result = await db.execute(select(Node).order_by(Node.id))
    return result.scalars().all()


@router.post("/nodes", response_model=NodeOut, status_code=status.HTTP_201_CREATED)
async def create_node(
    body: NodeCreate,
    admin: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    """Добавить новую ноду."""
    node = Node(**body.model_dump())
    db.add(node)
    await db.flush()
    await db.refresh(node)
    return node


@router.put("/nodes/{node_id}", response_model=NodeOut)
async def update_node(
    node_id: int,
    body: NodeUpdate,
    admin: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    """Обновить ноду."""
    result = await db.execute(select(Node).where(Node.id == node_id))
    node = result.scalar_one_or_none()
    if node is None:
        raise HTTPException(status_code=404, detail="Нода не найдена")

    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(node, field, value)

    await db.flush()
    await db.refresh(node)
    return node


@router.delete("/nodes/{node_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_node(
    node_id: int,
    admin: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    """Удалить ноду (soft)."""
    result = await db.execute(select(Node).where(Node.id == node_id))
    node = result.scalar_one_or_none()
    if node is None:
        raise HTTPException(status_code=404, detail="Нода не найдена")
    node.is_active = False
    await db.flush()


# ── Проверка подключения к Proxmox ────────────────────

@router.post("/nodes/test")
async def test_node_connection(
    body: NodeTestRequest,
    admin: User = Depends(get_current_admin),
):
    """Проверить подключение к Proxmox-ноде по токену."""
    base_url = f"https://{body.hostname}:{body.port}/api2/json"
    headers = {
        "Authorization": f"PVEAPIToken={body.api_user}!{body.api_token_name}={body.api_token_value}"
    }
    try:
        async with httpx.AsyncClient(verify=False, timeout=10) as client:
            resp = await client.get(f"{base_url}/version", headers=headers)
        if resp.status_code == 200:
            data = resp.json().get("data", {})
            return {
                "success": True,
                "version": data.get("version", "unknown"),
                "release": data.get("release", "unknown"),
            }
        else:
            return {"success": False, "error": f"HTTP {resp.status_code}: {resp.text[:200]}"}
    except httpx.ConnectError:
        return {"success": False, "error": "Не удалось подключиться. Проверьте hostname и порт."}
    except httpx.TimeoutException:
        return {"success": False, "error": "Таймаут подключения (10с). Проверьте доступность сервера."}
    except Exception as e:
        return {"success": False, "error": str(e)[:300]}


# ═══════════════════════════════════════════════════════
#  СЕРВЕРЫ (все)
# ═══════════════════════════════════════════════════════

@router.get("/servers", response_model=list[ServerOut])
async def list_all_servers(
    page: int = Query(1, ge=1),
    per_page: int = Query(50, ge=1, le=200),
    admin: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    """Список всех серверов (для админа)."""
    offset = (page - 1) * per_page
    result = await db.execute(
        select(Server).order_by(Server.created_at.desc()).offset(offset).limit(per_page)
    )
    servers = result.scalars().all()
    out = []
    for s in servers:
        ip = s.ip_address.address if s.ip_address else None
        out.append(ServerOut(
            id=s.id, user_id=s.user_id, plan_id=s.plan_id, node_id=s.node_id,
            proxmox_vmid=s.proxmox_vmid, hostname=s.hostname, os_template=s.os_template,
            status=s.status, rdns=s.rdns, ip_address=ip,
            created_at=s.created_at, updated_at=s.updated_at,
        ))
    return out


@router.post("/servers/{server_id}/action", response_model=ServerOut)
async def admin_server_action(
    server_id: int,
    body: ServerAction,
    admin: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    """Управление любым VPS (admin)."""
    result = await db.execute(select(Server).where(Server.id == server_id))
    server = result.scalar_one_or_none()
    if server is None:
        raise HTTPException(status_code=404, detail="Сервер не найден")

    from tasks.vm_tasks import vm_action_task
    vm_action_task.delay(server.id, body.action)

    action_status_map = {
        "start": "running", "stop": "stopped", "restart": "running",
        "suspend": "suspended", "unsuspend": "running",
    }
    server.status = action_status_map.get(body.action, server.status)
    await db.flush()
    await db.refresh(server)

    ip = server.ip_address.address if server.ip_address else None
    return ServerOut(
        id=server.id, user_id=server.user_id, plan_id=server.plan_id, node_id=server.node_id,
        proxmox_vmid=server.proxmox_vmid, hostname=server.hostname, os_template=server.os_template,
        status=server.status, rdns=server.rdns, ip_address=ip,
        created_at=server.created_at, updated_at=server.updated_at,
    )


@router.delete("/servers/{server_id}", status_code=status.HTTP_204_NO_CONTENT)
async def admin_delete_server(
    server_id: int,
    admin: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    """Удалить VPS (admin)."""
    result = await db.execute(select(Server).where(Server.id == server_id))
    server = result.scalar_one_or_none()
    if server is None:
        raise HTTPException(status_code=404, detail="Сервер не найден")

    # Отправляем задачу на уничтожение VM в Proxmox
    try:
        from tasks.vm_tasks import vm_action_task
        vm_action_task.delay(server.id, "destroy")
    except Exception:
        pass  # Если Celery недоступен — удаляем только из БД

    server.status = "deleted"
    await db.flush()


# ═══════════════════════════════════════════════════════
#  ПОЛЬЗОВАТЕЛИ
# ═══════════════════════════════════════════════════════

@router.get("/users", response_model=list[UserOut])
async def list_users(
    page: int = Query(1, ge=1),
    per_page: int = Query(50, ge=1, le=200),
    admin: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    """Список всех пользователей."""
    offset = (page - 1) * per_page
    result = await db.execute(select(User).order_by(User.id).offset(offset).limit(per_page))
    return result.scalars().all()


@router.post("/users/{user_id}/deposit", response_model=TransactionOut)
async def admin_deposit(
    user_id: int,
    body: BalanceDeposit,
    admin: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    """Пополнить баланс любому пользователю."""
    result = await db.execute(select(User).where(User.id == user_id))
    if result.scalar_one_or_none() is None:
        raise HTTPException(status_code=404, detail="Пользователь не найден")

    tx = await deposit_user(db, user_id, body.amount, description=f"Пополнение администратором")
    await db.commit()
    await db.refresh(tx)
    return tx


@router.put("/users/{user_id}/toggle", response_model=UserOut)
async def toggle_user(
    user_id: int,
    body: UserToggle,
    admin: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    """Заблокировать/разблокировать пользователя."""
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if user is None:
        raise HTTPException(status_code=404, detail="Пользователь не найден")
    if user.id == admin.id:
        raise HTTPException(status_code=400, detail="Нельзя заблокировать самого себя")
    user.is_active = body.is_active
    await db.flush()
    await db.refresh(user)
    return user


@router.put("/users/{user_id}/role", response_model=UserOut)
async def set_user_role(
    user_id: int,
    body: UserRole,
    admin: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    """Сменить роль пользователя."""
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if user is None:
        raise HTTPException(status_code=404, detail="Пользователь не найден")
    if user.id == admin.id:
        raise HTTPException(status_code=400, detail="Нельзя сменить роль самому себе")
    user.role = body.role
    await db.flush()
    await db.refresh(user)
    return user


@router.post("/users/{user_id}/reset-password")
async def reset_user_password(
    user_id: int,
    body: UserResetPassword,
    admin: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    """Сбросить пароль пользователю."""
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if user is None:
        raise HTTPException(status_code=404, detail="Пользователь не найден")
    user.hashed_password = hash_password(body.new_password)
    await db.flush()
    return {"detail": "Пароль успешно изменён"}


# ═══════════════════════════════════════════════════════
#  СТАТИСТИКА (дашборд)
# ═══════════════════════════════════════════════════════

@router.get("/stats")
async def admin_stats(
    admin: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    """Агрегированная статистика для дашборда."""
    # Количества
    total_users = (await db.execute(select(func.count()).select_from(User))).scalar() or 0
    total_servers = (await db.execute(select(func.count()).select_from(Server))).scalar() or 0
    total_nodes = (await db.execute(select(func.count()).select_from(Node))).scalar() or 0
    active_servers = (await db.execute(
        select(func.count()).select_from(Server).where(Server.status == "running")
    )).scalar() or 0

    # Общий доход (сумма deposit-транзакций)
    total_revenue = (await db.execute(
        select(func.coalesce(func.sum(Transaction.amount), 0))
        .where(Transaction.type == "deposit")
    )).scalar() or 0

    # Статусы серверов для диаграммы
    server_status_q = await db.execute(
        select(Server.status, func.count()).group_by(Server.status)
    )
    server_statuses = {row[0]: row[1] for row in server_status_q.all()}

    # Загрузка нод
    nodes_result = await db.execute(select(Node).where(Node.is_active == True).order_by(Node.id))
    nodes = nodes_result.scalars().all()
    nodes_load = [
        {
            "id": n.id,
            "name": n.name,
            "cpu_usage": round(n.used_cpu / n.total_cpu * 100, 1) if n.total_cpu else 0,
            "ram_usage": round(n.used_ram_mb / n.total_ram_mb * 100, 1) if n.total_ram_mb else 0,
            "disk_usage": round(n.used_disk_gb / n.total_disk_gb * 100, 1) if n.total_disk_gb else 0,
        }
        for n in nodes
    ]

    # Последние 10 действий
    recent_logs_q = await db.execute(
        select(ActivityLog).order_by(ActivityLog.created_at.desc()).limit(10)
    )
    recent_logs = [
        {
            "id": log.id,
            "user_id": log.user_id,
            "action": log.action,
            "target_type": log.target_type,
            "target_id": log.target_id,
            "details": log.details,
            "created_at": log.created_at.isoformat(),
        }
        for log in recent_logs_q.scalars().all()
    ]

    return {
        "total_users": total_users,
        "total_servers": total_servers,
        "active_servers": active_servers,
        "total_nodes": total_nodes,
        "total_revenue": float(total_revenue),
        "server_statuses": server_statuses,
        "nodes_load": nodes_load,
        "recent_logs": recent_logs,
    }


# ═══════════════════════════════════════════════════════
#  ТРАНЗАКЦИИ (все)
# ═══════════════════════════════════════════════════════

@router.get("/transactions", response_model=TransactionListOut)
async def list_all_transactions(
    page: int = Query(1, ge=1),
    per_page: int = Query(50, ge=1, le=200),
    admin: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    """Все транзакции."""
    offset = (page - 1) * per_page
    count_q = select(func.count()).select_from(Transaction)
    total = (await db.execute(count_q)).scalar() or 0

    result = await db.execute(
        select(Transaction).order_by(Transaction.created_at.desc()).offset(offset).limit(per_page)
    )
    return TransactionListOut(items=result.scalars().all(), total=total)


# ═══════════════════════════════════════════════════════
#  ЛОГИ АКТИВНОСТИ
# ═══════════════════════════════════════════════════════

@router.get("/logs")
async def list_logs(
    page: int = Query(1, ge=1),
    per_page: int = Query(100, ge=1, le=500),
    admin: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    """Журнал действий."""
    offset = (page - 1) * per_page
    result = await db.execute(
        select(ActivityLog).order_by(ActivityLog.created_at.desc()).offset(offset).limit(per_page)
    )
    logs = result.scalars().all()
    return [
        {
            "id": log.id,
            "user_id": log.user_id,
            "action": log.action,
            "target_type": log.target_type,
            "target_id": log.target_id,
            "details": log.details,
            "ip_address": log.ip_address,
            "created_at": log.created_at.isoformat(),
        }
        for log in logs
    ]


# ═══════════════════════════════════════════════════════
#  ТИКЕТЫ (админ)
# ═══════════════════════════════════════════════════════

def _admin_ticket_to_out(ticket: Ticket) -> TicketOut:
    msgs = ticket.messages or []
    last_msg = msgs[-1] if msgs else None
    ip = None
    hostname = None
    server_status = None
    if ticket.server:
        hostname = ticket.server.hostname
        server_status = ticket.server.status
        ip = ticket.server.ip_address.address if ticket.server.ip_address else None
    return TicketOut(
        id=ticket.id,
        user_id=ticket.user_id,
        server_id=ticket.server_id,
        subject=ticket.subject,
        priority=ticket.priority,
        category=ticket.category,
        status=ticket.status,
        is_read_by_admin=ticket.is_read_by_admin,
        is_read_by_user=ticket.is_read_by_user,
        closed_at=ticket.closed_at,
        created_at=ticket.created_at,
        updated_at=ticket.updated_at,
        user_email=ticket.user.email if ticket.user else None,
        server_hostname=hostname,
        server_ip=ip,
        server_status=server_status,
        message_count=len(msgs),
        last_message_at=last_msg.created_at if last_msg else None,
    )


@router.get("/tickets", response_model=TicketListOut)
async def admin_list_tickets(
    page: int = Query(1, ge=1),
    per_page: int = Query(30, ge=1, le=100),
    status_filter: str | None = Query(None, alias="status"),
    priority: str | None = Query(None),
    category: str | None = Query(None),
    user_id: int | None = Query(None),
    admin: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    """Список всех тикетов с фильтрами."""
    query = select(Ticket)
    if status_filter:
        query = query.where(Ticket.status == status_filter)
    if priority:
        query = query.where(Ticket.priority == priority)
    if category:
        query = query.where(Ticket.category == category)
    if user_id:
        query = query.where(Ticket.user_id == user_id)

    count_q = select(func.count()).select_from(query.subquery())
    total = (await db.execute(count_q)).scalar() or 0

    offset = (page - 1) * per_page
    result = await db.execute(
        query
        .options(selectinload(Ticket.messages).selectinload(TicketMessage.attachments))
        .options(selectinload(Ticket.user))
        .order_by(Ticket.updated_at.desc())
        .offset(offset)
        .limit(per_page)
    )
    tickets = result.scalars().all()
    return TicketListOut(items=[_admin_ticket_to_out(t) for t in tickets], total=total)


@router.get("/tickets/{ticket_id}", response_model=TicketDetailOut)
async def admin_get_ticket(
    ticket_id: int,
    admin: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    """Получить тикет со всеми сообщениями (админ)."""
    result = await db.execute(
        select(Ticket)
        .options(selectinload(Ticket.messages).selectinload(TicketMessage.sender))
        .options(selectinload(Ticket.messages).selectinload(TicketMessage.attachments))
        .options(selectinload(Ticket.user))
        .where(Ticket.id == ticket_id)
    )
    ticket = result.scalar_one_or_none()
    if ticket is None:
        raise HTTPException(status_code=404, detail="Тикет не найден")

    # Помечаем как прочитанное админом
    ticket.is_read_by_admin = True
    for msg in ticket.messages:
        if msg.sender_role == "user":
            msg.is_read = True
    await db.flush()

    ip = None
    hostname = None
    server_status = None
    if ticket.server:
        hostname = ticket.server.hostname
        server_status = ticket.server.status
        ip = ticket.server.ip_address.address if ticket.server.ip_address else None

    from app.schemas.ticket import MessageOut
    return TicketDetailOut(
        id=ticket.id,
        user_id=ticket.user_id,
        server_id=ticket.server_id,
        subject=ticket.subject,
        priority=ticket.priority,
        category=ticket.category,
        status=ticket.status,
        is_read_by_admin=ticket.is_read_by_admin,
        is_read_by_user=ticket.is_read_by_user,
        closed_at=ticket.closed_at,
        created_at=ticket.created_at,
        updated_at=ticket.updated_at,
        user_email=ticket.user.email if ticket.user else None,
        server_hostname=hostname,
        server_ip=ip,
        server_status=server_status,
        messages=[
            MessageOut(
                id=m.id,
                ticket_id=m.ticket_id,
                sender_id=m.sender_id,
                sender_role=m.sender_role,
                sender_email=m.sender.email if m.sender else None,
                body=m.body,
                is_read=m.is_read,
                attachments=[
                    {
                        "id": a.id,
                        "filename": a.filename,
                        "original_filename": a.original_filename,
                        "content_type": a.content_type,
                        "size_bytes": a.size_bytes,
                        "created_at": a.created_at,
                    }
                    for a in (m.attachments or [])
                ],
                created_at=m.created_at,
            )
            for m in ticket.messages
        ],
    )


@router.post("/tickets/{ticket_id}/reply")
async def admin_reply_ticket(
    ticket_id: int,
    body: MessageCreate,
    admin: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    """Ответить в тикет (от админа)."""
    result = await db.execute(select(Ticket).where(Ticket.id == ticket_id))
    ticket = result.scalar_one_or_none()
    if ticket is None:
        raise HTTPException(status_code=404, detail="Тикет не найден")
    if ticket.status == "closed":
        raise HTTPException(status_code=400, detail="Тикет закрыт")

    msg = TicketMessage(
        ticket_id=ticket.id,
        sender_id=admin.id,
        sender_role="admin",
        body=body.body,
        is_read=False,
    )
    db.add(msg)

    ticket.is_read_by_user = False
    ticket.is_read_by_admin = True
    ticket.status = "awaiting_user"
    await db.flush()
    await db.refresh(msg)

    # WS notify
    try:
        import json
        import redis.asyncio as aioredis
        from app.config import settings as cfg
        r = aioredis.from_url(cfg.REDIS_URL, decode_responses=True)
        await r.publish("ticket_updates", json.dumps({
            "event": "new_message",
            "ticket_id": ticket.id,
            "user_id": ticket.user_id,
            "message_id": msg.id,
            "sender_role": "admin",
        }))
        await r.close()
    except Exception:
        pass

    return {"detail": "Ответ отправлен", "message_id": msg.id}


@router.patch("/tickets/{ticket_id}/status")
async def admin_update_ticket_status(
    ticket_id: int,
    body: TicketStatusUpdate,
    admin: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    """Сменить статус тикета."""
    result = await db.execute(select(Ticket).where(Ticket.id == ticket_id))
    ticket = result.scalar_one_or_none()
    if ticket is None:
        raise HTTPException(status_code=404, detail="Тикет не найден")

    from datetime import datetime as dt, timezone as tz
    ticket.status = body.status
    if body.status == "closed":
        ticket.closed_at = dt.now(tz.utc)
    await db.flush()

    # WS notify
    try:
        import json
        import redis.asyncio as aioredis
        from app.config import settings as cfg
        r = aioredis.from_url(cfg.REDIS_URL, decode_responses=True)
        await r.publish("ticket_updates", json.dumps({
            "event": "status_changed",
            "ticket_id": ticket.id,
            "user_id": ticket.user_id,
            "status": body.status,
        }))
        await r.close()
    except Exception:
        pass

    return {"detail": f"Статус изменён на '{body.status}'"}


@router.delete("/tickets/{ticket_id}", status_code=status.HTTP_204_NO_CONTENT)
async def admin_delete_ticket(
    ticket_id: int,
    admin: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    """Удалить тикет."""
    result = await db.execute(select(Ticket).where(Ticket.id == ticket_id))
    ticket = result.scalar_one_or_none()
    if ticket is None:
        raise HTTPException(status_code=404, detail="Тикет не найден")
    await db.delete(ticket)
    await db.flush()


@router.post("/tickets/{ticket_id}/compensate")
async def admin_compensate(
    ticket_id: int,
    body: CompensationRequest,
    admin: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    """Начислить компенсацию пользователю из тикета."""
    result = await db.execute(
        select(Ticket).options(selectinload(Ticket.user)).where(Ticket.id == ticket_id)
    )
    ticket = result.scalar_one_or_none()
    if ticket is None:
        raise HTTPException(status_code=404, detail="Тикет не найден")

    tx = await billing_deposit_user(
        db, ticket.user_id, body.amount,
        description=f"Компенсация по тикету #{ticket_id}: {body.reason}",
    )
    await db.flush()

    # Добавляем системное сообщение
    sys_msg = TicketMessage(
        ticket_id=ticket.id,
        sender_id=admin.id,
        sender_role="admin",
        body=f"💰 Начислена компенсация: {body.amount:.2f} ₽ — {body.reason}",
        is_read=False,
    )
    db.add(sys_msg)
    ticket.is_read_by_user = False
    await db.flush()

    return {"detail": f"Компенсация {body.amount:.2f} ₽ начислена", "new_balance": float(tx.balance_after)}


@router.post("/tickets/{ticket_id}/vps-action")
async def admin_ticket_vps_action(
    ticket_id: int,
    body: TicketVpsAction,
    admin: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    """Быстрое действие над VPS из тикета."""
    result = await db.execute(select(Ticket).where(Ticket.id == ticket_id))
    ticket = result.scalar_one_or_none()
    if ticket is None:
        raise HTTPException(status_code=404, detail="Тикет не найден")
    if ticket.server_id is None:
        raise HTTPException(status_code=400, detail="Тикет не привязан к серверу")

    srv_result = await db.execute(select(Server).where(Server.id == ticket.server_id))
    server = srv_result.scalar_one_or_none()
    if server is None:
        raise HTTPException(status_code=404, detail="Сервер не найден")

    from tasks.vm_tasks import vm_action_task
    vm_action_task.delay(server.id, body.action)

    action_status_map = {
        "start": "running", "stop": "stopped", "restart": "running",
        "suspend": "suspended", "unsuspend": "running",
    }
    if body.action in action_status_map:
        server.status = action_status_map[body.action]
    await db.flush()

    # Системное сообщение
    action_labels = {
        "start": "▶️ Запуск", "stop": "⏹ Остановка", "restart": "🔄 Перезагрузка",
        "suspend": "⏸ Приостановка", "unsuspend": "▶️ Возобновление", "reinstall": "🔧 Переустановка",
    }
    sys_msg = TicketMessage(
        ticket_id=ticket.id,
        sender_id=admin.id,
        sender_role="admin",
        body=f"🖥️ Выполнено действие над VPS #{server.id}: {action_labels.get(body.action, body.action)}",
        is_read=False,
    )
    db.add(sys_msg)
    ticket.is_read_by_user = False
    await db.flush()

    return {"detail": f"Действие '{body.action}' выполнено для VPS #{server.id}"}


@router.get("/tickets/{ticket_id}/user-info")
async def admin_get_ticket_user_info(
    ticket_id: int,
    admin: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    """Получить подробную информацию о пользователе тикета."""
    result = await db.execute(
        select(Ticket).options(selectinload(Ticket.user)).where(Ticket.id == ticket_id)
    )
    ticket = result.scalar_one_or_none()
    if ticket is None:
        raise HTTPException(status_code=404, detail="Тикет не найден")

    user = ticket.user

    # VPS пользователя
    servers_q = await db.execute(
        select(Server).where(Server.user_id == user.id, Server.status != "deleted")
        .order_by(Server.created_at.desc())
    )
    servers = servers_q.scalars().all()

    # Последние транзакции
    tx_q = await db.execute(
        select(Transaction).where(Transaction.user_id == user.id)
        .order_by(Transaction.created_at.desc()).limit(10)
    )
    transactions = tx_q.scalars().all()

    return {
        "user": {
            "id": user.id,
            "email": user.email,
            "role": user.role,
            "balance": float(user.balance),
            "is_active": user.is_active,
            "created_at": user.created_at.isoformat(),
        },
        "servers": [
            {
                "id": s.id,
                "hostname": s.hostname,
                "status": s.status,
                "os_template": s.os_template,
                "ip_address": s.ip_address.address if s.ip_address else None,
                "plan_id": s.plan_id,
                "created_at": s.created_at.isoformat(),
            }
            for s in servers
        ],
        "recent_transactions": [
            {
                "id": t.id,
                "type": t.type,
                "amount": float(t.amount),
                "description": t.description,
                "created_at": t.created_at.isoformat(),
            }
            for t in transactions
        ],
    }
