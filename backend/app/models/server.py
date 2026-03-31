"""
Модель Server — виртуальные серверы пользователей.
"""
from __future__ import annotations

import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Server(Base):
    __tablename__ = "servers"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)

    # Связи FK
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    plan_id: Mapped[int] = mapped_column(Integer, ForeignKey("plans.id"), nullable=False)
    node_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("nodes.id"), nullable=True)
    ip_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("ip_addresses.id"), nullable=True)

    # Proxmox
    proxmox_vmid: Mapped[int | None] = mapped_column(Integer, nullable=True)
    hostname: Mapped[str] = mapped_column(String(100), nullable=False)
    os_template: Mapped[str] = mapped_column(String(150), nullable=False)  # e.g. "ubuntu-22.04"

    # Статус: creating | running | stopped | suspended | deleting | error
    status: Mapped[str] = mapped_column(String(30), default="creating", nullable=False)
    rdns: Mapped[str | None] = mapped_column(String(255), nullable=True)

    # Idempotency-ключ (защита от повторного create)
    idempotency_key: Mapped[str | None] = mapped_column(String(64), unique=True, nullable=True)

    # Заметки / ошибки
    note: Mapped[str | None] = mapped_column(Text, nullable=True)

    created_at: Mapped[datetime.datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime.datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    # Relationships
    owner = relationship("User", back_populates="servers")
    plan = relationship("Plan", lazy="joined")
    node = relationship("Node", back_populates="servers")
    ip_address = relationship("IPAddress", back_populates="server", uselist=False)

    def __repr__(self) -> str:
        return f"<Server id={self.id} vmid={self.proxmox_vmid} status={self.status}>"
