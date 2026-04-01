"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { serverApi, type Server } from "@/lib/api";
import { useVpsWebSocket, type VpsStatusEvent } from "@/lib/useVpsWebSocket";

const STATUS_MAP: Record<string, { label: string; color: string; dot: string; badge: string }> = {
  running:   { label: "Работает",      color: "text-green-400",  dot: "bg-green-400", badge: "bg-green-500/10 text-green-400 border-green-500/20" },
  stopped:   { label: "Остановлен",    color: "text-gray-400",   dot: "bg-gray-400",  badge: "bg-gray-500/10 text-gray-400 border-gray-500/20" },
  creating:  { label: "Создаётся…",    color: "text-blue-400",   dot: "bg-blue-400",  badge: "bg-blue-500/10 text-blue-400 border-blue-500/20" },
  suspended: { label: "Приостановлен", color: "text-yellow-400", dot: "bg-yellow-400", badge: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20" },
  deleting:  { label: "Удаляется…",    color: "text-red-400",    dot: "bg-red-400",   badge: "bg-red-500/10 text-red-400 border-red-500/20" },
  error:     { label: "Ошибка",        color: "text-red-400",    dot: "bg-red-400",   badge: "bg-red-500/10 text-red-400 border-red-500/20" },
};

type FilterStatus = "all" | "running" | "stopped" | "creating" | "suspended" | "error";

export default function ServersPage() {
  const [servers, setServers] = useState<Server[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterStatus>("all");
  const [search, setSearch] = useState("");

  const handleWsMessage = useCallback((event: VpsStatusEvent) => {
    if (event.event === "status_change" && event.server_id) {
      setServers((prev) =>
        prev.map((s) =>
          s.id === event.server_id
            ? { ...s, status: event.status || s.status, ip_address: event.ip_address ?? s.ip_address }
            : s
        )
      );
    }
  }, []);
  useVpsWebSocket(handleWsMessage);

  useEffect(() => {
    loadServers();
  }, []);

  const loadServers = async () => {
    try {
      const res = await serverApi.list();
      setServers(res.data.items);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleAction = async (serverId: number, action: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      const res = await serverApi.action(serverId, action);
      setServers((prev) => prev.map((s) => (s.id === serverId ? { ...s, status: res.data.status } : s)));
    } catch (err: any) {
      alert(err.response?.data?.detail || "Ошибка");
    }
  };

  const filtered = servers.filter((s) => {
    if (filter !== "all" && s.status !== filter) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        s.hostname.toLowerCase().includes(q) ||
        (s.ip_address || "").toLowerCase().includes(q) ||
        s.os_template.toLowerCase().includes(q) ||
        String(s.id).includes(q)
      );
    }
    return true;
  });

  const statusCounts = {
    all: servers.length,
    running: servers.filter((s) => s.status === "running").length,
    stopped: servers.filter((s) => s.status === "stopped").length,
    creating: servers.filter((s) => s.status === "creating").length,
    suspended: servers.filter((s) => s.status === "suspended").length,
    error: servers.filter((s) => s.status === "error").length,
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-purple-500/30 border-t-purple-500 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Мои серверы</h1>
          <p className="text-sm text-gray-500 mt-1">Управление вашими VPS-серверами</p>
        </div>
        <Link
          href="/dashboard/create"
          className="bg-gradient-to-r from-purple-600 to-violet-600 hover:from-purple-500 hover:to-violet-500 text-white font-medium py-2.5 px-5 rounded-xl transition-all hover:shadow-lg hover:shadow-purple-500/20 text-sm"
        >
          + Создать VPS
        </Link>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4 flex-wrap">
        {/* Status tabs */}
        <div className="flex items-center gap-1 bg-white/[0.03] border border-white/[0.06] rounded-xl p-1">
          {(
            [
              { key: "all", label: "Все" },
              { key: "running", label: "Активные" },
              { key: "stopped", label: "Остановлены" },
              { key: "creating", label: "Создаются" },
              { key: "suspended", label: "Приостановлены" },
            ] as { key: FilterStatus; label: string }[]
          ).map((tab) => (
            <button
              key={tab.key}
              onClick={() => setFilter(tab.key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                filter === tab.key
                  ? "bg-purple-600/20 text-white border border-purple-500/20"
                  : "text-gray-500 hover:text-gray-300"
              }`}
            >
              {tab.label}
              {statusCounts[tab.key] > 0 && (
                <span className="ml-1.5 text-[10px] text-gray-500">{statusCounts[tab.key]}</span>
              )}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="flex-1 min-w-[200px] max-w-sm">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Поиск по имени, IP, ОС…"
            className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-2 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:border-purple-500/40 transition-colors"
          />
        </div>
      </div>

      {/* Server table */}
      {filtered.length === 0 ? (
        <div className="bg-white/[0.04] border border-white/[0.08] rounded-2xl text-center py-16">
          {servers.length === 0 ? (
            <>
              <div className="text-4xl mb-4">☁️</div>
              <p className="text-gray-400 text-lg font-medium">У вас пока нет серверов</p>
              <p className="text-gray-500 text-sm mt-1">Создайте свой первый VPS за пару минут</p>
              <Link
                href="/dashboard/create"
                className="bg-gradient-to-r from-purple-600 to-violet-600 text-white font-medium py-2.5 px-6 rounded-xl mt-5 inline-block hover:shadow-lg hover:shadow-purple-500/20 transition-all"
              >
                Создать VPS
              </Link>
            </>
          ) : (
            <>
              <p className="text-gray-400">Ничего не найдено</p>
              <p className="text-gray-500 text-sm mt-1">Попробуйте изменить фильтры или поисковый запрос</p>
            </>
          )}
        </div>
      ) : (
        <div className="bg-white/[0.04] border border-white/[0.08] rounded-2xl overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/[0.06]">
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Сервер</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">IP-адрес</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">ОС</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Статус</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Создан</th>
                <th className="text-right px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Действия</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.04]">
              {filtered.map((s) => {
                const st = STATUS_MAP[s.status] || STATUS_MAP.error;
                return (
                  <tr key={s.id} className="hover:bg-white/[0.02] transition-colors group">
                    <td className="px-5 py-4">
                      <Link href={`/dashboard/servers/${s.id}`} className="block">
                        <div className="flex items-center gap-3">
                          <div className={`w-2 h-2 rounded-full ${st.dot} shrink-0`} />
                          <div>
                            <p className="text-sm font-medium text-white group-hover:text-purple-300 transition-colors">{s.hostname}</p>
                            <p className="text-xs text-gray-500">ID: #{s.id}</p>
                          </div>
                        </div>
                      </Link>
                    </td>
                    <td className="px-5 py-4">
                      <span className="text-sm text-gray-300 font-mono">{s.ip_address || "—"}</span>
                    </td>
                    <td className="px-5 py-4">
                      <span className="text-sm text-gray-400">{s.os_template}</span>
                    </td>
                    <td className="px-5 py-4">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${st.badge}`}>
                        {st.label}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <span className="text-sm text-gray-500">
                        {new Date(s.created_at).toLocaleDateString("ru")}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-right">
                      <div className="flex items-center gap-1 justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                        {s.status === "stopped" && (
                          <button
                            onClick={(e) => handleAction(s.id, "start", e)}
                            className="p-1.5 rounded-lg hover:bg-green-500/10 text-green-400 text-xs"
                            title="Запустить"
                          >▶</button>
                        )}
                        {s.status === "running" && (
                          <>
                            <button
                              onClick={(e) => handleAction(s.id, "restart", e)}
                              className="p-1.5 rounded-lg hover:bg-blue-500/10 text-blue-400 text-xs"
                              title="Перезагрузить"
                            >🔄</button>
                            <button
                              onClick={(e) => handleAction(s.id, "stop", e)}
                              className="p-1.5 rounded-lg hover:bg-gray-500/10 text-gray-400 text-xs"
                              title="Остановить"
                            >⏹</button>
                          </>
                        )}
                        <Link
                          href={`/dashboard/servers/${s.id}`}
                          className="p-1.5 rounded-lg hover:bg-purple-500/10 text-purple-400 text-xs"
                        >
                          Открыть →
                        </Link>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
