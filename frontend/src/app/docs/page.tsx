"use client";

import Link from "next/link";
import { ArrowLeft, BookOpen, Terminal, Shield, Server, Zap, Globe } from "lucide-react";

const DOCS_SECTIONS = [
  {
    icon: Zap,
    title: "Быстрый старт",
    desc: "Создайте свой первый VPS-сервер за 5 минут",
    articles: [
      "Регистрация и пополнение баланса",
      "Создание VPS-сервера",
      "Подключение по SSH",
      "Выбор операционной системы",
    ],
  },
  {
    icon: Server,
    title: "Управление серверами",
    desc: "Полное руководство по управлению вашими серверами",
    articles: [
      "Панель управления",
      "Запуск, остановка и перезагрузка",
      "Изменение тарифа",
      "Мониторинг ресурсов",
      "Консоль VNC",
    ],
  },
  {
    icon: Shield,
    title: "Безопасность",
    desc: "Настройка защиты и безопасного доступа",
    articles: [
      "Настройка SSH-ключей",
      "Настройка файрвола",
      "DDoS-защита",
      "Бэкапы и снапшоты",
    ],
  },
  {
    icon: Globe,
    title: "Сеть",
    desc: "Настройка сети и DNS",
    articles: [
      "IPv4 и IPv6 адреса",
      "Обратная DNS-запись (rDNS)",
      "Настройка DNS",
      "Приватные сети",
    ],
  },
  {
    icon: Terminal,
    title: "API",
    desc: "Документация REST API для автоматизации",
    articles: [
      "Аутентификация",
      "Управление серверами через API",
      "Webhook-уведомления",
      "Примеры на Python и cURL",
    ],
  },
  {
    icon: BookOpen,
    title: "Биллинг",
    desc: "Всё об оплате и тарификации",
    articles: [
      "Почасовая тарификация",
      "Способы оплаты",
      "Возвраты и компенсации",
      "SLA и гарантии",
    ],
  },
];

export default function DocsPage() {
  return (
    <div className="min-h-screen bg-[#06000f] text-white">
      <div className="border-b border-white/[0.06]">
        <div className="max-w-6xl mx-auto px-6 py-4">
          <Link href="/" className="inline-flex items-center gap-2 text-gray-400 hover:text-white transition-colors text-sm">
            <ArrowLeft className="w-4 h-4" />
            Вернуться на главную
          </Link>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-16">
        <div className="text-center mb-16">
          <span className="inline-block text-xs font-semibold tracking-[0.2em] uppercase text-purple-400 mb-4">Документация</span>
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold text-white">База знаний Infinity Cloud</h1>
          <p className="mt-4 text-gray-400 max-w-2xl mx-auto">
            Руководства, справочники и примеры для эффективной работы с платформой
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {DOCS_SECTIONS.map((section) => (
            <div
              key={section.title}
              className="group bg-white/[0.03] hover:bg-white/[0.06] backdrop-blur-sm border border-white/[0.06] hover:border-purple-500/20 rounded-2xl p-7 transition-all duration-300"
            >
              <div className="w-12 h-12 rounded-xl bg-purple-500/10 group-hover:bg-purple-500/20 flex items-center justify-center mb-5 transition-colors">
                <section.icon className="w-6 h-6 text-purple-400" />
              </div>
              <h2 className="text-lg font-semibold text-white mb-1">{section.title}</h2>
              <p className="text-sm text-gray-400 mb-5">{section.desc}</p>
              <ul className="space-y-2">
                {section.articles.map((article) => (
                  <li key={article}>
                    <span className="text-sm text-gray-400 hover:text-purple-400 transition-colors cursor-pointer flex items-center gap-2">
                      <span className="w-1 h-1 rounded-full bg-purple-500/50 shrink-0" />
                      {article}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
