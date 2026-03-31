"use client";

import { useEffect, useState } from "react";
import { adminApi } from "@/lib/api";

interface Stats {
  total_users: number;
  total_servers: number;
  total_nodes: number;
  total_revenue: number;
  active_servers: number;
  server_statuses: Record<string, number>;
  nodes_load: { id: number; name: string; current_vms: number; max_vms: number }[];
  recent_logs: { id: number; message: string; created_at: string }[];
}

const statusColors: Record<string, string> = {
  running: "bg-green-500",
  stopped: "bg-gray-400",
  creating: "bg-blue-500",
  error: "bg-red-500",
  suspended: "bg-yellow-500",
};

const statusLabels: Record<string, string> = {
  running: "Работает",
  stopped: "Остановлен",
  creating: "Создаётся",
  error: "Ошибка",
  suspended: "Приостановлен",
};

export default function AdminDashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    adminApi.getStats()
      .then((res) => setStats(res.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="text-gray-400 dark:text-gray-500 text-lg">Загрузка…</div>
    </div>
  );

  if (!stats) return (
    <div className="text-red-500 text-center mt-12">Не удалось загрузить статистику</div>
  );

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-8">Обзор системы</h1>

      {/* Основные метрики */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <div className="card">
          <div className="text-sm text-gray-500 dark:text-gray-400">Пользователи</div>
          <div className="text-3xl font-bold text-gray-900 dark:text-white mt-2">{stats.total_users}</div>
        </div>
        <div className="card">
          <div className="text-sm text-gray-500 dark:text-gray-400">VPS-серверы</div>
          <div className="text-3xl font-bold text-gray-900 dark:text-white mt-2">{stats.total_servers}</div>
          <div className="text-xs text-green-600 mt-1">{stats.active_servers} активных</div>
        </div>
        <div className="card">
          <div className="text-sm text-gray-500 dark:text-gray-400">Proxmox-ноды</div>
          <div className="text-3xl font-bold text-gray-900 dark:text-white mt-2">{stats.total_nodes}</div>
        </div>
        <div className="card">
          <div className="text-sm text-gray-500 dark:text-gray-400">Выручка</div>
          <div className="text-3xl font-bold text-green-600 mt-2">{stats.total_revenue.toFixed(0)} ₽</div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        {/* Серверы по статусу */}
        <div className="card">
          <h2 className="font-semibold text-gray-900 dark:text-white mb-4">Серверы по статусу</h2>
          {Object.entries(stats.server_statuses).length === 0 ? (
            <div className="text-sm text-gray-400">Нет серверов</div>
          ) : (
            <div className="space-y-3">
              {Object.entries(stats.server_statuses).map(([status, count]) => (
                <div key={status} className="flex items-center gap-3">
                  <span className={`w-3 h-3 rounded-full ${statusColors[status] || "bg-gray-300"}`} />
                  <span className="text-sm text-gray-700 dark:text-gray-300 flex-1">
                    {statusLabels[status] || status}
                  </span>
                  <span className="font-bold text-gray-900 dark:text-white">{count}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Загрузка нод */}
        <div className="card">
          <h2 className="font-semibold text-gray-900 dark:text-white mb-4">Загрузка нод</h2>
          {stats.nodes_load.length === 0 ? (
            <div className="text-sm text-gray-400">Нет нод</div>
          ) : (
            <div className="space-y-4">
              {stats.nodes_load.map((node) => {
                const pct = node.max_vms > 0 ? Math.round((node.current_vms / node.max_vms) * 100) : 0;
                const barColor = pct > 80 ? "bg-red-500" : pct > 50 ? "bg-yellow-500" : "bg-green-500";
                return (
                  <div key={node.id}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-gray-700 dark:text-gray-300">{node.name}</span>
                      <span className="text-gray-500 dark:text-gray-400">
                        {node.current_vms}/{node.max_vms} VM ({pct}%)
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5">
                      <div className={`${barColor} h-2.5 rounded-full transition-all`}
                        style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Последние события */}
      <div className="card">
        <h2 className="font-semibold text-gray-900 dark:text-white mb-4">Последние события</h2>
        {stats.recent_logs.length === 0 ? (
          <div className="text-sm text-gray-400">Нет событий</div>
        ) : (
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {stats.recent_logs.map((log) => (
              <div key={log.id} className="flex gap-3 text-sm border-b border-gray-50 dark:border-gray-700 pb-2">
                <span className="text-gray-400 dark:text-gray-500 whitespace-nowrap">
                  {new Date(log.created_at).toLocaleString("ru", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                </span>
                <span className="text-gray-700 dark:text-gray-300">{log.message}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
