"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const MENU_ITEMS = [
  { href: "/admin", label: "Обзор", icon: "📊" },
  { href: "/admin/plans", label: "Тарифы", icon: "💎" },
  { href: "/admin/nodes", label: "Ноды", icon: "🖥️" },
  { href: "/admin/servers", label: "Серверы", icon: "☁️" },
  { href: "/admin/users", label: "Пользователи", icon: "👤" },
  { href: "/admin/tickets", label: "Тикеты", icon: "🎫" },
];

export default function AdminSidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-64 bg-white/[0.02] backdrop-blur-sm border-r border-white/[0.06] text-white min-h-screen p-6 flex flex-col">
      <div className="mb-8">
        <Link href="/admin" className="flex items-center gap-2.5">
          <span className="text-2xl text-purple-400">∞</span>
          <span className="text-lg font-bold text-white">Admin Panel</span>
        </Link>
      </div>

      <nav className="space-y-1 flex-1">
        {MENU_ITEMS.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all ${
                isActive
                  ? "bg-gradient-to-r from-purple-600/20 to-violet-600/10 text-white border border-purple-500/20"
                  : "text-gray-400 hover:text-white hover:bg-white/[0.04]"
              }`}
            >
              <span>{item.icon}</span>
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="mt-8 pt-6 border-t border-white/[0.06]">
        <Link
          href="/dashboard"
          className="flex items-center gap-3 px-3 py-2 rounded-xl text-sm text-gray-400 hover:text-white hover:bg-white/[0.04] transition-colors"
        >
          ← Панель клиента
        </Link>
      </div>
    </aside>
  );
}
