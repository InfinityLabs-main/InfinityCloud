"use client";

import { useEffect, useState } from "react";
import { adminApi, type Node, type Server, type User } from "@/lib/api";

export default function AdminDashboard() {
  const [stats, setStats] = useState({
    users: 0,
    servers: 0,
    nodes: 0,
  });

  useEffect(() => {
    Promise.all([
      adminApi.listUsers(),
      adminApi.listServers(),
      adminApi.listNodes(),
    ]).then(([usersRes, serversRes, nodesRes]) => {
      setStats({
        users: usersRes.data.length,
        servers: serversRes.data.length,
        nodes: nodesRes.data.length,
      });
    }).catch(console.error);
  }, []);

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-8">Обзор системы</h1>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="card">
          <div className="text-sm text-gray-500">Пользователи</div>
          <div className="text-3xl font-bold text-gray-900 mt-2">
            {stats.users}
          </div>
        </div>
        <div className="card">
          <div className="text-sm text-gray-500">VPS-серверы</div>
          <div className="text-3xl font-bold text-gray-900 mt-2">
            {stats.servers}
          </div>
        </div>
        <div className="card">
          <div className="text-sm text-gray-500">Proxmox-ноды</div>
          <div className="text-3xl font-bold text-gray-900 mt-2">
            {stats.nodes}
          </div>
        </div>
      </div>
    </div>
  );
}
