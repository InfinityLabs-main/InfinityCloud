"use client";

import { useEffect, useState } from "react";
import { adminApi, type User } from "@/lib/api";

export default function AdminUsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [page, setPage] = useState(1);
  const [depositUserId, setDepositUserId] = useState<number | null>(null);
  const [depositAmount, setDepositAmount] = useState("");
  const [resetPwdUserId, setResetPwdUserId] = useState<number | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [search, setSearch] = useState("");

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

  const handleToggle = async (userId: number, currentActive: boolean) => {
    const action = currentActive ? "заблокировать" : "разблокировать";
    if (!confirm(`Вы уверены, что хотите ${action} пользователя #${userId}?`)) return;
    try {
      await adminApi.toggleUser(userId, !currentActive);
      loadUsers();
    } catch (err: any) {
      alert(err.response?.data?.detail || "Ошибка");
    }
  };

  const handleRoleChange = async (userId: number, currentRole: string) => {
    const newRole = currentRole === "admin" ? "user" : "admin";
    if (!confirm(`Сменить роль на "${newRole}" для пользователя #${userId}?`)) return;
    try {
      await adminApi.setUserRole(userId, newRole);
      loadUsers();
    } catch (err: any) {
      alert(err.response?.data?.detail || "Ошибка");
    }
  };

  const handleResetPassword = async (userId: number) => {
    if (newPassword.length < 6) {
      alert("Пароль должен быть минимум 6 символов");
      return;
    }
    try {
      await adminApi.resetUserPassword(userId, newPassword);
      setResetPwdUserId(null);
      setNewPassword("");
      alert("Пароль успешно изменён");
    } catch (err: any) {
      alert(err.response?.data?.detail || "Ошибка");
    }
  };

  const filteredUsers = users.filter((u) =>
    !search ||
    u.email.toLowerCase().includes(search.toLowerCase()) ||
    String(u.id).includes(search) ||
    u.role.includes(search.toLowerCase())
  );

  return (
    <div>
      <h1 className="text-2xl font-bold text-white mb-6">Пользователи</h1>

      <div className="mb-4">
        <input
          placeholder="🔍 Поиск по email, ID, роли…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:border-purple-500/40 max-w-md"
        />
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/[0.08] text-left text-gray-400">
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
            {filteredUsers.map((u) => (
              <tr key={u.id} className="border-b border-white/[0.06]">
                <td className="py-3 pr-4">#{u.id}</td>
                <td className="py-3 pr-4 font-medium">{u.email}</td>
                <td className="py-3 pr-4">
                  <span className={`status-badge cursor-pointer ${
                    u.role === "admin" ? "bg-purple-500/10 text-purple-400 border border-purple-500/20" : "bg-gray-500/10 text-gray-400 border border-gray-500/20"
                  }`}
                    onClick={() => handleRoleChange(u.id, u.role)}
                    title="Нажмите для смены роли"
                  >{u.role}</span>
                </td>
                <td className="py-3 pr-4 font-medium text-green-600">
                  {u.balance.toFixed(2)} ₽
                </td>
                <td className="py-3 pr-4">
                  <span className={`status-badge ${
                    u.is_active ? "bg-green-500/10 text-green-400 border border-green-500/20" : "bg-red-500/10 text-red-400 border border-red-500/20"
                  }`}>{u.is_active ? "Активен" : "Заблокирован"}</span>
                </td>
                <td className="py-3 pr-4 text-gray-500 dark:text-gray-400">
                  {new Date(u.created_at).toLocaleDateString("ru")}
                </td>
                <td className="py-3">
                  <div className="flex flex-col gap-1">
                    {/* Пополнение */}
                    {depositUserId === u.id ? (
                      <div className="flex gap-1">
                        <input type="number" value={depositAmount}
                          onChange={(e) => setDepositAmount(e.target.value)}
                          className="bg-white/[0.04] border border-white/[0.08] rounded-lg px-2 py-1 text-xs text-white placeholder:text-gray-500 focus:outline-none focus:border-purple-500/40 w-24" placeholder="Сумма ₽" />
                        <button onClick={() => handleDeposit(u.id)}
                          className="text-xs text-purple-400 hover:text-purple-300 hover:underline">OK</button>
                        <button onClick={() => setDepositUserId(null)}
                          className="text-xs text-gray-400 hover:text-gray-300 hover:underline">✕</button>
                      </div>
                    ) : (
                      <div className="flex gap-2 flex-wrap">
                        <button onClick={() => setDepositUserId(u.id)}
                          className="text-purple-400 hover:text-purple-300 hover:underline text-xs">
                          💰 Пополнить
                        </button>
                        <button onClick={() => handleToggle(u.id, u.is_active)}
                          className={`hover:underline text-xs ${u.is_active ? "text-red-400 hover:text-red-300" : "text-green-400 hover:text-green-300"}`}>
                          {u.is_active ? "🔒 Заблокировать" : "🔓 Разблокировать"}
                        </button>
                        {resetPwdUserId === u.id ? (
                          <div className="flex gap-1">
                            <input type="password" value={newPassword}
                              onChange={(e) => setNewPassword(e.target.value)}
                              className="bg-white/[0.04] border border-white/[0.08] rounded-lg px-2 py-1 text-xs text-white placeholder:text-gray-500 focus:outline-none focus:border-purple-500/40 w-28" placeholder="Новый пароль" />
                            <button onClick={() => handleResetPassword(u.id)}
                              className="text-xs text-purple-400 hover:text-purple-300 hover:underline">OK</button>
                            <button onClick={() => setResetPwdUserId(null)}
                              className="text-xs text-gray-400 hover:text-gray-300 hover:underline">✕</button>
                          </div>
                        ) : (
                          <button onClick={() => setResetPwdUserId(u.id)}
                            className="text-orange-400 hover:text-orange-300 hover:underline text-xs">
                            🔑 Пароль
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex gap-2 mt-4">
        <button onClick={() => setPage(Math.max(1, page - 1))}
          disabled={page === 1} className="btn-secondary disabled:opacity-50">← Назад</button>
        <span className="flex items-center px-4 text-sm text-gray-400">Стр. {page}</span>
        <button onClick={() => setPage(page + 1)} className="btn-secondary">Вперёд →</button>
      </div>
    </div>
  );
}
