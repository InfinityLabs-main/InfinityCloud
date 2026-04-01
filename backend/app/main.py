"""
Infinity Cloud — Точка входа FastAPI-приложения.
"""
from __future__ import annotations

import json
import sys
from contextlib import asynccontextmanager
from datetime import datetime, timezone

import redis.asyncio as aioredis
import sentry_sdk
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from loguru import logger

from app.config import settings
from app.exceptions import register_exception_handlers
from app.middleware.correlation_id import CorrelationIdMiddleware
from app.middleware.rate_limit import RateLimitMiddleware

# Импорт роутеров
from app.routers import admin, auth, console, payments, plans, public, servers, users


# ── Structured JSON Logging (ELK/Loki) ───────────────
def _json_sink(message):
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
    if record["extra"]:
        for k, v in record["extra"].items():
            log_entry[k] = v
    if record["exception"]:
        log_entry["exception_type"] = str(record["exception"].type.__name__) if record["exception"].type else None
        log_entry["exception_value"] = str(record["exception"].value) if record["exception"].value else None
    print(json.dumps(log_entry, ensure_ascii=False, default=str), flush=True)


logger.remove()
logger.add(_json_sink, level="INFO", backtrace=True, diagnose=False)


# ── WebSocket Manager ────────────────────────────────
class WebSocketManager:
    """Управление WebSocket-подключениями для real-time статуса VPS."""

    def __init__(self):
        self._connections: dict[int, list[WebSocket]] = {}  # user_id → [ws, ...]
        self._redis: aioredis.Redis | None = None

    async def connect(self, user_id: int, ws: WebSocket):
        await ws.accept()
        self._connections.setdefault(user_id, []).append(ws)

    def disconnect(self, user_id: int, ws: WebSocket):
        if user_id in self._connections:
            self._connections[user_id] = [w for w in self._connections[user_id] if w != ws]
            if not self._connections[user_id]:
                del self._connections[user_id]

    async def send_to_user(self, user_id: int, data: dict):
        if user_id in self._connections:
            dead = []
            for ws in self._connections[user_id]:
                try:
                    await ws.send_json(data)
                except Exception:
                    dead.append(ws)
            for ws in dead:
                self.disconnect(user_id, ws)

    async def start_redis_listener(self):
        """Подписка на Redis PubSub канал vps_status для relay в WS."""
        try:
            self._redis = aioredis.from_url(settings.REDIS_URL, decode_responses=True)
            pubsub = self._redis.pubsub()
            await pubsub.subscribe("vps_status")
            async for message in pubsub.listen():
                if message["type"] == "message":
                    try:
                        data = json.loads(message["data"])
                        user_id = data.get("user_id")
                        if user_id:
                            await self.send_to_user(user_id, data)
                    except Exception:
                        pass
        except Exception as e:
            logger.error(f"Redis PubSub listener error: {e}")


