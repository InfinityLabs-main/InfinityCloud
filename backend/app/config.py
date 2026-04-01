"""
Infinity Cloud — Конфигурация приложения.
Все секреты и настройки берутся из переменных окружения (.env).
"""
from __future__ import annotations

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    # ── Database ──────────────────────────────────────
    DATABASE_URL: str = "postgresql+asyncpg://infinity:infinity_secret@localhost:5432/infinity_cloud"
    DATABASE_URL_SYNC: str = "postgresql://infinity:infinity_secret@localhost:5432/infinity_cloud"

    # ── Redis ─────────────────────────────────────────
    REDIS_URL: str = "redis://localhost:6379/0"

    # ── JWT ───────────────────────────────────────────
    SECRET_KEY: str = ""
    JWT_ALGORITHM: str = "HS256"
    JWT_ACCESS_TOKEN_EXPIRE_MINUTES: int = 60

    # ── Proxmox VE ───────────────────────────────────
    PROXMOX_HOST: str = "https://proxmox.example.com:8006"
    PROXMOX_USER: str = "root@pam"
    PROXMOX_TOKEN_NAME: str = "infinity"
    PROXMOX_TOKEN_VALUE: str = ""
    PROXMOX_VERIFY_SSL: bool = False

    # ── CORS ──────────────────────────────────────────
    CORS_ORIGINS: str = "http://localhost:3000"

    # ── Rate-limit ────────────────────────────────────
    RATE_LIMIT_PER_MINUTE: int = 100
    RATE_LIMIT_LOGIN_PER_5MIN: int = 5

    # ── Sentry ────────────────────────────────────────
    SENTRY_DSN: str = ""

    # ── Admin bootstrap ───────────────────────────────
    ADMIN_EMAIL: str = "admin@infinity.cloud"
    ADMIN_PASSWORD: str = "Admin123!"

    # ── YooKassa ──────────────────────────────────────
    YOOKASSA_SHOP_ID: str = ""
    YOOKASSA_SECRET_KEY: str = ""
    YOOKASSA_RETURN_URL: str = "http://localhost:3000/dashboard"
    YOOKASSA_WEBHOOK_SECRET: str = ""

    # ── Email / SMTP ──────────────────────────────────
    SMTP_HOST: str = ""
    SMTP_PORT: int = 587
    SMTP_USER: str = ""
    SMTP_PASSWORD: str = ""
    SMTP_FROM: str = "noreply@infinity.cloud"
    SMTP_USE_TLS: bool = True

    # ── Node alerts ───────────────────────────────────
    NODE_ALERT_CPU_THRESHOLD: int = 80
    NODE_ALERT_RAM_THRESHOLD: int = 80
    NODE_ALERT_DISK_THRESHOLD: int = 85

    @property
    def cors_origins_list(self) -> list[str]:
        return [o.strip() for o in self.CORS_ORIGINS.split(",") if o.strip()]


settings = Settings()

# ── Валидация критических секретов при старте ─────────
if not settings.SECRET_KEY or settings.SECRET_KEY == "CHANGE_ME":
    raise RuntimeError(
        "FATAL: SECRET_KEY не установлен! Задайте надёжный ключ в .env: "
        "SECRET_KEY=$(openssl rand -hex 32)"
    )
