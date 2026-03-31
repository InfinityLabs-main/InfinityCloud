"""Pydantic-схемы — Транзакции."""
from __future__ import annotations

import datetime
from pydantic import BaseModel


class TransactionOut(BaseModel):
    id: int
    user_id: int
    server_id: int | None
    type: str
    amount: float
    balance_after: float
    description: str | None
    created_at: datetime.datetime

    class Config:
        from_attributes = True


class TransactionListOut(BaseModel):
    items: list[TransactionOut]
    total: int
