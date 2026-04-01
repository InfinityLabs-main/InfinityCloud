"""
Сервис выбора ноды — алгоритм Least-Used (наименее загруженная нода).
Использует with_for_update для защиты от overcommit при конкурентных запросах.
"""
from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.exceptions import NodeUnavailableError
from app.models.node import Node


async def select_node(
    db: AsyncSession,
    required_cpu: int,
    required_ram_mb: int,
    required_disk_gb: int,
) -> Node:
    """
    Выбирает оптимальную ноду по алгоритму Least-Used:
    - Нода должна быть активна
    - Должно хватать свободных ресурсов
    - Из подходящих выбираем с наибольшим запасом RAM
    - Используется with_for_update для предотвращения overcommit
    """
    # Блокируем ноды для атомарного резервирования ресурсов
    result = await db.execute(
        select(Node).where(Node.is_active == True).with_for_update()  # noqa: E712
    )
    nodes = result.scalars().all()

    suitable: list[tuple[Node, int]] = []
    for node in nodes:
        free_cpu = node.total_cpu - node.used_cpu
        free_ram = node.total_ram_mb - node.used_ram_mb
        free_disk = node.total_disk_gb - node.used_disk_gb

        if free_cpu >= required_cpu and free_ram >= required_ram_mb and free_disk >= required_disk_gb:
            score = free_ram
            suitable.append((node, score))

    if not suitable:
        raise NodeUnavailableError()

    # Сортируем по score (desc) → наименее загруженная
    suitable.sort(key=lambda x: x[1], reverse=True)
    best_node = suitable[0][0]

    # Резервируем ресурсы атомарно (под блокировкой)
    best_node.used_cpu += required_cpu
    best_node.used_ram_mb += required_ram_mb
    best_node.used_disk_gb += required_disk_gb

    return best_node
