"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Navbar from "@/components/Navbar";
import { serverApi, consoleApi, type Server } from "@/lib/api";
import { useAuthGuard } from "@/lib/useAuthGuard";
import { useVpsWebSocket, type VpsStatusEvent } from "@/lib/useVpsWebSocket";

export default function ServerDetailPage() {
  const { allowed } = useAuthGuard();
  const params = useParams();
  const router = useRouter();
  const serverId = Number(params.id);

  const [server, setServer] = useState<Server | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState("");
  const [rdns, setRdns] = useState("");
  const [consoleUrl, setConsoleUrl] = useState("");
  const [showConsole, setShowConsole] = useState(false);

  // WebSocket — обновление статуса VPS в реальном времени
  const handleWsMessage = useCallback((event: VpsStatusEvent) => {
    if (event.event === "status_change" && event.server_id === serverId) {
      setServer((prev) =>
        prev ? { ...prev, status: event.status || prev.status, ip_address: event.ip_address ?? prev.ip_address } : prev
      );
    }
  }, [serverId]);
  useVpsWebSocket(handleWsMessage);

  useEffect(() => {
    if (allowed) loadServer();
  }, [serverId, allowed]);

  const loadServer = async () => {
    try {
      const res = await serverApi.get(serverId);
      setServer(res.data);
      setRdns(res.data.rdns || "");
    } catch {
      router.push("/dashboard");
    } finally {
      setLoading(false);
    }
  };

  const handleAction = async (action: string) => {
    setActionLoading(action);
    try {
      const res = await serverApi.action(serverId, action);
      setServer(res.data);
    } catch (err: any) {
      alert(err.response?.data?.detail || "Ошибка");
    } finally {
      setActionLoading("");
    }
  };

  const handleRdns = async () => {
    try {
      const res = await serverApi.updateRdns(serverId, rdns);
      setServer(res.data);
    } catch (err: any) {
      alert(err.response?.data?.detail || "Ошибка");
    }
  };

  const handleConsole = async () => {
    try {
      const res = await consoleApi.getVnc(serverId);
      setConsoleUrl(res.data.url);
      setShowConsole(true);
    } catch (err: any) {
      alert(err.response?.data?.detail || "Консоль недоступна");
    }
  };

  const handleDelete = async () => {
    if (!confirm("Вы уверены? VPS будет удалён безвозвратно.")) return;
    try {
      await serverApi.delete(serverId);
      router.push("/dashboard");
    } catch (err: any) {
      alert(err.response?.data?.detail || "Ошибка удаления");
    }
  };

  if (loading || !server) {
    return (
      <div className="min-h-screen bg-[#060010]">
        <Navbar />
        <div className="flex items-center justify-center h-64">
          <div className="text-gray-400">Загрузка…</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#060010]">
      <Navbar />
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Заголовок */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-white">
              {server.hostname}
            </h1>
            <p className="text-gray-400 mt-1">
              {server.ip_address || "IP назначается…"} · VMID:{" "}
              {server.proxmox_vmid || "—"}
            </p>
          </div>
          <span
            className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
              server.status === "running"
                ? "bg-green-500/10 text-green-400 border border-green-500/20"
                : server.status === "stopped"
                ? "bg-gray-500/10 text-gray-400 border border-gray-500/20"
                : server.status === "suspended"
                ? "bg-yellow-500/10 text-yellow-400 border border-yellow-500/20"
                : "bg-blue-500/10 text-blue-400 border border-blue-500/20"
            }`}
          >
            {server.status}
          </span>
        </div>

        {/* Действия */}
        <div className="bg-white/[0.04] backdrop-blur-sm border border-white/[0.08] rounded-2xl p-6 mb-6">
          <h2 className="font-semibold text-white mb-4">Управление</h2>
          <div className="flex flex-wrap gap-3">
            <button
              onClick={() => handleAction("start")}
              disabled={!!actionLoading || server.status === "running"}
              className="btn-primary disabled:opacity-50"
            >
              {actionLoading === "start" ? "…" : "▶ Запустить"}
            </button>
            <button
              onClick={() => handleAction("stop")}
              disabled={!!actionLoading || server.status === "stopped"}
              className="btn-secondary disabled:opacity-50"
            >
              {actionLoading === "stop" ? "…" : "⏹ Остановить"}
            </button>
            <button
              onClick={() => handleAction("restart")}
              disabled={!!actionLoading}
              className="btn-secondary disabled:opacity-50"
            >
              {actionLoading === "restart" ? "…" : "🔄 Перезагрузить"}
            </button>
            <button
              onClick={handleConsole}
              disabled={server.status !== "running"}
              className="btn-secondary disabled:opacity-50"
            >
              🖥️ Консоль
            </button>
            <button onClick={handleDelete} className="btn-danger ml-auto">
              🗑️ Удалить
            </button>
          </div>
        </div>

        {/* Консоль noVNC */}
        {showConsole && consoleUrl && (
          <div className="bg-white/[0.04] backdrop-blur-sm border border-white/[0.08] rounded-2xl p-6 mb-6">
            <h2 className="font-semibold text-white mb-4">
              noVNC Консоль
              <button
                onClick={() => setShowConsole(false)}
                className="text-sm text-gray-400 hover:text-gray-300 ml-4"
              >
                ✕ Закрыть
              </button>
            </h2>
            <iframe
              src={consoleUrl}
              className="w-full h-96 border border-gray-200 rounded-lg"
              allow="clipboard-write"
            />
          </div>
        )}

        {/* Информация */}
        <div className="bg-white/[0.04] backdrop-blur-sm border border-white/[0.08] rounded-2xl p-6 mb-6">
          <h2 className="font-semibold text-white mb-4">Информация</h2>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-gray-400">ID:</span>
              <span className="ml-2 font-medium text-white">#{server.id}</span>
            </div>
            <div>
              <span className="text-gray-400">ОС:</span>
              <span className="ml-2 font-medium text-white">{server.os_template}</span>
            </div>
            <div>
              <span className="text-gray-400">IP:</span>
              <span className="ml-2 font-medium text-white">
                {server.ip_address || "—"}
              </span>
            </div>
            <div>
              <span className="text-gray-400">Создан:</span>
              <span className="ml-2 font-medium text-white">
                {new Date(server.created_at).toLocaleString("ru")}
              </span>
            </div>
          </div>
        </div>

        {/* rDNS */}
        <div className="bg-white/[0.04] backdrop-blur-sm border border-white/[0.08] rounded-2xl p-6">
          <h2 className="font-semibold text-white mb-4">rDNS запись</h2>
          <div className="flex gap-2">
            <input
              type="text"
              value={rdns}
              onChange={(e) => setRdns(e.target.value)}
              placeholder="server.example.com"
              className="flex-1 bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:border-purple-500/40"
            />
            <button onClick={handleRdns} className="btn-primary">
              Сохранить
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
