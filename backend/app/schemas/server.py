"""Pydantic-схемы — VPS-серверы."""
from __future__ import annotations

import datetime
from decimal import Decimal

from pydantic import BaseModel, Field


class ServerCreate(BaseModel):
    plan_id: int
    hostname: str = Field(
        min_length=1,
        max_length=63,
        pattern=r"^[a-zA-Z0-9]([a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?$",
        description="RFC-1123 hostname",
    )
    os_template: str = Field(min_length=1, max_length=150)
    idempotency_key: str | None = Field(None, max_length=64, description="Ключ идемпотентности")


class ServerOut(BaseModel):
    id: int
    user_id: int
    plan_id: int
    node_id: int | None
    proxmox_vmid: int | None
    hostname: str
    os_template: str
    status: str
    rdns: str | None
    ip_address: str | None = None
    created_at: datetime.datetime
    updated_at: datetime.datetime

    class Config:
        from_attributes = True


class ServerAction(BaseModel):
    """Действие над VPS: start / stop / restart / suspend / unsuspend"""
    action: str = Field(pattern="^(start|stop|restart|suspend|unsuspend)$")


class ServerRdns(BaseModel):
    rdns: str = Field(min_length=1, max_length=255)


class ServerListOut(BaseModel):
    items: list[ServerOut]
    total: int
