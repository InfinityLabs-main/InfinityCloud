"use client";

import AdminSidebar from "@/components/AdminSidebar";
import { useAuthGuard } from "@/lib/useAuthGuard";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { allowed } = useAuthGuard({ requireAdmin: true });

  if (!allowed) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#060010]">
        <div className="text-gray-400">Проверка доступа…</div>
      </div>
    );
  }

  return (
    <div className="dark">
      <div className="flex min-h-screen bg-[#060010] text-gray-200">
        <AdminSidebar />
        <main className="flex-1 p-8">{children}</main>
      </div>
    </div>
  );
}
