"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const MENU_ITEMS = [
  { href: "/admin", label: "Обзор", icon: "📊" },
  { href: "/admin/plans", label: "Тарифы", icon: "💎" },
  { href: "/admin/nodes", label: "Ноды", icon: "🖥️" },
  { href: "/admin/servers", label: "Серверы", icon: "☁️" },
  { href: "/admin/users", label: "Пользователи", icon: "👤" },
];

export default function AdminSidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-64 bg-dark-800 text-white min-h-screen p-6">
      <div className="mb-8">
        <Link href="/admin" className="text-lg font-bold text-primary-400">
          ∞ Admin Panel
        </Link>
      </div>

      <nav className="space-y-1">
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
