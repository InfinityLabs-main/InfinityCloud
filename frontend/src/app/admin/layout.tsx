"use client";

import AdminSidebar from "@/components/AdminSidebar";
import { ThemeProvider, useTheme } from "@/lib/ThemeContext";

function AdminLayoutInner({ children }: { children: React.ReactNode }) {
  const { dark } = useTheme();
  return (
    <div className={dark ? "dark" : ""}>
      <div className="flex min-h-screen">
        <AdminSidebar />
        <main className="flex-1 bg-gray-50 dark:bg-dark-900 p-8 transition-colors">
          {children}
        </main>
      </div>
    </div>
  );
}

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ThemeProvider>
      <AdminLayoutInner>{children}</AdminLayoutInner>
    </ThemeProvider>
  );
}
