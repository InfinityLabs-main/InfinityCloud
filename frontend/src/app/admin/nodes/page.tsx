"use client";

import { useEffect, useState } from "react";
import { adminApi, type Node } from "@/lib/api";

export default function AdminNodesPage() {
  const [nodes, setNodes] = useState<Node[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [showGuide, setShowGuide] = useState(false);
  const [editNode, setEditNode] = useState<Node | null>(null);
  const [testStatus, setTestStatus] = useState<{ success?: boolean; message?: string } | null>(null);
  const [testing, setTesting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
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

  const resetForm = () => {
    setForm({
      name: "", hostname: "", port: 8006, api_user: "root@pam",
      api_token_name: "", api_token_value: "",
      total_cpu: 0, total_ram_mb: 0, total_disk_gb: 0, max_vms: 100,
    });
    setEditNode(null);
    setShowForm(false);
    setTestStatus(null);
    setErrors({});
  };

  const handleEdit = (node: Node) => {
    setEditNode(node);
    setForm({
      name: node.name, hostname: node.hostname, port: node.port,
      api_user: "", api_token_name: "", api_token_value: "",
      total_cpu: node.total_cpu, total_ram_mb: node.total_ram_mb,
      total_disk_gb: node.total_disk_gb, max_vms: node.max_vms,
    });
    setShowForm(true);
    setTestStatus(null);
    setErrors({});
  };

  const validate = (): boolean => {
    const e: Record<string, string> = {};
    if (!form.name.trim()) e.name = "Имя обязательно";
    if (!form.hostname.trim()) e.hostname = "Hostname обязателен";
    if (form.port < 1 || form.port > 65535) e.port = "Порт 1-65535";
    if (!editNode) {
      if (!form.api_user.trim()) e.api_user = "Обязательно";
      if (!form.api_token_name.trim()) e.api_token_name = "Обязательно";
      if (!form.api_token_value.trim()) e.api_token_value = "Обязательно";
    }
    if (form.total_cpu < 0) e.total_cpu = "Не может быть отрицательным";
    if (form.total_ram_mb < 0) e.total_ram_mb = "Не может быть отрицательным";
    if (form.total_disk_gb < 0) e.total_disk_gb = "Не может быть отрицательным";
    if (form.max_vms < 1) e.max_vms = "Минимум 1";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleTestConnection = async () => {
    if (!form.hostname || !form.api_user || !form.api_token_name || !form.api_token_value) {
      setTestStatus({ success: false, message: "Заполните hostname, api_user, token name и token value" });
      return;
    }
    setTesting(true);
    setTestStatus(null);
    try {
      const res = await adminApi.testNode({
        hostname: form.hostname, port: form.port,
        api_user: form.api_user,
        api_token_name: form.api_token_name,
        api_token_value: form.api_token_value,
      });
      if (res.data.success) {
        setTestStatus({ success: true, message: `✅ Proxmox ${res.data.version} (${res.data.release})` });
      } else {
        setTestStatus({ success: false, message: `❌ ${res.data.error}` });
      }
    } catch (err: any) {
      setTestStatus({ success: false, message: `❌ ${err.response?.data?.detail || err.message}` });
    } finally {
      setTesting(false);
    }
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    try {
      if (editNode) {
        const updateData: any = {
          name: form.name, hostname: form.hostname, port: form.port,
          total_cpu: form.total_cpu, total_ram_mb: form.total_ram_mb,
          total_disk_gb: form.total_disk_gb, max_vms: form.max_vms,
        };
        await adminApi.updateNode(editNode.id, updateData);
      } else {
        await adminApi.createNode(form);
      }
      resetForm();
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

  const Field = ({
    label, error, children, hint,
  }: { label: string; error?: string; hint?: string; children: React.ReactNode }) => (
    <div>
      <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">{label}</label>
      {children}
      {hint && !error && <p className="text-xs text-gray-400 mt-0.5">{hint}</p>}
      {error && <p className="text-xs text-red-500 mt-0.5">{error}</p>}
    </div>
  );

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Proxmox-ноды</h1>
        <div className="flex gap-2">
          <button onClick={() => setShowGuide(!showGuide)}
            className="btn-secondary text-sm">
            📖 Инструкция
          </button>
          <button onClick={() => { resetForm(); setShowForm(true); }} className="btn-primary">
            + Добавить ноду
          </button>
        </div>
      </div>

      {/* Инструкция */}
      {showGuide && (
        <div className="card mb-6 bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800">
          <h2 className="font-semibold text-blue-900 dark:text-blue-100 mb-3">📖 Как добавить Proxmox-ноду</h2>
          <div className="text-sm text-blue-800 dark:text-blue-200 space-y-3">
            <div>
              <strong>Шаг 1: Создайте API-токен в Proxmox</strong>
              <ol className="list-decimal ml-5 mt-1 space-y-1">
                <li>Откройте веб-интерфейс Proxmox: <code className="bg-blue-100 dark:bg-blue-900 px-1 rounded">https://ваш-ip:8006</code></li>
                <li>Перейдите в <strong>Datacenter → Permissions → API Tokens → Add</strong></li>
                <li>Заполните: <strong>User:</strong> <code className="bg-blue-100 dark:bg-blue-900 px-1 rounded">root@pam</code>, <strong>Token ID:</strong> <code className="bg-blue-100 dark:bg-blue-900 px-1 rounded">infinity</code></li>
                <li>❗ <strong>Снимите галочку</strong> &quot;Privilege Separation&quot;</li>
                <li>Нажмите <strong>Add</strong> и <strong>скопируйте Token Value</strong> (показывается только один раз!)</li>
              </ol>
            </div>
            <div>
              <strong>Шаг 2: Заполните форму ниже</strong>
              <ul className="list-disc ml-5 mt-1 space-y-1">
                <li><strong>Имя ноды</strong> — любое понятное название (напр. &quot;PVE-1 Frankfurt&quot;)</li>
                <li><strong>Hostname / IP</strong> — IP-адрес Proxmox-сервера</li>
                <li><strong>Порт</strong> — обычно 8006</li>
                <li><strong>API User</strong> — <code className="bg-blue-100 dark:bg-blue-900 px-1 rounded">root@pam</code></li>
                <li><strong>Token Name</strong> — то что вы указали как Token ID (напр. <code className="bg-blue-100 dark:bg-blue-900 px-1 rounded">infinity</code>)</li>
                <li><strong>Token Value</strong> — секретное значение из шага 1</li>
                <li><strong>CPU / RAM / Disk</strong> — реальные ресурсы сервера</li>
              </ul>
            </div>
            <div>
              <strong>Шаг 3: Проверьте подключение</strong>
              <p className="mt-1">Нажмите &quot;🔌 Проверить подключение&quot; перед сохранением, чтобы убедиться что токен работает.</p>
            </div>
          </div>
          <button onClick={() => setShowGuide(false)} className="mt-3 text-sm text-blue-600 dark:text-blue-400 hover:underline">
            Скрыть инструкцию
          </button>
        </div>
      )}

      {/* Форма */}
      {showForm && (
        <div className="card mb-6">
          <h2 className="font-semibold mb-4 text-gray-900 dark:text-white">
            {editNode ? `Редактировать ноду: ${editNode.name}` : "Новая нода"}
          </h2>

          <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2 uppercase tracking-wide">Основные данные</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-4">
            <Field label="Имя ноды" error={errors.name} hint="Понятное название (PVE-1 Frankfurt)">
              <input value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="input-field" placeholder="PVE-1 Frankfurt" />
            </Field>
            <Field label="Hostname / IP" error={errors.hostname} hint="IP-адрес или FQDN Proxmox-сервера">
              <input value={form.hostname}
                onChange={(e) => setForm({ ...form, hostname: e.target.value })}
                className="input-field" placeholder="192.168.1.10" />
            </Field>
            <Field label="Порт" error={errors.port} hint="Обычно 8006">
              <input type="number" value={form.port} min={1} max={65535}
                onChange={(e) => setForm({ ...form, port: +e.target.value })}
                className="input-field" />
            </Field>
          </div>

          {!editNode && (
            <>
              <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2 uppercase tracking-wide">Авторизация Proxmox API</h3>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-4">
                <Field label="API User" error={errors.api_user} hint="Формат: root@pam">
                  <input value={form.api_user}
                    onChange={(e) => setForm({ ...form, api_user: e.target.value })}
                    className="input-field" placeholder="root@pam" />
                </Field>
                <Field label="Token Name" error={errors.api_token_name} hint="Token ID из Proxmox">
                  <input value={form.api_token_name}
                    onChange={(e) => setForm({ ...form, api_token_name: e.target.value })}
                    className="input-field" placeholder="infinity" />
                </Field>
                <Field label="Token Value" error={errors.api_token_value} hint="Секретное значение токена">
                  <input type="password" value={form.api_token_value}
                    onChange={(e) => setForm({ ...form, api_token_value: e.target.value })}
                    className="input-field" />
                </Field>
              </div>

              {/* Кнопка проверки подключения */}
              <div className="mb-4">
                <button onClick={handleTestConnection} disabled={testing}
                  className="btn-secondary text-sm disabled:opacity-50">
                  {testing ? "⏳ Проверяю…" : "🔌 Проверить подключение"}
                </button>
                {testStatus && (
                  <span className={`ml-3 text-sm ${testStatus.success ? "text-green-600" : "text-red-600"}`}>
                    {testStatus.message}
                  </span>
                )}
              </div>
            </>
          )}

          <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2 uppercase tracking-wide">Ресурсы сервера</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Field label="CPU (ядер)" error={errors.total_cpu} hint="Общее количество ядер">
              <input type="number" value={form.total_cpu} min={0}
                onChange={(e) => setForm({ ...form, total_cpu: +e.target.value })}
                className="input-field" />
            </Field>
            <Field label="RAM (МБ)" error={errors.total_ram_mb} hint="Общий объём ОЗУ">
              <input type="number" value={form.total_ram_mb} min={0} step={1024}
                onChange={(e) => setForm({ ...form, total_ram_mb: +e.target.value })}
                className="input-field" />
            </Field>
            <Field label="Диск (ГБ)" error={errors.total_disk_gb} hint="Общий объём дисков">
              <input type="number" value={form.total_disk_gb} min={0}
                onChange={(e) => setForm({ ...form, total_disk_gb: +e.target.value })}
                className="input-field" />
            </Field>
            <Field label="Макс. VM" error={errors.max_vms} hint="Лимит виртуальных машин">
              <input type="number" value={form.max_vms} min={1}
                onChange={(e) => setForm({ ...form, max_vms: +e.target.value })}
                className="input-field" />
            </Field>
          </div>

          <div className="flex gap-2 mt-4">
            <button onClick={handleSubmit} className="btn-primary">
              {editNode ? "Сохранить" : "Создать"}
            </button>
            <button onClick={resetForm} className="btn-secondary">Отмена</button>
          </div>
        </div>
      )}

      {/* Карточки нод */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {nodes.map((node) => (
          <div key={node.id} className="card">
            <div className="flex justify-between items-start">
              <div>
                <h3 className="font-semibold text-gray-900 dark:text-white">{node.name}</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">{node.hostname}:{node.port}</p>
              </div>
              <span className={`status-badge ${node.is_active ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200" : "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200"}`}>
                {node.is_active ? "Активна" : "Отключена"}
              </span>
            </div>

            <div className="mt-4 space-y-2">
              <div>
                <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mb-1">
                  <span>CPU</span>
                  <span>{node.used_cpu}/{node.total_cpu} ядер</span>
                </div>
                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                  <div className="bg-primary-500 rounded-full h-2"
                    style={{ width: `${node.total_cpu ? (node.used_cpu / node.total_cpu) * 100 : 0}%` }} />
                </div>
              </div>
              <div>
                <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mb-1">
                  <span>RAM</span>
                  <span>{(node.used_ram_mb / 1024).toFixed(1)}/{(node.total_ram_mb / 1024).toFixed(1)} ГБ</span>
                </div>
                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                  <div className="bg-blue-500 rounded-full h-2"
                    style={{ width: `${node.total_ram_mb ? (node.used_ram_mb / node.total_ram_mb) * 100 : 0}%` }} />
                </div>
              </div>
              <div>
                <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mb-1">
                  <span>Disk</span>
                  <span>{node.used_disk_gb}/{node.total_disk_gb} ГБ</span>
                </div>
                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                  <div className="bg-green-500 rounded-full h-2"
                    style={{ width: `${node.total_disk_gb ? (node.used_disk_gb / node.total_disk_gb) * 100 : 0}%` }} />
                </div>
              </div>
            </div>

            <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">Макс. VM: {node.max_vms}</p>

            <div className="mt-4 pt-3 border-t border-gray-100 dark:border-gray-700 flex gap-3">
              <button onClick={() => handleEdit(node)}
                className="text-sm text-primary-600 hover:underline">Редактировать</button>
              <button onClick={() => handleDelete(node.id)}
                className="text-sm text-red-600 hover:underline">Деактивировать</button>
            </div>
          </div>
        ))}
      </div>

      {nodes.length === 0 && !showForm && (
        <div className="card text-center text-gray-500 dark:text-gray-400 py-12">
          <p className="text-lg mb-2">Нет добавленных нод</p>
          <p className="text-sm">Нажмите &quot;+ Добавить ноду&quot; и следуйте инструкции</p>
        </div>
      )}
    </div>
  );
}
