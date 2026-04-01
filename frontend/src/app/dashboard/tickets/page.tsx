"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import { useAuthGuard } from "@/lib/useAuthGuard";
import api from "@/lib/api";

interface TicketItem {
  id: number;
  subject: string;
  priority: string;
  category: string;
  status: string;
  is_read_by_user: boolean;
  message_count: number;
  last_message_at: string | null;
  created_at: string;
  updated_at: string;
  server_hostname: string | null;
}

const STATUS_CONFIG: Record<string, { label: string; class: string }> = {
  open: { label: "Открыт", class: "bg-green-500/10 text-green-400 border-green-500/20" },
  in_progress: { label: "В работе", class: "bg-blue-500/10 text-blue-400 border-blue-500/20" },
  awaiting_user: { label: "Ожидает ответа", class: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20" },
  closed: { label: "Закрыт", class: "bg-gray-500/10 text-gray-500 border-gray-500/20" },
};

const PRIORITY_CONFIG: Record<string, { label: string; class: string }> = {
  low: { label: "Низкий", class: "text-gray-400" },
  medium: { label: "Средний", class: "text-blue-400" },
  high: { label: "Высокий", class: "text-orange-400" },
  critical: { label: "Критический", class: "text-red-400" },
};

const CATEGORY_LABELS: Record<string, string> = {
  technical: "Техническая проблема",
  vps: "Проблема с VPS",
  network: "Сеть / IP / доступ",
  billing: "Биллинг / Оплата",
  complaint: "Жалоба",
  other: "Другое",
};

export default function TicketsPage() {
  const { allowed } = useAuthGuard();
  const [tickets, setTickets] = useState<TicketItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("");
  const [page, setPage] = useState(1);

  useEffect(() => {
    if (allowed) loadTickets();
  }, [allowed, statusFilter, page]);

  const loadTickets = async () => {
    setLoading(true);
    try {
      const params: Record<string, any> = { page, per_page: 20 };
      if (statusFilter) params.status = statusFilter;
      const res = await api.get("/tickets", { params });
      setTickets(res.data.items);
      setTotal(res.data.total);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (!allowed) {
    return (
      <div className="min-h-screen bg-[#060010]">
        <Navbar />
        <div className="flex items-center justify-center h-64">
          <div className="text-gray-400">Загрузка…</div>
        </div>
      </div>
    );
  }

  const totalPages = Math.ceil(total / 20);

  return (
    <div className="min-h-screen bg-[#060010]">
      <Navbar />
      <div className="max-w-5xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-white">Поддержка</h1>
            <p className="text-sm text-gray-400 mt-1">
              {total} {total === 1 ? "тикет" : total < 5 ? "тикета" : "тикетов"}
            </p>
          </div>
          <Link
            href="/dashboard/tickets/create"
            className="bg-gradient-to-r from-purple-600 to-violet-600 hover:from-purple-500 hover:to-violet-500 text-white font-medium py-2.5 px-5 rounded-xl transition-all"
          >
            + Новый тикет
          </Link>
        </div>

        {/* Filters */}
        <div className="flex gap-2 mb-6 flex-wrap">
          {[
            { value: "", label: "Все" },
            { value: "open", label: "Открытые" },
            { value: "in_progress", label: "В работе" },
            { value: "awaiting_user", label: "Ожидают ответа" },
            { value: "closed", label: "Закрытые" },
          ].map((f) => (
            <button
              key={f.value}
              onClick={() => { setStatusFilter(f.value); setPage(1); }}
              className={`px-4 py-2 rounded-xl text-sm transition-all border ${
                statusFilter === f.value
                  ? "bg-purple-500/20 text-purple-300 border-purple-500/30"
                  : "bg-white/[0.03] text-gray-400 border-white/[0.06] hover:bg-white/[0.06] hover:text-white"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Ticket list */}
        {loading ? (
          <div className="text-center py-12 text-gray-400">Загрузка…</div>
        ) : tickets.length === 0 ? (
          <div className="bg-white/[0.04] border border-white/[0.08] rounded-2xl text-center py-16">
            <div className="text-4xl mb-4">📭</div>
            <p className="text-gray-400 text-lg">Тикетов пока нет</p>
            <Link
              href="/dashboard/tickets/create"
              className="inline-block mt-4 bg-gradient-to-r from-purple-600 to-violet-600 text-white font-medium py-2.5 px-5 rounded-xl"
            >
              Создать первый тикет
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {tickets.map((t) => {
              const st = STATUS_CONFIG[t.status] || STATUS_CONFIG.open;
              const pr = PRIORITY_CONFIG[t.priority] || PRIORITY_CONFIG.medium;

              return (
                <Link key={t.id} href={`/dashboard/tickets/${t.id}`}>
                  <div
                    className={`bg-white/[0.04] backdrop-blur-sm border rounded-2xl p-5 hover:bg-white/[0.06] transition-all cursor-pointer ${
                      !t.is_read_by_user
                        ? "border-purple-500/30 bg-purple-500/5"
                        : "border-white/[0.08]"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          {!t.is_read_by_user && (
                            <span className="w-2 h-2 bg-purple-400 rounded-full flex-shrink-0" />
                          )}
                          <h3 className="font-semibold text-white truncate">
                            {t.subject}
                          </h3>
                        </div>
                        <div className="flex items-center gap-3 text-xs text-gray-500 mt-2 flex-wrap">
                          <span>#{t.id}</span>
                          <span className={pr.class}>{pr.label}</span>
                          <span>{CATEGORY_LABELS[t.category] || t.category}</span>
                          {t.server_hostname && (
                            <span className="text-purple-400">
                              🖥 {t.server_hostname}
                            </span>
                          )}
                          <span>💬 {t.message_count}</span>
                          <span>
                            {new Date(t.updated_at).toLocaleString("ru", {
                              day: "numeric",
                              month: "short",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                        </div>
                      </div>
                      <span
                        className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border whitespace-nowrap ${st.class}`}
                      >
                        {st.label}
                      </span>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 mt-8">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-4 py-2 rounded-xl text-sm bg-white/[0.04] border border-white/[0.08] text-gray-400 disabled:opacity-30 hover:bg-white/[0.06] transition-all"
            >
              ←
            </button>
            <span className="text-sm text-gray-400">
              {page} / {totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="px-4 py-2 rounded-xl text-sm bg-white/[0.04] border border-white/[0.08] text-gray-400 disabled:opacity-30 hover:bg-white/[0.06] transition-all"
            >
              →
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
