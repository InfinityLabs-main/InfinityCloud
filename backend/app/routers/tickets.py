"""
Роутер системы тикетов — пользовательские эндпоинты.

Эндпоинты:
  POST   /api/v1/tickets                          — Создать тикет
  GET    /api/v1/tickets                          — Список тикетов пользователя
  GET    /api/v1/tickets/{id}                     — Детали тикета (с сообщениями)
  POST   /api/v1/tickets/{id}/messages            — Отправить сообщение
  POST   /api/v1/tickets/{id}/messages/{mid}/attachments — Загрузить вложение
  PATCH  /api/v1/tickets/{id}/close               — Закрыть тикет
  GET    /api/v1/tickets/attachments/{attachment_id} — Скачать вложение
"""
from __future__ import annotations

import os
import uuid
from datetime import datetime, timezone
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File, status
from fastapi.responses import FileResponse
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.deps import get_current_user
from app.models.ticket import Ticket, TicketAttachment, TicketMessage
from app.models.user import User
from app.schemas.ticket import (
    MessageCreate,
    MessageOut,
    TicketCreate,
    TicketDetailOut,
    TicketListOut,
    TicketOut,
)

router = APIRouter()

# ── Конфигурация загрузки файлов ─────────────────────
UPLOAD_DIR = Path("uploads/tickets")
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

MAX_FILE_SIZE = 25 * 1024 * 1024  # 25 MB
ALLOWED_EXTENSIONS = {
    # Изображения
    ".jpg", ".jpeg", ".png", ".gif", ".webp", ".bmp", ".svg",
    # Видео
    ".mp4", ".webm", ".mov",
    # Логи / текст
    ".txt", ".log", ".csv", ".json", ".xml",
    # Архивы
    ".zip", ".tar", ".gz", ".7z", ".rar",
    # Документы
    ".pdf", ".doc", ".docx",
}

ALLOWED_CONTENT_TYPES = {
    "image/jpeg", "image/png", "image/gif", "image/webp", "image/bmp", "image/svg+xml",
    "video/mp4", "video/webm", "video/quicktime",
    "text/plain", "text/csv", "application/json", "application/xml",
    "application/zip", "application/x-tar", "application/gzip",
    "application/x-7z-compressed", "application/x-rar-compressed",
    "application/vnd.rar",
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/octet-stream",
}


def _ticket_to_out(ticket: Ticket) -> TicketOut:
    """Конвертирует модель в схему ответа."""
    msgs = ticket.messages or []
    last_msg = msgs[-1] if msgs else None
    ip = None
    hostname = None
    server_status = None
    if ticket.server:
        hostname = ticket.server.hostname
        server_status = ticket.server.status
        ip = ticket.server.ip_address.address if ticket.server.ip_address else None

    return TicketOut(
        id=ticket.id,
        user_id=ticket.user_id,
        server_id=ticket.server_id,
        subject=ticket.subject,
        priority=ticket.priority,
        category=ticket.category,
        status=ticket.status,
        is_read_by_admin=ticket.is_read_by_admin,
        is_read_by_user=ticket.is_read_by_user,
        closed_at=ticket.closed_at,
        created_at=ticket.created_at,
        updated_at=ticket.updated_at,
        user_email=ticket.user.email if ticket.user else None,
        server_hostname=hostname,
        server_ip=ip,
        server_status=server_status,
        message_count=len(msgs),
        last_message_at=last_msg.created_at if last_msg else None,
    )


def _message_to_out(msg: TicketMessage) -> MessageOut:
    return MessageOut(
        id=msg.id,
        ticket_id=msg.ticket_id,
        sender_id=msg.sender_id,
        sender_role=msg.sender_role,
        sender_email=msg.sender.email if msg.sender else None,
        body=msg.body,
        is_read=msg.is_read,
        attachments=[
            {
                "id": a.id,
                "filename": a.filename,
                "original_filename": a.original_filename,
                "content_type": a.content_type,
                "size_bytes": a.size_bytes,
                "created_at": a.created_at,
            }
            for a in (msg.attachments or [])
        ],
        created_at=msg.created_at,
    )


# ═══════════════════════════════════════════════════════
#  CRUD
# ═══════════════════════════════════════════════════════

