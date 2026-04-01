"""
Infinity Cloud — Настройка структурированного логирования (JSON-формат).
Совместимо с ELK Stack / Grafana Loki.
"""
from __future__ import annotations

import json
import sys
from datetime import datetime, timezone

from loguru import logger


def _json_serializer(message) -> str:
    """Сериализует loguru-записи в JSON для ELK/Loki."""
    record = message.record
    log_entry = {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "level": record["level"].name,
        "message": record["message"],
        "logger": record["name"],
        "module": record["module"],
        "function": record["function"],
        "line": record["line"],
        "service": "infinity-cloud-backend",
    }

    # Добавляем extra-поля (request_id, user_id, etc.)
    if record["extra"]:
        for key, value in record["extra"].items():
            if key not in ("_serialized",):
                log_entry[key] = value

    # Добавляем исключение если есть
    if record["exception"]:
        log_entry["exception"] = {
            "type": str(record["exception"].type.__name__) if record["exception"].type else None,
            "value": str(record["exception"].value) if record["exception"].value else None,
        }

    return json.dumps(log_entry, ensure_ascii=False, default=str)


def setup_logging(json_format: bool = True) -> None:
    """
    Настройка loguru.
    json_format=True → JSON для прода (ELK/Loki).
    json_format=False → human-readable для разработки.
    """
    logger.remove()  # Убираем дефолтный handler

    if json_format:
        logger.add(
            sys.stdout,
            format="{extra[_serialized]}",
            level="INFO",
            serialize=False,
            backtrace=True,
            diagnose=False,
        )
        # Патчим: добавляем _serialized поле
        logger = logger.patch(lambda record: record["extra"].update(_serialized=_json_serializer(type("M", (), {"record": record})())))
    else:
        logger.add(
            sys.stdout,
            format="<green>{time:YYYY-MM-DD HH:mm:ss}</green> | <level>{level: <8}</level> | "
                   "<cyan>{name}</cyan>:<cyan>{function}</cyan>:<cyan>{line}</cyan> — {message}",
            level="DEBUG",
            colorize=True,
        )
