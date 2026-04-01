"""
Correlation ID middleware — добавляет уникальный request_id к каждому запросу.
Используется для трассировки запросов в ELK/Loki.
"""
from __future__ import annotations

import uuid

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request


class CorrelationIdMiddleware(BaseHTTPMiddleware):
    """Добавляет X-Request-ID заголовок к запросу и ответу."""

    async def dispatch(self, request: Request, call_next):
        request_id = request.headers.get("X-Request-ID") or str(uuid.uuid4())
        # Сохраняем в state для использования в handlers
        request.state.request_id = request_id

        response = await call_next(request)
        response.headers["X-Request-ID"] = request_id
        return response
