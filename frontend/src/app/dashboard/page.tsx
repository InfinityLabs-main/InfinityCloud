"use client";

import { useEffect, useState, useCallback } from "react";
import Navbar from "@/components/Navbar";
import ServerCard from "@/components/ServerCard";
import { serverApi, userApi, paymentApi, type Server } from "@/lib/api";
import { useAuthGuard } from "@/lib/useAuthGuard";
import { useVpsWebSocket, type VpsStatusEvent } from "@/lib/useVpsWebSocket";

export default function DashboardPage() {
  const { allowed } = useAuthGuard();
  const [servers, setServers] = useState<Server[]>([]);
  const [balance, setBalance] = useState(0);
  const [loading, setLoading] = useState(true);
  const [depositAmount, setDepositAmount] = useState("");
  const [paymentLoading, setPaymentLoading] = useState(false);

  // WebSocket — обновление статуса VPS в реальном времени
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
    if (allowed) loadData();
  }, [allowed]);

  const loadData = async () => {
    try {
      const [serversRes, balanceRes] = await Promise.all([
        serverApi.list(),
        userApi.getBalance(),
      ]);
      setServers(serversRes.data.items);
      setBalance(balanceRes.data.balance);
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
      // Редирект на страницу оплаты YooKassa
      window.location.href = res.data.confirmation_url;
    } catch (err: any) {
      alert(err.response?.data?.detail || "Ошибка создания платежа");
    } finally {
      setPaymentLoading(false);
    }
  };

  if (!allowed || loading) {
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
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Баланс */}
        <div className="bg-white/[0.04] backdrop-blur-sm border border-white/[0.08] rounded-2xl p-6 mb-8">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <h2 className="text-sm font-medium text-gray-400">Баланс</h2>
              <p className="text-3xl font-bold text-white mt-1">
                {balance.toFixed(2)} ₽
              </p>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="number"
                value={depositAmount}
                onChange={(e) => setDepositAmount(e.target.value)}
                placeholder="Сумма"
                className="w-32 bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:border-purple-500/40"
                min="1"
              />
              <button
                onClick={handleDeposit}
                disabled={paymentLoading}
                className="bg-gradient-to-r from-purple-600 to-violet-600 hover:from-purple-500 hover:to-violet-500 text-white font-medium py-2.5 px-5 rounded-xl transition-all disabled:opacity-50"
              >
                {paymentLoading ? "Переход…" : "Пополнить"}
              </button>
            </div>
          </div>
        </div>

        {/* Серверы */}
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold text-white">
            Мои серверы ({servers.length})
          </h2>
          <a href="/dashboard/create" className="bg-gradient-to-r from-purple-600 to-violet-600 hover:from-purple-500 hover:to-violet-500 text-white font-medium py-2.5 px-5 rounded-xl transition-all">
            + Создать VPS
          </a>
        </div>

        {servers.length === 0 ? (
          <div className="bg-white/[0.04] backdrop-blur-sm border border-white/[0.08] rounded-2xl text-center py-12">
            <p className="text-gray-400 text-lg">У вас пока нет серверов</p>
            <a
              href="/dashboard/create"
              className="bg-gradient-to-r from-purple-600 to-violet-600 text-white font-medium py-2.5 px-5 rounded-xl mt-4 inline-block"
            >
              Создать первый VPS
            </a>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {servers.map((server) => (
              <ServerCard key={server.id} server={server} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
