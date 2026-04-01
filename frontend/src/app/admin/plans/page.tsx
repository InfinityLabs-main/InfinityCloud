"use client";

import { useEffect, useState } from "react";
import { planApi, adminApi, type Plan } from "@/lib/api";

function Field({
  label, error, children,
}: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-400 mb-1">{label}</label>
      {children}
      {error && <p className="text-xs text-red-400 mt-0.5">{error}</p>}
    </div>
  );
}

export default function AdminPlansPage() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editPlan, setEditPlan] = useState<Plan | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [form, setForm] = useState({
    name: "", slug: "", cpu_cores: 1, ram_mb: 1024,
    disk_gb: 20, bandwidth_tb: 1, price_per_hour: 0.5,
    price_per_month: 300, sort_order: 0,
  });

  useEffect(() => { loadPlans(); }, []);

  const loadPlans = async () => {
    const res = await planApi.list();
    setPlans(res.data);
  };

  const resetForm = () => {
    setForm({
      name: "", slug: "", cpu_cores: 1, ram_mb: 1024,
      disk_gb: 20, bandwidth_tb: 1, price_per_hour: 0.5,
      price_per_month: 300, sort_order: 0,
    });
    setEditPlan(null);
    setShowForm(false);
    setErrors({});
  };

  const handleEdit = (plan: Plan) => {
    setEditPlan(plan);
    setForm({
      name: plan.name, slug: plan.slug, cpu_cores: plan.cpu_cores,
      ram_mb: plan.ram_mb, disk_gb: plan.disk_gb,
      bandwidth_tb: plan.bandwidth_tb, price_per_hour: plan.price_per_hour,
      price_per_month: plan.price_per_month, sort_order: plan.sort_order,
    });
    setShowForm(true);
    setErrors({});
  };

  const validate = (): boolean => {
    const e: Record<string, string> = {};
    if (!form.name.trim()) e.name = "Название обязательно";
    if (!form.slug.trim()) e.slug = "Slug обязателен";
    else if (!/^[a-z0-9_-]+$/.test(form.slug)) e.slug = "Только a-z, 0-9, -, _";
    if (form.cpu_cores < 1) e.cpu_cores = "Минимум 1";
    if (form.ram_mb < 256) e.ram_mb = "Минимум 256 МБ";
    if (form.disk_gb < 1) e.disk_gb = "Минимум 1 ГБ";
    if (form.price_per_hour <= 0) e.price_per_hour = "Должна быть > 0";
    if (form.price_per_month <= 0) e.price_per_month = "Должна быть > 0";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    try {
      if (editPlan) {
        await adminApi.updatePlan(editPlan.id, form);
      } else {
        await adminApi.createPlan({ ...form, is_active: true });
      }
      resetForm();
      loadPlans();
    } catch (err: any) {
      alert(err.response?.data?.detail || "Ошибка");
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Удалить тариф?")) return;
    await adminApi.deletePlan(id);
    loadPlans();
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Тарифные планы</h1>
        <button onClick={() => { resetForm(); setShowForm(true); }} className="btn-primary">
          + Добавить тариф
        </button>
      </div>

      {/* Форма */}
      {showForm && (
        <div className="card mb-6">
          <h2 className="font-semibold mb-4 text-white">
            {editPlan ? "Редактировать тариф" : "Новый тариф"}
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Field label="Название тарифа" error={errors.name}>
              <input value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="input-field" placeholder="Например: Start" />
            </Field>
            <Field label="Slug (идентификатор)" error={errors.slug}>
              <input value={form.slug}
                onChange={(e) => setForm({ ...form, slug: e.target.value })}
                className="input-field" placeholder="start" disabled={!!editPlan} />
            </Field>
            <Field label="vCPU (ядра)" error={errors.cpu_cores}>
              <input type="number" value={form.cpu_cores} min={1}
                onChange={(e) => setForm({ ...form, cpu_cores: +e.target.value })}
                className="input-field" />
            </Field>
            <Field label="RAM (МБ)" error={errors.ram_mb}>
              <input type="number" value={form.ram_mb} min={256} step={256}
                onChange={(e) => setForm({ ...form, ram_mb: +e.target.value })}
                className="input-field" />
            </Field>
            <Field label="Диск (ГБ)" error={errors.disk_gb}>
              <input type="number" value={form.disk_gb} min={1}
                onChange={(e) => setForm({ ...form, disk_gb: +e.target.value })}
                className="input-field" />
            </Field>
            <Field label="Трафик (ТБ)">
              <input type="number" value={form.bandwidth_tb} min={0} step={0.5}
                onChange={(e) => setForm({ ...form, bandwidth_tb: +e.target.value })}
                className="input-field" />
            </Field>
            <Field label="Цена за час (₽)" error={errors.price_per_hour}>
              <input type="number" step="0.01" value={form.price_per_hour} min={0.01}
                onChange={(e) => setForm({ ...form, price_per_hour: +e.target.value })}
                className="input-field" />
            </Field>
            <Field label="Цена за месяц (₽)" error={errors.price_per_month}>
              <input type="number" value={form.price_per_month} min={1}
                onChange={(e) => setForm({ ...form, price_per_month: +e.target.value })}
                className="input-field" />
            </Field>
            <Field label="Порядок сортировки">
              <input type="number" value={form.sort_order} min={0}
                onChange={(e) => setForm({ ...form, sort_order: +e.target.value })}
                className="input-field" />
            </Field>
          </div>
          <div className="flex gap-2 mt-4">
            <button onClick={handleSubmit} className="btn-primary">
              {editPlan ? "Сохранить" : "Создать"}
            </button>
            <button onClick={resetForm} className="btn-secondary">Отмена</button>
          </div>
        </div>
      )}

      {/* Таблица */}
      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/[0.08] text-left text-gray-400">
              <th className="pb-3 pr-4">ID</th>
              <th className="pb-3 pr-4">Название</th>
              <th className="pb-3 pr-4">vCPU</th>
              <th className="pb-3 pr-4">RAM</th>
              <th className="pb-3 pr-4">Диск</th>
              <th className="pb-3 pr-4">₽/час</th>
              <th className="pb-3 pr-4">₽/мес</th>
              <th className="pb-3 pr-4">Порядок</th>
              <th className="pb-3">Действия</th>
            </tr>
          </thead>
          <tbody>
            {plans.map((plan) => (
              <tr key={plan.id} className="border-b border-white/[0.06]">
                <td className="py-3 pr-4 text-gray-300">{plan.id}</td>
                <td className="py-3 pr-4 font-medium text-white">{plan.name}</td>
                <td className="py-3 pr-4 text-gray-300">{plan.cpu_cores}</td>
                <td className="py-3 pr-4 text-gray-300">{plan.ram_mb} МБ</td>
                <td className="py-3 pr-4 text-gray-300">{plan.disk_gb} ГБ</td>
                <td className="py-3 pr-4 text-gray-300">{plan.price_per_hour}</td>
                <td className="py-3 pr-4 text-gray-300">{plan.price_per_month}</td>
                <td className="py-3 pr-4 text-gray-300">{plan.sort_order}</td>
                <td className="py-3">
                  <button onClick={() => handleEdit(plan)}
                    className="text-purple-400 hover:text-purple-300 mr-3">Изменить</button>
                  <button onClick={() => handleDelete(plan.id)}
                    className="text-red-400 hover:text-red-300">Удалить</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
