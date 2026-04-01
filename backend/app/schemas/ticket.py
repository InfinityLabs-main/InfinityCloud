"""Pydantic-схемы — система тикетов."""
from __future__ import annotations

import datetime
from typing import Optional

from pydantic import BaseModel, Field


# ── Вложения ─────────────────────────────────────────

class AttachmentOut(BaseModel):
    id: int
    filename: str
    original_filename: str
    content_type: str
    size_bytes: int
    created_at: datetime.datetime

    class Config:
        from_attributes = True


# ── Сообщения ────────────────────────────────────────

class MessageCreate(BaseModel):
    body: str = Field(min_length=1, max_length=10000)


class MessageOut(BaseModel):
    id: int
    ticket_id: int
    sender_id: int
    sender_role: str
    sender_email: str | None = None
    body: str
    is_read: bool
    attachments: list[AttachmentOut] = []
    created_at: datetime.datetime

    class Config:
        from_attributes = True


# ── Тикеты ───────────────────────────────────────────

class TicketCreate(BaseModel):
    subject: str = Field(min_length=3, max_length=255)
    priority: str = Field(default="medium", pattern="^(low|medium|high|critical)$")
    category: str = Field(default="other", pattern="^(technical|vps|network|billing|complaint|other)$")
    server_id: int | None = None
    body: str = Field(min_length=5, max_length=10000, description="Описание проблемы")


class TicketOut(BaseModel):
    id: int
    user_id: int
    server_id: int | None
    subject: str
    priority: str
    category: str
    status: str
    is_read_by_admin: bool
    is_read_by_user: bool
    closed_at: datetime.datetime | None
    created_at: datetime.datetime
    updated_at: datetime.datetime
    # Вложенные
    user_email: str | None = None
    server_hostname: str | None = None
    server_ip: str | None = None
    server_status: str | None = None
    message_count: int = 0
    last_message_at: datetime.datetime | None = None

    class Config:
        from_attributes = True


class TicketDetailOut(BaseModel):
    id: int
    user_id: int
    server_id: int | None
    subject: str
    priority: str
    category: str
    status: str
    is_read_by_admin: bool
    is_read_by_user: bool
    closed_at: datetime.datetime | None
    created_at: datetime.datetime
    updated_at: datetime.datetime
    user_email: str | None = None
    server_hostname: str | None = None
    server_ip: str | None = None
    server_status: str | None = None
    messages: list[MessageOut] = []

    class Config:
        from_attributes = True


class TicketListOut(BaseModel):
    items: list[TicketOut]
    total: int


class TicketStatusUpdate(BaseModel):
    status: str = Field(pattern="^(open|in_progress|awaiting_user|closed)$")


# ── Admin: компенсация ───────────────────────────────

class CompensationRequest(BaseModel):
    amount: float = Field(gt=0, description="Сумма компенсации")
    reason: str = Field(min_length=3, max_length=500)


# ── Admin: VPS действия из тикета ────────────────────

class TicketVpsAction(BaseModel):
    action: str = Field(pattern="^(start|stop|restart|suspend|unsuspend|reinstall)$")
