"""
Тесты авторизации — регистрация, логин, me.
"""
from __future__ import annotations

import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_register_success(client: AsyncClient):
    """Успешная регистрация нового пользователя."""
    resp = await client.post("/api/auth/register", json={
        "email": "test@example.com",
        "password": "password123",
    })
    assert resp.status_code == 201
    data = resp.json()
    assert data["email"] == "test@example.com"
    assert data["role"] == "user"
    assert data["balance"] == 0.0


@pytest.mark.asyncio
async def test_register_duplicate(client: AsyncClient):
    """Повторная регистрация с тем же email = 409."""
    await client.post("/api/auth/register", json={
        "email": "dup@example.com",
        "password": "password123",
    })
    resp = await client.post("/api/auth/register", json={
        "email": "dup@example.com",
        "password": "password123",
    })
    assert resp.status_code == 409


@pytest.mark.asyncio
async def test_login_success(client: AsyncClient):
    """Успешный логин → получаем токен."""
    await client.post("/api/auth/register", json={
        "email": "login@example.com",
        "password": "password123",
    })
    resp = await client.post("/api/auth/login", json={
        "email": "login@example.com",
        "password": "password123",
    })
    assert resp.status_code == 200
    data = resp.json()
    assert "access_token" in data
    assert data["token_type"] == "bearer"


@pytest.mark.asyncio
async def test_login_wrong_password(client: AsyncClient):
    """Неверный пароль = 401."""
    await client.post("/api/auth/register", json={
        "email": "wrong@example.com",
        "password": "password123",
    })
    resp = await client.post("/api/auth/login", json={
        "email": "wrong@example.com",
        "password": "wrongpass",
    })
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_me_endpoint(client: AsyncClient):
    """Получение текущего пользователя по токену."""
    await client.post("/api/auth/register", json={
        "email": "me@example.com",
        "password": "password123",
    })
    login_resp = await client.post("/api/auth/login", json={
        "email": "me@example.com",
        "password": "password123",
    })
    token = login_resp.json()["access_token"]

    resp = await client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 200
    assert resp.json()["email"] == "me@example.com"


@pytest.mark.asyncio
async def test_me_unauthorized(client: AsyncClient):
    """Без токена = 401."""
    resp = await client.get("/api/auth/me")
    assert resp.status_code == 401
