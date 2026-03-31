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
    <nav className="bg-white border-b border-gray-200 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16 items-center">
          {/* Logo */}
          <Link href="/dashboard" className="flex items-center gap-2">
            <span className="text-xl font-bold text-primary-600">∞</span>
            <span className="font-semibold text-gray-900">Infinity Cloud</span>
          </Link>

          {/* Navigation */}
          <div className="flex items-center gap-6">
            {user && (
              <>
                <Link
                  href="/dashboard"
                  className="text-sm text-gray-600 hover:text-gray-900"
                >
                  Серверы
                </Link>
                <Link
                  href="/dashboard/create"
                  className="text-sm text-gray-600 hover:text-gray-900"
                >
                  Создать VPS
                </Link>
                {isAdmin() && (
                  <Link
                    href="/admin"
                    className="text-sm text-primary-600 hover:text-primary-700 font-medium"
                  >
                    Админка
                  </Link>
                )}

                {/* Баланс + Профиль */}
                <div className="flex items-center gap-3 pl-4 border-l border-gray-200">
                  <span className="text-sm font-medium text-green-600">
                    {user.balance.toFixed(2)} ₽
                  </span>
                  <span className="text-sm text-gray-500">{user.email}</span>
                  <button
                    onClick={() => authApi.logout()}
                    className="text-sm text-red-500 hover:text-red-700"
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
