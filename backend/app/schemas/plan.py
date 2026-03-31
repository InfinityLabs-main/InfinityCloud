"""Pydantic-схемы — Тарифные планы."""
from __future__ import annotations

import datetime
from pydantic import BaseModel, Field


class PlanCreate(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    slug: str = Field(min_length=1, max_length=50)
    cpu_cores: int = Field(ge=1)
    ram_mb: int = Field(ge=128)
    disk_gb: int = Field(ge=1)
    bandwidth_tb: float = Field(ge=0)
    price_per_hour: float = Field(ge=0)
    price_per_month: float = Field(ge=0)
    is_active: bool = True
    sort_order: int = 0


class PlanUpdate(BaseModel):
    name: str | None = None
    cpu_cores: int | None = Field(None, ge=1)
    ram_mb: int | None = Field(None, ge=128)
    disk_gb: int | None = Field(None, ge=1)
    bandwidth_tb: float | None = None
    price_per_hour: float | None = Field(None, ge=0)
    price_per_month: float | None = Field(None, ge=0)
    is_active: bool | None = None
    sort_order: int | None = None


class PlanOut(BaseModel):
    id: int
    name: str
    slug: str
    cpu_cores: int
    ram_mb: int
    disk_gb: int
    bandwidth_tb: float
    price_per_hour: float
    price_per_month: float
    is_active: bool
    sort_order: int
    created_at: datetime.datetime

    class Config:
        from_attributes = True
