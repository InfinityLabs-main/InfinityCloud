"use client";

import { useEffect, useState } from "react";
import { adminApi, type Server } from "@/lib/api";

export default function AdminServersPage() {
  const [servers, setServers] = useState<Server[]>([]);
  const [page, setPage] = useState(1);

  useEffect(() => { loadServers(); }, [page]);

  const loadServers = async () => {
    const res = await adminApi.listServers(page);
    setServers(res.data);
  };

  const handleAction = async (id: number, action: string) => {
    try {
      await adminApi.serverAction(id, action);
      loadServers();
    } catch (err: any) {
      alert(err.response?.data?.detail || "Ошибка");
    }
  };

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Все VPS-серверы</h1>

      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-gray-500">
              <th className="pb-3 pr-4">ID</th>
              <th className="pb-3 pr-4">User</th>
              <th className="pb-3 pr-4">Hostname</th>
              <th className="pb-3 pr-4">IP</th>
              <th className="pb-3 pr-4">VMID</th>
              <th className="pb-3 pr-4">Статус</th>
              <th className="pb-3">Действия</th>
            </tr>
          </thead>
          <tbody>
            {servers.map((s) => (
              <tr key={s.id} className="border-b border-gray-100">
                <td className="py-3 pr-4">#{s.id}</td>
                <td className="py-3 pr-4">#{s.user_id}</td>
                <td className="py-3 pr-4 font-medium">{s.hostname}</td>
                <td className="py-3 pr-4">{s.ip_address || "—"}</td>
                <td className="py-3 pr-4">{s.proxmox_vmid || "—"}</td>
                <td className="py-3 pr-4">
                  <span className={`status-badge ${
                    s.status === "running" ? "bg-green-100 text-green-800" :
                    s.status === "stopped" ? "bg-gray-100 text-gray-800" :
                    s.status === "suspended" ? "bg-yellow-100 text-yellow-800" :
                    "bg-blue-100 text-blue-800"
                  }`}>{s.status}</span>
                </td>
                <td className="py-3">
                  <div className="flex gap-2">
                    <button onClick={() => handleAction(s.id, "start")}
                      className="text-green-600 hover:underline text-xs">Start</button>
                    <button onClick={() => handleAction(s.id, "stop")}
                      className="text-gray-600 hover:underline text-xs">Stop</button>
                    <button onClick={() => handleAction(s.id, "suspend")}
                      className="text-yellow-600 hover:underline text-xs">Suspend</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex gap-2 mt-4">
        <button onClick={() => setPage(Math.max(1, page - 1))}
          disabled={page === 1} className="btn-secondary disabled:opacity-50">← Назад</button>
        <span className="flex items-center px-4 text-sm text-gray-500">Стр. {page}</span>
        <button onClick={() => setPage(page + 1)} className="btn-secondary">Вперёд →</button>
      </div>
    </div>
  );
}
