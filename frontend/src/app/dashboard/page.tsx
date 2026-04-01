"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { serverApi, userApi, paymentApi, type Server, type Transaction } from "@/lib/api";
import { useVpsWebSocket, type VpsStatusEvent } from "@/lib/useVpsWebSocket";

/* ═══ Status config ═══ */
const STATUS_MAP: Record<string, { label: string; color: string; dot: string }> = {
  running:   { label: "Работает",      color: "text-green-400",  dot: "bg-green-400" },
  stopped:   { label: "Остановлен",    color: "text-gray-400",   dot: "bg-gray-400" },
  creating:  { label: "Создаётся",     color: "text-blue-400",   dot: "bg-blue-400" },
  suspended: { label: "Приостановлен", color: "text-yellow-400", dot: "bg-yellow-400" },
  deleting:  { label: "Удаляется",     color: "text-red-400",    dot: "bg-red-400" },
  error:     { label: "Ошибка",        color: "text-red-400",    dot: "bg-red-400" },
};

const TX_TYPE_LABELS: Record<string, { label: string; icon: string }> = {
  deposit:   { label: "Пополнение",  icon: "💰" },
  charge:    { label: "Списание",    icon: "💸" },
  refund:    { label: "Возврат",     icon: "↩️" },
  bonus:     { label: "Бонус",       icon: "🎁" },
};

