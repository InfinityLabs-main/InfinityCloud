"""
Infinity Cloud — Глобальная обработка исключений.
"""
from __future__ import annotations

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from loguru import logger


class AppException(Exception):
    """Базовое исключение приложения."""
    def __init__(self, status_code: int = 400, detail: str = "Ошибка"):
        self.status_code = status_code
        self.detail = detail


class InsufficientFundsError(AppException):
    def __init__(self):
        super().__init__(402, "Недостаточно средств на балансе")


class NodeUnavailableError(AppException):
    def __init__(self):
        super().__init__(503, "Нет доступных нод с достаточными ресурсами")


class ProxmoxError(AppException):
    def __init__(self, detail: str = "Ошибка Proxmox API"):
        super().__init__(502, detail)


def register_exception_handlers(app: FastAPI) -> None:
    """Регистрация глобальных обработчиков исключений."""

    @app.exception_handler(AppException)
    async def app_exception_handler(_: Request, exc: AppException) -> JSONResponse:
        logger.warning(f"AppException: {exc.detail}")
        return JSONResponse(status_code=exc.status_code, content={"detail": exc.detail})

    @app.exception_handler(Exception)
    async def unhandled_exception_handler(_: Request, exc: Exception) -> JSONResponse:
        logger.exception(f"Unhandled exception: {exc}")
        return JSONResponse(status_code=500, content={"detail": "Внутренняя ошибка сервера"})
