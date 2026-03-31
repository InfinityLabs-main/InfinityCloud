"""Pydantic-схемы — Пользователи / Авторизация."""
from __future__ import annotations

import datetime
from pydantic import BaseModel, EmailStr, Field


# ── Регистрация ──────────────────────────────────────
class UserRegister(BaseModel):
    email: EmailStr
    password: str = Field(min_length=6, max_length=128)


# ── Логин ────────────────────────────────────────────
class UserLogin(BaseModel):
    email: EmailStr
    password: str


# ── Токен ────────────────────────────────────────────
class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"


# ── Ответ пользователя ──────────────────────────────
class UserOut(BaseModel):
    id: int
    email: str
    role: str
    balance: float
    is_active: bool
    created_at: datetime.datetime

    class Config:
        from_attributes = True


class UserBalanceOut(BaseModel):
    balance: float


# ── Пополнение баланса (admin/demo) ─────────────────
class BalanceDeposit(BaseModel):
    amount: float = Field(gt=0, description="Сумма пополнения")
