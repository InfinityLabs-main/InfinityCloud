"""
Роутер тарифных планов — публичный просмотр.

Эндпоинты:
  GET /api/plans       — Список активных тарифов
  GET /api/plans/{id}  — Детали тарифа
"""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.plan import Plan
from app.schemas.plan import PlanOut

router = APIRouter()


@router.get("", response_model=list[PlanOut])
async def list_plans(db: AsyncSession = Depends(get_db)):
    """Список активных тарифных планов (публичный)."""
    result = await db.execute(
        select(Plan).where(Plan.is_active == True).order_by(Plan.sort_order, Plan.price_per_month)  # noqa
    )
    return result.scalars().all()


@router.get("/{plan_id}", response_model=PlanOut)
async def get_plan(plan_id: int, db: AsyncSession = Depends(get_db)):
    """Детали тарифного плана."""
    result = await db.execute(select(Plan).where(Plan.id == plan_id))
    plan = result.scalar_one_or_none()
    if plan is None:
        raise HTTPException(status_code=404, detail="Тариф не найден")
    return plan
