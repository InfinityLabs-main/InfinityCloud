"""
Публичные эндпоинты — без авторизации.

  GET /api/v1/public/nodes/status  — Статус нод (пинг, онлайн)
"""
from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.node import Node
from app.schemas.node import NodePublicStatus

router = APIRouter()


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
