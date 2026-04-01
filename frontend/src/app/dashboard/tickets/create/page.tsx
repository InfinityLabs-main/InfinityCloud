"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Navbar from "@/components/Navbar";
import { useAuthGuard } from "@/lib/useAuthGuard";
import api, { type Server } from "@/lib/api";

interface FormState {
  subject: string;
  priority: string;
  category: string;
  server_id: string;
  body: string;
}

const PRIORITIES = [
  { value: "low", label: "🟢 Низкий", desc: "Вопрос не срочный" },
  { value: "medium", label: "🟡 Средний", desc: "Требуется помощь" },
  { value: "high", label: "🟠 Высокий", desc: "Серьёзная проблема" },
  { value: "critical", label: "🔴 Критический", desc: "Сервис не работает" },
];

const CATEGORIES = [
  { value: "technical", label: "🔧 Техническая проблема" },
  { value: "vps", label: "🖥 Проблема с VPS" },
  { value: "network", label: "🌐 Сеть / IP / доступ" },
  { value: "billing", label: "💳 Биллинг / Оплата" },
  { value: "complaint", label: "📝 Жалоба" },
  { value: "other", label: "❓ Другое" },
];

const STATUS_LABELS: Record<string, string> = {
  running: "🟢 Online",
  stopped: "⚫ Offline",
  creating: "🔵 Создаётся",
  suspended: "🟡 Приостановлен",
  error: "🔴 Ошибка",
};

