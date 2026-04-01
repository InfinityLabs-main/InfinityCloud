"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Navbar from "@/components/Navbar";
import PlanCard from "@/components/PlanCard";
import { planApi, serverApi, type Plan } from "@/lib/api";
import { useAuthGuard } from "@/lib/useAuthGuard";

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
  const { allowed } = useAuthGuard();
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
    <div className="min-h-screen bg-[#060010]">
      <Navbar />
      <div className="max-w-5xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold text-white mb-8">
          Создать новый VPS
        </h1>

        {error && (
          <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-sm p-3 rounded-xl mb-6">
            {error}
          </div>
        )}

        {/* Шаг 1: Тариф */}
        <h2 className="text-lg font-semibold text-gray-200 mb-4">
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
        <h2 className="text-lg font-semibold text-gray-200 mb-4">
          2. Операционная система
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
          {OS_OPTIONS.map((os) => (
            <button
              key={os.value}
              onClick={() => setOsTemplate(os.value)}
              className={`p-3 rounded-xl border text-sm font-medium transition-all ${
                osTemplate === os.value
                  ? "border-purple-500/40 bg-purple-500/10 text-purple-300"
                  : "border-white/[0.08] hover:border-white/[0.15] text-gray-400 bg-white/[0.03]"
              }`}
            >
              {os.label}
            </button>
          ))}
        </div>

        {/* Шаг 3: Hostname */}
        <h2 className="text-lg font-semibold text-gray-200 mb-4">
          3. Имя сервера
        </h2>
        <input
          type="text"
          value={hostname}
          onChange={(e) => setHostname(e.target.value)}
          placeholder="my-server-01"
          className="w-full max-w-md bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-3 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:border-purple-500/40 mb-8"
        />

        {/* Создать */}
        <button
          onClick={handleCreate}
          disabled={loading || !selectedPlan}
          className="bg-gradient-to-r from-purple-600 to-violet-600 hover:from-purple-500 hover:to-violet-500 text-white font-medium text-lg px-8 py-3 rounded-xl transition-all hover:shadow-lg hover:shadow-purple-500/25 disabled:opacity-50"
        >
          {loading ? "Создание…" : "Создать VPS"}
        </button>
      </div>
    </div>
  );
}
