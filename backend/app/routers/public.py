"""
Публичные эндпоинты — без авторизации.

  GET /api/v1/public/plans         — Список активных тарифов
  GET /api/v1/public/nodes/status  — Статус нод (пинг, онлайн)
"""
from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.node import Node
from app.models.plan import Plan
from app.schemas.node import NodePublicStatus
from app.schemas.plan import PlanOut

router = APIRouter()


@router.get("/plans", response_model=list[PlanOut])
async def public_plans(db: AsyncSession = Depends(get_db)):
    """Список активных тарифных планов (публичный, без авторизации)."""
    result = await db.execute(
        select(Plan)
        .where(Plan.is_active == True)  # noqa: E712
        .order_by(Plan.sort_order, Plan.price_per_month)
    )
    return result.scalars().all()


@router.get("/nodes/status", response_model=list[NodePublicStatus])
async def get_nodes_status(db: AsyncSession = Depends(get_db)):
    """Публичный статус дата-центров с данными пинга."""
    result = await db.execute(
        select(Node).where(Node.is_active == True).order_by(Node.id)  # noqa: E712
    )
    nodes = result.scalars().all()
    return [
        NodePublicStatus(
            id=n.id,
            name=n.name,
            location=n.location,
            country=n.country,
            country_code=n.country_code,
            is_online=n.ping_ms is not None and n.ping_ms > 0,
            ping_ms=round(n.ping_ms, 1) if n.ping_ms and n.ping_ms > 0 else None,
            last_ping_at=n.last_ping_at,
        )
        for n in nodes
    ]
