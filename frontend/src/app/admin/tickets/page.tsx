"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuthGuard } from "@/lib/useAuthGuard";
import api from "@/lib/api";

interface TicketItem {
  id: number;
  user_id: number;
  subject: string;
  priority: string;
  category: string;
  status: string;
  is_read_by_admin: boolean;
  message_count: number;
  last_message_at: string | null;
  created_at: string;
  updated_at: string;
  user_email: string | null;
  server_hostname: string | null;
}

const STATUS_CONFIG: Record<string, { label: string; class: string }> = {
  open: { label: "Открыт", class: "bg-green-500/10 text-green-400 border-green-500/20" },
  in_progress: { label: "В работе", class: "bg-blue-500/10 text-blue-400 border-blue-500/20" },
  awaiting_user: { label: "Ожидает клиента", class: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20" },
  closed: { label: "Закрыт", class: "bg-gray-500/10 text-gray-500 border-gray-500/20" },
};

const PRIORITY_CONFIG: Record<string, { label: string; dot: string; sort: number }> = {
  critical: { label: "Критический", dot: "bg-red-500", sort: 0 },
  high: { label: "Высокий", dot: "bg-orange-500", sort: 1 },
  medium: { label: "Средний", dot: "bg-yellow-500", sort: 2 },
  low: { label: "Низкий", dot: "bg-gray-500", sort: 3 },
};

const CATEGORY_LABELS: Record<string, string> = {
  technical: "🔧 Техническая",
  vps: "🖥 VPS",
  network: "🌐 Сеть",
  billing: "💳 Биллинг",
  complaint: "📝 Жалоба",
  other: "❓ Другое",
};

export default function AdminTicketsPage() {
  const { allowed } = useAuthGuard({ requireAdmin: true });
  const [tickets, setTickets] = useState<TicketItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);

  // Filters
  const [statusFilter, setStatusFilter] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");

  useEffect(() => {
    if (allowed) loadTickets();
  }, [allowed, page, statusFilter, priorityFilter, categoryFilter]);

  const loadTickets = async () => {
    setLoading(true);
    try {
      const params: Record<string, any> = { page, per_page: 30 };
      if (statusFilter) params.status = statusFilter;
      if (priorityFilter) params.priority = priorityFilter;
      if (categoryFilter) params.category = categoryFilter;
      const res = await api.get("/admin/tickets", { params });
      setTickets(res.data.items);
      setTotal(res.data.total);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (!allowed) return null;

  const totalPages = Math.ceil(total / 30);
  const unreadCount = tickets.filter((t) => !t.is_read_by_admin && t.status !== "closed").length;

  return (
    <div>
      {/* Page header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Тикеты</h1>
          <p className="text-sm text-gray-400 mt-1">
            {total} всего
            {unreadCount > 0 && (
              <span className="text-purple-400 ml-2">• {unreadCount} непрочитанных</span>
            )}
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4 mb-6 space-y-3">
        {/* Status */}
        <div className="flex gap-2 flex-wrap">
          <span className="text-xs text-gray-500 self-center w-16">Статус:</span>
          {[
            { value: "", label: "Все" },
            { value: "open", label: "Открыт" },
            { value: "in_progress", label: "В работе" },
            { value: "awaiting_user", label: "Ожидает" },
            { value: "closed", label: "Закрыт" },
          ].map((f) => (
            <button
              key={f.value}
              onClick={() => { setStatusFilter(f.value); setPage(1); }}
              className={`px-3 py-1.5 rounded-lg text-xs transition-all border ${
                statusFilter === f.value
                  ? "bg-purple-500/20 text-purple-300 border-purple-500/30"
                  : "bg-white/[0.02] text-gray-400 border-white/[0.04] hover:text-white"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Priority */}
        <div className="flex gap-2 flex-wrap">
          <span className="text-xs text-gray-500 self-center w-16">Приоритет:</span>
          {[
            { value: "", label: "Все" },
            { value: "critical", label: "🔴 Критический" },
            { value: "high", label: "🟠 Высокий" },
            { value: "medium", label: "🟡 Средний" },
            { value: "low", label: "🟢 Низкий" },
          ].map((f) => (
            <button
              key={f.value}
              onClick={() => { setPriorityFilter(f.value); setPage(1); }}
              className={`px-3 py-1.5 rounded-lg text-xs transition-all border ${
                priorityFilter === f.value
                  ? "bg-purple-500/20 text-purple-300 border-purple-500/30"
                  : "bg-white/[0.02] text-gray-400 border-white/[0.04] hover:text-white"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Category */}
        <div className="flex gap-2 flex-wrap">
          <span className="text-xs text-gray-500 self-center w-16">Категория:</span>
          <button
            onClick={() => { setCategoryFilter(""); setPage(1); }}
            className={`px-3 py-1.5 rounded-lg text-xs transition-all border ${
              !categoryFilter
                ? "bg-purple-500/20 text-purple-300 border-purple-500/30"
                : "bg-white/[0.02] text-gray-400 border-white/[0.04] hover:text-white"
            }`}
          >
            Все
          </button>
          {Object.entries(CATEGORY_LABELS).map(([val, label]) => (
            <button
              key={val}
              onClick={() => { setCategoryFilter(val); setPage(1); }}
              className={`px-3 py-1.5 rounded-lg text-xs transition-all border ${
                categoryFilter === val
                  ? "bg-purple-500/20 text-purple-300 border-purple-500/30"
                  : "bg-white/[0.02] text-gray-400 border-white/[0.04] hover:text-white"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Ticket table */}
      {loading ? (
        <div className="text-center py-12 text-gray-400">Загрузка…</div>
      ) : tickets.length === 0 ? (
        <div className="bg-white/[0.04] border border-white/[0.08] rounded-2xl text-center py-16">
          <div className="text-4xl mb-4">📭</div>
          <p className="text-gray-400">Тикетов не найдено</p>
        </div>
      ) : (
        <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/[0.06] text-left">
                  <th className="px-4 py-3 text-xs text-gray-500 font-medium">ID</th>
                  <th className="px-4 py-3 text-xs text-gray-500 font-medium">Тема</th>
                  <th className="px-4 py-3 text-xs text-gray-500 font-medium">Пользователь</th>
                  <th className="px-4 py-3 text-xs text-gray-500 font-medium">Приоритет</th>
                  <th className="px-4 py-3 text-xs text-gray-500 font-medium">Категория</th>
                  <th className="px-4 py-3 text-xs text-gray-500 font-medium">Статус</th>
                  <th className="px-4 py-3 text-xs text-gray-500 font-medium">Обновлено</th>
                  <th className="px-4 py-3 text-xs text-gray-500 font-medium">💬</th>
                </tr>
              </thead>
              <tbody>
                {tickets.map((t) => {
                  const st = STATUS_CONFIG[t.status] || STATUS_CONFIG.open;
                  const pr = PRIORITY_CONFIG[t.priority] || PRIORITY_CONFIG.medium;

                  return (
                    <tr
                      key={t.id}
                      className={`border-b border-white/[0.04] hover:bg-white/[0.04] transition-colors cursor-pointer ${
                        !t.is_read_by_admin ? "bg-purple-500/5" : ""
                      }`}
                    >
                      <td className="px-4 py-3">
                        <Link href={`/admin/tickets/${t.id}`} className="text-gray-300 hover:text-white">
                          <div className="flex items-center gap-1.5">
                            {!t.is_read_by_admin && (
                              <span className="w-2 h-2 bg-purple-400 rounded-full" />
                            )}
                            #{t.id}
                          </div>
                        </Link>
                      </td>
                      <td className="px-4 py-3 max-w-[250px]">
                        <Link href={`/admin/tickets/${t.id}`} className="text-white hover:text-purple-300 font-medium truncate block">
                          {t.subject}
                        </Link>
                        {t.server_hostname && (
                          <span className="text-xs text-gray-500">🖥 {t.server_hostname}</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-gray-400 text-xs">{t.user_email || `#${t.user_id}`}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          <span className={`w-2 h-2 rounded-full ${pr.dot}`} />
                          <span className="text-xs text-gray-300">{pr.label}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-400">
                        {CATEGORY_LABELS[t.category] || t.category}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded-full text-xs border ${st.class}`}>
                          {st.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-500">
                        {new Date(t.updated_at).toLocaleString("ru", {
                          day: "numeric",
                          month: "short",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-400">{t.message_count}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-6">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="px-4 py-2 rounded-xl text-sm bg-white/[0.04] border border-white/[0.08] text-gray-400 disabled:opacity-30 hover:bg-white/[0.06]"
          >
            ←
          </button>
          <span className="text-sm text-gray-400">
            {page} / {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="px-4 py-2 rounded-xl text-sm bg-white/[0.04] border border-white/[0.08] text-gray-400 disabled:opacity-30 hover:bg-white/[0.06]"
          >
            →
          </button>
        </div>
      )}
    </div>
  );
}
