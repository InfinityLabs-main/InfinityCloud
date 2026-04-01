"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { authApi, userApi, type User } from "@/lib/api";
import { isAdmin } from "@/lib/auth";

const MENU_ITEMS = [
  { href: "/dashboard", label: "Дашборд", icon: "📊", exact: true },
  { href: "/dashboard/servers", label: "Мои серверы", icon: "☁️" },
  { href: "/dashboard/create", label: "Создать VPS", icon: "➕" },
  { href: "/dashboard/billing", label: "Биллинг", icon: "💳" },
  { href: "/dashboard/history", label: "История операций", icon: "📋" },
  { href: "/dashboard/tickets", label: "Поддержка", icon: "🎫" },
];

const BOTTOM_MENU = [
  { href: "/dashboard/profile", label: "Профиль", icon: "👤" },
  { href: "/dashboard/security", label: "Безопасность", icon: "🔐" },
  { href: "/dashboard/settings", label: "Настройки", icon: "⚙️" },
];

export default function DashboardSidebar() {
  const pathname = usePathname();
  const [user, setUser] = useState<User | null>(null);
  const [balance, setBalance] = useState<number>(0);

  useEffect(() => {
    authApi.me().then((r) => setUser(r.data)).catch(() => {});
    userApi.getBalance().then((r) => setBalance(r.data.balance)).catch(() => {});
  }, []);

  const isActive = (href: string, exact?: boolean) => {
    if (exact) return pathname === href;
    return pathname === href || pathname.startsWith(href + "/");
  };

  return (
    <aside className="w-[260px] shrink-0 bg-white/[0.02] backdrop-blur-sm border-r border-white/[0.06] text-white min-h-screen flex flex-col">
      {/* Logo */}
      <div className="px-5 py-5 border-b border-white/[0.06]">
        <Link href="/dashboard" className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500 to-violet-600 flex items-center justify-center">
            <span className="text-white font-bold text-sm">∞</span>
          </div>
          <span className="text-base font-bold text-white tracking-tight">Infinity Cloud</span>
        </Link>
      </div>

      {/* Balance card */}
      <div className="px-4 py-4">
        <div className="bg-gradient-to-br from-purple-600/20 to-violet-600/10 border border-purple-500/20 rounded-xl p-3.5">
          <p className="text-[11px] uppercase tracking-wider text-gray-400 font-medium">Баланс</p>
          <p className="text-xl font-bold text-white mt-0.5">{balance.toFixed(2)} ₽</p>
          <Link
            href="/dashboard/billing"
            className="mt-2.5 block w-full text-center bg-purple-600/30 hover:bg-purple-600/50 border border-purple-500/20 text-purple-200 text-xs font-medium py-1.5 rounded-lg transition-all"
          >
            Пополнить
          </Link>
        </div>
      </div>

      {/* Main menu */}
      <nav className="flex-1 px-3 space-y-0.5">
        <p className="text-[10px] uppercase tracking-wider text-gray-500 font-semibold px-3 mb-2">Меню</p>
        {MENU_ITEMS.map((item) => {
          const active = isActive(item.href, item.exact);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all duration-200 ${
                active
                  ? "bg-gradient-to-r from-purple-600/20 to-violet-600/10 text-white border border-purple-500/20 shadow-sm shadow-purple-500/5"
                  : "text-gray-400 hover:text-white hover:bg-white/[0.04]"
              }`}
            >
              <span className="text-base w-5 text-center">{item.icon}</span>
              <span className="font-medium">{item.label}</span>
            </Link>
          );
        })}

        <div className="!mt-5">
          <p className="text-[10px] uppercase tracking-wider text-gray-500 font-semibold px-3 mb-2">Аккаунт</p>
          {BOTTOM_MENU.map((item) => {
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all duration-200 ${
                  active
                    ? "bg-gradient-to-r from-purple-600/20 to-violet-600/10 text-white border border-purple-500/20 shadow-sm shadow-purple-500/5"
                    : "text-gray-400 hover:text-white hover:bg-white/[0.04]"
                }`}
              >
                <span className="text-base w-5 text-center">{item.icon}</span>
                <span className="font-medium">{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>

      {/* User + Admin + Logout */}
      <div className="px-3 pb-4 mt-4 border-t border-white/[0.06] pt-4 space-y-1">
        {user && (
          <div className="flex items-center gap-2.5 px-3 py-2">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500/20 to-violet-500/20 border border-purple-500/20 flex items-center justify-center text-xs text-purple-300 font-bold">
              {user.email.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs text-white font-medium truncate">{user.email}</p>
              <p className="text-[10px] text-gray-500">ID: #{user.id}</p>
            </div>
          </div>
        )}
        {isAdmin() && (
          <Link
            href="/admin"
            className="flex items-center gap-3 px-3 py-2 rounded-xl text-sm text-purple-400 hover:text-purple-300 hover:bg-purple-500/10 transition-all"
          >
            <span className="text-base w-5 text-center">🛡️</span>
            <span className="font-medium">Админ-панель</span>
          </Link>
        )}
        <button
          onClick={() => authApi.logout()}
          className="flex items-center gap-3 px-3 py-2 rounded-xl text-sm text-gray-500 hover:text-red-400 hover:bg-red-500/5 transition-all w-full"
        >
          <span className="text-base w-5 text-center">🚪</span>
          <span className="font-medium">Выйти</span>
        </button>
      </div>
    </aside>
  );
}
