"use client";

import { useEffect, useState } from "react";
import { authApi, type User } from "@/lib/api";
import api from "@/lib/api";

export default function ProfilePage() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // Password change
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordMsg, setPasswordMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    authApi.me().then((r) => { setUser(r.data); }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const handleChangePassword = async () => {
    if (!currentPassword || !newPassword) {
      setPasswordMsg({ type: "err", text: "Заполните все поля" });
      return;
    }
    if (newPassword.length < 6) {
      setPasswordMsg({ type: "err", text: "Пароль должен быть не менее 6 символов" });
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordMsg({ type: "err", text: "Пароли не совпадают" });
      return;
    }

    setSaving(true);
    setPasswordMsg(null);
    try {
      await api.post("/auth/change-password", { current_password: currentPassword, new_password: newPassword });
      setPasswordMsg({ type: "ok", text: "Пароль успешно изменён" });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err: any) {
      setPasswordMsg({ type: "err", text: err.response?.data?.detail || "Ошибка смены пароля" });
    } finally {
      setSaving(false);
    }
  };

  if (loading || !user) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-purple-500/30 border-t-purple-500 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-white">Профиль</h1>
        <p className="text-sm text-gray-500 mt-1">Информация о вашем аккаунте</p>
      </div>

      {/* Profile card */}
      <div className="bg-white/[0.04] border border-white/[0.08] rounded-2xl overflow-hidden">
        <div className="px-6 py-5 border-b border-white/[0.06] flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-purple-500/20 to-violet-500/20 border border-purple-500/20 flex items-center justify-center text-2xl text-purple-300 font-bold">
            {user.email.charAt(0).toUpperCase()}
          </div>
          <div>
            <p className="text-lg font-semibold text-white">{user.email}</p>
            <p className="text-sm text-gray-500">
              Зарегистрирован {new Date(user.created_at).toLocaleDateString("ru")}
            </p>
          </div>
        </div>

        <div className="divide-y divide-white/[0.04]">
          {[
            { label: "ID аккаунта", value: `#${user.id}` },
            { label: "Email", value: user.email },
            { label: "Роль", value: user.role === "admin" ? "Администратор" : "Пользователь" },
            { label: "Баланс", value: `${user.balance.toFixed(2)} ₽`, color: "text-green-400" },
            { label: "Статус", value: user.is_active ? "Активен" : "Заблокирован", color: user.is_active ? "text-green-400" : "text-red-400" },
          ].map((row) => (
            <div key={row.label} className="flex items-center justify-between px-6 py-3.5">
              <span className="text-sm text-gray-500">{row.label}</span>
              <span className={`text-sm font-medium ${row.color || "text-white"}`}>{row.value}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Change password */}
      <div className="bg-white/[0.04] border border-white/[0.08] rounded-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-white/[0.06]">
          <h2 className="font-semibold text-white text-sm">Смена пароля</h2>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="text-xs text-gray-500 mb-1.5 block">Текущий пароль</label>
            <input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:border-purple-500/40 transition-colors"
            />
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1.5 block">Новый пароль</label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Минимум 6 символов"
              className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:border-purple-500/40 transition-colors"
            />
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1.5 block">Подтвердите пароль</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:border-purple-500/40 transition-colors"
            />
          </div>

          {passwordMsg && (
            <div className={`text-sm p-3 rounded-xl ${
              passwordMsg.type === "ok" ? "bg-green-500/10 border border-green-500/20 text-green-400" : "bg-red-500/10 border border-red-500/20 text-red-400"
            }`}>
              {passwordMsg.text}
            </div>
          )}

          <button
            onClick={handleChangePassword}
            disabled={saving}
            className="bg-gradient-to-r from-purple-600 to-violet-600 hover:from-purple-500 hover:to-violet-500 text-white font-medium py-2.5 px-5 rounded-xl transition-all disabled:opacity-50 text-sm"
          >
            {saving ? "Сохранение…" : "Изменить пароль"}
          </button>
        </div>
      </div>
    </div>
  );
}
