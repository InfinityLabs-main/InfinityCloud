"""
Celery-задача мониторинга нод — алерт при высокой загрузке.

Запускается Celery Beat каждые 5 минут.
Проверяет загрузку CPU/RAM/Disk каждой активной ноды.
Если порог превышен — отправляет email администратору.
Использует Redis-флаг для дедупликации (1 алерт в час на ноду).
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

_engine = create_async_engine(DATABASE_URL, pool_size=3)
_session_factory = async_sessionmaker(bind=_engine, class_=AsyncSession, expire_on_commit=False)


def _run_async(coro):
    loop = asyncio.new_event_loop()
    try:
        return loop.run_until_complete(coro)
    finally:
        loop.close()


@celery_app.task(name="tasks.node_alert_tasks.check_node_load")
def check_node_load() -> dict:
    """
    Проверить загрузку всех активных нод.
    Если CPU/RAM/Disk превышают пороги — отправить алерт-email администратору.
    Redis-ключ `node_alert:{node_id}` с TTL=1h для дедупликации.
    """
    logger.info("[node_alert] Проверка загрузки нод…")

    async def _check():
        from app.config import settings
        from app.models.node import Node
        from app.models.user import User

        async with _session_factory() as db:
            # Получаем пороги из конфигурации
            cpu_threshold = settings.NODE_ALERT_CPU_THRESHOLD
            ram_threshold = settings.NODE_ALERT_RAM_THRESHOLD
            disk_threshold = settings.NODE_ALERT_DISK_THRESHOLD

            # Получаем все активные ноды
            result = await db.execute(
                select(Node).where(Node.is_active == True)  # noqa
            )
            nodes = result.scalars().all()

            # Получаем email администраторов
            admin_result = await db.execute(
                select(User).where(User.role == "admin", User.is_active == True)  # noqa
            )
            admins = admin_result.scalars().all()
            admin_emails = [a.email for a in admins]

            if not admin_emails:
                logger.warning("[node_alert] Нет активных администраторов для алертов")
                return {"alerts": 0, "reason": "no_admins"}

            r = sync_redis.from_url(REDIS_URL)
            alerts_sent = 0

            for node in nodes:
                cpu_pct = (node.used_cpu / node.total_cpu * 100) if node.total_cpu else 0
                ram_pct = (node.used_ram_mb / node.total_ram_mb * 100) if node.total_ram_mb else 0
                disk_pct = (node.used_disk_gb / node.total_disk_gb * 100) if node.total_disk_gb else 0

                overloaded = (
                    cpu_pct >= cpu_threshold
                    or ram_pct >= ram_threshold
                    or disk_pct >= disk_threshold
                )

                if not overloaded:
                    continue

                # Дедупликация: не чаще 1 алерта в час на ноду
                alert_key = f"node_alert:{node.id}"
                if r.get(alert_key):
                    logger.info(f"[node_alert] Алерт для ноды {node.name} уже отправлен, пропускаю")
                    continue

                logger.warning(
                    f"[node_alert] 🔴 Нода {node.name} перегружена: "
                    f"CPU={cpu_pct:.1f}%, RAM={ram_pct:.1f}%, Disk={disk_pct:.1f}%"
                )

                # Отправляем email всем админам
                try:
                    from app.services.email import render_node_alert, send_email

                    subj, body = render_node_alert(
                        node.name, cpu_pct, ram_pct, disk_pct
                    )
                    for email in admin_emails:
                        await send_email(email, subj, body)

                    # Устанавливаем дедупликационный ключ (TTL = 1 час)
                    r.setex(alert_key, 3600, "1")
                    alerts_sent += 1
                except Exception as e:
                    logger.error(f"[node_alert] Ошибка отправки алерта: {e}")

            r.close()
            logger.info(f"[node_alert] ✅ Проверено {len(nodes)} нод, алертов: {alerts_sent}")
            return {"nodes_checked": len(nodes), "alerts_sent": alerts_sent}

    return _run_async(_check())
