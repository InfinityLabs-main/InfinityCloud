"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import api from "@/lib/api";
import { getToken } from "@/lib/auth";

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
  is_read_by_user: boolean;
  created_at: string;
  updated_at: string;
  server_hostname: string | null;
  server_ip: string | null;
  server_status: string | null;
  messages: Message[];
}

const STATUS_CONFIG: Record<string, { label: string; class: string }> = {
  open: { label: "Открыт", class: "bg-green-500/10 text-green-400 border-green-500/20" },
  in_progress: { label: "В работе", class: "bg-blue-500/10 text-blue-400 border-blue-500/20" },
  awaiting_user: { label: "Ожидает ответа", class: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20" },
  closed: { label: "Закрыт", class: "bg-gray-500/10 text-gray-500 border-gray-500/20" },
};

const PRIORITY_LABELS: Record<string, string> = {
  low: "🟢 Низкий",
  medium: "🟡 Средний",
  high: "🟠 Высокий",
  critical: "🔴 Критический",
};

const CATEGORY_LABELS: Record<string, string> = {
  technical: "Техническая проблема",
  vps: "Проблема с VPS",
  network: "Сеть / IP / доступ",
  billing: "Биллинг / Оплата",
  complaint: "Жалоба",
  other: "Другое",
};

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return bytes + " Б";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " КБ";
  return (bytes / 1024 / 1024).toFixed(1) + " МБ";
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
const WS_URL = API_URL.replace("http://", "ws://").replace("https://", "wss://");

export default function TicketChatPage() {
  const params = useParams();
  const router = useRouter();
  const ticketId = Number(params.id);

  const [ticket, setTicket] = useState<TicketDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);

  const chatEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const wsRef = useRef<WebSocket | null>(null);

  const scrollToBottom = () => {
    setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
  };

  useEffect(() => {
    loadTicket();
  }, [ticketId]);

  // WebSocket для real-time обновлений
  useEffect(() => {
    const token = getToken();
    if (!token) return;

    const ws = new WebSocket(`${WS_URL}/ws/tickets`);
    wsRef.current = ws;

    ws.onopen = () => ws.send(JSON.stringify({ token }));

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.ticket_id === ticketId && data.event === "new_message") {
          loadTicket();
        }
        if (data.ticket_id === ticketId && data.event === "status_changed") {
          setTicket((prev) => prev ? { ...prev, status: data.status } : prev);
        }
      } catch {}
    };

    ws.onclose = () => {
      setTimeout(() => {
        // Reconnect logic simplified
      }, 5000);
    };

    return () => ws.close();
  }, [ticketId]);

  const loadTicket = async () => {
    try {
      const res = await api.get(`/tickets/${ticketId}`);
      setTicket(res.data);
      scrollToBottom();
    } catch {
      router.push("/dashboard/tickets");
    } finally {
      setLoading(false);
    }
  };

  const handleSend = async () => {
    if (!message.trim() || sending) return;
    setSending(true);
    try {
      await api.post(`/tickets/${ticketId}/messages`, { body: message.trim() });
      setMessage("");
      await loadTicket();
    } catch (err: any) {
      alert(err.response?.data?.detail || "Ошибка отправки");
    } finally {
      setSending(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files?.length || !ticket) return;

    // Получаем последнее сообщение пользователя для аттача
    const userMsgs = ticket.messages.filter((m) => m.sender_role === "user");
    const lastMsg = userMsgs[userMsgs.length - 1];
    if (!lastMsg) {
      alert("Сначала отправьте сообщение");
      return;
    }

    setUploading(true);
    for (const file of Array.from(files)) {
      const formData = new FormData();
      formData.append("file", file);
      try {
        await api.post(
          `/tickets/${ticketId}/messages/${lastMsg.id}/attachments`,
          formData,
          { headers: { "Content-Type": "multipart/form-data" } }
        );
      } catch (err: any) {
        alert(`Ошибка загрузки ${file.name}: ${err.response?.data?.detail || "Неизвестная ошибка"}`);
      }
    }
    setUploading(false);
    await loadTicket();
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleClose = async () => {
    if (!confirm("Закрыть тикет?")) return;
    try {
      await api.patch(`/tickets/${ticketId}/close`);
      await loadTicket();
    } catch (err: any) {
      alert(err.response?.data?.detail || "Ошибка");
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  if (loading || !ticket) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-400">Загрузка…</div>
      </div>
    );
  }

  const st = STATUS_CONFIG[ticket.status] || STATUS_CONFIG.open;
  const isClosed = ticket.status === "closed";

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <div className="max-w-4xl mx-auto flex-1 flex flex-col w-full space-y-4">
        {/* Header */}
        <div className="mb-6">
          <button
            onClick={() => router.push("/dashboard/tickets")}
            className="text-sm text-gray-400 hover:text-white transition-colors mb-3 inline-block"
          >
            ← Назад к тикетам
          </button>

          <div className="bg-white/[0.04] border border-white/[0.08] rounded-2xl p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h1 className="text-xl font-bold text-white">{ticket.subject}</h1>
                <div className="flex items-center gap-3 text-xs text-gray-500 mt-2 flex-wrap">
                  <span>#{ticket.id}</span>
                  <span>{PRIORITY_LABELS[ticket.priority]}</span>
                  <span>{CATEGORY_LABELS[ticket.category]}</span>
                  {ticket.server_hostname && (
                    <span className="text-purple-400">
                      🖥 {ticket.server_hostname}{" "}
                      {ticket.server_ip && `(${ticket.server_ip})`}
                    </span>
                  )}
                  <span>
                    Создан:{" "}
                    {new Date(ticket.created_at).toLocaleString("ru")}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className={`px-2.5 py-1 rounded-full text-xs font-medium border ${st.class}`}>
                  {st.label}
                </span>
                {!isClosed && (
                  <button
                    onClick={handleClose}
                    className="text-xs text-gray-500 hover:text-red-400 transition-colors"
                  >
                    Закрыть
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto space-y-4 mb-4 pr-1">
          {ticket.messages.map((msg) => {
            const isAdmin = msg.sender_role === "admin";
            return (
              <div
                key={msg.id}
                className={`flex ${isAdmin ? "justify-start" : "justify-end"}`}
              >
                <div
                  className={`max-w-[75%] rounded-2xl px-5 py-3.5 ${
                    isAdmin
                      ? "bg-white/[0.06] border border-white/[0.08]"
                      : "bg-purple-600/20 border border-purple-500/20"
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1.5">
                    <span
                      className={`text-xs font-medium ${
                        isAdmin ? "text-blue-400" : "text-purple-400"
                      }`}
                    >
                      {isAdmin ? "⚡ Поддержка" : "Вы"}
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
                  <p className="text-sm text-gray-200 whitespace-pre-wrap break-words">
                    {msg.body}
                  </p>

                  {/* Attachments */}
                  {msg.attachments.length > 0 && (
                    <div className="mt-3 space-y-1.5">
                      {msg.attachments.map((a) => (
                        <a
                          key={a.id}
                          href={`${API_URL}/api/v1/tickets/attachments/${a.id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-2 px-3 py-2 bg-white/[0.04] border border-white/[0.06] rounded-lg hover:bg-white/[0.08] transition-colors"
                        >
                          <span className="text-sm">📎</span>
                          <span className="text-xs text-gray-300 truncate flex-1">
                            {a.original_filename}
                          </span>
                          <span className="text-xs text-gray-500">
                            {formatFileSize(a.size_bytes)}
                          </span>
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

        {/* Input area */}
        {!isClosed ? (
          <div className="bg-white/[0.04] border border-white/[0.08] rounded-2xl p-4">
            <div className="flex gap-3">
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Введите сообщение… (Enter — отправить, Shift+Enter — новая строка)"
                rows={3}
                className="flex-1 bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-3 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:border-purple-500/40 resize-none"
              />
              <div className="flex flex-col gap-2">
                <button
                  onClick={handleSend}
                  disabled={!message.trim() || sending}
                  className="bg-gradient-to-r from-purple-600 to-violet-600 hover:from-purple-500 hover:to-violet-500 text-white font-medium py-2.5 px-5 rounded-xl transition-all disabled:opacity-50 text-sm"
                >
                  {sending ? "…" : "Отправить"}
                </button>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  className="px-4 py-2 rounded-xl text-sm border border-white/[0.08] text-gray-400 hover:bg-white/[0.06] hover:text-white transition-all disabled:opacity-50"
                >
                  {uploading ? "⏳" : "📎 Файл"}
                </button>
              </div>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              className="hidden"
              onChange={handleFileUpload}
              accept="image/*,video/*,.txt,.log,.csv,.json,.xml,.zip,.tar,.gz,.7z,.rar,.pdf,.doc,.docx"
            />
          </div>
        ) : (
          <div className="text-center py-6 text-gray-500 text-sm border border-white/[0.06] rounded-2xl bg-white/[0.02]">
            Тикет закрыт. Создайте новый, если проблема повторяется.
          </div>
        )}
      </div>
    </div>
  );
}
