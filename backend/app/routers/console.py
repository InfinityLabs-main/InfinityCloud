"""
Роутер noVNC-консоли.

Эндпоинты:
  GET /api/console/{server_id}/vnc  — Получить URL для noVNC iframe
"""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.deps import get_current_user
from app.models.server import Server
from app.models.user import User
from app.services.proxmox import ProxmoxClient

router = APIRouter()


@router.get("/{server_id}/vnc")
async def get_vnc_console(
    server_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Получить VNC-консоль для VPS.

    Response 200:
        {
            "url": "https://proxmox-host:8006/?console=kvm&vmid=100&...",
            "ticket": "PVE:...",
            "port": "5900"
        }
    """
    result = await db.execute(
        select(Server).where(Server.id == server_id, Server.user_id == current_user.id)
    )
    server = result.scalar_one_or_none()
    if server is None:
        raise HTTPException(status_code=404, detail="Сервер не найден")

    if server.node is None or server.proxmox_vmid is None:
        raise HTTPException(status_code=400, detail="VPS ещё не развёрнут")

    if server.status not in ("running",):
        raise HTTPException(status_code=400, detail="VPS должен быть запущен для доступа к консоли")

    client = ProxmoxClient(server.node)
    vnc_data = await client.get_vnc_ticket(server.node.name, server.proxmox_vmid)

    # Формируем URL для noVNC
    host = server.node.hostname
    port = server.node.port
    vnc_url = (
        f"https://{host}:{port}/?console=kvm&vmid={server.proxmox_vmid}"
        f"&vmname={server.hostname}&node={server.node.name}"
    )

    return {
        "url": vnc_url,
        "ticket": vnc_data.get("ticket", ""),
        "port": vnc_data.get("port", ""),
    }