export default function DashboardPage() {
  const [servers, setServers] = useState<Server[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [balance, setBalance] = useState(0);
  const [loading, setLoading] = useState(true);
  const [depositAmount, setDepositAmount] = useState("");
  const [paymentLoading, setPaymentLoading] = useState(false);

  // WebSocket — обновление статуса
  const handleWsMessage = useCallback((event: VpsStatusEvent) => {
    if (event.event === "status_change" && event.server_id) {
      setServers((prev) =>
        prev.map((s) =>
          s.id === event.server_id
            ? { ...s, status: event.status || s.status, ip_address: event.ip_address ?? s.ip_address }
            : s
        )
      );
    }
    if (event.event === "balance_updated" && event.balance) {
      setBalance(parseFloat(event.balance));
    }
  }, []);
  useVpsWebSocket(handleWsMessage);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [serversRes, balanceRes, txRes] = await Promise.all([
        serverApi.list(),
        userApi.getBalance(),
        userApi.getTransactions(1),
      ]);
      setServers(serversRes.data.items);
      setBalance(balanceRes.data.balance);
      setTransactions(txRes.data.items.slice(0, 5));
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleDeposit = async () => {
    const amount = parseFloat(depositAmount);
    if (!amount || amount <= 0) return;
    setPaymentLoading(true);
    try {
      const res = await paymentApi.create(amount);
      window.location.href = res.data.confirmation_url;
    } catch (err: any) {
      alert(err.response?.data?.detail || "Ошибка создания платежа");
    } finally {
      setPaymentLoading(false);
    }
  };

  const totalServers = servers.length;
  const activeServers = servers.filter((s) => s.status === "running").length;
  const stoppedServers = servers.filter((s) => s.status === "stopped").length;
  const recentServers = servers.slice(0, 5);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-purple-500/30 border-t-purple-500 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ═══ Header ═══ */}
      <div>
        <h1 className="text-2xl font-bold text-white">Дашборд</h1>
        <p className="text-sm text-gray-500 mt-1">Обзор вашей инфраструктуры</p>
      </div>

      {/* ═══ Top row: Balance + Quick actions ═══ */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Balance card */}
        <div className="lg:col-span-2 bg-gradient-to-br from-purple-600/10 via-violet-600/5 to-transparent border border-purple-500/15 rounded-2xl p-6">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <p className="text-xs uppercase tracking-wider text-gray-400 font-medium">Текущий баланс</p>
              <p className="text-4xl font-bold text-white mt-1 tabular-nums">{balance.toFixed(2)} <span className="text-xl text-gray-400">₽</span></p>
              <p className="text-xs text-gray-500 mt-1">
                Серверов активно: <span className="text-green-400 font-medium">{activeServers}</span> из {totalServers}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="number"
                value={depositAmount}
                onChange={(e) => setDepositAmount(e.target.value)}
                placeholder="Сумма"
                className="w-28 bg-white/[0.06] border border-white/[0.1] rounded-xl px-3 py-2.5 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:border-purple-500/40 transition-colors"
                min="1"
              />
              <button
                onClick={handleDeposit}
                disabled={paymentLoading}
                className="bg-gradient-to-r from-purple-600 to-violet-600 hover:from-purple-500 hover:to-violet-500 text-white font-medium py-2.5 px-5 rounded-xl transition-all hover:shadow-lg hover:shadow-purple-500/20 disabled:opacity-50"
              >
                {paymentLoading ? "…" : "Пополнить"}
              </button>
            </div>
          </div>
        </div>

        {/* Quick actions */}
        <div className="bg-white/[0.04] border border-white/[0.08] rounded-2xl p-5">
          <p className="text-xs uppercase tracking-wider text-gray-400 font-medium mb-3">Быстрые действия</p>
          <div className="space-y-2">
            <Link
              href="/dashboard/create"
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-purple-600/10 border border-purple-500/15 hover:bg-purple-600/20 transition-all text-sm text-purple-300 font-medium"
            >
              <span>➕</span> Создать VPS
            </Link>
            <Link
              href="/dashboard/billing"
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-white/[0.03] border border-white/[0.06] hover:bg-white/[0.06] transition-all text-sm text-gray-300"
            >
              <span>💳</span> Пополнить баланс
            </Link>
            <Link
              href="/dashboard/tickets/create"
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-white/[0.03] border border-white/[0.06] hover:bg-white/[0.06] transition-all text-sm text-gray-300"
            >
              <span>🎫</span> Создать тикет
            </Link>
          </div>
        </div>
      </div>

      {/* ═══ Stat cards ═══ */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Всего серверов", value: totalServers, icon: "☁️", accent: "from-blue-500/10 border-blue-500/15" },
          { label: "Активных", value: activeServers, icon: "🟢", accent: "from-green-500/10 border-green-500/15" },
          { label: "Остановленных", value: stoppedServers, icon: "⏸️", accent: "from-gray-500/10 border-gray-500/15" },
          { label: "Расход в мес.", value: `${activeServers} акт.`, icon: "📉", accent: "from-orange-500/10 border-orange-500/15" },
        ].map((card) => (
          <div
            key={card.label}
            className={`bg-gradient-to-br ${card.accent} to-transparent border rounded-2xl p-5 transition-all hover:scale-[1.02] duration-200`}
          >
            <div className="flex items-center justify-between">
              <span className="text-2xl">{card.icon}</span>
            </div>
            <p className="text-2xl font-bold text-white mt-3 tabular-nums">{card.value}</p>
            <p className="text-xs text-gray-500 mt-1">{card.label}</p>
          </div>
        ))}
      </div>

      {/* ═══ Bottom: Recent servers + Recent transactions ═══ */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent servers */}
        <div className="bg-white/[0.04] border border-white/[0.08] rounded-2xl overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.06]">
            <h2 className="font-semibold text-white text-sm">Последние серверы</h2>
            <Link href="/dashboard/servers" className="text-xs text-purple-400 hover:text-purple-300 transition-colors">
              Все серверы →
            </Link>
          </div>
          {recentServers.length === 0 ? (
            <div className="p-8 text-center">
              <p className="text-gray-500 text-sm">У вас пока нет серверов</p>
              <Link
                href="/dashboard/create"
                className="text-purple-400 hover:text-purple-300 text-sm mt-2 inline-block transition-colors"
              >
                Создать первый VPS →
              </Link>
            </div>
          ) : (
            <div className="divide-y divide-white/[0.04]">
              {recentServers.map((s) => {
                const st = STATUS_MAP[s.status] || STATUS_MAP.error;
                return (
                  <Link
                    key={s.id}
                    href={`/dashboard/servers/${s.id}`}
                    className="flex items-center gap-4 px-5 py-3.5 hover:bg-white/[0.03] transition-colors"
                  >
                    <div className={`w-2 h-2 rounded-full ${st.dot} shrink-0`} />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-white truncate">{s.hostname}</p>
                      <p className="text-xs text-gray-500">{s.ip_address || "IP назначается…"} · {s.os_template}</p>
                    </div>
                    <span className={`text-xs font-medium ${st.color}`}>{st.label}</span>
                  </Link>
                );
              })}
            </div>
          )}
        </div>

        {/* Recent transactions */}
        <div className="bg-white/[0.04] border border-white/[0.08] rounded-2xl overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.06]">
            <h2 className="font-semibold text-white text-sm">Последние операции</h2>
            <Link href="/dashboard/history" className="text-xs text-purple-400 hover:text-purple-300 transition-colors">
              Вся история →
            </Link>
          </div>
          {transactions.length === 0 ? (
            <div className="p-8 text-center">
              <p className="text-gray-500 text-sm">Операций пока нет</p>
            </div>
          ) : (
            <div className="divide-y divide-white/[0.04]">
              {transactions.map((tx) => {
                const txType = TX_TYPE_LABELS[tx.type] || { label: tx.type, icon: "📄" };
                const isPositive = tx.amount >= 0;
                return (
                  <div key={tx.id} className="flex items-center gap-4 px-5 py-3.5">
                    <span className="text-lg">{txType.icon}</span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-white truncate">{tx.description || txType.label}</p>
                      <p className="text-xs text-gray-500">
                        {new Date(tx.created_at).toLocaleString("ru", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                      </p>
                    </div>
                    <span className={`text-sm font-semibold tabular-nums ${isPositive ? "text-green-400" : "text-red-400"}`}>
                      {isPositive ? "+" : ""}{tx.amount.toFixed(2)} ₽
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
