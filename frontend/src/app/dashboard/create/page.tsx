"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Navbar from "@/components/Navbar";
import PlanCard from "@/components/PlanCard";
import { planApi, serverApi, type Plan } from "@/lib/api";

const OS_OPTIONS = [
  { value: "ubuntu-22.04", label: "Ubuntu 22.04 LTS" },
  { value: "ubuntu-24.04", label: "Ubuntu 24.04 LTS" },
  { value: "debian-12", label: "Debian 12" },
  { value: "centos-9", label: "CentOS Stream 9" },
  { value: "almalinux-9", label: "AlmaLinux 9" },
  { value: "rocky-9", label: "Rocky Linux 9" },
  { value: "windows-2022", label: "Windows Server 2022" },
];

export default function CreateServerPage() {
  const router = useRouter();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null);
  const [hostname, setHostname] = useState("");
  const [osTemplate, setOsTemplate] = useState("ubuntu-22.04");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    planApi.list().then((r) => setPlans(r.data)).catch(console.error);
  }, []);

  const handleCreate = async () => {
    if (!selectedPlan) {
      setError("Выберите тариф");
      return;
    }
    if (!hostname.trim()) {
      setError("Введите hostname");
      return;
    }

    setError("");
    setLoading(true);

    try {
      await serverApi.create({
        plan_id: selectedPlan.id,
        hostname: hostname.trim(),
        os_template: osTemplate,
      });
      router.push("/dashboard");
    } catch (err: any) {
      setError(err.response?.data?.detail || "Ошибка создания VPS");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Navbar />
      <div className="max-w-5xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-8">
          Создать новый VPS
        </h1>

        {error && (
          <div className="bg-red-50 text-red-600 text-sm p-3 rounded-lg mb-6">
            {error}
          </div>
        )}

        {/* Шаг 1: Тариф */}
        <h2 className="text-lg font-semibold text-gray-800 mb-4">
          1. Выберите тариф
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
          {plans.map((plan) => (
            <PlanCard
              key={plan.id}
              plan={plan}
              selected={selectedPlan?.id === plan.id}
              onSelect={setSelectedPlan}
            />
          ))}
        </div>

        {/* Шаг 2: ОС */}
        <h2 className="text-lg font-semibold text-gray-800 mb-4">
          2. Операционная система
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
          {OS_OPTIONS.map((os) => (
            <button
              key={os.value}
              onClick={() => setOsTemplate(os.value)}
              className={`p-3 rounded-lg border text-sm font-medium transition-colors ${
                osTemplate === os.value
                  ? "border-primary-500 bg-primary-50 text-primary-700"
                  : "border-gray-200 hover:border-gray-300 text-gray-600"
              }`}
            >
              {os.label}
            </button>
          ))}
        </div>

        {/* Шаг 3: Hostname */}
        <h2 className="text-lg font-semibold text-gray-800 mb-4">
          3. Имя сервера
        </h2>
        <input
          type="text"
          value={hostname}
          onChange={(e) => setHostname(e.target.value)}
          placeholder="my-server-01"
          className="input-field max-w-md mb-8"
        />

        {/* Создать */}
        <button
          onClick={handleCreate}
          disabled={loading || !selectedPlan}
          className="btn-primary text-lg px-8 py-3 disabled:opacity-50"
        >
          {loading ? "Создание…" : "Создать VPS"}
        </button>
      </div>
    </>
  );
}
