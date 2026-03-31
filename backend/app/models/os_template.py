"""
Модель OSTemplate — шаблоны ОС для установки на VPS.
"""
from __future__ import annotations

import datetime

from sqlalchemy import Boolean, DateTime, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class OSTemplate(Base):
    __tablename__ = "os_templates"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    slug: Mapped[str] = mapped_column(String(80), unique=True, nullable=False)  # "ubuntu-22.04"
    name: Mapped[str] = mapped_column(String(150), nullable=False)  # "Ubuntu 22.04 LTS"
    proxmox_template: Mapped[str] = mapped_column(String(255), nullable=False)  # Путь в Proxmox
    icon_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    created_at: Mapped[datetime.datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    def __repr__(self) -> str:
        return f"<OSTemplate id={self.id} slug={self.slug}>"
