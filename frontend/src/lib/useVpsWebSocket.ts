/**
 * useWebSocket — hook для получения real-time обновлений статуса VPS.
 * Подключается к WebSocket бэкенда, аутентифицируется по JWT,
 * и вызывает onMessage при получении события.
 *
 * Использует useRef для callback, чтобы избежать бесконечного
 * reconnect-цикла при пересоздании onMessage.
 */
"use client";

import { useEffect, useRef } from "react";
import { getToken } from "@/lib/auth";

const WS_URL = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000")
  .replace("http://", "ws://")
  .replace("https://", "wss://");

const MAX_RECONNECT_DELAY = 30_000; // макс. 30 сек между попытками
const BASE_RECONNECT_DELAY = 3_000; // начальная задержка 3 сек

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
  const onMessageRef = useRef(onMessage);
  const closedIntentionally = useRef(false);
  const retriesRef = useRef(0);

  // Всегда обновляем ref на актуальный callback — без пересоздания эффекта
  onMessageRef.current = onMessage;

  useEffect(() => {
    closedIntentionally.current = false;
    retriesRef.current = 0;

    function connect() {
      const token = getToken();
      if (!token) return;

      const ws = new WebSocket(`${WS_URL}/ws/servers`);
      wsRef.current = ws;

      ws.onopen = () => {
        retriesRef.current = 0; // сброс при успешном подключении
        ws.send(JSON.stringify({ token }));
      };

      ws.onmessage = (event) => {
        try {
          const data: VpsStatusEvent = JSON.parse(event.data);
          if (data.event !== "connected") {
            onMessageRef.current(data);
          }
        } catch {
          // ignore malformed JSON
        }
      };

      ws.onclose = () => {
        if (closedIntentionally.current) return;
        // Exponential backoff с лимитом
        const delay = Math.min(
          BASE_RECONNECT_DELAY * Math.pow(2, retriesRef.current),
          MAX_RECONNECT_DELAY
        );
        retriesRef.current++;
        reconnectTimer.current = setTimeout(connect, delay);
      };

      ws.onerror = () => {
        ws.close();
      };
    }

    connect();

    return () => {
      closedIntentionally.current = true;
      clearTimeout(reconnectTimer.current);
      wsRef.current?.close();
    };
  }, []); // пустой dep-массив — подключение создаётся один раз

  return wsRef;
}
