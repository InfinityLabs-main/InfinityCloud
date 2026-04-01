"use client";

import { useState } from "react";

export default function SettingsPage() {
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [serverAlerts, setServerAlerts] = useState(true);
  const [billingAlerts, setBillingAlerts] = useState(true);
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    // В реальности тут API-вызов
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-white">Настройки</h1>
        <p className="text-sm text-gray-500 mt-1">Общие настройки аккаунта</p>
      </div>

      {/* Notifications */}
      <div className="bg-white/[0.04] border border-white/[0.08] rounded-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-white/[0.06]">
          <h2 className="font-semibold text-white text-sm">🔔 Уведомления</h2>
          <p className="text-xs text-gray-500 mt-0.5">Настройте, какие уведомления вы хотите получать</p>
        </div>
        <div className="divide-y divide-white/[0.04]">
          {[
            {
              label: "Email уведомления",
              desc: "Получать важные уведомления на email",
              value: emailNotifications,
              set: setEmailNotifications,
            },
            {
              label: "Статус серверов",
              desc: "Уведомления об изменении статуса VPS",
              value: serverAlerts,
              set: setServerAlerts,
            },
            {
              label: "Биллинг",
              desc: "Уведомления о платежах и балансе",
              value: billingAlerts,
              set: setBillingAlerts,
            },
          ].map((item) => (
            <div key={item.label} className="flex items-center justify-between px-6 py-4">
              <div>
                <p className="text-sm text-white font-medium">{item.label}</p>
                <p className="text-xs text-gray-500">{item.desc}</p>
              </div>
              <button
                onClick={() => item.set(!item.value)}
                className={`relative w-11 h-6 rounded-full transition-colors ${
                  item.value ? "bg-purple-600" : "bg-white/[0.1]"
                }`}
              >
                <span
                  className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform shadow-sm ${
                    item.value ? "translate-x-5" : ""
                  }`}
                />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Display */}
      <div className="bg-white/[0.04] border border-white/[0.08] rounded-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-white/[0.06]">
          <h2 className="font-semibold text-white text-sm">🎨 Внешний вид</h2>
        </div>
        <div className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-white font-medium">Тема</p>
              <p className="text-xs text-gray-500">Текущая тема оформления</p>
            </div>
            <div className="flex items-center gap-2">
              <span className="px-3 py-1.5 rounded-lg text-xs font-medium bg-purple-600/20 border border-purple-500/20 text-purple-300">
                🌙 Тёмная
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Language */}
      <div className="bg-white/[0.04] border border-white/[0.08] rounded-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-white/[0.06]">
          <h2 className="font-semibold text-white text-sm">🌐 Язык и регион</h2>
        </div>
        <div className="divide-y divide-white/[0.04]">
          <div className="flex items-center justify-between px-6 py-4">
            <div>
              <p className="text-sm text-white font-medium">Язык</p>
              <p className="text-xs text-gray-500">Язык интерфейса</p>
            </div>
            <span className="text-sm text-gray-300">🇷🇺 Русский</span>
          </div>
          <div className="flex items-center justify-between px-6 py-4">
            <div>
              <p className="text-sm text-white font-medium">Часовой пояс</p>
              <p className="text-xs text-gray-500">Используется для отображения дат</p>
            </div>
            <span className="text-sm text-gray-300">UTC+3 (Москва)</span>
          </div>
          <div className="flex items-center justify-between px-6 py-4">
            <div>
              <p className="text-sm text-white font-medium">Валюта</p>
              <p className="text-xs text-gray-500">Валюта для расчётов</p>
            </div>
            <span className="text-sm text-gray-300">₽ Рубль</span>
          </div>
        </div>
      </div>

      {/* Danger zone */}
      <div className="bg-red-500/5 border border-red-500/10 rounded-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-red-500/10">
          <h2 className="font-semibold text-red-400 text-sm">⚠️ Опасная зона</h2>
        </div>
        <div className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-white font-medium">Удалить аккаунт</p>
              <p className="text-xs text-gray-500">Все данные будут удалены безвозвратно</p>
            </div>
            <button className="text-xs text-red-400 border border-red-500/20 hover:bg-red-500/10 font-medium py-2 px-4 rounded-xl transition-all">
              Удалить аккаунт
            </button>
          </div>
        </div>
      </div>

      {/* Save */}
      <button
        onClick={handleSave}
        className="bg-gradient-to-r from-purple-600 to-violet-600 hover:from-purple-500 hover:to-violet-500 text-white font-medium py-2.5 px-6 rounded-xl transition-all text-sm"
      >
        {saved ? "✓ Сохранено" : "Сохранить настройки"}
      </button>
    </div>
  );
}
