"""
Тесты серверов — создание, листинг, действия.
"""
from __future__ import annotations

from unittest.mock import patch

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.plan import Plan


async def _create_user_and_login(client: AsyncClient, email: str = "vps@example.com") -> str:
    """Хелпер: регистрация + логин → возвращает токен."""
    await client.post("/api/auth/register", json={"email": email, "password": "password123"})
    resp = await client.post("/api/auth/login", json={"email": email, "password": "password123"})
    return resp.json()["access_token"]


@pytest.mark.asyncio
async def test_list_servers_empty(client: AsyncClient):
    """Пустой список серверов у нового пользователя."""
    token = await _create_user_and_login(client, "list@example.com")
    resp = await client.get("/api/servers", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 200
    assert resp.json()["total"] == 0


@pytest.mark.asyncio
async def test_create_server_no_plan(client: AsyncClient):
    """Создание VPS с несуществующим тарифом = 404."""
    token = await _create_user_and_login(client, "noplan@example.com")
    resp = await client.post("/api/servers", json={
        "plan_id": 999,
        "hostname": "test-server",
        "os_template": "ubuntu-22.04",
    }, headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_get_plans_empty(client: AsyncClient):
    """Пустой список тарифов."""
    resp = await client.get("/api/plans")
    assert resp.status_code == 200
    assert resp.json() == []


@pytest.mark.asyncio
async def test_health_check(client: AsyncClient):
    """Health check endpoint."""
    resp = await client.get("/api/health")
    assert resp.status_code == 200
    assert resp.json()["status"] == "ok"
