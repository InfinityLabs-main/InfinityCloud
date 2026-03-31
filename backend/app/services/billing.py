"""
Сервис биллинга — списание средств, проверка баланса, приостановка VPS.
"""
from __future__ import annotations

from loguru import logger
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.server import Server
from app.models.transaction import Transaction
from app.models.user import User


async def charge_user(
    db: AsyncSession,
    user_id: int,
    amount: float,
    server_id: int | None = None,
    description: str = "Списание",
) -> Transaction | None:
    """
    Списать средства с баланса пользователя.
    Возвращает транзакцию или None, если недостаточно средств.
    """
    result = await db.execute(select(User).where(User.id == user_id).with_for_update())
    user = result.scalar_one_or_none()
    if user is None:
        return None

    if user.balance < amount:
        logger.warning(f"Недостаточно средств у user_id={user_id}: баланс={user.balance}, нужно={amount}")
        return None

    new_balance = round(user.balance - amount, 2)
    user.balance = new_balance

    tx = Transaction(
        user_id=user_id,
        server_id=server_id,
        type="charge",
        amount=-amount,
        balance_after=new_balance,
        description=description,
    )
    db.add(tx)
    await db.flush()
    return tx


async def deposit_user(
    db: AsyncSession,
    user_id: int,
    amount: float,
    description: str = "Пополнение баланса",
) -> Transaction:
    """Пополнить баланс пользователя."""
    result = await db.execute(select(User).where(User.id == user_id).with_for_update())
    user = result.scalar_one()

    new_balance = round(user.balance + amount, 2)
    user.balance = new_balance

    tx = Transaction(
        user_id=user_id,
        type="deposit",
        amount=amount,
        balance_after=new_balance,
        description=description,
    )
    db.add(tx)
    await db.flush()
    return tx


async def hourly_billing(db: AsyncSession) -> dict:
    """
    Почасовое списание для всех активных VPS.
    Вызывается Celery Beat раз в час.
    Возвращает статистику: {"charged": N, "suspended": M}
    """
    # Получаем все запущенные серверы с планами
    result = await db.execute(
        select(Server)
        .where(Server.status.in_(["running", "stopped"]))
        .options()  # plan загружен через lazy="joined"
    )
    servers = result.scalars().all()

    charged = 0
    suspended = 0

    for server in servers:
        plan = server.plan
        if plan is None:
            continue

        tx = await charge_user(
            db=db,
            user_id=server.user_id,
            amount=plan.price_per_hour,
            server_id=server.id,
            description=f"Почасовое списание: {plan.name} (VPS #{server.id})",
        )

        if tx is not None:
            charged += 1
        else:
            # Недостаточно средств — приостанавливаем VPS
            server.status = "suspended"
            suspended += 1
            logger.info(f"VPS #{server.id} приостановлен из-за нехватки средств")

    await db.commit()
    return {"charged": charged, "suspended": suspended}
