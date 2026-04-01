/**
 * useWebSocket — hook для получения real-time обновлений статуса VPS.
 * Подключается к WebSocket бэкенда, аутентифицируется по JWT,
 * и вызывает onMessage при получении события.
 */
"use client";

import { useEffect, useRef, useCallback } from "react";
import { getToken } from "@/lib/auth";

const WS_URL = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000")
  .replace("http://", "ws://")
  .replace("https://", "wss://");

export interface VpsStatusEvent {
  event: string;
  user_id?: number;
  server_id?: number;
  status?: string;
  hostname?: string;
  ip_address?: string | null;
  balance?: string;
}

export function useVpsWebSocket(onMessage: (event: VpsStatusEvent) => void) {
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout>>();

  const connect = useCallback(() => {
    const token = getToken();
    if (!token) return;

    const ws = new WebSocket(`${WS_URL}/ws/servers`);
    wsRef.current = ws;

    ws.onopen = () => {
      // Отправляем JWT для аутентификации
      ws.send(JSON.stringify({ token }));
    };

    ws.onmessage = (event) => {
      try {
        const data: VpsStatusEvent = JSON.parse(event.data);
        if (data.event !== "connected") {
          onMessage(data);
        }
      } catch {
        // ignore
      }
    };

    ws.onclose = () => {
      // Reconnect через 5 секунд
      reconnectTimer.current = setTimeout(connect, 5000);
    };

    ws.onerror = () => {
      ws.close();
    };
  }, [onMessage]);

  useEffect(() => {
    connect();
    return () => {
      clearTimeout(reconnectTimer.current);
      wsRef.current?.close();
    };
  }, [connect]);

  return wsRef;
}
