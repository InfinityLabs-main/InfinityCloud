"use client";

import { useEffect, useState } from "react";
import { planApi, adminApi, type Plan } from "@/lib/api";

export default function AdminPlansPage() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editPlan, setEditPlan] = useState<Plan | null>(null);
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
  };

  const handleSubmit = async () => {
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
        <h1 className="text-2xl font-bold text-gray-900">Тарифные планы</h1>
        <button onClick={() => { resetForm(); setShowForm(true); }} className="btn-primary">
          + Добавить тариф
        </button>
      </div>

      {/* Форма */}
      {showForm && (
        <div className="card mb-6">
          <h2 className="font-semibold mb-4">
            {editPlan ? "Редактировать тариф" : "Новый тариф"}
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <input placeholder="Название" value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="input-field" />
            <input placeholder="Slug" value={form.slug}
              onChange={(e) => setForm({ ...form, slug: e.target.value })}
              className="input-field" disabled={!!editPlan} />
            <input type="number" placeholder="vCPU" value={form.cpu_cores}
              onChange={(e) => setForm({ ...form, cpu_cores: +e.target.value })}
              className="input-field" />
            <input type="number" placeholder="RAM (МБ)" value={form.ram_mb}
              onChange={(e) => setForm({ ...form, ram_mb: +e.target.value })}
              className="input-field" />
            <input type="number" placeholder="Диск (ГБ)" value={form.disk_gb}
              onChange={(e) => setForm({ ...form, disk_gb: +e.target.value })}
              className="input-field" />
            <input type="number" placeholder="Трафик (ТБ)" value={form.bandwidth_tb}
              onChange={(e) => setForm({ ...form, bandwidth_tb: +e.target.value })}
              className="input-field" />
            <input type="number" step="0.01" placeholder="₽/час" value={form.price_per_hour}
              onChange={(e) => setForm({ ...form, price_per_hour: +e.target.value })}
              className="input-field" />
            <input type="number" placeholder="₽/мес" value={form.price_per_month}
              onChange={(e) => setForm({ ...form, price_per_month: +e.target.value })}
              className="input-field" />
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
            <tr className="border-b text-left text-gray-500">
              <th className="pb-3 pr-4">ID</th>
              <th className="pb-3 pr-4">Название</th>
              <th className="pb-3 pr-4">vCPU</th>
              <th className="pb-3 pr-4">RAM</th>
              <th className="pb-3 pr-4">Диск</th>
              <th className="pb-3 pr-4">₽/час</th>
              <th className="pb-3 pr-4">₽/мес</th>
              <th className="pb-3">Действия</th>
            </tr>
          </thead>
          <tbody>
            {plans.map((plan) => (
              <tr key={plan.id} className="border-b border-gray-100">
                <td className="py-3 pr-4">{plan.id}</td>
                <td className="py-3 pr-4 font-medium">{plan.name}</td>
                <td className="py-3 pr-4">{plan.cpu_cores}</td>
                <td className="py-3 pr-4">{plan.ram_mb} МБ</td>
                <td className="py-3 pr-4">{plan.disk_gb} ГБ</td>
                <td className="py-3 pr-4">{plan.price_per_hour}</td>
                <td className="py-3 pr-4">{plan.price_per_month}</td>
                <td className="py-3">
                  <button onClick={() => handleEdit(plan)}
                    className="text-primary-600 hover:underline mr-3">Изменить</button>
                  <button onClick={() => handleDelete(plan.id)}
                    className="text-red-600 hover:underline">Удалить</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
