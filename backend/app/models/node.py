"""
Модель Node — Proxmox-ноды кластера.
"""
from __future__ import annotations

import datetime

from sqlalchemy import Boolean, DateTime, Float, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base
from typing import Optional


class Node(Base):
    __tablename__ = "nodes"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    hostname: Mapped[str] = mapped_column(String(255), nullable=False)  # IP/FQDN Proxmox
    port: Mapped[int] = mapped_column(Integer, default=8006)
    api_user: Mapped[str] = mapped_column(String(100), nullable=False)
    api_token_name: Mapped[str] = mapped_column(String(100), nullable=False)
    api_token_value: Mapped[str] = mapped_column(String(255), nullable=False)

    # Ресурсы ноды (обновляются sync-задачей)
    total_cpu: Mapped[int] = mapped_column(Integer, default=0)        # Кол-во ядер
    total_ram_mb: Mapped[int] = mapped_column(Integer, default=0)     # МБ
    total_disk_gb: Mapped[int] = mapped_column(Integer, default=0)    # ГБ
    used_cpu: Mapped[int] = mapped_column(Integer, default=0)
    used_ram_mb: Mapped[int] = mapped_column(Integer, default=0)
    used_disk_gb: Mapped[int] = mapped_column(Integer, default=0)

    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    max_vms: Mapped[int] = mapped_column(Integer, default=100)

    # Локация дата-центра
    location: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    country: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    country_code: Mapped[Optional[str]] = mapped_column(String(5), nullable=True)

    # Мониторинг пинга
    ping_ms: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    last_ping_at: Mapped[Optional[datetime.datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    created_at: Mapped[datetime.datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    # Связи
    servers = relationship("Server", back_populates="node", lazy="selectin")
    ip_addresses = relationship("IPAddress", back_populates="node", lazy="selectin")

    @property
    def free_cpu(self) -> int:
        return self.total_cpu - self.used_cpu

    @property
    def free_ram_mb(self) -> int:
        return self.total_ram_mb - self.used_ram_mb

    @property
    def free_disk_gb(self) -> int:
        return self.total_disk_gb - self.used_disk_gb

    def __repr__(self) -> str:
        return f"<Node id={self.id} name={self.name}>"
