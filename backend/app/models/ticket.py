"""
Модели системы тикетов — Ticket, TicketMessage, TicketAttachment.
"""
from __future__ import annotations

import datetime
from typing import Optional

from sqlalchemy import (
    Boolean, DateTime, ForeignKey, Integer, String, Text, func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Ticket(Base):
    """Тикет обращения в поддержку."""
    __tablename__ = "tickets"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True,
    )
    server_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("servers.id", ondelete="SET NULL"), nullable=True, index=True,
    )

    subject: Mapped[str] = mapped_column(String(255), nullable=False)

    # low | medium | high | critical
    priority: Mapped[str] = mapped_column(String(20), nullable=False, default="medium")

    # technical | vps | network | billing | complaint | other
    category: Mapped[str] = mapped_column(String(30), nullable=False, default="other")

    # open | in_progress | awaiting_user | closed
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="open", index=True)

    is_read_by_admin: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    is_read_by_user: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    closed_at: Mapped[Optional[datetime.datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True,
    )
    created_at: Mapped[datetime.datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False,
    )
    updated_at: Mapped[datetime.datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False,
    )

    # Relationships
    user = relationship("User", backref="tickets", lazy="joined")
    server = relationship("Server", lazy="joined")
    messages = relationship(
        "TicketMessage", back_populates="ticket",
        order_by="TicketMessage.created_at.asc()", lazy="selectin", cascade="all, delete-orphan",
    )

    def __repr__(self) -> str:
        return f"<Ticket id={self.id} status={self.status} priority={self.priority}>"


class TicketMessage(Base):
    """Сообщение внутри тикета (от пользователя или админа)."""
    __tablename__ = "ticket_messages"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    ticket_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("tickets.id", ondelete="CASCADE"), nullable=False, index=True,
    )
    sender_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False,
    )

    # user | admin
    sender_role: Mapped[str] = mapped_column(String(20), nullable=False, default="user")
    body: Mapped[str] = mapped_column(Text, nullable=False)
    is_read: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    created_at: Mapped[datetime.datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False,
    )

    # Relationships
    ticket = relationship("Ticket", back_populates="messages")
    sender = relationship("User", lazy="joined")
    attachments = relationship(
        "TicketAttachment", back_populates="message",
        lazy="selectin", cascade="all, delete-orphan",
    )

    def __repr__(self) -> str:
        return f"<TicketMessage id={self.id} ticket={self.ticket_id} role={self.sender_role}>"


class TicketAttachment(Base):
    """Вложение к сообщению тикета."""
    __tablename__ = "ticket_attachments"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    message_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("ticket_messages.id", ondelete="CASCADE"), nullable=False, index=True,
    )
    filename: Mapped[str] = mapped_column(String(255), nullable=False)
    original_filename: Mapped[str] = mapped_column(String(255), nullable=False)
    content_type: Mapped[str] = mapped_column(String(100), nullable=False)
    size_bytes: Mapped[int] = mapped_column(Integer, nullable=False)
    storage_path: Mapped[str] = mapped_column(String(500), nullable=False)

    created_at: Mapped[datetime.datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False,
    )

    # Relationships
    message = relationship("TicketMessage", back_populates="attachments")

    def __repr__(self) -> str:
        return f"<TicketAttachment id={self.id} file={self.original_filename}>"
