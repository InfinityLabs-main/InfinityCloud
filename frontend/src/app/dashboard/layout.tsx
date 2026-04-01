"use client";

import DashboardSidebar from "@/components/DashboardSidebar";
import { useAuthGuard } from "@/lib/useAuthGuard";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { allowed } = useAuthGuard();

  if (!allowed) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#060010]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-purple-500/30 border-t-purple-500 rounded-full animate-spin" />
          <p className="text-gray-500 text-sm">Проверка доступа…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-[#060010] text-gray-200">
      <DashboardSidebar />
      <main className="flex-1 overflow-auto">
        <div className="max-w-[1400px] mx-auto p-6 lg:p-8">
          {children}
        </div>
      </main>
    </div>
  );
}
