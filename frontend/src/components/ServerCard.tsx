"use client";

import type { Server } from "@/lib/api";
import Link from "next/link";

const STATUS_COLORS: Record<string, string> = {
  running: "bg-green-100 text-green-800",
  stopped: "bg-gray-100 text-gray-800",
  creating: "bg-blue-100 text-blue-800",
  suspended: "bg-yellow-100 text-yellow-800",
  deleting: "bg-red-100 text-red-800",
  error: "bg-red-100 text-red-800",
};

const STATUS_LABELS: Record<string, string> = {
  running: "Работает",
  stopped: "Остановлен",
  creating: "Создаётся…",
  suspended: "Приостановлен",
  deleting: "Удаляется…",
  error: "Ошибка",
};

export default function ServerCard({ server }: { server: Server }) {
  const statusClass = STATUS_COLORS[server.status] || "bg-gray-100 text-gray-800";
  const statusLabel = STATUS_LABELS[server.status] || server.status;

  return (
    <Link href={`/dashboard/servers/${server.id}`}>
      <div className="card hover:shadow-md transition-shadow cursor-pointer">
        <div className="flex justify-between items-start">
          <div>
            <h3 className="font-semibold text-gray-900">{server.hostname}</h3>
            <p className="text-sm text-gray-500 mt-1">
              {server.ip_address || "IP назначается…"}
            </p>
          </div>
          <span className={`status-badge ${statusClass}`}>{statusLabel}</span>
        </div>

        <div className="mt-4 flex gap-4 text-xs text-gray-500">
          <span>OS: {server.os_template}</span>
          <span>VMID: {server.proxmox_vmid || "—"}</span>
          <span>ID: #{server.id}</span>
        </div>
      </div>
    </Link>
  );
}
