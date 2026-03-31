"""
Модель IPAddress — пул IP-адресов.
"""
from __future__ import annotations

import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class IPAddress(Base):
    __tablename__ = "ip_addresses"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    node_id: Mapped[int] = mapped_column(Integer, ForeignKey("nodes.id"), nullable=False)
    address: Mapped[str] = mapped_column(String(45), unique=True, nullable=False)  # IPv4/IPv6
    subnet: Mapped[str] = mapped_column(String(50), nullable=True)  # e.g. "255.255.255.0"
    gateway: Mapped[str] = mapped_column(String(45), nullable=True)
    is_allocated: Mapped[bool] = mapped_column(Boolean, default=False)
    rdns: Mapped[str | None] = mapped_column(String(255), nullable=True)

    created_at: Mapped[datetime.datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    # Связи
    node = relationship("Node", back_populates="ip_addresses")
    server = relationship("Server", back_populates="ip_address", uselist=False)

    def __repr__(self) -> str:
        return f"<IPAddress id={self.id} address={self.address} allocated={self.is_allocated}>"
