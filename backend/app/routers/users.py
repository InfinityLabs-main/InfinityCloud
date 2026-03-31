"""
Роутер пользователей — баланс, пополнение, транзакции.

Эндпоинты:
  GET  /api/users/balance         — Текущий баланс
  POST /api/users/deposit         — Пополнить баланс (demo)
  GET  /api/users/transactions    — Список транзакций
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
from app.schemas.user import BalanceDeposit, UserBalanceOut
from app.services.billing import deposit_user

router = APIRouter()


@router.get("/balance", response_model=UserBalanceOut)
async def get_balance(current_user: User = Depends(get_current_user)):
    """Баланс текущего пользователя."""
    return UserBalanceOut(balance=current_user.balance)


@router.post("/deposit", response_model=TransactionOut)
async def deposit(
    body: BalanceDeposit,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Пополнение баланса (demo-режим / admin).

    Request body: {"amount": 500.0}
    Response 200: Transaction
    """
    tx = await deposit_user(db, current_user.id, body.amount)
    await db.commit()
    await db.refresh(tx)
    return tx


@router.get("/transactions", response_model=TransactionListOut)
async def list_transactions(
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    История транзакций текущего пользователя.

    Query params: ?page=1&per_page=20
    """
    offset = (page - 1) * per_page

    # Подсчёт
    count_q = select(func.count()).select_from(Transaction).where(Transaction.user_id == current_user.id)
    total = (await db.execute(count_q)).scalar() or 0

    # Данные
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
