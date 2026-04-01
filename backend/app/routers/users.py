"""
Роутер пользователей — баланс, транзакции.

Эндпоинты:
  GET  /api/v1/users/balance         — Текущий баланс
  GET  /api/v1/users/transactions    — Список транзакций
"""
from __future__ import annotations

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.deps import get_current_user
from app.models.transaction import Transaction
from app.models.user import User
from app.schemas.transaction import TransactionListOut, TransactionOut
from app.schemas.user import UserBalanceOut

router = APIRouter()


@router.get("/balance", response_model=UserBalanceOut)
async def get_balance(current_user: User = Depends(get_current_user)):
    """Баланс текущего пользователя."""
    return UserBalanceOut(balance=float(current_user.balance))


@router.get("/transactions", response_model=TransactionListOut)
async def list_transactions(
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """История транзакций текущего пользователя."""
    offset = (page - 1) * per_page

    count_q = select(func.count()).select_from(Transaction).where(Transaction.user_id == current_user.id)
    total = (await db.execute(count_q)).scalar() or 0

    q = (
        select(Transaction)
        .where(Transaction.user_id == current_user.id)
        .order_by(Transaction.created_at.desc())
        .offset(offset)
        .limit(per_page)
    )
    result = await db.execute(q)
    items = result.scalars().all()

    return TransactionListOut(items=items, total=total)
