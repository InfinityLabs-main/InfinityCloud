"use client";

import { useEffect, useState } from "react";
import { adminApi, type Node } from "@/lib/api";

export default function AdminNodesPage() {
  const [nodes, setNodes] = useState<Node[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    name: "", hostname: "", port: 8006, api_user: "root@pam",
    api_token_name: "", api_token_value: "",
    total_cpu: 0, total_ram_mb: 0, total_disk_gb: 0, max_vms: 100,
  });

  useEffect(() => { loadNodes(); }, []);

  const loadNodes = async () => {
    const res = await adminApi.listNodes();
    setNodes(res.data);
  };

  const handleSubmit = async () => {
    try {
      await adminApi.createNode(form);
      setShowForm(false);
      loadNodes();
    } catch (err: any) {
      alert(err.response?.data?.detail || "Ошибка");
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Деактивировать ноду?")) return;
    await adminApi.deleteNode(id);
    loadNodes();
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Proxmox-ноды</h1>
        <button onClick={() => setShowForm(!showForm)} className="btn-primary">
          + Добавить ноду
        </button>
      </div>

      {showForm && (
        <div className="card mb-6">
          <h2 className="font-semibold mb-4">Новая нода</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <input placeholder="Имя ноды" value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="input-field" />
            <input placeholder="Hostname / IP" value={form.hostname}
              onChange={(e) => setForm({ ...form, hostname: e.target.value })}
              className="input-field" />
            <input type="number" placeholder="Порт" value={form.port}
              onChange={(e) => setForm({ ...form, port: +e.target.value })}
              className="input-field" />
            <input placeholder="API User" value={form.api_user}
              onChange={(e) => setForm({ ...form, api_user: e.target.value })}
              className="input-field" />
            <input placeholder="Token Name" value={form.api_token_name}
              onChange={(e) => setForm({ ...form, api_token_name: e.target.value })}
              className="input-field" />
            <input placeholder="Token Value" type="password" value={form.api_token_value}
              onChange={(e) => setForm({ ...form, api_token_value: e.target.value })}
              className="input-field" />
            <input type="number" placeholder="CPU (ядер)" value={form.total_cpu}
              onChange={(e) => setForm({ ...form, total_cpu: +e.target.value })}
              className="input-field" />
            <input type="number" placeholder="RAM (МБ)" value={form.total_ram_mb}
              onChange={(e) => setForm({ ...form, total_ram_mb: +e.target.value })}
              className="input-field" />
            <input type="number" placeholder="Disk (ГБ)" value={form.total_disk_gb}
              onChange={(e) => setForm({ ...form, total_disk_gb: +e.target.value })}
              className="input-field" />
          </div>
          <div className="flex gap-2 mt-4">
            <button onClick={handleSubmit} className="btn-primary">Создать</button>
            <button onClick={() => setShowForm(false)} className="btn-secondary">Отмена</button>
          </div>
        </div>
      )}

      {/* Карточки нод */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {nodes.map((node) => (
          <div key={node.id} className="card">
            <div className="flex justify-between items-start">
              <div>
                <h3 className="font-semibold text-gray-900">{node.name}</h3>
                <p className="text-sm text-gray-500">{node.hostname}:{node.port}</p>
              </div>
              <span className={`status-badge ${node.is_active ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}`}>
                {node.is_active ? "Активна" : "Отключена"}
              </span>
            </div>

            {/* Ресурсы */}
            <div className="mt-4 space-y-2">
              <div>
                <div className="flex justify-between text-xs text-gray-500 mb-1">
                  <span>CPU</span>
                  <span>{node.used_cpu}/{node.total_cpu} ядер</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div className="bg-primary-500 rounded-full h-2"
                    style={{ width: `${node.total_cpu ? (node.used_cpu / node.total_cpu) * 100 : 0}%` }} />
                </div>
              </div>
              <div>
                <div className="flex justify-between text-xs text-gray-500 mb-1">
                  <span>RAM</span>
                  <span>{(node.used_ram_mb / 1024).toFixed(1)}/{(node.total_ram_mb / 1024).toFixed(1)} ГБ</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div className="bg-blue-500 rounded-full h-2"
                    style={{ width: `${node.total_ram_mb ? (node.used_ram_mb / node.total_ram_mb) * 100 : 0}%` }} />
                </div>
              </div>
              <div>
                <div className="flex justify-between text-xs text-gray-500 mb-1">
                  <span>Disk</span>
                  <span>{node.used_disk_gb}/{node.total_disk_gb} ГБ</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div className="bg-green-500 rounded-full h-2"
                    style={{ width: `${node.total_disk_gb ? (node.used_disk_gb / node.total_disk_gb) * 100 : 0}%` }} />
                </div>
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-gray-100">
              <button onClick={() => handleDelete(node.id)}
                className="text-sm text-red-600 hover:underline">Деактивировать</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
