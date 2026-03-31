"""
Сервис Proxmox VE API — создание/управление VM через REST API Proxmox.
"""
from __future__ import annotations

from typing import Any

import httpx
from loguru import logger

from app.exceptions import ProxmoxError
from app.models.node import Node


class ProxmoxClient:
    """Клиент для работы с Proxmox VE REST API."""

    def __init__(self, node: Node):
        self.base_url = f"https://{node.hostname}:{node.port}/api2/json"
        self.headers = {
            "Authorization": f"PVEAPIToken={node.api_user}!{node.api_token_name}={node.api_token_value}"
        }
        self.verify_ssl = False  # В проде — True + CA

    async def _request(self, method: str, path: str, **kwargs) -> dict[str, Any]:
        """Базовый HTTP-запрос к Proxmox API."""
        url = f"{self.base_url}{path}"
        try:
            async with httpx.AsyncClient(verify=self.verify_ssl, timeout=30.0) as client:
                resp = await client.request(method, url, headers=self.headers, **kwargs)
                resp.raise_for_status()
                return resp.json().get("data", {})
        except httpx.HTTPStatusError as e:
            logger.error(f"Proxmox HTTP error: {e.response.status_code} — {e.response.text}")
            raise ProxmoxError(f"Proxmox вернул ошибку {e.response.status_code}")
        except httpx.RequestError as e:
            logger.error(f"Proxmox connection error: {e}")
            raise ProxmoxError("Не удалось подключиться к Proxmox")

    # ── VM Lifecycle ─────────────────────────────────

    async def get_next_vmid(self) -> int:
        """Получить следующий свободный VMID."""
        data = await self._request("GET", "/cluster/nextid")
        return int(data) if isinstance(data, (int, str)) else int(data.get("data", 100))

    async def create_vm(
        self,
        node_name: str,
        vmid: int,
        template: str,
        cores: int,
        memory_mb: int,
        disk_gb: int,
        hostname: str,
        ip_address: str,
        gateway: str,
    ) -> dict:
        """
        Клонировать / создать VM из шаблона.
        Используем qemu clone + resize.
        """
        # Шаг 1: Клонируем шаблон
        clone_data = {
            "newid": vmid,
            "name": hostname,
            "full": 1,  # Полный клон
        }
        logger.info(f"Proxmox: клонирую шаблон {template} → vmid={vmid}")
        result = await self._request(
            "POST",
            f"/nodes/{node_name}/qemu/{template}/clone",
            data=clone_data,
        )

        # Шаг 2: Настраиваем ресурсы
        config_data = {
            "cores": cores,
            "memory": memory_mb,
            "name": hostname,
            "ipconfig0": f"ip={ip_address}/24,gw={gateway}",
        }
        await self._request("PUT", f"/nodes/{node_name}/qemu/{vmid}/config", data=config_data)

        # Шаг 3: Resize диска
        await self._request(
            "PUT",
            f"/nodes/{node_name}/qemu/{vmid}/resize",
            data={"disk": "scsi0", "size": f"{disk_gb}G"},
        )

        return result

    async def start_vm(self, node_name: str, vmid: int) -> dict:
        """Запустить VM."""
        return await self._request("POST", f"/nodes/{node_name}/qemu/{vmid}/status/start")

    async def stop_vm(self, node_name: str, vmid: int) -> dict:
        """Остановить VM (graceful shutdown)."""
        return await self._request("POST", f"/nodes/{node_name}/qemu/{vmid}/status/shutdown")

    async def restart_vm(self, node_name: str, vmid: int) -> dict:
        """Перезагрузить VM."""
        return await self._request("POST", f"/nodes/{node_name}/qemu/{vmid}/status/reboot")

    async def delete_vm(self, node_name: str, vmid: int) -> dict:
        """Удалить VM."""
        # Сначала остановим, если запущена
        try:
            await self.stop_vm(node_name, vmid)
        except ProxmoxError:
            pass  # VM уже остановлена
        return await self._request("DELETE", f"/nodes/{node_name}/qemu/{vmid}")

    async def get_vm_status(self, node_name: str, vmid: int) -> dict:
        """Получить статус VM."""
        return await self._request("GET", f"/nodes/{node_name}/qemu/{vmid}/status/current")

    async def get_vnc_ticket(self, node_name: str, vmid: int) -> dict:
        """
        Получить VNC-тикет для noVNC-консоли.
        Возвращает {"ticket": "...", "port": "..."}
        """
        return await self._request("POST", f"/nodes/{node_name}/qemu/{vmid}/vncproxy", data={"websocket": 1})

    async def get_node_status(self, node_name: str) -> dict:
        """Получить состояние ресурсов ноды."""
        return await self._request("GET", f"/nodes/{node_name}/status")
