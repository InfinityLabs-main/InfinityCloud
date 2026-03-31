"""
Celery-задача биллинга — почасовое списание средств.

Запускается через Celery Beat каждый час.
Логика:
  1. Перебрать все active VPS (running/stopped)
  2. Списать price_per_hour с баланса владельца
  3. Если баланс < 0 → приостановить VPS
"""
from __future__ import annotations

import asyncio
import os
import sys

from celery.utils.log import get_task_logger
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from tasks.celery_app import celery_app

logger = get_task_logger(__name__)

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "..", "backend"))

DATABASE_URL = os.environ.get(
    "DATABASE_URL",
    "postgresql+asyncpg://infinity:infinity_secret@postgres:5432/infinity_cloud",
)
_engine = create_async_engine(DATABASE_URL, pool_size=5)
_session_factory = async_sessionmaker(bind=_engine, class_=AsyncSession, expire_on_commit=False)


def _run_async(coro):
    loop = asyncio.new_event_loop()
    try:
        return loop.run_until_complete(coro)
    finally:
        loop.close()


@celery_app.task(name="tasks.billing_tasks.hourly_billing_task")
def hourly_billing_task() -> dict:
    """
    Почасовой биллинг.
    Для каждого активного VPS:
      - Списываем plan.price_per_hour
      - Если средств не хватает → VPS → suspended
    """
    logger.info("[billing] Запуск почасового биллинга…")

    async def _billing():
        from app.models.plan import Plan
        from app.models.server import Server
        from app.models.transaction import Transaction
        from app.models.user import User

        async with _session_factory() as db:
            # Все активные серверы (running или stopped — пользователь платит за ресурсы)
            result = await db.execute(
                select(Server).where(Server.status.in_(["running", "stopped"]))
            )
            servers = result.scalars().all()

            charged = 0
            suspended = 0

            for server in servers:
                # Загружаем план
                plan_r = await db.execute(select(Plan).where(Plan.id == server.plan_id))
                plan = plan_r.scalar_one_or_none()
                if not plan:
                    continue

                # Загружаем пользователя с блокировкой
                user_r = await db.execute(
                    select(User).where(User.id == server.user_id).with_for_update()
                )
                user = user_r.scalar_one_or_none()
                if not user:
                    continue

                amount = plan.price_per_hour

                if user.balance >= amount:
                    # Списываем
                    user.balance = round(user.balance - amount, 2)
                    tx = Transaction(
                        user_id=user.id,
                        server_id=server.id,
                        type="charge",
                        amount=-amount,
                        balance_after=user.balance,
                        description=f"Почасовое списание: {plan.name} (VPS #{server.id})",
                    )
                    db.add(tx)
                    charged += 1
                else:
                    # Недостаточно средств → suspend
                    server.status = "suspended"
                    tx = Transaction(
                        user_id=user.id,
                        server_id=server.id,
                        type="charge",
                        amount=0,
                        balance_after=user.balance,
                        description=f"Приостановка VPS #{server.id}: недостаточно средств",
                    )
                    db.add(tx)
                    suspended += 1
                    logger.warning(
                        f"[billing] VPS #{server.id} приостановлен "
                        f"(user={user.id}, баланс={user.balance})"
                    )

            await db.commit()
            logger.info(f"[billing] ✅ Списано: {charged}, приостановлено: {suspended}")
            return {"charged": charged, "suspended": suspended}

    return _run_async(_billing())
