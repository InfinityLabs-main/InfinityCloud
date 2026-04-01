"""
Celery-задача биллинга — почасовое списание средств.

Запускается через Celery Beat каждый час.
Использует distributed lock (Redis) для защиты от двойного списания.
Использует billing_period для idempotency.
"""
from __future__ import annotations

import asyncio
import os
import sys
from datetime import datetime, timezone

import redis as sync_redis
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
REDIS_URL = os.environ.get("REDIS_URL", "redis://localhost:6379/0")

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
    Почасовой биллинг с distributed lock и idempotency.
    """
    # Distributed lock через Redis (60 мин TTL)
    r = sync_redis.from_url(REDIS_URL)
    lock = r.lock("billing:hourly_lock", timeout=3600, blocking_timeout=5)
    if not lock.acquire(blocking=False):
        logger.info("[billing] Другой воркер уже выполняет биллинг, пропускаем")
        return {"status": "skipped", "reason": "lock_held"}

    billing_period = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H")
    logger.info(f"[billing] Запуск почасового биллинга, period={billing_period}")

    try:
        async def _billing():
            from decimal import Decimal

            from app.models.plan import Plan
            from app.models.server import Server
            from app.models.transaction import Transaction
            from app.models.user import User

            async with _session_factory() as db:
                # Все активные серверы (не suspended, не deleted, не deleting)
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

                    # Idempotency: проверяем не было ли уже списания за этот период
                    existing_tx = await db.execute(
                        select(Transaction.id).where(
                            Transaction.server_id == server.id,
                            Transaction.billing_period == billing_period,
                            Transaction.type == "charge",
                        )
                    )
                    if existing_tx.scalar_one_or_none() is not None:
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
                        user.balance = user.balance - amount
                        tx = Transaction(
                            user_id=user.id,
                            server_id=server.id,
                            type="charge",
                            amount=-amount,
                            balance_after=user.balance,
                            description=f"Почасовое списание: {plan.name} (VPS #{server.id})",
                            billing_period=billing_period,
                        )
                        db.add(tx)
                        charged += 1
                    else:
                        server.status = "suspended"
                        tx = Transaction(
                            user_id=user.id,
                            server_id=server.id,
                            type="charge",
                            amount=Decimal("0"),
                            balance_after=user.balance,
                            description=f"Приостановка VPS #{server.id}: недостаточно средств",
                            billing_period=billing_period,
                        )
                        db.add(tx)
                        suspended += 1
                        logger.warning(
                            f"[billing] VPS #{server.id} приостановлен "
                            f"(user={user.id}, баланс={user.balance})"
                        )

                        # Email-уведомление о приостановке
                        try:
                            from app.services.email import render_vps_suspended, send_email
                            subj, body = render_vps_suspended(
                                server.hostname, str(user.balance)
                            )
                            await send_email(user.email, subj, body)
                        except Exception:
                            pass

                await db.commit()
                logger.info(f"[billing] ✅ Списано: {charged}, приостановлено: {suspended}")
                return {"charged": charged, "suspended": suspended, "period": billing_period}

        return _run_async(_billing())
    finally:
        try:
            lock.release()
        except Exception:
            pass
