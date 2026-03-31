"use client";

import { useEffect, useState } from "react";
import Navbar from "@/components/Navbar";
import ServerCard from "@/components/ServerCard";
import { serverApi, userApi, type Server } from "@/lib/api";

export default function DashboardPage() {
  const [servers, setServers] = useState<Server[]>([]);
  const [balance, setBalance] = useState(0);
  const [loading, setLoading] = useState(true);
  const [depositAmount, setDepositAmount] = useState("");

  useEffect(() => {
    loadData();
  }, []);

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
    try {
      await userApi.deposit(amount);
      setDepositAmount("");
      loadData();
    } catch (err) {
      console.error(err);
    }
  };

  if (loading) {
    return (
      <>
        <Navbar />
        <div className="flex items-center justify-center h-64">
          <div className="text-gray-400">Загрузка…</div>
        </div>
      </>
    );
  }

  return (
    <>
      <Navbar />
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Баланс */}
        <div className="card mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-medium text-gray-500">Баланс</h2>
              <p className="text-3xl font-bold text-gray-900 mt-1">
                {balance.toFixed(2)} ₽
              </p>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="number"
                value={depositAmount}
                onChange={(e) => setDepositAmount(e.target.value)}
                placeholder="Сумма"
                className="input-field w-32"
                min="1"
              />
              <button onClick={handleDeposit} className="btn-primary">
                Пополнить
              </button>
            </div>
          </div>
        </div>

        {/* Серверы */}
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold text-gray-900">
            Мои серверы ({servers.length})
          </h2>
          <a href="/dashboard/create" className="btn-primary">
            + Создать VPS
          </a>
        </div>

        {servers.length === 0 ? (
          <div className="card text-center py-12">
            <p className="text-gray-400 text-lg">У вас пока нет серверов</p>
            <a
              href="/dashboard/create"
              className="btn-primary mt-4 inline-block"
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
    </>
  );
}