@router.post("", response_model=TicketOut, status_code=status.HTTP_201_CREATED)
async def create_ticket(
    body: TicketCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Создать новый тикет."""
    # Валидация сервера (если указан)
    if body.server_id:
        from app.models.server import Server
        srv_result = await db.execute(
            select(Server).where(Server.id == body.server_id, Server.user_id == current_user.id)
        )
        if srv_result.scalar_one_or_none() is None:
            raise HTTPException(status_code=404, detail="Сервер не найден")

    ticket = Ticket(
        user_id=current_user.id,
        server_id=body.server_id,
        subject=body.subject,
        priority=body.priority,
        category=body.category,
        status="open",
        is_read_by_admin=False,
        is_read_by_user=True,
    )
    db.add(ticket)
    await db.flush()

    # Первое сообщение
    msg = TicketMessage(
        ticket_id=ticket.id,
        sender_id=current_user.id,
        sender_role="admin" if current_user.role == "admin" else "user",
        body=body.body,
        is_read=False,
    )
    db.add(msg)
    await db.flush()

    # Reload
    result = await db.execute(
        select(Ticket)
        .options(selectinload(Ticket.messages).selectinload(TicketMessage.attachments))
        .options(selectinload(Ticket.user))
        .where(Ticket.id == ticket.id)
    )
    ticket = result.scalar_one()

    # Отправляем WS-уведомление админам
    await _notify_ticket_event(ticket.id, "ticket_created", {
        "ticket_id": ticket.id,
        "subject": ticket.subject,
        "priority": ticket.priority,
        "user_email": current_user.email,
    })

    return _ticket_to_out(ticket)


@router.get("", response_model=TicketListOut)
async def list_tickets(
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=50),
    status_filter: str | None = Query(None, alias="status"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Список тикетов текущего пользователя."""
    query = select(Ticket).where(Ticket.user_id == current_user.id)

    if status_filter:
        query = query.where(Ticket.status == status_filter)

    # Count
    count_q = select(func.count()).select_from(query.subquery())
    total = (await db.execute(count_q)).scalar() or 0

    # Fetch
    offset = (page - 1) * per_page
    result = await db.execute(
        query
        .options(selectinload(Ticket.messages).selectinload(TicketMessage.attachments))
        .options(selectinload(Ticket.user))
        .order_by(Ticket.updated_at.desc())
        .offset(offset)
        .limit(per_page)
    )
    tickets = result.scalars().all()

    return TicketListOut(
        items=[_ticket_to_out(t) for t in tickets],
        total=total,
    )


@router.get("/{ticket_id}", response_model=TicketDetailOut)
async def get_ticket(
    ticket_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Получить тикет со всеми сообщениями."""
    result = await db.execute(
        select(Ticket)
        .options(selectinload(Ticket.messages).selectinload(TicketMessage.sender))
        .options(selectinload(Ticket.messages).selectinload(TicketMessage.attachments))
        .options(selectinload(Ticket.user))
        .where(Ticket.id == ticket_id, Ticket.user_id == current_user.id)
    )
    ticket = result.scalar_one_or_none()
    if ticket is None:
        raise HTTPException(status_code=404, detail="Тикет не найден")

    # Помечаем как прочитанное пользователем
    ticket.is_read_by_user = True
    for msg in ticket.messages:
        if msg.sender_role == "admin":
            msg.is_read = True
    await db.flush()

    ip = None
    hostname = None
    server_status = None
    if ticket.server:
        hostname = ticket.server.hostname
        server_status = ticket.server.status
        ip = ticket.server.ip_address.address if ticket.server.ip_address else None

    return TicketDetailOut(
        id=ticket.id,
        user_id=ticket.user_id,
        server_id=ticket.server_id,
        subject=ticket.subject,
        priority=ticket.priority,
        category=ticket.category,
        status=ticket.status,
        is_read_by_admin=ticket.is_read_by_admin,
        is_read_by_user=ticket.is_read_by_user,
        closed_at=ticket.closed_at,
        created_at=ticket.created_at,
        updated_at=ticket.updated_at,
        user_email=ticket.user.email if ticket.user else None,
        server_hostname=hostname,
        server_ip=ip,
        server_status=server_status,
        messages=[_message_to_out(m) for m in ticket.messages],
    )


@router.post("/{ticket_id}/messages", response_model=MessageOut, status_code=status.HTTP_201_CREATED)
async def send_message(
    ticket_id: int,
    body: MessageCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Отправить сообщение в тикет."""
    result = await db.execute(
        select(Ticket).where(Ticket.id == ticket_id, Ticket.user_id == current_user.id)
    )
    ticket = result.scalar_one_or_none()
    if ticket is None:
        raise HTTPException(status_code=404, detail="Тикет не найден")
    if ticket.status == "closed":
        raise HTTPException(status_code=400, detail="Тикет закрыт")

    msg = TicketMessage(
        ticket_id=ticket.id,
        sender_id=current_user.id,
        sender_role="user",
        body=body.body,
        is_read=False,
    )
    db.add(msg)

    # Обновляем тикет
    ticket.is_read_by_admin = False
    ticket.is_read_by_user = True
    if ticket.status == "awaiting_user":
        ticket.status = "open"
    await db.flush()
    await db.refresh(msg, attribute_names=["sender", "attachments"])

    # WS notify
    await _notify_ticket_event(ticket.id, "new_message", {
        "ticket_id": ticket.id,
        "message_id": msg.id,
        "sender_role": "user",
        "sender_email": current_user.email,
    })

    return _message_to_out(msg)


@router.post(
    "/{ticket_id}/messages/{message_id}/attachments",
    status_code=status.HTTP_201_CREATED,
)
async def upload_attachment(
    ticket_id: int,
    message_id: int,
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Загрузить вложение к сообщению."""
    # Проверяем тикет
    result = await db.execute(
        select(Ticket).where(Ticket.id == ticket_id, Ticket.user_id == current_user.id)
    )
    if result.scalar_one_or_none() is None:
        raise HTTPException(status_code=404, detail="Тикет не найден")

    # Проверяем сообщение
    msg_result = await db.execute(
        select(TicketMessage).where(
            TicketMessage.id == message_id,
            TicketMessage.ticket_id == ticket_id,
            TicketMessage.sender_id == current_user.id,
        )
    )
    if msg_result.scalar_one_or_none() is None:
        raise HTTPException(status_code=404, detail="Сообщение не найдено")

    # Валидация файла
    if file.filename is None:
        raise HTTPException(status_code=400, detail="Имя файла отсутствует")

    ext = os.path.splitext(file.filename)[1].lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(status_code=400, detail=f"Тип файла '{ext}' не разрешён")

    if file.content_type and file.content_type not in ALLOWED_CONTENT_TYPES:
        raise HTTPException(status_code=400, detail=f"Content-type '{file.content_type}' не разрешён")

    # Читаем и проверяем размер
    content = await file.read()
    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(status_code=400, detail="Файл слишком большой (макс. 25 МБ)")

    # Сохраняем на диск
    safe_name = f"{uuid.uuid4().hex}{ext}"
    ticket_dir = UPLOAD_DIR / str(ticket_id)
    ticket_dir.mkdir(parents=True, exist_ok=True)
    file_path = ticket_dir / safe_name

    with open(file_path, "wb") as f:
        f.write(content)

    # Запись в БД
    attachment = TicketAttachment(
        message_id=message_id,
        filename=safe_name,
        original_filename=file.filename,
        content_type=file.content_type or "application/octet-stream",
        size_bytes=len(content),
        storage_path=str(file_path),
    )
    db.add(attachment)
    await db.flush()
    await db.refresh(attachment)

    return {
        "id": attachment.id,
        "filename": attachment.filename,
        "original_filename": attachment.original_filename,
        "content_type": attachment.content_type,
        "size_bytes": attachment.size_bytes,
        "created_at": attachment.created_at.isoformat(),
    }


@router.get("/attachments/{attachment_id}")
async def download_attachment(
    attachment_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Скачать вложение (если принадлежит тикету пользователя)."""
    query = (
        select(TicketAttachment)
        .join(TicketMessage, TicketMessage.id == TicketAttachment.message_id)
        .join(Ticket, Ticket.id == TicketMessage.ticket_id)
        .where(TicketAttachment.id == attachment_id)
    )
    # Обычный пользователь видит только свои вложения, админ — все
    if current_user.role != "admin":
        query = query.where(Ticket.user_id == current_user.id)
    result = await db.execute(query)
    attachment = result.scalar_one_or_none()
    if attachment is None:
        raise HTTPException(status_code=404, detail="Вложение не найдено")

    if not os.path.exists(attachment.storage_path):
        raise HTTPException(status_code=404, detail="Файл не найден на сервере")

    return FileResponse(
        attachment.storage_path,
        filename=attachment.original_filename,
        media_type=attachment.content_type,
    )


@router.patch("/{ticket_id}/close")
async def close_ticket(
    ticket_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Закрыть тикет (пользователем)."""
    result = await db.execute(
        select(Ticket).where(Ticket.id == ticket_id, Ticket.user_id == current_user.id)
    )
    ticket = result.scalar_one_or_none()
    if ticket is None:
        raise HTTPException(status_code=404, detail="Тикет не найден")

    ticket.status = "closed"
    ticket.closed_at = datetime.now(timezone.utc)
    await db.flush()

    await _notify_ticket_event(ticket.id, "ticket_closed", {"ticket_id": ticket.id})

    return {"detail": "Тикет закрыт"}


# ── WS уведомления ───────────────────────────────────

async def _notify_ticket_event(ticket_id: int, event: str, data: dict):
    """Отправляет событие через Redis PubSub в канал ticket_updates."""
    try:
        import json
        import redis.asyncio as aioredis
        from app.config import settings

        r = aioredis.from_url(settings.REDIS_URL, decode_responses=True)
        payload = {"event": event, "ticket_id": ticket_id, **data}
        await r.publish("ticket_updates", json.dumps(payload))
        await r.close()
    except Exception:
        pass  # Redis недоступен — не блокируем основную логику
