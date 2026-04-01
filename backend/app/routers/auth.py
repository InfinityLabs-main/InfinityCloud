"""
Роутер авторизации — регистрация, логин.

Эндпоинты:
  POST /api/v1/auth/register  — Регистрация нового пользователя
  POST /api/v1/auth/login     — Получение JWT-токена
  GET  /api/v1/auth/me        — Текущий пользователь
"""
from __future__ import annotations

import time

import redis.asyncio as aioredis
from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import get_db
from app.deps import get_current_user
from app.models.user import User
from app.schemas.user import Token, UserLogin, UserOut, UserRegister
from app.services.auth import create_access_token, hash_password, verify_password

router = APIRouter()

_redis_login: aioredis.Redis | None = None


async def _get_login_redis() -> aioredis.Redis:
    global _redis_login
    if _redis_login is None:
        _redis_login = aioredis.from_url(settings.REDIS_URL, decode_responses=True)
    return _redis_login


async def _check_login_rate_limit(request: Request) -> None:
    """Проверяет rate-limit для логина: N попыток за 5 минут на IP."""
    client_ip = request.client.host if request.client else "unknown"
    key = f"login_rl:{client_ip}"
    try:
        r = await _get_login_redis()
        attempts = await r.incr(key)
        if attempts == 1:
            await r.expire(key, 300)  # 5 минут
        if attempts > settings.RATE_LIMIT_LOGIN_PER_5MIN:
            raise HTTPException(
                status_code=429,
                detail="Слишком много попыток входа. Подождите 5 минут.",
                headers={"Retry-After": "300"},
            )
    except HTTPException:
        raise
    except Exception:
        pass  # Redis недоступен → пропускаем


@router.post("/register", response_model=UserOut, status_code=status.HTTP_201_CREATED)
async def register(body: UserRegister, db: AsyncSession = Depends(get_db)):
    """Регистрация нового пользователя."""
    # Проверяем уникальность email
    exists = await db.execute(select(User).where(User.email == body.email))
    if exists.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Пользователь с таким email уже существует")

    user = User(
        email=body.email,
        hashed_password=hash_password(body.password),
        role="user",
        balance=0,
    )
    db.add(user)
    await db.flush()
    await db.refresh(user)
    return user


@router.post("/login", response_model=Token)
async def login(body: UserLogin, request: Request, db: AsyncSession = Depends(get_db)):
    """Авторизация и получение JWT."""
    # Stricter rate-limit для логина
    await _check_login_rate_limit(request)

    result = await db.execute(select(User).where(User.email == body.email))
    user = result.scalar_one_or_none()

    if user is None or not verify_password(body.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Неверный email или пароль")

    if not user.is_active:
        raise HTTPException(status_code=403, detail="Аккаунт заблокирован")

    token = create_access_token(user.id, user.role)
    return Token(access_token=token)


@router.get("/me", response_model=UserOut)
async def me(current_user: User = Depends(get_current_user)):
    """Текущий авторизованный пользователь."""
    return current_user


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str = Field(min_length=6, max_length=128)


@router.post("/change-password")
async def change_password(
    body: ChangePasswordRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Смена пароля текущим пользователем."""
    if not verify_password(body.current_password, current_user.hashed_password):
        raise HTTPException(status_code=400, detail="Текущий пароль указан неверно")

    current_user.hashed_password = hash_password(body.new_password)
    await db.flush()
    return {"detail": "Пароль успешно изменён"}
