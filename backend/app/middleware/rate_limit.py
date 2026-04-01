"""
Rate-Limit Middleware — ограничение запросов по IP (Redis backend).
Работает корректно с несколькими инстансами бэкенда.
"""
from __future__ import annotations

import time

import redis.asyncio as aioredis
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse


class RateLimitMiddleware(BaseHTTPMiddleware):
    """
    Sliding-window rate limiter через Redis.
    max_requests запросов в минуту на IP.
    """

    def __init__(self, app, max_requests: int = 100, redis_url: str = "redis://localhost:6379/0"):
        super().__init__(app)
        self.max_requests = max_requests
        self._redis: aioredis.Redis | None = None
        self._redis_url = redis_url

    async def _get_redis(self) -> aioredis.Redis:
        if self._redis is None:
            self._redis = aioredis.from_url(self._redis_url, decode_responses=True)
        return self._redis

    async def dispatch(self, request: Request, call_next):
        client_ip = request.client.host if request.client else "unknown"
        now = time.time()
        window = 60  # 1 минута
        key = f"rl:{client_ip}"

        try:
            r = await self._get_redis()
            pipe = r.pipeline()
            pipe.zremrangebyscore(key, 0, now - window)
            pipe.zadd(key, {str(now): now})
            pipe.zcard(key)
            pipe.expire(key, window + 1)
            results = await pipe.execute()
            request_count = results[2]
        except Exception:
            # Redis недоступен → пропускаем (fail-open)
            return await call_next(request)

        if request_count > self.max_requests:
            return JSONResponse(
                status_code=429,
                content={"detail": "Превышен лимит запросов. Попробуйте позже."},
                headers={"Retry-After": "60"},
            )

        return await call_next(request)
