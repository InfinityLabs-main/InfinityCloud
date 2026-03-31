"""
Celery App — конфигурация очереди задач.
Подключение к Redis, настройки Beat (расписание биллинга).
"""
from __future__ import annotations

import os

from celery import Celery
from celery.schedules import crontab

# Брокер и backend из переменных окружения
BROKER_URL = os.environ.get("CELERY_BROKER_URL", "redis://localhost:6379/1")
RESULT_BACKEND = os.environ.get("CELERY_RESULT_BACKEND", "redis://localhost:6379/2")

celery_app = Celery(
    "infinity_cloud",
    broker=BROKER_URL,
    backend=RESULT_BACKEND,
    include=[
        "tasks.vm_tasks",
        "tasks.billing_tasks",
    ],
)

celery_app.conf.update(
    # Сериализация
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,

    # Retry по умолчанию
    task_default_retry_delay=30,  # 30 секунд между retry
    task_max_retries=5,

    # Ack после выполнения (защита от потери задач при crash)
    task_acks_late=True,
    worker_prefetch_multiplier=1,

    # Расписание Beat — почасовой биллинг
    beat_schedule={
        "hourly-billing": {
            "task": "tasks.billing_tasks.hourly_billing_task",
            "schedule": crontab(minute=0),  # Каждый час в :00
        },
    },
)
