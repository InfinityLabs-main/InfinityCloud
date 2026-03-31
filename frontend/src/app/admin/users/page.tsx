"use client";

import { useEffect, useState } from "react";
import { adminApi, type User } from "@/lib/api";

export default function AdminUsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [page, setPage] = useState(1);
  const [depositUserId, setDepositUserId] = useState<number | null>(null);
  const [depositAmount, setDepositAmount] = useState("");

  useEffect(() => { loadUsers(); }, [page]);

  const loadUsers = async () => {
    const res = await adminApi.listUsers(page);
    setUsers(res.data);
  };

  const handleDeposit = async (userId: number) => {
    const amount = parseFloat(depositAmount);
    if (!amount || amount <= 0) return;
    try {
      await adminApi.depositUser(userId, amount);
      setDepositUserId(null);
      setDepositAmount("");
      loadUsers();
    } catch (err: any) {
      alert(err.response?.data?.detail || "Ошибка");
    }
  };

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Пользователи</h1>

      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-gray-500">
              <th className="pb-3 pr-4">ID</th>
              <th className="pb-3 pr-4">Email</th>
              <th className="pb-3 pr-4">Роль</th>
              <th className="pb-3 pr-4">Баланс</th>
              <th className="pb-3 pr-4">Статус</th>
              <th className="pb-3 pr-4">Регистрация</th>
              <th className="pb-3">Действия</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-b border-gray-100">
                <td className="py-3 pr-4">#{u.id}</td>
                <td className="py-3 pr-4 font-medium">{u.email}</td>
                <td className="py-3 pr-4">
                  <span className={`status-badge ${
                    u.role === "admin" ? "bg-purple-100 text-purple-800" : "bg-gray-100 text-gray-800"
                  }`}>{u.role}</span>
                </td>
                <td className="py-3 pr-4 font-medium text-green-600">
                  {u.balance.toFixed(2)} ₽
                </td>
                <td className="py-3 pr-4">
                  <span className={`status-badge ${
                    u.is_active ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"
                  }`}>{u.is_active ? "Активен" : "Заблокирован"}</span>
                </td>
                <td className="py-3 pr-4 text-gray-500">
                  {new Date(u.created_at).toLocaleDateString("ru")}
                </td>
                <td className="py-3">
                  {depositUserId === u.id ? (
                    <div className="flex gap-1">
                      <input type="number" value={depositAmount}
                        onChange={(e) => setDepositAmount(e.target.value)}
                        className="input-field w-24 text-xs" placeholder="Сумма" />
                      <button onClick={() => handleDeposit(u.id)}
                        className="text-xs text-primary-600 hover:underline">OK</button>
                      <button onClick={() => setDepositUserId(null)}
                        className="text-xs text-gray-400 hover:underline">✕</button>
                    </div>
                  ) : (
                    <button onClick={() => setDepositUserId(u.id)}
                      className="text-primary-600 hover:underline text-xs">
                      Пополнить
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex gap-2 mt-4">
        <button onClick={() => setPage(Math.max(1, page - 1))}
          disabled={page === 1} className="btn-secondary disabled:opacity-50">← Назад</button>
        <span className="flex items-center px-4 text-sm text-gray-500">Стр. {page}</span>
        <button onClick={() => setPage(page + 1)} className="btn-secondary">Вперёд →</button>
      </div>
    </div>
  );
}
