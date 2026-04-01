"use client";

import type { Plan } from "@/lib/api";

interface PlanCardProps {
  plan: Plan;
  selected?: boolean;
  onSelect?: (plan: Plan) => void;
}

export default function PlanCard({ plan, selected, onSelect }: PlanCardProps) {
  return (
    <div
      onClick={() => onSelect?.(plan)}
      className={`bg-white/[0.04] backdrop-blur-sm border rounded-2xl p-6 cursor-pointer transition-all ${
        selected
          ? "ring-2 ring-purple-500 border-purple-500/30"
          : "border-white/[0.08] hover:border-purple-500/20 hover:bg-white/[0.06]"
      }`}
    >
      <h3 className="font-bold text-lg text-white">{plan.name}</h3>

      <div className="mt-4 space-y-2 text-sm text-gray-400">
        <div className="flex justify-between">
          <span>vCPU</span>
          <span className="font-medium text-gray-200">{plan.cpu_cores} ядер</span>
        </div>
        <div className="flex justify-between">
          <span>RAM</span>
          <span className="font-medium text-gray-200">
            {plan.ram_mb >= 1024
              ? `${(plan.ram_mb / 1024).toFixed(0)} ГБ`
              : `${plan.ram_mb} МБ`}
          </span>
        </div>
        <div className="flex justify-between">
          <span>Диск</span>
          <span className="font-medium text-gray-200">{plan.disk_gb} ГБ SSD</span>
        </div>
        <div className="flex justify-between">
          <span>Трафик</span>
          <span className="font-medium text-gray-200">{plan.bandwidth_tb} ТБ</span>
        </div>
      </div>

      <div className="mt-4 pt-4 border-t border-white/[0.08]">
        <div className="text-2xl font-bold text-purple-400">
          {plan.price_per_month.toFixed(0)} ₽
          <span className="text-sm font-normal text-gray-500">/мес</span>
        </div>
        <div className="text-xs text-gray-500">
          {plan.price_per_hour.toFixed(2)} ₽/час
        </div>
      </div>
    </div>
  );
}
