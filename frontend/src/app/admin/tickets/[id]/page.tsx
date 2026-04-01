"use client";

import { useEffect, useState, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useAuthGuard } from "@/lib/useAuthGuard";
import api from "@/lib/api";
import { getToken } from "@/lib/auth";

/* ═══ Types ═══ */
interface Attachment {
  id: number;
  filename: string;
  original_filename: string;
  content_type: string;
  size_bytes: number;
  created_at: string;
}

interface Message {
  id: number;
  ticket_id: number;
  sender_id: number;
  sender_role: string;
  sender_email: string | null;
  body: string;
  is_read: boolean;
  attachments: Attachment[];
  created_at: string;
}

interface TicketDetail {
  id: number;
  user_id: number;
  server_id: number | null;
  subject: string;
  priority: string;
  category: string;
  status: string;
  created_at: string;
  updated_at: string;
  user_email: string | null;
  server_hostname: string | null;
  server_ip: string | null;
  server_status: string | null;
  messages: Message[];
}

interface UserInfo {
  user: {
    id: number;
    email: string;
    role: string;
    balance: number;
    is_active: boolean;
    created_at: string;
  };
  servers: Array<{
    id: number;
    hostname: string;
    status: string;
    os_template: string;
    ip_address: string | null;
    plan_id: number;
    created_at: string;
  }>;
  recent_transactions: Array<{
    id: number;
    type: string;
    amount: number;
    description: string | null;
    created_at: string;
  }>;
}

