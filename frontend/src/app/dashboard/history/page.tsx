"use client";

import { useEffect, useState } from "react";
import { userApi, type Transaction } from "@/lib/api";

const TX_TYPE_MAP: Record<string, { label: string; icon: string; color: string }> = {
  deposit: { label: "Пополнение", icon: "💰", color: "text-green-400" },
  charge:  { label: "Списание",   icon: "💸", color: "text-red-400" },
  refund:  { label: "Возврат",    icon: "↩️", color: "text-blue-400" },
  bonus:   { label: "Бонус",      icon: "🎁", color: "text-yellow-400" },
};

export default function HistoryPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState<string>("all");

  useEffect(() => { load(); }, [page]);

  const load = async () => {
    try {
      const res = await userApi.getTransactions(page);
      setTransactions(res.data.items);
      setTotal(res.data.total);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const perPage = 20;
  const totalPages = Math.ceil(total / perPage);
  const filtered = filterType === "all" ? transactions : transactions.filter((t) => t.type === filterType);

  // Stats
  const totalDeposits = transactions.filter((t) => t.amount > 0).reduce((a, t) => a + t.amount, 0);
  const totalCharges = transactions.filter((t) => t.amount < 0).reduce((a, t) => a + Math.abs(t.amount), 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-purple-500/30 border-t-purple-500 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">История операций</h1>
        <p className="text-sm text-gray-500 mt-1">Все транзакции вашего аккаунта</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white/[0.04] border border-white/[0.08] rounded-2xl p-5">
          <p className="text-xs text-gray-500 uppercase tracking-wider font-medium">Всего операций</p>
          <p className="text-2xl font-bold text-white mt-1">{total}</p>
        </div>
        <div className="bg-green-500/5 border border-green-500/10 rounded-2xl p-5">
          <p className="text-xs text-gray-500 uppercase tracking-wider font-medium">Пополнения</p>
          <p className="text-2xl font-bold text-green-400 mt-1">+{totalDeposits.toFixed(2)} ₽</p>
        </div>
        <div className="bg-red-500/5 border border-red-500/10 rounded-2xl p-5">
          <p className="text-xs text-gray-500 uppercase tracking-wider font-medium">Списания</p>
          <p className="text-2xl font-bold text-red-400 mt-1">-{totalCharges.toFixed(2)} ₽</p>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex items-center gap-1 bg-white/[0.03] border border-white/[0.06] rounded-xl p-1 w-fit">
        {[
          { key: "all", label: "Все" },
          { key: "deposit", label: "Пополнения" },
          { key: "charge", label: "Списания" },
          { key: "refund", label: "Возвраты" },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setFilterType(tab.key)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              filterType === tab.key
                ? "bg-purple-600/20 text-white border border-purple-500/20"
                : "text-gray-500 hover:text-gray-300"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="bg-white/[0.04] border border-white/[0.08] rounded-2xl overflow-hidden">
        {filtered.length === 0 ? (
          <div className="p-12 text-center text-gray-500">Нет операций</div>
        ) : (
          <>
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/[0.06]">
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Дата</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Тип</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Описание</th>
                  <th className="text-right px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Сумма</th>
                  <th className="text-right px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Баланс после</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.04]">
                {filtered.map((tx) => {
                  const info = TX_TYPE_MAP[tx.type] || { label: tx.type, icon: "📄", color: "text-gray-400" };
                  const isPositive = tx.amount >= 0;
                  return (
                    <tr key={tx.id} className="hover:bg-white/[0.02] transition-colors">
                      <td className="px-5 py-3.5 text-sm text-gray-400 whitespace-nowrap">
                        {new Date(tx.created_at).toLocaleString("ru", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                      </td>
                      <td className="px-5 py-3.5">
                        <span className="text-xs font-medium text-gray-400">{info.icon} {info.label}</span>
                      </td>
                      <td className="px-5 py-3.5 text-sm text-white truncate max-w-[300px]">{tx.description || info.label}</td>
                      <td className={`px-5 py-3.5 text-sm font-semibold text-right tabular-nums ${isPositive ? "text-green-400" : "text-red-400"}`}>
                        {isPositive ? "+" : ""}{tx.amount.toFixed(2)} ₽
                      </td>
                      <td className="px-5 py-3.5 text-sm text-gray-500 text-right tabular-nums">{tx.balance_after.toFixed(2)} ₽</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {totalPages > 1 && (
              <div className="flex items-center justify-between px-5 py-3 border-t border-white/[0.06]">
                <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1} className="text-xs text-gray-400 hover:text-white disabled:opacity-30 transition-colors">← Назад</button>
                <span className="text-xs text-gray-500">{page} / {totalPages}</span>
                <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages} className="text-xs text-gray-400 hover:text-white disabled:opacity-30 transition-colors">Далее →</button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
