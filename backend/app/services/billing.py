"""
Сервис биллинга — списание средств, проверка баланса, приостановка VPS.
"""
from __future__ import annotations

from decimal import Decimal

from loguru import logger
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.server import Server
from app.models.transaction import Transaction
from app.models.user import User


async def charge_user(
    db: AsyncSession,
    user_id: int,
    amount: Decimal | float,
    server_id: int | None = None,
    description: str = "Списание",
    billing_period: str | None = None,
) -> Transaction | None:
    """
    Списать средства с баланса пользователя.
    Использует with_for_update для защиты от race conditions.
    Возвращает транзакцию или None, если недостаточно средств.
    """
    amount = Decimal(str(amount))

    result = await db.execute(select(User).where(User.id == user_id).with_for_update())
    user = result.scalar_one_or_none()
    if user is None:
        return None

    if user.balance < amount:
        logger.warning(f"Недостаточно средств у user_id={user_id}: баланс={user.balance}, нужно={amount}")
        return None

    new_balance = user.balance - amount
    user.balance = new_balance

    tx = Transaction(
        user_id=user_id,
        server_id=server_id,
        type="charge",
        amount=-amount,
        balance_after=new_balance,
        description=description,
        billing_period=billing_period,
    )
    db.add(tx)
    await db.flush()
    return tx


async def deposit_user(
    db: AsyncSession,
    user_id: int,
    amount: Decimal | float,
    description: str = "Пополнение баланса",
) -> Transaction:
    """Пополнить баланс пользователя. Автоматически разблокирует suspended VPS."""
    amount = Decimal(str(amount))

    result = await db.execute(select(User).where(User.id == user_id).with_for_update())
    user = result.scalar_one()

    new_balance = user.balance + amount
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

    # Авто-unsuspend: разблокируем VPS если баланс теперь положительный
    if new_balance > 0:
        suspended_result = await db.execute(
            select(Server).where(
                Server.user_id == user_id,
                Server.status == "suspended",
            )
        )
        suspended_servers = suspended_result.scalars().all()
        for server in suspended_servers:
            server.status = "running"
            logger.info(f"Авто-unsuspend VPS #{server.id} после пополнения (user_id={user_id})")
            # Отправляем задачу на запуск
            try:
                from tasks.vm_tasks import vm_action_task
                vm_action_task.delay(server.id, "start")
            except Exception:
                pass

    return tx


async def hourly_billing(db: AsyncSession, billing_period: str) -> dict:
    """
    Почасовое списание для всех активных VPS.
    billing_period — уникальный идентификатор периода (e.g. "2026-04-01T15").
    Защита от повторного списания через billing_period в транзакциях.
    """
    # Получаем все запущенные/остановленные серверы (batched)
    result = await db.execute(
        select(Server)
        .where(Server.status.in_(["running", "stopped"]))
    )
    servers = result.scalars().all()

    charged = 0
    suspended = 0

    for server in servers:
        plan = server.plan
        if plan is None:
            continue

        # Idempotency check: не было ли уже списания за этот период для этого сервера
        existing_tx = await db.execute(
            select(Transaction.id).where(
                Transaction.server_id == server.id,
                Transaction.billing_period == billing_period,
                Transaction.type == "charge",
            )
        )
        if existing_tx.scalar_one_or_none() is not None:
            continue  # Уже списано за этот период

        tx = await charge_user(
            db=db,
            user_id=server.user_id,
            amount=plan.price_per_hour,
            server_id=server.id,
            description=f"Почасовое списание: {plan.name} (VPS #{server.id})",
            billing_period=billing_period,
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
