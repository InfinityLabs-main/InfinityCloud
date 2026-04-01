"""
Роутер платежей — интеграция с YooKassa.

Эндпоинты:
  POST /api/v1/payments/create    — Создать платёж (получить URL для оплаты)
  POST /api/v1/payments/webhook   — Webhook от YooKassa (подтверждение платежа)
  GET  /api/v1/payments/status/{id} — Проверить статус платежа
"""
from __future__ import annotations

import hashlib
import hmac
import json
import uuid
from decimal import Decimal

import httpx
from fastapi import APIRouter, Depends, HTTPException, Request, status
from loguru import logger
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import get_db
from app.deps import get_current_user
from app.models.user import User
from app.services.billing import deposit_user

router = APIRouter()


# ── Схемы ─────────────────────────────────────────────

class PaymentCreate(BaseModel):
    amount: float = Field(gt=0, le=100000, description="Сумма оплаты в рублях")


class PaymentResponse(BaseModel):
    payment_id: str
    confirmation_url: str
    amount: float
    status: str


# ── YooKassa API Client ──────────────────────────────

YOOKASSA_API_URL = "https://api.yookassa.ru/v3"


async def _yookassa_request(method: str, path: str, data: dict | None = None) -> dict:
    """Запрос к YooKassa API."""
    if not settings.YOOKASSA_SHOP_ID or not settings.YOOKASSA_SECRET_KEY:
        raise HTTPException(status_code=503, detail="Платёжная система не настроена")

    auth = (settings.YOOKASSA_SHOP_ID, settings.YOOKASSA_SECRET_KEY)
    headers = {
        "Content-Type": "application/json",
        "Idempotence-Key": str(uuid.uuid4()),
    }

    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.request(
            method,
            f"{YOOKASSA_API_URL}{path}",
            auth=auth,
            headers=headers,
            json=data,
        )
        if resp.status_code >= 400:
            logger.error(f"YooKassa error: {resp.status_code} — {resp.text}")
            raise HTTPException(status_code=502, detail="Ошибка платёжной системы")
        return resp.json()


# ── Эндпоинты ─────────────────────────────────────────

@router.post("/create", response_model=PaymentResponse)
async def create_payment(
    body: PaymentCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Создать платёж через YooKassa.
    Возвращает URL для перенаправления пользователя на страницу оплаты.
    """
    payment_data = {
        "amount": {
            "value": f"{body.amount:.2f}",
            "currency": "RUB",
        },
        "confirmation": {
            "type": "redirect",
            "return_url": settings.YOOKASSA_RETURN_URL,
        },
        "capture": True,
        "description": f"Пополнение баланса Infinity Cloud (user #{current_user.id})",
        "metadata": {
            "user_id": str(current_user.id),
        },
    }

    result = await _yookassa_request("POST", "/payments", payment_data)

    return PaymentResponse(
        payment_id=result["id"],
        confirmation_url=result["confirmation"]["confirmation_url"],
        amount=body.amount,
        status=result["status"],
    )


@router.post("/webhook", status_code=status.HTTP_200_OK)
async def payment_webhook(request: Request, db: AsyncSession = Depends(get_db)):
    """
    Webhook от YooKassa.
    Вызывается при изменении статуса платежа (payment.succeeded, etc.).
    """
    body = await request.body()
    body_str = body.decode("utf-8")

    # Верификация webhook (если задан секрет)
    if settings.YOOKASSA_WEBHOOK_SECRET:
        signature = request.headers.get("Content-Hmac", "")
        expected = hmac.new(
            settings.YOOKASSA_WEBHOOK_SECRET.encode(),
            body,
            hashlib.sha256,
        ).hexdigest()
        # YooKassa отправляет подпись в формате sha256=xxx
        if not hmac.compare_digest(signature.replace("sha256=", ""), expected):
            logger.warning("YooKassa webhook: невалидная подпись")
            raise HTTPException(status_code=403, detail="Invalid signature")

    try:
        data = json.loads(body_str)
    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="Invalid JSON")

    event = data.get("event")
    payment = data.get("object", {})

    if event == "payment.succeeded":
        user_id_str = payment.get("metadata", {}).get("user_id")
        if not user_id_str:
            logger.error("YooKassa webhook: нет user_id в metadata")
            return {"status": "ignored"}

        user_id = int(user_id_str)
        amount = Decimal(payment["amount"]["value"])
        payment_id = payment["id"]

        # Idempotency: проверяем не был ли уже зачислен этот платёж
        from app.models.transaction import Transaction
        existing = await db.execute(
            select(Transaction).where(
                Transaction.description.contains(payment_id)
            )
        )
        if existing.scalar_one_or_none():
            logger.info(f"YooKassa: платёж {payment_id} уже обработан")
            return {"status": "already_processed"}

        tx = await deposit_user(
            db,
            user_id,
            amount,
            description=f"YooKassa платёж {payment_id}",
        )
        await db.commit()

        # Отправляем email-уведомление
        try:
            from app.services.email import render_payment_received, send_email
            user_result = await db.execute(select(User).where(User.id == user_id))
            user = user_result.scalar_one_or_none()
            if user:
                subj, body = render_payment_received(str(amount), str(user.balance))
                await send_email(user.email, subj, body)
        except Exception as e:
            logger.error(f"Ошибка отправки email о платеже: {e}")

        # Публикуем событие в WebSocket через Redis
        try:
            import redis.asyncio as aioredis
            r = aioredis.from_url(settings.REDIS_URL)
            await r.publish("vps_status", json.dumps({
                "event": "balance_updated",
                "user_id": user_id,
                "balance": str(tx.balance_after),
            }))
            await r.close()
        except Exception:
            pass

        logger.info(f"YooKassa: зачислено {amount}₽ пользователю #{user_id}")
        return {"status": "ok"}

    logger.info(f"YooKassa webhook: событие {event} проигнорировано")
    return {"status": "ignored"}


@router.get("/status/{payment_id}")
async def get_payment_status(
    payment_id: str,
    current_user: User = Depends(get_current_user),
):
    """Проверить статус платежа."""
    result = await _yookassa_request("GET", f"/payments/{payment_id}")
    return {
        "payment_id": result["id"],
        "status": result["status"],
        "amount": result["amount"]["value"],
        "paid": result.get("paid", False),
    }
