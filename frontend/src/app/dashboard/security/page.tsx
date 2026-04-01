"use client";

import { useState } from "react";
import api from "@/lib/api";

export default function SecurityPage() {
  // Password
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const [saving, setSaving] = useState(false);

  const handleChangePassword = async () => {
    if (!currentPassword || !newPassword) {
      setMsg({ type: "err", text: "Заполните все поля" });
      return;
    }
    if (newPassword.length < 6) {
      setMsg({ type: "err", text: "Минимум 6 символов" });
      return;
    }
    if (newPassword !== confirmPassword) {
      setMsg({ type: "err", text: "Пароли не совпадают" });
      return;
    }
    setSaving(true);
    setMsg(null);
    try {
      await api.post("/auth/change-password", { current_password: currentPassword, new_password: newPassword });
      setMsg({ type: "ok", text: "Пароль успешно изменён" });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err: any) {
      setMsg({ type: "err", text: err.response?.data?.detail || "Ошибка" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-white">Безопасность</h1>
        <p className="text-sm text-gray-500 mt-1">Управление паролем и безопасностью аккаунта</p>
      </div>

      {/* Change password */}
      <div className="bg-white/[0.04] border border-white/[0.08] rounded-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-white/[0.06]">
          <h2 className="font-semibold text-white text-sm">🔐 Смена пароля</h2>
          <p className="text-xs text-gray-500 mt-0.5">Рекомендуем менять пароль не реже раза в 3 месяца</p>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="text-xs text-gray-500 mb-1.5 block">Текущий пароль</label>
            <input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-purple-500/40 transition-colors"
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
            <label className="text-xs text-gray-500 mb-1.5 block">Подтвердите новый пароль</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-purple-500/40 transition-colors"
            />
          </div>

          {msg && (
            <div className={`text-sm p-3 rounded-xl ${
              msg.type === "ok" ? "bg-green-500/10 border border-green-500/20 text-green-400" : "bg-red-500/10 border border-red-500/20 text-red-400"
            }`}>
              {msg.text}
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

      {/* 2FA */}
      <div className="bg-white/[0.04] border border-white/[0.08] rounded-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-white/[0.06]">
          <h2 className="font-semibold text-white text-sm">🛡️ Двухфакторная аутентификация (2FA)</h2>
          <p className="text-xs text-gray-500 mt-0.5">Дополнительная защита аккаунта</p>
        </div>
        <div className="p-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-yellow-500/10 border border-yellow-500/20 flex items-center justify-center text-xl">
              🔒
            </div>
            <div className="flex-1">
              <p className="text-sm text-white font-medium">2FA не активирован</p>
              <p className="text-xs text-gray-500">Подключите аутентификатор для повышенной безопасности</p>
            </div>
            <button
              className="bg-white/[0.06] border border-white/[0.1] text-gray-400 font-medium py-2 px-4 rounded-xl text-sm cursor-not-allowed opacity-60"
              disabled
            >
              Скоро
            </button>
          </div>
        </div>
      </div>

      {/* Active sessions */}
      <div className="bg-white/[0.04] border border-white/[0.08] rounded-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-white/[0.06]">
          <h2 className="font-semibold text-white text-sm">📱 Активные сессии</h2>
        </div>
        <div className="p-6">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-green-500/10 border border-green-500/20 flex items-center justify-center text-sm">
              🟢
            </div>
            <div className="flex-1">
              <p className="text-sm text-white font-medium">Текущая сессия</p>
              <p className="text-xs text-gray-500">Браузер · Активна сейчас</p>
            </div>
            <span className="text-xs text-green-400 font-medium px-2 py-0.5 bg-green-500/10 border border-green-500/20 rounded-full">Активна</span>
          </div>
        </div>
      </div>
    </div>
  );
}
