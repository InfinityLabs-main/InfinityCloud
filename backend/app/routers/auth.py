"""
Роутер авторизации — регистрация, логин.

Эндпоинты:
  POST /api/auth/register  — Регистрация нового пользователя
  POST /api/auth/login     — Получение JWT-токена
  GET  /api/auth/me        — Текущий пользователь
"""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.deps import get_current_user
from app.models.user import User
from app.schemas.user import Token, UserLogin, UserOut, UserRegister
from app.services.auth import create_access_token, hash_password, verify_password

router = APIRouter()


@router.post("/register", response_model=UserOut, status_code=status.HTTP_201_CREATED)
async def register(body: UserRegister, db: AsyncSession = Depends(get_db)):
    """
    Регистрация нового пользователя.

    Request body:
        {"email": "user@mail.com", "password": "secret123"}

    Response 201:
        {"id": 1, "email": "user@mail.com", "role": "user", "balance": 0, ...}
    """
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
async def login(body: UserLogin, db: AsyncSession = Depends(get_db)):
    """
    Авторизация и получение JWT.

    Request body:
        {"email": "user@mail.com", "password": "secret123"}

    Response 200:
        {"access_token": "eyJ...", "token_type": "bearer"}
    """
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
    """
    Текущий авторизованный пользователь.

    Headers: Authorization: Bearer <token>
    Response 200: UserOut
    """
    return current_user