/* ═══ Config ═══ */
const STATUS_OPTIONS = [
  { value: "open", label: "Открыт", class: "bg-green-500/10 text-green-400 border-green-500/20" },
  { value: "in_progress", label: "В работе", class: "bg-blue-500/10 text-blue-400 border-blue-500/20" },
  { value: "awaiting_user", label: "Ожидает клиента", class: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20" },
  { value: "closed", label: "Закрыт", class: "bg-gray-500/10 text-gray-500 border-gray-500/20" },
];

const PRIORITY_LABELS: Record<string, string> = {
  low: "🟢 Низкий",
  medium: "🟡 Средний",
  high: "🟠 Высокий",
  critical: "🔴 Критический",
};

const CATEGORY_LABELS: Record<string, string> = {
  technical: "🔧 Техническая проблема",
  vps: "🖥 Проблема с VPS",
  network: "🌐 Сеть / IP",
  billing: "💳 Биллинг",
  complaint: "📝 Жалоба",
  other: "❓ Другое",
};

const VPS_STATUS: Record<string, { label: string; class: string }> = {
  running: { label: "Online", class: "text-green-400" },
  stopped: { label: "Offline", class: "text-gray-400" },
  creating: { label: "Создаётся", class: "text-blue-400" },
  suspended: { label: "Приостановлен", class: "text-yellow-400" },
  error: { label: "Ошибка", class: "text-red-400" },
};

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return bytes + " Б";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " КБ";
  return (bytes / 1024 / 1024).toFixed(1) + " МБ";
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
const WS_URL = API_URL.replace("http://", "ws://").replace("https://", "wss://");

/* ═══ Component ═══ */
export default function AdminTicketDetailPage() {
  const { allowed } = useAuthGuard({ requireAdmin: true });
  const params = useParams();
  const router = useRouter();
  const ticketId = Number(params.id);

  const [ticket, setTicket] = useState<TicketDetail | null>(null);
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null);
  const [loading, setLoading] = useState(true);

  // Reply
  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);

  // Actions
  const [compensationAmount, setCompensationAmount] = useState("");
  const [compensationReason, setCompensationReason] = useState("");
  const [actionLoading, setActionLoading] = useState("");

  const chatEndRef = useRef<HTMLDivElement>(null);
  const wsRef = useRef<WebSocket | null>(null);

  const scrollToBottom = () => {
    setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
  };

  useEffect(() => {
    if (allowed) {
      loadTicket();
      loadUserInfo();
    }
  }, [ticketId, allowed]);

  // WebSocket
  useEffect(() => {
    if (!allowed) return;
    const token = getToken();
    if (!token) return;

    const ws = new WebSocket(`${WS_URL}/ws/tickets`);
    wsRef.current = ws;
    ws.onopen = () => ws.send(JSON.stringify({ token }));
    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.ticket_id === ticketId && (data.event === "new_message" || data.event === "status_changed")) {
          loadTicket();
        }
      } catch {}
    };
    return () => ws.close();
  }, [allowed, ticketId]);

  const loadTicket = async () => {
    try {
      const res = await api.get(`/admin/tickets/${ticketId}`);
      setTicket(res.data);
      scrollToBottom();
    } catch {
      router.push("/admin/tickets");
    } finally {
      setLoading(false);
    }
  };

  const loadUserInfo = async () => {
    try {
      const res = await api.get(`/admin/tickets/${ticketId}/user-info`);
      setUserInfo(res.data);
    } catch {}
  };

  const handleReply = async () => {
    if (!reply.trim() || sending) return;
    setSending(true);
    try {
      await api.post(`/admin/tickets/${ticketId}/reply`, { body: reply.trim() });
      setReply("");
      await loadTicket();
    } catch (err: any) {
      alert(err.response?.data?.detail || "Ошибка");
    } finally {
      setSending(false);
    }
  };

  const handleStatusChange = async (status: string) => {
    try {
      await api.patch(`/admin/tickets/${ticketId}/status`, { status });
      await loadTicket();
    } catch (err: any) {
      alert(err.response?.data?.detail || "Ошибка");
    }
  };

  const handleDelete = async () => {
    if (!confirm("Удалить тикет? Это действие необратимо.")) return;
    try {
      await api.delete(`/admin/tickets/${ticketId}`);
      router.push("/admin/tickets");
    } catch (err: any) {
      alert(err.response?.data?.detail || "Ошибка");
    }
  };

  const handleCompensation = async () => {
    const amount = parseFloat(compensationAmount);
    if (!amount || amount <= 0 || !compensationReason.trim()) {
      alert("Укажите сумму и причину");
      return;
    }
    setActionLoading("compensate");
    try {
      const res = await api.post(`/admin/tickets/${ticketId}/compensate`, {
        amount,
        reason: compensationReason.trim(),
      });
      alert(res.data.detail);
      setCompensationAmount("");
      setCompensationReason("");
      await loadTicket();
      await loadUserInfo();
    } catch (err: any) {
      alert(err.response?.data?.detail || "Ошибка");
    } finally {
      setActionLoading("");
    }
  };

  const handleVpsAction = async (action: string) => {
    setActionLoading(action);
    try {
      const res = await api.post(`/admin/tickets/${ticketId}/vps-action`, { action });
      alert(res.data.detail);
      await loadTicket();
    } catch (err: any) {
      alert(err.response?.data?.detail || "Ошибка");
    } finally {
      setActionLoading("");
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleReply();
    }
  };

  if (!allowed || loading || !ticket) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-400">Загрузка…</div>
      </div>
    );
  }

  const st = STATUS_OPTIONS.find((s) => s.value === ticket.status) || STATUS_OPTIONS[0];
  const isClosed = ticket.status === "closed";

  return (
    <div className="flex gap-6 min-h-[calc(100vh-4rem)]">
      {/* ═══ LEFT: Chat ═══ */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <div className="mb-4">
          <Link href="/admin/tickets" className="text-sm text-gray-400 hover:text-white transition-colors mb-3 inline-block">
            ← Назад к тикетам
          </Link>

          <div className="bg-white/[0.04] border border-white/[0.08] rounded-xl p-4">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <h1 className="text-lg font-bold text-white truncate">{ticket.subject}</h1>
                <div className="flex items-center gap-3 text-xs text-gray-500 mt-1.5 flex-wrap">
                  <span>#{ticket.id}</span>
                  <span>{PRIORITY_LABELS[ticket.priority]}</span>
                  <span>{CATEGORY_LABELS[ticket.category]}</span>
                  <span>{ticket.user_email}</span>
                  {ticket.server_hostname && (
                    <span className="text-purple-400">🖥 {ticket.server_hostname}</span>
                  )}
                </div>
              </div>
              <span className={`px-2.5 py-1 rounded-full text-xs font-medium border whitespace-nowrap ${st.class}`}>
                {st.label}
              </span>
            </div>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto space-y-3 mb-4 pr-1">
          {ticket.messages.map((msg) => {
            const isAdmin = msg.sender_role === "admin";
            return (
              <div key={msg.id} className={`flex ${isAdmin ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                  isAdmin
                    ? "bg-purple-600/20 border border-purple-500/20"
                    : "bg-white/[0.06] border border-white/[0.08]"
                }`}>
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`text-xs font-medium ${isAdmin ? "text-purple-400" : "text-blue-400"}`}>
                      {isAdmin ? "⚡ Админ" : `👤 ${msg.sender_email || "Клиент"}`}
                    </span>
                    <span className="text-xs text-gray-600">
                      {new Date(msg.created_at).toLocaleString("ru", {
                        day: "numeric",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                  <p className="text-sm text-gray-200 whitespace-pre-wrap break-words">{msg.body}</p>
                  {msg.attachments.length > 0 && (
                    <div className="mt-2 space-y-1">
                      {msg.attachments.map((a) => (
                        <a
                          key={a.id}
                          href={`${API_URL}/api/v1/tickets/attachments/${a.id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-2 px-2.5 py-1.5 bg-white/[0.04] border border-white/[0.06] rounded-lg hover:bg-white/[0.08] transition-colors"
                        >
                          <span className="text-xs">📎</span>
                          <span className="text-xs text-gray-300 truncate flex-1">{a.original_filename}</span>
                          <span className="text-xs text-gray-500">{formatFileSize(a.size_bytes)}</span>
                        </a>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
          <div ref={chatEndRef} />
        </div>

        {/* Reply input */}
        {!isClosed ? (
          <div className="bg-white/[0.04] border border-white/[0.08] rounded-xl p-3">
            <div className="flex gap-2">
              <textarea
                value={reply}
                onChange={(e) => setReply(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ответ клиенту… (Enter — отправить)"
                rows={2}
                className="flex-1 bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:border-purple-500/40 resize-none"
              />
              <button
                onClick={handleReply}
                disabled={!reply.trim() || sending}
                className="bg-gradient-to-r from-purple-600 to-violet-600 hover:from-purple-500 hover:to-violet-500 text-white font-medium py-2 px-4 rounded-lg transition-all disabled:opacity-50 text-sm self-end"
              >
                {sending ? "…" : "Ответить"}
              </button>
            </div>
          </div>
        ) : (
          <div className="text-center py-4 text-gray-500 text-sm border border-white/[0.06] rounded-xl bg-white/[0.02]">
            Тикет закрыт
          </div>
        )}
      </div>

      {/* ═══ RIGHT: Sidebar ═══ */}
      <div className="w-80 shrink-0 space-y-4 overflow-y-auto">
        {/* Status */}
        <div className="bg-white/[0.04] border border-white/[0.08] rounded-xl p-4">
          <h3 className="text-sm font-semibold text-white mb-3">Статус тикета</h3>
          <div className="grid grid-cols-2 gap-1.5">
            {STATUS_OPTIONS.map((s) => (
              <button
                key={s.value}
                onClick={() => handleStatusChange(s.value)}
                className={`px-2.5 py-1.5 rounded-lg text-xs border transition-all ${
                  ticket.status === s.value
                    ? s.class + " font-medium"
                    : "bg-white/[0.02] text-gray-400 border-white/[0.04] hover:text-white"
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
          <button
            onClick={handleDelete}
            className="w-full mt-3 text-xs text-red-400 hover:text-red-300 py-1.5 border border-red-500/10 rounded-lg hover:bg-red-500/10 transition-all"
          >
            🗑 Удалить тикет
          </button>
        </div>

        {/* User card */}
        {userInfo && (
          <div className="bg-white/[0.04] border border-white/[0.08] rounded-xl p-4">
            <h3 className="text-sm font-semibold text-white mb-3">👤 Пользователь</h3>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-gray-500">ID</span>
                <span className="text-gray-200">#{userInfo.user.id}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Email</span>
                <span className="text-gray-200 truncate ml-2">{userInfo.user.email}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Баланс</span>
                <span className="text-green-400 font-medium">{userInfo.user.balance.toFixed(2)} ₽</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">VPS</span>
                <span className="text-gray-200">{userInfo.servers.length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Статус</span>
                <span className={userInfo.user.is_active ? "text-green-400" : "text-red-400"}>
                  {userInfo.user.is_active ? "Активен" : "Заблокирован"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Регистрация</span>
                <span className="text-gray-300">
                  {new Date(userInfo.user.created_at).toLocaleDateString("ru")}
                </span>
              </div>
            </div>

            {/* Recent transactions */}
            {userInfo.recent_transactions.length > 0 && (
              <div className="mt-3 pt-3 border-t border-white/[0.06]">
                <p className="text-xs text-gray-500 mb-2">Последние платежи</p>
                <div className="space-y-1">
                  {userInfo.recent_transactions.slice(0, 5).map((tx) => (
                    <div key={tx.id} className="flex justify-between text-xs">
                      <span className="text-gray-400 truncate mr-2">{tx.description || tx.type}</span>
                      <span className={tx.amount >= 0 ? "text-green-400" : "text-red-400"}>
                        {tx.amount >= 0 ? "+" : ""}{tx.amount.toFixed(2)} ₽
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* VPS card */}
        {ticket.server_id && (
          <div className="bg-white/[0.04] border border-white/[0.08] rounded-xl p-4">
            <h3 className="text-sm font-semibold text-white mb-3">🖥 Привязанный VPS</h3>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-gray-500">ID</span>
                <span className="text-gray-200">#{ticket.server_id}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Hostname</span>
                <span className="text-gray-200">{ticket.server_hostname || "—"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">IP</span>
                <span className="text-gray-200">{ticket.server_ip || "—"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Статус</span>
                <span className={VPS_STATUS[ticket.server_status || ""]?.class || "text-gray-400"}>
                  {VPS_STATUS[ticket.server_status || ""]?.label || ticket.server_status || "—"}
                </span>
              </div>
            </div>

            {/* Quick VPS actions */}
            <div className="mt-3 pt-3 border-t border-white/[0.06]">
              <p className="text-xs text-gray-500 mb-2">Быстрые действия</p>
              <div className="grid grid-cols-2 gap-1.5">
                {[
                  { action: "start", label: "▶ Запустить", color: "text-green-400 border-green-500/20 hover:bg-green-500/10" },
                  { action: "stop", label: "⏹ Остановить", color: "text-gray-400 border-gray-500/20 hover:bg-gray-500/10" },
                  { action: "restart", label: "🔄 Рестарт", color: "text-blue-400 border-blue-500/20 hover:bg-blue-500/10" },
                  { action: "suspend", label: "⏸ Приостановить", color: "text-yellow-400 border-yellow-500/20 hover:bg-yellow-500/10" },
                ].map((btn) => (
                  <button
                    key={btn.action}
                    onClick={() => handleVpsAction(btn.action)}
                    disabled={!!actionLoading}
                    className={`px-2 py-1.5 rounded-lg text-xs border transition-all disabled:opacity-40 ${btn.color}`}
                  >
                    {actionLoading === btn.action ? "…" : btn.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Compensation */}
        <div className="bg-white/[0.04] border border-white/[0.08] rounded-xl p-4">
          <h3 className="text-sm font-semibold text-white mb-3">💰 Компенсация</h3>
          <div className="space-y-2">
            <input
              type="number"
              value={compensationAmount}
              onChange={(e) => setCompensationAmount(e.target.value)}
              placeholder="Сумма, ₽"
              min="0"
              step="0.01"
              className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:border-purple-500/40"
            />
            <input
              type="text"
              value={compensationReason}
              onChange={(e) => setCompensationReason(e.target.value)}
              placeholder="Причина компенсации"
              className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:border-purple-500/40"
            />
            <button
              onClick={handleCompensation}
              disabled={actionLoading === "compensate"}
              className="w-full bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 text-white text-xs font-medium py-2 px-3 rounded-lg transition-all disabled:opacity-50"
            >
              {actionLoading === "compensate" ? "Начисление…" : "Начислить компенсацию"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