export default function CreateTicketPage() {
  const { allowed } = useAuthGuard();
  const router = useRouter();
  const [servers, setServers] = useState<Server[]>([]);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const [form, setForm] = useState<FormState>({
    subject: "",
    priority: "medium",
    category: "technical",
    server_id: "",
    body: "",
  });

  useEffect(() => {
    if (allowed) {
      api.get("/servers").then((r) => setServers(r.data.items)).catch(() => {});
    }
  }, [allowed]);

  const selectedServer = servers.find((s) => s.id === Number(form.server_id));

  const validate = (): boolean => {
    const e: Record<string, string> = {};
    if (!form.subject.trim()) e.subject = "Введите тему";
    if (form.subject.length > 255) e.subject = "Макс. 255 символов";
    if (!form.body.trim()) e.body = "Опишите проблему";
    if (form.body.length < 5) e.body = "Минимум 5 символов";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    setLoading(true);
    try {
      const payload: any = {
        subject: form.subject.trim(),
        priority: form.priority,
        category: form.category,
        body: form.body.trim(),
      };
      if (form.server_id) payload.server_id = Number(form.server_id);
      const res = await api.post("/tickets", payload);
      router.push(`/dashboard/tickets/${res.data.id}`);
    } catch (err: any) {
      alert(err.response?.data?.detail || "Ошибка создания тикета");
    } finally {
      setLoading(false);
    }
  };

  const updateField = (field: keyof FormState, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: "" }));
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

  return (
    <div className="min-h-screen bg-[#060010]">
      <Navbar />
      <div className="max-w-3xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={() => router.push("/dashboard/tickets")}
            className="text-sm text-gray-400 hover:text-white transition-colors mb-4 inline-block"
          >
            ← Назад к тикетам
          </button>
          <h1 className="text-2xl font-bold text-white">Новый тикет</h1>
          <p className="text-sm text-gray-400 mt-1">
            Опишите вашу проблему, и мы постараемся помочь
          </p>
        </div>

        {/* Form */}
        <div className="space-y-6">
          {/* Subject */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Тема обращения <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={form.subject}
              onChange={(e) => updateField("subject", e.target.value)}
              placeholder="Коротко опишите проблему"
              className={`w-full bg-white/[0.04] border rounded-xl px-4 py-3 text-sm text-white placeholder:text-gray-500 focus:outline-none transition-colors ${
                errors.subject
                  ? "border-red-500/50 focus:border-red-500"
                  : "border-white/[0.08] focus:border-purple-500/40"
              }`}
            />
            {errors.subject && (
              <p className="text-red-400 text-xs mt-1">{errors.subject}</p>
            )}
          </div>

          {/* Priority */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Приоритет <span className="text-red-400">*</span>
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {PRIORITIES.map((p) => (
                <button
                  key={p.value}
                  onClick={() => updateField("priority", p.value)}
                  className={`p-3 rounded-xl text-left text-sm border transition-all ${
                    form.priority === p.value
                      ? "bg-purple-500/15 border-purple-500/30 text-white"
                      : "bg-white/[0.03] border-white/[0.06] text-gray-400 hover:bg-white/[0.06]"
                  }`}
                >
                  <div className="font-medium">{p.label}</div>
                  <div className="text-xs text-gray-500 mt-0.5">{p.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Category */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Категория <span className="text-red-400">*</span>
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {CATEGORIES.map((c) => (
                <button
                  key={c.value}
                  onClick={() => updateField("category", c.value)}
                  className={`p-3 rounded-xl text-left text-sm border transition-all ${
                    form.category === c.value
                      ? "bg-purple-500/15 border-purple-500/30 text-white"
                      : "bg-white/[0.03] border-white/[0.06] text-gray-400 hover:bg-white/[0.06]"
                  }`}
                >
                  {c.label}
                </button>
              ))}
            </div>
          </div>

          {/* Server select */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Связанная услуга
            </label>
            <select
              value={form.server_id}
              onChange={(e) => updateField("server_id", e.target.value)}
              className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-purple-500/40 appearance-none"
            >
              <option value="" className="bg-[#0a0015]">Не связано с услугой</option>
              {servers.map((s) => (
                <option key={s.id} value={s.id} className="bg-[#0a0015]">
                  #{s.id} — {s.hostname} ({s.ip_address || "IP назначается"}) — {s.status}
                </option>
              ))}
            </select>
          </div>

          {/* Selected server info */}
          {selectedServer && (
            <div className="bg-white/[0.04] border border-white/[0.08] rounded-xl p-4">
              <h3 className="text-sm font-medium text-gray-300 mb-2">
                Информация о VPS
              </h3>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <span className="text-gray-500">ID:</span>
                  <span className="ml-2 text-white">#{selectedServer.id}</span>
                </div>
                <div>
                  <span className="text-gray-500">IP:</span>
                  <span className="ml-2 text-white">
                    {selectedServer.ip_address || "—"}
                  </span>
                </div>
                <div>
                  <span className="text-gray-500">OS:</span>
                  <span className="ml-2 text-white">{selectedServer.os_template}</span>
                </div>
                <div>
                  <span className="text-gray-500">Статус:</span>
                  <span className="ml-2 text-white">
                    {STATUS_LABELS[selectedServer.status] || selectedServer.status}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Body */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Описание проблемы <span className="text-red-400">*</span>
            </label>
            <textarea
              value={form.body}
              onChange={(e) => updateField("body", e.target.value)}
              placeholder="Подробно опишите проблему. Укажите шаги для воспроизведения, ожидаемое и фактическое поведение."
              rows={8}
              className={`w-full bg-white/[0.04] border rounded-xl px-4 py-3 text-sm text-white placeholder:text-gray-500 focus:outline-none transition-colors resize-y ${
                errors.body
                  ? "border-red-500/50 focus:border-red-500"
                  : "border-white/[0.08] focus:border-purple-500/40"
              }`}
            />
            {errors.body && (
              <p className="text-red-400 text-xs mt-1">{errors.body}</p>
            )}
            <p className="text-xs text-gray-600 mt-1">
              Вложения можно добавить после создания тикета
            </p>
          </div>

          {/* Submit */}
          <div className="flex justify-end gap-3">
            <button
              onClick={() => router.push("/dashboard/tickets")}
              className="px-5 py-2.5 rounded-xl text-sm text-gray-400 border border-white/[0.08] hover:bg-white/[0.04] transition-all"
            >
              Отмена
            </button>
            <button
              onClick={handleSubmit}
              disabled={loading}
              className="bg-gradient-to-r from-purple-600 to-violet-600 hover:from-purple-500 hover:to-violet-500 text-white font-medium py-2.5 px-6 rounded-xl transition-all disabled:opacity-50"
            >
              {loading ? "Создание…" : "Создать тикет"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
