"""
Celery-задача мониторинга нод — алерты при высокой загрузке.

Запускается через Celery Beat каждые 5 минут.
Проверяет загрузку CPU/RAM/Disk каждой активной ноды
и отправляет email-алерт администраторам при превышении порогов.
Использует Redis-кулдаун (1 час) чтобы не спамить алертами.
"""
from __future__ import annotations

import asyncio
import os
import sys

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

# Пороги по умолчанию (переопределяются из env)
CPU_THRESHOLD = int(os.environ.get("NODE_ALERT_CPU_THRESHOLD", "80"))
RAM_THRESHOLD = int(os.environ.get("NODE_ALERT_RAM_THRESHOLD", "80"))
DISK_THRESHOLD = int(os.environ.get("NODE_ALERT_DISK_THRESHOLD", "85"))

# Кулдаун алерта: 1 час на ноду
ALERT_COOLDOWN_SECONDS = 3600

_engine = create_async_engine(DATABASE_URL, pool_size=3)
_session_factory = async_sessionmaker(bind=_engine, class_=AsyncSession, expire_on_commit=False)


def _run_async(coro):
    loop = asyncio.new_event_loop()
    try:
        return loop.run_until_complete(coro)
    finally:
        loop.close()


@celery_app.task(name="tasks.node_alerts.check_node_load_task")
def check_node_load_task() -> dict:
    """
    Проверяет загрузку всех активных нод.
    При превышении порога CPU/RAM/Disk — отправляет email-алерт админам.
    Использует Redis для cooldown (не чаще 1 алерта в час на ноду).
    """
    logger.info("[node_alerts] Проверка загрузки нод…")

    async def _check():
        from app.models.node import Node
        from app.models.user import User

        async with _session_factory() as db:
            # Получаем все активные ноды
            result = await db.execute(
                select(Node).where(Node.is_active == True)  # noqa: E712
            )
            nodes = result.scalars().all()

            if not nodes:
                return {"status": "no_nodes"}

            # Получаем email'ы администраторов
            admin_result = await db.execute(
                select(User).where(User.role == "admin", User.is_active == True)  # noqa: E712
            )
            admins = admin_result.scalars().all()
            admin_emails = [a.email for a in admins]

            if not admin_emails:
                return {"status": "no_admins"}

            alerts_sent = 0
            r = sync_redis.from_url(REDIS_URL)

            for node in nodes:
                # Рассчитываем загрузку в %
                cpu_usage = (
                    round(node.used_cpu / node.total_cpu * 100, 1)
                    if node.total_cpu > 0 else 0
                )
                ram_usage = (
                    round(node.used_ram_mb / node.total_ram_mb * 100, 1)
                    if node.total_ram_mb > 0 else 0
                )
                disk_usage = (
                    round(node.used_disk_gb / node.total_disk_gb * 100, 1)
                    if node.total_disk_gb > 0 else 0
                )

                # Проверяем пороги
                overloaded = (
                    cpu_usage >= CPU_THRESHOLD
                    or ram_usage >= RAM_THRESHOLD
                    or disk_usage >= DISK_THRESHOLD
                )

                if not overloaded:
                    continue

                # Cooldown: проверяем, не было ли алерта за последний час
                cooldown_key = f"node_alert:cooldown:{node.id}"
                try:
                    if r.get(cooldown_key):
                        logger.info(
                            f"[node_alerts] Нода {node.name}: перегружена, "
                            f"но алерт в cooldown"
                        )
                        continue
                except Exception:
                    pass  # Redis недоступен → отправим алерт

                logger.warning(
                    f"[node_alerts] 🔴 Нода {node.name} перегружена: "
                    f"CPU={cpu_usage}%, RAM={ram_usage}%, Disk={disk_usage}%"
                )

                # Отправляем email всем админам
                try:
                    from app.services.email import render_node_alert, send_email

                    subj, body = render_node_alert(
                        node.name, cpu_usage, ram_usage, disk_usage
                    )
                    for email in admin_emails:
                        await send_email(email, subj, body)
                    alerts_sent += 1

                    # Ставим cooldown
                    try:
                        r.set(cooldown_key, "1", ex=ALERT_COOLDOWN_SECONDS)
                    except Exception:
                        pass
                except Exception as e:
                    logger.error(f"[node_alerts] Ошибка отправки алерта: {e}")

            r.close()
            logger.info(f"[node_alerts] ✅ Проверено нод: {len(nodes)}, алертов: {alerts_sent}")
            return {
                "nodes_checked": len(nodes),
                "alerts_sent": alerts_sent,
            }

    return _run_async(_check())
