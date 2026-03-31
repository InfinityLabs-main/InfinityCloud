"""
Модель Plan — тарифные планы VPS.
"""
from __future__ import annotations

import datetime

from sqlalchemy import Boolean, DateTime, Float, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class Plan(Base):
    __tablename__ = "plans"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False)           # «VPS-1», «VPS-Pro»
    slug: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)

    cpu_cores: Mapped[int] = mapped_column(Integer, nullable=False)          # vCPU
    ram_mb: Mapped[int] = mapped_column(Integer, nullable=False)             # МБ оперативки
    disk_gb: Mapped[int] = mapped_column(Integer, nullable=False)            # Диск (ГБ)
    bandwidth_tb: Mapped[float] = mapped_column(Float, default=1.0)          # Трафик (ТБ)
    price_per_hour: Mapped[float] = mapped_column(Float, nullable=False)     # Цена/час (₽)
    price_per_month: Mapped[float] = mapped_column(Float, nullable=False)    # Цена/мес. (₽)

    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    sort_order: Mapped[int] = mapped_column(Integer, default=0)

    created_at: Mapped[datetime.datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    def __repr__(self) -> str:
        return f"<Plan id={self.id} name={self.name} price_h={self.price_per_hour}>"
