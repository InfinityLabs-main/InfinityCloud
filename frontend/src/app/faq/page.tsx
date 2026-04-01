"use client";

import { useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, ArrowLeft } from "lucide-react";

const FAQ_DATA = [
  {
    q: "Как быстро создаётся VPS-сервер?",
    a: "Сервер разворачивается автоматически за 30–60 секунд после оплаты. Вы сразу получаете root-доступ и IP-адрес для подключения.",
  },
  {
    q: "Какие операционные системы поддерживаются?",
    a: "Мы поддерживаем Ubuntu 20.04 / 22.04 / 24.04, Debian 11 / 12, CentOS Stream 9, AlmaLinux 9, Rocky Linux 9, Fedora 39 и Windows Server 2022.",
  },
  {
    q: "Есть ли DDoS-защита?",
    a: "Да, бесплатная DDoS-защита включена на всех тарифах. На тарифах Business и Enterprise доступна расширенная защита с фильтрацией L7-атак.",
  },
  {
    q: "Как работает почасовая оплата?",
    a: "Вы оплачиваете сервер по часам фактического использования. Можете остановить или удалить сервер в любой момент — оплата прекращается. Максимальная сумма ограничена месячным тарифом.",
  },
  {
    q: "Можно ли масштабировать ресурсы сервера?",
    a: "Да, вы можете изменить тариф в любой момент через панель управления. Изменения применяются после перезагрузки сервера.",
  },
  {
    q: "Предоставляется ли резервное копирование?",
    a: "На тарифах Business и Enterprise бэкапы создаются автоматически. На тарифе Starter можно создавать снапшоты вручную.",
  },
  {
    q: "Какие способы оплаты поддерживаются?",
    a: "Мы принимаем банковские карты (Visa, Mastercard, МИР), электронные кошельки (ЮMoney, QIWI), а также СБП. Все платежи обрабатываются через YooKassa.",
  },
  {
    q: "Есть ли тестовый период?",
    a: "Мы не предоставляем бесплатный тестовый период, однако вы можете создать самый доступный VPS и протестировать платформу. Оплата почасовая — вы потратите минимум средств.",
  },
  {
    q: "Как связаться с поддержкой?",
    a: "Вы можете написать нам на support@infinitycloud.ru или в Telegram @infinitycloud_support. Среднее время ответа — 3 минуты.",
  },
  {
    q: "Предоставляется ли SLA?",
    a: "Да, мы гарантируем SLA 99.9% доступности для всех VPS-серверов. В случае нарушения SLA предоставляется компенсация.",
  },
];

function FAQItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border border-white/[0.06] rounded-2xl overflow-hidden hover:border-white/[0.1] transition-colors">
      <button onClick={() => setOpen(!open)} className="w-full flex items-center justify-between p-6 text-left">
        <span className="text-base font-medium text-white pr-4">{q}</span>
        <motion.div animate={{ rotate: open ? 180 : 0 }} transition={{ duration: 0.3 }} className="shrink-0">
          <ChevronDown className="w-5 h-5 text-purple-400" />
        </motion.div>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3 }}
          >
            <div className="px-6 pb-6 text-sm text-gray-400 leading-relaxed">{a}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function FAQPage() {
  return (
    <div className="min-h-screen bg-[#06000f] text-white">
      <div className="border-b border-white/[0.06]">
        <div className="max-w-3xl mx-auto px-6 py-4">
          <Link href="/" className="inline-flex items-center gap-2 text-gray-400 hover:text-white transition-colors text-sm">
            <ArrowLeft className="w-4 h-4" />
            Вернуться на главную
          </Link>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-6 py-16">
        <div className="text-center mb-12">
          <span className="inline-block text-xs font-semibold tracking-[0.2em] uppercase text-purple-400 mb-4">FAQ</span>
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold text-white">Частые вопросы</h1>
          <p className="mt-4 text-gray-400 max-w-xl mx-auto">Ответы на самые популярные вопросы о наших услугах</p>
        </div>

        <div className="space-y-4">
          {FAQ_DATA.map((item, i) => (
            <FAQItem key={i} q={item.q} a={item.a} />
          ))}
        </div>

        <div className="mt-12 text-center">
          <p className="text-gray-400 mb-4">Не нашли ответ на свой вопрос?</p>
          <a
            href="mailto:support@infinitycloud.ru"
            className="inline-flex items-center gap-2 bg-gradient-to-r from-purple-600 to-violet-600 hover:from-purple-500 hover:to-violet-500 text-white font-medium px-6 py-3 rounded-xl transition-all hover:shadow-lg hover:shadow-purple-500/25"
          >
            Написать в поддержку
          </a>
        </div>
      </div>
    </div>
  );
}
