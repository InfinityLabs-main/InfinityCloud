"""
Сервис email-уведомлений.
Отправка писем через SMTP (aiosmtplib).
"""
from __future__ import annotations

from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

import aiosmtplib
from loguru import logger

from app.config import settings


async def send_email(to: str, subject: str, html_body: str) -> bool:
    """
    Отправить email через SMTP.
    Возвращает True при успехе, False при ошибке.
    """
    if not settings.SMTP_HOST:
        logger.warning(f"SMTP не настроен, email не отправлен: {subject} → {to}")
        return False

    try:
        msg = MIMEMultipart("alternative")
        msg["From"] = settings.SMTP_FROM
        msg["To"] = to
        msg["Subject"] = subject
        msg.attach(MIMEText(html_body, "html", "utf-8"))

        await aiosmtplib.send(
            msg,
            hostname=settings.SMTP_HOST,
            port=settings.SMTP_PORT,
            username=settings.SMTP_USER or None,
            password=settings.SMTP_PASSWORD or None,
            use_tls=settings.SMTP_USE_TLS,
        )
        logger.info(f"Email отправлен: {subject} → {to}")
        return True
    except Exception as e:
        logger.error(f"Ошибка отправки email: {e}")
        return False


def render_vps_created(hostname: str, ip: str | None, plan_name: str) -> tuple[str, str]:
    """Шаблон: VPS создан."""
    subject = f"✅ VPS «{hostname}» создан — Infinity Cloud"
    body = f"""
    <div style="font-family:sans-serif;max-width:600px;margin:0 auto">
        <h2 style="color:#4F46E5">∞ Infinity Cloud</h2>
        <p>Ваш сервер <strong>{hostname}</strong> успешно создан!</p>
        <table style="border-collapse:collapse;width:100%;margin:16px 0">
            <tr><td style="padding:8px;border:1px solid #e5e7eb"><strong>Hostname</strong></td>
                <td style="padding:8px;border:1px solid #e5e7eb">{hostname}</td></tr>
            <tr><td style="padding:8px;border:1px solid #e5e7eb"><strong>IP-адрес</strong></td>
                <td style="padding:8px;border:1px solid #e5e7eb">{ip or 'Назначается…'}</td></tr>
            <tr><td style="padding:8px;border:1px solid #e5e7eb"><strong>Тариф</strong></td>
                <td style="padding:8px;border:1px solid #e5e7eb">{plan_name}</td></tr>
        </table>
        <p>Управляйте сервером в <a href="{settings.YOOKASSA_RETURN_URL}" style="color:#4F46E5">панели управления</a>.</p>
    </div>
    """
    return subject, body


def render_vps_suspended(hostname: str, balance: str) -> tuple[str, str]:
    """Шаблон: VPS приостановлен (нехватка средств)."""
    subject = f"⚠️ VPS «{hostname}» приостановлен — пополните баланс"
    body = f"""
    <div style="font-family:sans-serif;max-width:600px;margin:0 auto">
        <h2 style="color:#EAB308">⚠️ Infinity Cloud</h2>
        <p>Ваш сервер <strong>{hostname}</strong> приостановлен из-за недостаточного баланса.</p>
        <p>Текущий баланс: <strong>{balance} ₽</strong></p>
        <p><a href="{settings.YOOKASSA_RETURN_URL}" style="color:#4F46E5;font-weight:bold">Пополнить баланс →</a></p>
    </div>
    """
    return subject, body


def render_payment_received(amount: str, new_balance: str) -> tuple[str, str]:
    """Шаблон: Платёж получен."""
    subject = f"💳 Платёж {amount} ₽ получен — Infinity Cloud"
    body = f"""
    <div style="font-family:sans-serif;max-width:600px;margin:0 auto">
        <h2 style="color:#22C55E">✅ Infinity Cloud</h2>
        <p>Ваш платёж на сумму <strong>{amount} ₽</strong> успешно зачислен.</p>
        <p>Новый баланс: <strong>{new_balance} ₽</strong></p>
    </div>
    """
    return subject, body


def render_node_alert(node_name: str, cpu: float, ram: float, disk: float) -> tuple[str, str]:
    """Шаблон: Алерт загрузки ноды (для админа)."""
    subject = f"🔴 Нода «{node_name}» перегружена — Infinity Cloud"
    body = f"""
    <div style="font-family:sans-serif;max-width:600px;margin:0 auto">
        <h2 style="color:#EF4444">🔴 Alert: нода перегружена</h2>
        <p>Нода <strong>{node_name}</strong> превысила пороги загрузки:</p>
        <table style="border-collapse:collapse;width:100%;margin:16px 0">
            <tr><td style="padding:8px;border:1px solid #e5e7eb"><strong>CPU</strong></td>
                <td style="padding:8px;border:1px solid #e5e7eb">{cpu:.1f}%</td></tr>
            <tr><td style="padding:8px;border:1px solid #e5e7eb"><strong>RAM</strong></td>
                <td style="padding:8px;border:1px solid #e5e7eb">{ram:.1f}%</td></tr>
            <tr><td style="padding:8px;border:1px solid #e5e7eb"><strong>Disk</strong></td>
                <td style="padding:8px;border:1px solid #e5e7eb">{disk:.1f}%</td></tr>
        </table>
        <p>Рекомендуется добавить ресурсы или ноду.</p>
    </div>
    """
    return subject, body
