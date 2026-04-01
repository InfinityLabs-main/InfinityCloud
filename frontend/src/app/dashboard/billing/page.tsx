"use client";

import { useEffect, useState } from "react";
import { userApi, paymentApi, type Transaction } from "@/lib/api";

const QUICK_AMOUNTS = [100, 250, 500, 1000, 2500, 5000];

const TX_TYPE_MAP: Record<string, { label: string; icon: string; color: string }> = {
  deposit: { label: "Пополнение", icon: "💰", color: "text-green-400" },
  charge:  { label: "Списание",   icon: "💸", color: "text-red-400" },
  refund:  { label: "Возврат",    icon: "↩️", color: "text-blue-400" },
  bonus:   { label: "Бонус",      icon: "🎁", color: "text-yellow-400" },
};

export default function BillingPage() {
  const [balance, setBalance] = useState(0);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [totalTx, setTotalTx] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  const [depositAmount, setDepositAmount] = useState("");
  const [paymentLoading, setPaymentLoading] = useState(false);

  useEffect(() => { loadData(); }, [page]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [balRes, txRes] = await Promise.all([
        userApi.getBalance(),
        userApi.getTransactions(page),
      ]);
      setBalance(balRes.data.balance);
      setTransactions(txRes.data.items);
      setTotalTx(txRes.data.total);
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

  const perPage = 20;
  const totalPages = Math.ceil(totalTx / perPage);

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
        <h1 className="text-2xl font-bold text-white">Биллинг</h1>
        <p className="text-sm text-gray-500 mt-1">Управление балансом и платежами</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Balance card */}
        <div className="lg:col-span-1">
          <div className="bg-gradient-to-br from-purple-600/15 via-violet-600/5 to-transparent border border-purple-500/15 rounded-2xl p-6 sticky top-6">
            <p className="text-xs uppercase tracking-wider text-gray-400 font-medium">Текущий баланс</p>
            <p className="text-4xl font-bold text-white mt-2 tabular-nums">
              {balance.toFixed(2)} <span className="text-lg text-gray-400">₽</span>
            </p>

            <div className="mt-6">
              <p className="text-xs text-gray-500 mb-2">Быстрое пополнение</p>
              <div className="grid grid-cols-3 gap-1.5 mb-3">
                {QUICK_AMOUNTS.map((amt) => (
                  <button
                    key={amt}
                    onClick={() => setDepositAmount(String(amt))}
                    className={`py-2 rounded-lg text-xs font-medium transition-all border ${
                      depositAmount === String(amt)
                        ? "bg-purple-600/20 border-purple-500/30 text-purple-300"
                        : "bg-white/[0.03] border-white/[0.06] text-gray-400 hover:text-white hover:bg-white/[0.06]"
                    }`}
                  >
                    {amt} ₽
                  </button>
                ))}
              </div>

              <div className="flex gap-2">
                <input
                  type="number"
                  value={depositAmount}
                  onChange={(e) => setDepositAmount(e.target.value)}
                  placeholder="Своя сумма"
                  min="1"
                  className="flex-1 bg-white/[0.04] border border-white/[0.08] rounded-xl px-3 py-2.5 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:border-purple-500/40 transition-colors"
                />
                <button
                  onClick={handleDeposit}
                  disabled={paymentLoading || !depositAmount}
                  className="bg-gradient-to-r from-purple-600 to-violet-600 hover:from-purple-500 hover:to-violet-500 text-white font-medium py-2.5 px-5 rounded-xl transition-all disabled:opacity-50 text-sm whitespace-nowrap"
                >
                  {paymentLoading ? "…" : "Оплатить"}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Transactions table */}
        <div className="lg:col-span-2">
          <div className="bg-white/[0.04] border border-white/[0.08] rounded-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-white/[0.06]">
              <h2 className="font-semibold text-white text-sm">История платежей</h2>
              <p className="text-xs text-gray-500 mt-0.5">Всего операций: {totalTx}</p>
            </div>

            {transactions.length === 0 ? (
              <div className="p-12 text-center">
                <p className="text-gray-500">Операций пока нет</p>
              </div>
            ) : (
              <>
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-white/[0.06]">
                      <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Дата</th>
                      <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Описание</th>
                      <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Тип</th>
                      <th className="text-right px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Сумма</th>
                      <th className="text-right px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Баланс</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.04]">
                    {transactions.map((tx) => {
                      const txInfo = TX_TYPE_MAP[tx.type] || { label: tx.type, icon: "📄", color: "text-gray-400" };
                      const isPositive = tx.amount >= 0;
                      return (
                        <tr key={tx.id} className="hover:bg-white/[0.02] transition-colors">
                          <td className="px-5 py-3.5 text-sm text-gray-400">
                            {new Date(tx.created_at).toLocaleString("ru", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                          </td>
                          <td className="px-5 py-3.5 text-sm text-white truncate max-w-[200px]">
                            {tx.description || txInfo.label}
                          </td>
                          <td className="px-5 py-3.5">
                            <span className="text-xs font-medium text-gray-400">{txInfo.icon} {txInfo.label}</span>
                          </td>
                          <td className={`px-5 py-3.5 text-sm font-semibold text-right tabular-nums ${isPositive ? "text-green-400" : "text-red-400"}`}>
                            {isPositive ? "+" : ""}{tx.amount.toFixed(2)} ₽
                          </td>
                          <td className="px-5 py-3.5 text-sm text-gray-500 text-right tabular-nums">
                            {tx.balance_after.toFixed(2)} ₽
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-between px-5 py-3 border-t border-white/[0.06]">
                    <button
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={page <= 1}
                      className="text-xs text-gray-400 hover:text-white disabled:opacity-30 transition-colors"
                    >
                      ← Назад
                    </button>
                    <span className="text-xs text-gray-500">{page} / {totalPages}</span>
                    <button
                      onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                      disabled={page >= totalPages}
                      className="text-xs text-gray-400 hover:text-white disabled:opacity-30 transition-colors"
                    >
                      Далее →
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
