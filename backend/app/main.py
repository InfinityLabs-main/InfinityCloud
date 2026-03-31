"""
Infinity Cloud — Точка входа FastAPI-приложения.
"""
from __future__ import annotations

from contextlib import asynccontextmanager

import sentry_sdk
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from loguru import logger

from app.config import settings
from app.exceptions import register_exception_handlers
from app.middleware.rate_limit import RateLimitMiddleware

# Импорт роутеров
from app.routers import admin, auth, console, plans, servers, users


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
                logger.info(f"ℹ️ Администратор {settings.ADMIN_EMAIL} уже существует (создан другим воркером)")

    yield
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
app.add_middleware(RateLimitMiddleware, max_requests=settings.RATE_LIMIT_PER_MINUTE)

# ── Обработчики исключений ───────────────────────────
register_exception_handlers(app)

# ── Роутеры ──────────────────────────────────────────
app.include_router(auth.router, prefix="/api/auth", tags=["Авторизация"])
app.include_router(users.router, prefix="/api/users", tags=["Пользователи"])
app.include_router(servers.router, prefix="/api/servers", tags=["VPS-серверы"])
app.include_router(plans.router, prefix="/api/plans", tags=["Тарифы"])
app.include_router(console.router, prefix="/api/console", tags=["Консоль"])
app.include_router(admin.router, prefix="/api/admin", tags=["Админ-панель"])


@app.get("/api/health", tags=["Система"])
async def health_check():
    """Health-check endpoint."""
    return {"status": "ok", "service": "Infinity Cloud"}
