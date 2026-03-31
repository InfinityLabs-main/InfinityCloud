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

  # Серверы
  GET    /api/admin/servers        — Все VPS
  POST   /api/admin/servers/{id}/action — Управление любым VPS

  # Пользователи
  GET    /api/admin/users          — Список пользователей
  POST   /api/admin/users/{id}/deposit — Пополнить баланс юзеру

  # Транзакции
  GET    /api/admin/transactions   — Все транзакции

  # Логи
  GET    /api/admin/logs           — Лог активности
"""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.deps import get_current_admin
from app.models.activity_log import ActivityLog
from app.models.node import Node
from app.models.plan import Plan
from app.models.server import Server
from app.models.transaction import Transaction
from app.models.user import User
from app.schemas.node import NodeCreate, NodeOut, NodeUpdate
from app.schemas.plan import PlanCreate, PlanOut, PlanUpdate
from app.schemas.server import ServerAction, ServerOut
from app.schemas.transaction import TransactionListOut, TransactionOut
from app.schemas.user import BalanceDeposit, UserOut
from app.services.billing import deposit_user

router = APIRouter()


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
