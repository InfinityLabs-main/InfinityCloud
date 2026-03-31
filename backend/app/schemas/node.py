"""Pydantic-схемы — Proxmox-ноды."""
from __future__ import annotations

import datetime
from pydantic import BaseModel, Field


class NodeCreate(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    hostname: str = Field(min_length=1, max_length=255)
    port: int = 8006
    api_user: str
    api_token_name: str
    api_token_value: str
    total_cpu: int = Field(ge=0)
    total_ram_mb: int = Field(ge=0)
    total_disk_gb: int = Field(ge=0)
    max_vms: int = 100
    is_active: bool = True


class NodeUpdate(BaseModel):
    name: str | None = None
    hostname: str | None = None
    port: int | None = None
    total_cpu: int | None = None
    total_ram_mb: int | None = None
    total_disk_gb: int | None = None
    max_vms: int | None = None
    is_active: bool | None = None


class NodeOut(BaseModel):
    id: int
    name: str
    hostname: str
    port: int
    total_cpu: int
    total_ram_mb: int
    total_disk_gb: int
    used_cpu: int
    used_ram_mb: int
    used_disk_gb: int
    is_active: bool
    max_vms: int
    created_at: datetime.datetime

    class Config:
        from_attributes = True
