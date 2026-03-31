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
      case "running": return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200";
      case "stopped": return "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200";
      case "suspended": return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200";
      case "deleted": return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200";
      default: return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200";
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
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">Все VPS-серверы</h1>

      {/* Фильтры */}
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <input
          placeholder="🔍 Поиск по hostname, IP, email, ID…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="input-field flex-1"
        />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="input-field w-auto"
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
            <tr className="border-b text-left text-gray-500 dark:text-gray-400">
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
              <tr key={s.id} className="border-b border-gray-100 dark:border-gray-700">
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
                        className="text-green-600 hover:underline text-xs">▶ Start</button>
                    )}
                    {s.status === "running" && (
                      <>
                        <button onClick={() => handleAction(s.id, "stop")}
                          className="text-gray-600 hover:underline text-xs">⏹ Stop</button>
                        <button onClick={() => handleAction(s.id, "restart")}
                          className="text-blue-600 hover:underline text-xs">🔄 Restart</button>
                        <button onClick={() => handleAction(s.id, "suspend")}
                          className="text-yellow-600 hover:underline text-xs">⏸ Suspend</button>
                      </>
                    )}
                    {s.status === "suspended" && (
                      <button onClick={() => handleAction(s.id, "unsuspend")}
                        className="text-primary-600 hover:underline text-xs">▶ Unsuspend</button>
                    )}
                    {s.status !== "deleted" && (
                      <button onClick={() => handleDelete(s.id)}
                        className="text-red-600 hover:underline text-xs">🗑 Удалить</button>
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
        <span className="flex items-center px-4 text-sm text-gray-500 dark:text-gray-400">Стр. {page}</span>
        <button onClick={() => setPage(page + 1)} className="btn-secondary">Вперёд →</button>
      </div>
    </div>
  );
}
