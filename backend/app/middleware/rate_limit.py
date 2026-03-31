"""
Rate-Limit Middleware — ограничение запросов по IP.
Использует in-memory счётчик (для одного инстанса).
В проде рекомендуется Redis-backend.
"""
from __future__ import annotations

import time
from collections import defaultdict

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse


class RateLimitMiddleware(BaseHTTPMiddleware):
    """
    Sliding-window rate limiter: max_requests запросов в минуту на IP.
    """

    def __init__(self, app, max_requests: int = 100):
        super().__init__(app)
        self.max_requests = max_requests
        # {ip: [timestamp, timestamp, ...]}
        self._requests: dict[str, list[float]] = defaultdict(list)

    async def dispatch(self, request: Request, call_next):
        client_ip = request.client.host if request.client else "unknown"
        now = time.time()
        window = 60.0  # 1 минута

        # Очищаем устаревшие записи
        self._requests[client_ip] = [
            ts for ts in self._requests[client_ip] if now - ts < window
        ]

        if len(self._requests[client_ip]) >= self.max_requests:
            return JSONResponse(
                status_code=429,
                content={"detail": "Превышен лимит запросов. Попробуйте позже."},
                headers={"Retry-After": "60"},
            )

        self._requests[client_ip].append(now)
        return await call_next(request)
