"""
Celery-клиент для отправки задач из бэкенда.

Использует send_task() — не требует импорта модулей воркера.
Подключается к тому же Redis-брокеру что и воркер.
"""
from __future__ import annotations

import os

from celery import Celery

BROKER_URL = os.environ.get("CELERY_BROKER_URL", "redis://redis:6379/1")

celery_client = Celery(
    "infinity_cloud_client",
    broker=BROKER_URL,
)


def send_vm_create(server_id: int) -> None:
    """Отправить задачу создания VM."""
    celery_client.send_task("tasks.vm_tasks.create_vm_task", args=[server_id], queue="vm_create")


def send_vm_action(server_id: int, action: str) -> None:
    """Отправить задачу действия над VM (start/stop/restart/suspend/unsuspend/destroy)."""
    celery_client.send_task("tasks.vm_tasks.vm_action_task", args=[server_id, action], queue="vm_action")


def send_vm_delete(server_id: int) -> None:
    """Отправить задачу удаления VM."""
    celery_client.send_task("tasks.vm_tasks.delete_vm_task", args=[server_id], queue="vm_action")
