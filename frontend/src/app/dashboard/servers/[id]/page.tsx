"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { serverApi, planApi, consoleApi, type Server, type Plan } from "@/lib/api";
import { useVpsWebSocket, type VpsStatusEvent } from "@/lib/useVpsWebSocket";

/* ═══ Config ═══ */
const STATUS_MAP: Record<string, { label: string; badge: string }> = {
  running:   { label: "Работает",      badge: "bg-green-500/10 text-green-400 border-green-500/20" },
  stopped:   { label: "Остановлен",    badge: "bg-gray-500/10 text-gray-400 border-gray-500/20" },
  creating:  { label: "Создаётся…",    badge: "bg-blue-500/10 text-blue-400 border-blue-500/20" },
  suspended: { label: "Приостановлен", badge: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20" },
  deleting:  { label: "Удаляется…",    badge: "bg-red-500/10 text-red-400 border-red-500/20" },
  error:     { label: "Ошибка",        badge: "bg-red-500/10 text-red-400 border-red-500/20" },
};

const OS_OPTIONS = [
  { value: "ubuntu-22.04", label: "Ubuntu 22.04 LTS" },
  { value: "ubuntu-24.04", label: "Ubuntu 24.04 LTS" },
  { value: "debian-12", label: "Debian 12" },
  { value: "centos-9", label: "CentOS Stream 9" },
  { value: "almalinux-9", label: "AlmaLinux 9" },
  { value: "rocky-9", label: "Rocky Linux 9" },
  { value: "windows-2022", label: "Windows Server 2022" },
];

/* Mock chart component */
function MiniChart({ label, value, unit, color, data }: { label: string; value: string; unit: string; color: string; data: number[] }) {
  const max = Math.max(...data, 1);
  const h = 48;
  const w = 200;
  const points = data.map((d, i) => `${(i / (data.length - 1)) * w},${h - (d / max) * h}`).join(" ");

  return (
    <div className="bg-white/[0.04] border border-white/[0.08] rounded-2xl p-5">
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs text-gray-500 uppercase tracking-wider font-medium">{label}</p>
        <p className="text-sm font-bold text-white">{value}<span className="text-xs text-gray-500 ml-1">{unit}</span></p>
      </div>
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-12" preserveAspectRatio="none">
        <defs>
          <linearGradient id={`grad-${label}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.3" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        <polygon points={`0,${h} ${points} ${w},${h}`} fill={`url(#grad-${label})`} />
        <polyline points={points} fill="none" stroke={color} strokeWidth="2" vectorEffect="non-scaling-stroke" />
      </svg>
    </div>
  );
}

/* Generate mock data */
function mockData(base: number, variance: number, len = 20): number[] {
  return Array.from({ length: len }, () => base + (Math.random() - 0.5) * variance * 2);
}

/* Graphs with memoized mock data — avoid regeneration on every render */
function MiniCharts({ plan }: { plan: Plan | null }) {
  const chartData = useMemo(() => ({
    cpu: { value: (25 + Math.random() * 30).toFixed(1), data: mockData(30, 15) },
    ram: { value: plan ? (plan.ram_mb * 0.6 / 1024).toFixed(1) : "1.2", data: mockData(60, 10) },
    net: { value: (Math.random() * 50 + 5).toFixed(1), data: mockData(25, 20) },
  }), [plan]);

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <MiniChart label="CPU" value={chartData.cpu.value} unit="%" color="#8b5cf6" data={chartData.cpu.data} />
      <MiniChart label="RAM" value={chartData.ram.value} unit="ГБ" color="#06b6d4" data={chartData.ram.data} />
      <MiniChart label="Сеть" value={chartData.net.value} unit="Мбит/с" color="#22c55e" data={chartData.net.data} />
    </div>
  );
}

export default function ServerDetailPage() {
  const params = useParams();
  const router = useRouter();
  const serverId = Number(params.id);

  const [server, setServer] = useState<Server | null>(null);
  const [plan, setPlan] = useState<Plan | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState("");
  const [rdns, setRdns] = useState("");
  const [consoleUrl, setConsoleUrl] = useState("");
  const [showConsole, setShowConsole] = useState(false);
  const [showReinstall, setShowReinstall] = useState(false);
  const [reinstallOs, setReinstallOs] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [activeTab, setActiveTab] = useState<"overview" | "console" | "reinstall">("overview");

  const handleWsMessage = useCallback((event: VpsStatusEvent) => {
    if (event.event === "status_change" && event.server_id === serverId) {
      setServer((prev) =>
        prev ? { ...prev, status: event.status || prev.status, ip_address: event.ip_address ?? prev.ip_address } : prev
      );
    }
  }, [serverId]);
  useVpsWebSocket(handleWsMessage);

  useEffect(() => {
    loadServer();
  }, [serverId]);

  const loadServer = async () => {
    try {
      const res = await serverApi.get(serverId);
      setServer(res.data);
      setRdns(res.data.rdns || "");
      // Load plan info
      try {
        const planRes = await planApi.get(res.data.plan_id);
        setPlan(planRes.data);
      } catch {}
    } catch {
      router.push("/dashboard/servers");
    } finally {
      setLoading(false);
    }
  };

  const handleAction = async (action: string) => {
    setActionLoading(action);
    try {
      const res = await serverApi.action(serverId, action);
      setServer(res.data);
    } catch (err: any) {
      alert(err.response?.data?.detail || "Ошибка");
    } finally {
      setActionLoading("");
    }
  };

  const handleRdns = async () => {
    try {
      const res = await serverApi.updateRdns(serverId, rdns);
      setServer(res.data);
    } catch (err: any) {
      alert(err.response?.data?.detail || "Ошибка");
    }
  };

  const handleConsole = async () => {
    try {
      const res = await consoleApi.getVnc(serverId);
      setConsoleUrl(res.data.url);
      setShowConsole(true);
      setActiveTab("console");
    } catch (err: any) {
      alert(err.response?.data?.detail || "Консоль недоступна");
    }
  };

  const handleDelete = async () => {
    if (!confirm("Вы уверены? VPS будет удалён безвозвратно.")) return;
    try {
      await serverApi.delete(serverId);
      router.push("/dashboard/servers");
    } catch (err: any) {
      alert(err.response?.data?.detail || "Ошибка удаления");
    }
  };

  if (loading || !server) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-purple-500/30 border-t-purple-500 rounded-full animate-spin" />
      </div>
    );
  }

  const st = STATUS_MAP[server.status] || STATUS_MAP.error;
  const isRunning = server.status === "running";
  const isStopped = server.status === "stopped";

  return (
    <div className="space-y-6">
      {/* Breadcrumb + Header */}
      <div>
        <Link href="/dashboard/servers" className="text-sm text-gray-500 hover:text-gray-300 transition-colors">
          ← Мои серверы
        </Link>
        <div className="flex items-center justify-between mt-3">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-purple-500/20 to-violet-500/20 border border-purple-500/20 flex items-center justify-center">
              <span className="text-xl">🖥</span>
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">{server.hostname}</h1>
              <p className="text-sm text-gray-500 mt-0.5">
                {server.ip_address || "IP назначается…"} · VMID: {server.proxmox_vmid || "—"} · ID: #{server.id}
              </p>
            </div>
          </div>
          <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium border ${st.badge}`}>
            {st.label}
          </span>
        </div>
      </div>

      {/* ═══ Action bar ═══ */}
      <div className="bg-white/[0.04] border border-white/[0.08] rounded-2xl p-4">
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => handleAction("start")}
            disabled={!!actionLoading || isRunning}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium bg-green-500/10 border border-green-500/20 text-green-400 hover:bg-green-500/20 disabled:opacity-40 transition-all"
          >
            {actionLoading === "start" ? "…" : "▶ Запустить"}
          </button>
          <button
            onClick={() => handleAction("stop")}
            disabled={!!actionLoading || isStopped}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium bg-gray-500/10 border border-gray-500/20 text-gray-400 hover:bg-gray-500/20 disabled:opacity-40 transition-all"
          >
            {actionLoading === "stop" ? "…" : "⏹ Остановить"}
          </button>
          <button
            onClick={() => handleAction("restart")}
            disabled={!!actionLoading}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium bg-blue-500/10 border border-blue-500/20 text-blue-400 hover:bg-blue-500/20 disabled:opacity-40 transition-all"
          >
            {actionLoading === "restart" ? "…" : "🔄 Перезагрузить"}
          </button>
          <button
            onClick={handleConsole}
            disabled={!isRunning}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium bg-purple-500/10 border border-purple-500/20 text-purple-400 hover:bg-purple-500/20 disabled:opacity-40 transition-all"
          >
            🖥️ Консоль
          </button>
          <button
            onClick={() => { setShowReinstall(true); setActiveTab("reinstall"); }}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium bg-orange-500/10 border border-orange-500/20 text-orange-400 hover:bg-orange-500/20 transition-all"
          >
            🔧 Переустановить ОС
          </button>
          <button
            onClick={handleDelete}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20 transition-all ml-auto"
          >
            🗑 Удалить
          </button>
        </div>
      </div>

      {/* ═══ Graphs ═══ */}
      {isRunning && (
        <MiniCharts plan={plan} />
      )}

      {/* ═══ Console ═══ */}
      {showConsole && consoleUrl && (
        <div className="bg-white/[0.04] border border-white/[0.08] rounded-2xl overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3 border-b border-white/[0.06]">
            <h2 className="font-semibold text-white text-sm">noVNC Консоль</h2>
            <button onClick={() => setShowConsole(false)} className="text-xs text-gray-400 hover:text-gray-300 transition-colors">
              ✕ Закрыть
            </button>
          </div>
          <iframe src={consoleUrl} className="w-full h-[500px]" allow="clipboard-write" />
        </div>
      )}

      {/* ═══ Reinstall OS ═══ */}
      {showReinstall && (
        <div className="bg-white/[0.04] border border-orange-500/15 rounded-2xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-white">🔧 Переустановка ОС</h2>
            <button onClick={() => setShowReinstall(false)} className="text-xs text-gray-400 hover:text-gray-300">✕</button>
          </div>
          <p className="text-sm text-gray-400 mb-4">⚠️ Все данные на сервере будут удалены. Выберите новую ОС:</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-4">
            {OS_OPTIONS.map((os) => (
              <button
                key={os.value}
                onClick={() => setReinstallOs(os.value)}
                className={`p-3 rounded-xl border text-sm font-medium transition-all ${
                  reinstallOs === os.value
                    ? "border-orange-500/40 bg-orange-500/10 text-orange-300"
                    : "border-white/[0.08] hover:border-white/[0.15] text-gray-400 bg-white/[0.03]"
                }`}
              >
                {os.label}
              </button>
            ))}
          </div>
          <button
            onClick={() => {
              if (!reinstallOs) return alert("Выберите ОС");
              if (!confirm("ВСЕ ДАННЫЕ будут удалены! Продолжить?")) return;
              // В реальности тут будет API-вызов reinstall
              alert("Переустановка начата (заглушка)");
              setShowReinstall(false);
            }}
            className="bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-500 hover:to-red-500 text-white font-medium py-2.5 px-5 rounded-xl transition-all text-sm"
          >
            Переустановить
          </button>
        </div>
      )}

      {/* ═══ Info grid ═══ */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Server info */}
        <div className="bg-white/[0.04] border border-white/[0.08] rounded-2xl overflow-hidden">
          <div className="px-5 py-3.5 border-b border-white/[0.06]">
            <h2 className="font-semibold text-white text-sm">Информация о сервере</h2>
          </div>
          <div className="divide-y divide-white/[0.04]">
            {[
              { label: "IP-адрес", value: server.ip_address || "Назначается…", mono: true },
              { label: "Hostname", value: server.hostname },
              { label: "ОС", value: server.os_template },
              { label: "VMID", value: server.proxmox_vmid ? `#${server.proxmox_vmid}` : "—" },
              { label: "Логин", value: "root" },
              { label: "Пароль", value: showPassword ? "автогенерируется при создании" : "••••••••", action: () => setShowPassword(!showPassword), actionLabel: showPassword ? "Скрыть" : "Показать" },
              { label: "Создан", value: new Date(server.created_at).toLocaleString("ru") },
            ].map((row) => (
              <div key={row.label} className="flex items-center justify-between px-5 py-3">
                <span className="text-sm text-gray-500">{row.label}</span>
                <div className="flex items-center gap-2">
                  <span className={`text-sm text-white ${row.mono ? "font-mono" : ""}`}>{row.value}</span>
                  {row.action && (
                    <button onClick={row.action} className="text-xs text-purple-400 hover:text-purple-300 transition-colors">
                      {row.actionLabel}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Plan info + rDNS */}
        <div className="space-y-6">
          {/* Plan */}
          {plan && (
            <div className="bg-white/[0.04] border border-white/[0.08] rounded-2xl overflow-hidden">
              <div className="px-5 py-3.5 border-b border-white/[0.06]">
                <h2 className="font-semibold text-white text-sm">Тариф: {plan.name}</h2>
              </div>
              <div className="p-5 grid grid-cols-2 gap-4">
                {[
                  { label: "vCPU", value: `${plan.cpu_cores} ядер`, icon: "⚡" },
                  { label: "RAM", value: plan.ram_mb >= 1024 ? `${(plan.ram_mb / 1024).toFixed(0)} ГБ` : `${plan.ram_mb} МБ`, icon: "🧠" },
                  { label: "Диск", value: `${plan.disk_gb} ГБ SSD`, icon: "💾" },
                  { label: "Трафик", value: `${plan.bandwidth_tb} ТБ`, icon: "🌐" },
                ].map((spec) => (
                  <div key={spec.label} className="flex items-center gap-3">
                    <span className="text-lg">{spec.icon}</span>
                    <div>
                      <p className="text-xs text-gray-500">{spec.label}</p>
                      <p className="text-sm font-medium text-white">{spec.value}</p>
                    </div>
                  </div>
                ))}
                <div className="col-span-2 pt-3 border-t border-white/[0.06]">
                  <p className="text-sm text-gray-400">
                    Стоимость: <span className="text-white font-medium">{plan.price_per_month.toFixed(0)} ₽/мес</span>
                    <span className="text-gray-500 ml-2">({plan.price_per_hour.toFixed(2)} ₽/час)</span>
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* rDNS */}
          <div className="bg-white/[0.04] border border-white/[0.08] rounded-2xl overflow-hidden">
            <div className="px-5 py-3.5 border-b border-white/[0.06]">
              <h2 className="font-semibold text-white text-sm">rDNS запись</h2>
            </div>
            <div className="p-5">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={rdns}
                  onChange={(e) => setRdns(e.target.value)}
                  placeholder="server.example.com"
                  className="flex-1 bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:border-purple-500/40 transition-colors"
                />
                <button onClick={handleRdns} className="bg-gradient-to-r from-purple-600 to-violet-600 hover:from-purple-500 hover:to-violet-500 text-white font-medium py-2.5 px-5 rounded-xl transition-all text-sm">
                  Сохранить
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
