"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTheme } from "@/lib/ThemeContext";

const MENU_ITEMS = [
  { href: "/admin", label: "Обзор", icon: "📊" },
  { href: "/admin/plans", label: "Тарифы", icon: "💎" },
  { href: "/admin/nodes", label: "Ноды", icon: "🖥️" },
  { href: "/admin/servers", label: "Серверы", icon: "☁️" },
  { href: "/admin/users", label: "Пользователи", icon: "👤" },
];

export default function AdminSidebar() {
  const pathname = usePathname();
  const { dark, toggleDark } = useTheme();

  return (
    <aside className="w-64 bg-dark-800 text-white min-h-screen p-6 flex flex-col">
      <div className="mb-8 flex items-center justify-between">
        <Link href="/admin" className="text-lg font-bold text-primary-400">
          ∞ Admin Panel
        </Link>
        <button
          onClick={toggleDark}
          className="p-1.5 rounded-lg hover:bg-white/10 transition-colors text-lg"
          title={dark ? "Светлая тема" : "Тёмная тема"}
        >
          {dark ? "☀️" : "🌙"}
        </button>
      </div>

      <nav className="space-y-1 flex-1">
        {MENU_ITEMS.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                isActive
                  ? "bg-primary-600 text-white"
                  : "text-gray-400 hover:text-white hover:bg-white/5"
              }`}
            >
              <span>{item.icon}</span>
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="mt-8 pt-6 border-t border-white/10">
        <Link
          href="/dashboard"
          className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-gray-400 hover:text-white hover:bg-white/5"
        >
          ← Панель клиента
        </Link>
      </div>
    </aside>
  );
}
