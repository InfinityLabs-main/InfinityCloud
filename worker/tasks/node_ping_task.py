"""
Celery-задача — пинг Proxmox-нод и сохранение результатов в БД.

Запускается каждые 60 секунд через Celery Beat.
Отправляет HTTP-запрос к Proxmox API, измеряет время ответа.
"""
from __future__ import annotations

import asyncio
import os
import sys
import time

import httpx
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

_engine = create_async_engine(DATABASE_URL, pool_size=3)
_session_factory = async_sessionmaker(
    bind=_engine, class_=AsyncSession, expire_on_commit=False
)


def _run_async(coro):
    loop = asyncio.new_event_loop()
    try:
        return loop.run_until_complete(coro)
    finally:
        loop.close()


@celery_app.task(name="tasks.node_ping_task.ping_nodes")
def ping_nodes() -> dict:
    """Пинг всех активных Proxmox-нод, сохранение латентности в БД."""

    async def _ping():
        from datetime import datetime, timezone

        from app.models.node import Node

        async with _session_factory() as db:
            result = await db.execute(
                select(Node).where(Node.is_active == True)  # noqa: E712
            )
            nodes = result.scalars().all()
            results = []

            for node in nodes:
                url = f"https://{node.hostname}:{node.port}/api2/json/version"
                headers = {
                    "Authorization": (
                        f"PVEAPIToken={node.api_user}!"
                        f"{node.api_token_name}={node.api_token_value}"
                    )
                }
                try:
                    async with httpx.AsyncClient(verify=False, timeout=10) as client:
                        start = time.monotonic()
                        resp = await client.get(url, headers=headers)
                        elapsed_ms = (time.monotonic() - start) * 1000

                    if resp.status_code == 200:
                        node.ping_ms = round(elapsed_ms, 1)
                    else:
                        node.ping_ms = -1.0
                except Exception as e:
                    logger.warning(f"[node_ping] {node.name}: {e}")
                    node.ping_ms = -1.0

                node.last_ping_at = datetime.now(timezone.utc)
                results.append({"node": node.name, "ping_ms": node.ping_ms})

            await db.commit()
            logger.info(f"[node_ping] Pinged {len(nodes)} nodes: {results}")
            return {"nodes_pinged": len(nodes), "results": results}

    return _run_async(_ping())
