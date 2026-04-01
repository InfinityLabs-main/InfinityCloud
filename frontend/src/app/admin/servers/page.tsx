"use client";

import { useEffect, useState } from "react";
import { adminApi, type Server, type User } from "@/lib/api";

export default function AdminServersPage() {
  const [servers, setServers] = useState<Server[]>([]);
  const [users, setUsers] = useState<Record<number, User>>({});
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  useEffect(() => { loadServers(); loadUsers(); }, [page]);

  const loadServers = async () => {
    const res = await adminApi.listServers(page);
    setServers(res.data);
  };

  const loadUsers = async () => {
    try {
      const res = await adminApi.listUsers(1);
      const map: Record<number, User> = {};
      res.data.forEach((u: User) => { map[u.id] = u; });
      setUsers(map);
    } catch { /* ignore */ }
  };

  const handleAction = async (id: number, action: string) => {
    try {
      await adminApi.serverAction(id, action);
      loadServers();
    } catch (err: any) {
      alert(err.response?.data?.detail || "Ошибка");
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Удалить этот VPS? Это действие необратимо.")) return;
    try {
      await adminApi.deleteServer(id);
      loadServers();
    } catch (err: any) {
      alert(err.response?.data?.detail || "Ошибка");
    }
  };

  const statusColor = (status: string) => {
    switch (status) {
      case "running": return "bg-green-500/10 text-green-400 border border-green-500/20";
      case "stopped": return "bg-gray-500/10 text-gray-400 border border-gray-500/20";
      case "suspended": return "bg-yellow-500/10 text-yellow-400 border border-yellow-500/20";
      case "deleted": return "bg-red-500/10 text-red-400 border border-red-500/20";
      default: return "bg-blue-500/10 text-blue-400 border border-blue-500/20";
    }
  };

  const filteredServers = servers.filter((s) => {
    const matchSearch = !search ||
      s.hostname.toLowerCase().includes(search.toLowerCase()) ||
      (s.ip_address || "").includes(search) ||
      (users[s.user_id]?.email || "").toLowerCase().includes(search.toLowerCase()) ||
      String(s.id).includes(search);
    const matchStatus = statusFilter === "all" || s.status === statusFilter;
    return matchSearch && matchStatus;
  });

  return (
    <div>
      <h1 className="text-2xl font-bold text-white mb-6">Все VPS-серверы</h1>

      {/* Фильтры */}
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <input
          placeholder="🔍 Поиск по hostname, IP, email, ID…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:border-purple-500/40"
        />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-purple-500/40 w-auto"
        >
          <option value="all">Все статусы</option>
          <option value="running">🟢 Running</option>
          <option value="stopped">⚪ Stopped</option>
          <option value="suspended">🟡 Suspended</option>
          <option value="creating">🔵 Creating</option>
          <option value="deleted">🔴 Deleted</option>
        </select>
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/[0.08] text-left text-gray-400">
              <th className="pb-3 pr-4">ID</th>
              <th className="pb-3 pr-4">Пользователь</th>
              <th className="pb-3 pr-4">Hostname</th>
              <th className="pb-3 pr-4">IP</th>
              <th className="pb-3 pr-4">VMID</th>
              <th className="pb-3 pr-4">Статус</th>
              <th className="pb-3">Действия</th>
            </tr>
          </thead>
          <tbody>
            {filteredServers.map((s) => (
              <tr key={s.id} className="border-b border-white/[0.06]">
                <td className="py-3 pr-4">#{s.id}</td>
                <td className="py-3 pr-4">
                  <div className="font-medium">{users[s.user_id]?.email || `#${s.user_id}`}</div>
                </td>
                <td className="py-3 pr-4 font-medium">{s.hostname}</td>
                <td className="py-3 pr-4">{s.ip_address || "—"}</td>
                <td className="py-3 pr-4">{s.proxmox_vmid || "—"}</td>
                <td className="py-3 pr-4">
                  <span className={`status-badge ${statusColor(s.status)}`}>{s.status}</span>
                </td>
                <td className="py-3">
                  <div className="flex gap-2 flex-wrap">
                    {s.status !== "running" && s.status !== "deleted" && (
                      <button onClick={() => handleAction(s.id, "start")}
                        className="text-green-400 hover:text-green-300 hover:underline text-xs">▶ Start</button>
                    )}
                    {s.status === "running" && (
                      <>
                        <button onClick={() => handleAction(s.id, "stop")}
                          className="text-gray-400 hover:text-gray-300 hover:underline text-xs">⏹ Stop</button>
                        <button onClick={() => handleAction(s.id, "restart")}
                          className="text-blue-400 hover:text-blue-300 hover:underline text-xs">🔄 Restart</button>
                        <button onClick={() => handleAction(s.id, "suspend")}
                          className="text-yellow-400 hover:text-yellow-300 hover:underline text-xs">⏸ Suspend</button>
                      </>
                    )}
                    {s.status === "suspended" && (
                      <button onClick={() => handleAction(s.id, "unsuspend")}
                        className="text-purple-400 hover:text-purple-300 hover:underline text-xs">▶ Unsuspend</button>
                    )}
                    {s.status !== "deleted" && (
                      <button onClick={() => handleDelete(s.id)}
                        className="text-red-400 hover:text-red-300 hover:underline text-xs">🗑 Удалить</button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {filteredServers.length === 0 && (
              <tr>
                <td colSpan={7} className="py-8 text-center text-gray-400">
                  {search || statusFilter !== "all" ? "Ничего не найдено" : "Нет серверов"}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="flex gap-2 mt-4">
        <button onClick={() => setPage(Math.max(1, page - 1))}
          disabled={page === 1} className="btn-secondary disabled:opacity-50">← Назад</button>
        <span className="flex items-center px-4 text-sm text-gray-400">Стр. {page}</span>
        <button onClick={() => setPage(page + 1)} className="btn-secondary">Вперёд →</button>
      </div>
    </div>
  );
}
