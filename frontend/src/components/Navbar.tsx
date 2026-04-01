"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { authApi, type User } from "@/lib/api";
import { isAdmin, isAuthenticated } from "@/lib/auth";

export default function Navbar() {
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    if (isAuthenticated()) {
      authApi.me().then((r) => setUser(r.data)).catch(() => {});
    }
  }, []);

  return (
    <nav className="bg-[#060010]/80 backdrop-blur-2xl border-b border-white/[0.06] sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16 items-center">
          <Link href="/dashboard" className="flex items-center gap-2">
            <span className="text-xl text-purple-400">∞</span>
            <span className="font-semibold text-white">Infinity Cloud</span>
          </Link>

          <div className="flex items-center gap-6">
            {user && (
              <>
                <Link href="/dashboard" className="text-sm text-gray-400 hover:text-white transition-colors">
                  Серверы
                </Link>
                <Link href="/dashboard/create" className="text-sm text-gray-400 hover:text-white transition-colors">
                  Создать VPS
                </Link>
                <Link href="/dashboard/tickets" className="text-sm text-gray-400 hover:text-white transition-colors">
                  Поддержка
                </Link>
                {isAdmin() && (
                  <Link href="/admin" className="text-sm text-purple-400 hover:text-purple-300 font-medium transition-colors">
                    Админка
                  </Link>
                )}

                <div className="flex items-center gap-3 pl-4 border-l border-white/[0.1]">
                  <span className="text-sm font-medium text-green-400">
                    {user.balance.toFixed(2)} ₽
                  </span>
                  <span className="text-sm text-gray-400">{user.email}</span>
                  <button
                    onClick={() => authApi.logout()}
                    className="text-sm text-red-400 hover:text-red-300 transition-colors"
                  >
                    Выход
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}