ws_manager = WebSocketManager()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup / Shutdown lifecycle."""
    logger.info("🚀 Infinity Cloud Backend запускается…")

    # Инициализация Sentry (если DSN задан)
    if settings.SENTRY_DSN:
        sentry_sdk.init(dsn=settings.SENTRY_DSN, traces_sample_rate=0.3)

    # Bootstrap: создание admin-пользователя, если его нет
    from app.database import async_session_factory
    from app.models.user import User
    from app.services.auth import hash_password
    from sqlalchemy import select
    from sqlalchemy.exc import IntegrityError

    async with async_session_factory() as session:
        result = await session.execute(select(User).where(User.email == settings.ADMIN_EMAIL))
        if result.scalar_one_or_none() is None:
            try:
                admin_user = User(
                    email=settings.ADMIN_EMAIL,
                    hashed_password=hash_password(settings.ADMIN_PASSWORD),
                    role="admin",
                    balance=0,
                )
                session.add(admin_user)
                await session.commit()
                logger.info(f"✅ Администратор создан: {settings.ADMIN_EMAIL}")
            except IntegrityError:
                await session.rollback()
                logger.info(f"ℹ️ Администратор {settings.ADMIN_EMAIL} уже существует")

    # Запускаем Redis PubSub listener в фоне
    import asyncio
    redis_task = asyncio.create_task(ws_manager.start_redis_listener())

    yield

    redis_task.cancel()
    if ws_manager._redis:
        await ws_manager._redis.close()
    logger.info("🛑 Infinity Cloud Backend остановлен")


app = FastAPI(
    title="Infinity Cloud API",
    version="1.0.0",
    description="Облачный VPS-хостинг провайдерского уровня",
    lifespan=lifespan,
)

# ── Middleware ────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.add_middleware(CorrelationIdMiddleware)
app.add_middleware(
    RateLimitMiddleware,
    max_requests=settings.RATE_LIMIT_PER_MINUTE,
    redis_url=settings.REDIS_URL,
)

# ── Обработчики исключений ───────────────────────────
register_exception_handlers(app)

# ── Роутеры (API v1) ─────────────────────────────────
app.include_router(auth.router, prefix="/api/v1/auth", tags=["Авторизация"])
app.include_router(users.router, prefix="/api/v1/users", tags=["Пользователи"])
app.include_router(servers.router, prefix="/api/v1/servers", tags=["VPS-серверы"])
app.include_router(plans.router, prefix="/api/v1/plans", tags=["Тарифы"])
app.include_router(console.router, prefix="/api/v1/console", tags=["Консоль"])
app.include_router(admin.router, prefix="/api/v1/admin", tags=["Админ-панель"])
app.include_router(payments.router, prefix="/api/v1/payments", tags=["Платежи"])
app.include_router(public.router, prefix="/api/v1/public", tags=["Публичное"])

# Backward-compatible aliases (без версии)
app.include_router(auth.router, prefix="/api/auth", tags=["Авторизация"], include_in_schema=False)
app.include_router(users.router, prefix="/api/users", tags=["Пользователи"], include_in_schema=False)
app.include_router(servers.router, prefix="/api/servers", tags=["VPS-серверы"], include_in_schema=False)
app.include_router(plans.router, prefix="/api/plans", tags=["Тарифы"], include_in_schema=False)
app.include_router(console.router, prefix="/api/console", tags=["Консоль"], include_in_schema=False)
app.include_router(admin.router, prefix="/api/admin", tags=["Админ-панель"], include_in_schema=False)
app.include_router(payments.router, prefix="/api/payments", tags=["Платежи"], include_in_schema=False)
app.include_router(public.router, prefix="/api/public", tags=["Публичное"], include_in_schema=False)


# ── Health Check (с DB + Redis) ──────────────────────
@app.get("/api/v1/health", tags=["Система"])
@app.get("/api/health", tags=["Система"], include_in_schema=False)
async def health_check():
    """Health-check: проверяет DB и Redis."""
    status = {"service": "Infinity Cloud", "status": "ok"}
    try:
        from app.database import engine
        from sqlalchemy import text
        async with engine.connect() as conn:
            await conn.execute(text("SELECT 1"))
        status["database"] = "ok"
    except Exception as e:
        status["database"] = f"error: {e}"
        status["status"] = "degraded"

    try:
        r = aioredis.from_url(settings.REDIS_URL)
        await r.ping()
        await r.close()
        status["redis"] = "ok"
    except Exception as e:
        status["redis"] = f"error: {e}"
        status["status"] = "degraded"

    return status


# ── WebSocket для real-time статуса VPS ──────────────
@app.websocket("/ws/servers")
async def websocket_servers(ws: WebSocket):
    """
    WebSocket для получения real-time обновлений статуса VPS.
    Клиент отправляет: {"token": "JWT_TOKEN"}
    Сервер отправляет: {"event": "status_change", "server_id": 1, "status": "running", ...}
    """
    from app.services.auth import decode_access_token

    await ws.accept()
    # Ожидаем auth-сообщение
    try:
        auth_msg = await ws.receive_json()
        token = auth_msg.get("token", "")
        payload = decode_access_token(token)
        if not payload:
            await ws.send_json({"error": "unauthorized"})
            await ws.close(code=4001)
            return
        user_id = int(payload["sub"])
    except Exception:
        await ws.close(code=4001)
        return

    # Подключаем
    ws_manager._connections.setdefault(user_id, []).append(ws)
    await ws.send_json({"event": "connected", "user_id": user_id})

    try:
        while True:
            # Держим соединение, ждём ping/pong
            await ws.receive_text()
    except WebSocketDisconnect:
        pass
    finally:
        ws_manager.disconnect(user_id, ws)
