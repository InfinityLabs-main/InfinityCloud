"use client";

import type { Server } from "@/lib/api";
import Link from "next/link";

const STATUS_COLORS: Record<string, string> = {
  running: "bg-green-500/10 text-green-400 border border-green-500/20",
  stopped: "bg-gray-500/10 text-gray-400 border border-gray-500/20",
  creating: "bg-blue-500/10 text-blue-400 border border-blue-500/20",
  suspended: "bg-yellow-500/10 text-yellow-400 border border-yellow-500/20",
  deleting: "bg-red-500/10 text-red-400 border border-red-500/20",
  error: "bg-red-500/10 text-red-400 border border-red-500/20",
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
  const statusClass = STATUS_COLORS[server.status] || "bg-gray-500/10 text-gray-400";
  const statusLabel = STATUS_LABELS[server.status] || server.status;

  return (
    <Link href={`/dashboard/servers/${server.id}`}>
      <div className="bg-white/[0.04] backdrop-blur-sm border border-white/[0.08] rounded-2xl p-6 hover:border-purple-500/20 hover:bg-white/[0.06] transition-all duration-300 cursor-pointer">
        <div className="flex justify-between items-start">
          <div>
            <h3 className="font-semibold text-white">{server.hostname}</h3>
            <p className="text-sm text-gray-400 mt-1">
              {server.ip_address || "IP назначается…"}
            </p>
          </div>
          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusClass}`}>
            {statusLabel}
          </span>
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
