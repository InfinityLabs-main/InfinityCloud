"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import {
  motion,
  AnimatePresence,
  useInView,
  useScroll,
  useTransform,
} from "framer-motion";
import {
  Zap,
  Shield,
  Clock,
  Globe,
  HardDrive,
  Activity,
  ChevronDown,
  ArrowRight,
  Menu,
  X,
  BookOpen,
  Map,
  Users,
  ExternalLink,
  Monitor,
  Server,
  FileText,
  Rocket,
} from "lucide-react";

/* ================================================================== */
/*  DATA                                                               */
/* ================================================================== */

const NAV_LINKS = [
  { label: "Преимущества", id: "features" },
  { label: "Тарифы", id: "pricing" },
  { label: "Как работает", id: "how-it-works" },
  { label: "Серверы", id: "servers" },
  { label: "FAQ", id: "faq" },
];

const FEATURES = [
  {
    icon: Zap,
    title: "Мгновенный деплой",
    desc: "Разворачивайте VPS за считанные секунды. Автоматическая установка ОС и настройка сети.",
  },
  {
    icon: Shield,
    title: "DDoS-защита",
    desc: "Бесплатная защита от атак до 1 Тбит/с на всех тарифах. Ваш сервер всегда доступен.",
  },
  {
    icon: Clock,
    title: "Почасовая оплата",
    desc: "Платите только за фактическое использование. Без скрытых платежей и долгосрочных контрактов.",
  },
  {
    icon: Globe,
    title: "Дата-центры в Европе",
    desc: "Серверы в Нидерландах (Амстердам). Низкие задержки и высокая скорость соединения.",
  },
  {
    icon: HardDrive,
    title: "NVMe SSD",
    desc: "Сверхбыстрые NVMe-диски на всех серверах. До 7 000 МБ/с на чтение.",
  },
  {
    icon: Activity,
    title: "Мониторинг 24/7",
    desc: "Отслеживайте нагрузку, трафик и состояние сервера в реальном времени из панели управления.",
  },
];

const STEPS = [
  {
    step: 1,
    title: "Выберите тариф",
    desc: "Определите нужную конфигурацию сервера под ваши задачи",
    icon: FileText,
  },
  {
    step: 2,
    title: "Настройте сервер",
    desc: "Выберите ОС, регион и дополнительные параметры",
    icon: Monitor,
  },
  {
    step: 3,
    title: "Запустите в один клик",
    desc: "Сервер будет готов к работе менее чем за 60 секунд",
    icon: Rocket,
  },
  {
    step: 4,
    title: "Управляйте",
    desc: "Удобная панель для мониторинга и масштабирования",
    icon: Activity,
  },
];

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
];

const INFO_BLOCKS = [
  {
    icon: BookOpen,
    title: "Документация",
    desc: "Подробные гайды, API-справочник и примеры для быстрого старта",
    btn: "Открыть документацию",
    href: "/docs",
  },
  {
    icon: Map,
    title: "Roadmap",
    desc: "Следите за нашими планами развития и предлагайте свои идеи",
    btn: "Смотреть Roadmap",
    href: "#",
  },
  {
    icon: Users,
    title: "FAQ",
    desc: "Ответы на самые частые вопросы о наших услугах и платформе",
    btn: "Открыть FAQ",
    href: "/faq",
  },
];

const FOOTER_LINKS: Record<string, { label: string; href: string }[]> = {
  Продукт: [
    { label: "VPS-серверы", href: "#pricing" },
    { label: "Тарифы", href: "#pricing" },
    { label: "DDoS-защита", href: "#features" },
    { label: "SLA", href: "/documents/sla" },
  ],
  Компания: [
    { label: "О нас", href: "#docs" },
    { label: "Блог", href: "#" },
    { label: "Вакансии", href: "#" },
    { label: "Партнёрам", href: "#" },
  ],
  Поддержка: [
    { label: "Документация", href: "#docs" },
    { label: "Статус серверов", href: "#servers" },
    { label: "Связаться", href: "#" },
    { label: "FAQ", href: "/faq" },
  ],
  Юридическое: [
    { label: "Условия использования", href: "/documents/terms" },
    { label: "Конфиденциальность", href: "/documents/privacy" },
    { label: "Правила использования", href: "/documents/aup" },
    { label: "Политика возвратов", href: "/documents/refund" },
  ],
};

/* ================================================================== */
/*  ANIMATION HELPERS                                                  */
/* ================================================================== */

const ease = [0.22, 1, 0.36, 1] as const;

const scrollTo = (id: string) => {
  document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
};

function FadeIn({
  children,
  className = "",
  delay = 0,
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-60px" });

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 30 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.6, delay, ease }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

function GradientText({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={`bg-gradient-to-r from-purple-400 via-violet-400 to-blue-400 bg-clip-text text-transparent ${className}`}
    >
      {children}
    </span>
  );
}

/* ================================================================== */
/*  1 · HEADER                                                         */
/* ================================================================== */

function Header() {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 50);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={`fixed top-0 inset-x-0 z-50 transition-all duration-500 ${
        scrolled
          ? "bg-[#06000f]/80 backdrop-blur-2xl border-b border-white/5 shadow-xl shadow-purple-950/20"
          : "bg-transparent"
      }`}
    >
      <div className="max-w-7xl mx-auto flex items-center justify-between px-6 py-4">
        {/* Logo */}
        <button
          onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
          className="flex items-center gap-2.5 group"
        >
          <span className="text-2xl font-light text-purple-400 group-hover:text-purple-300 transition-colors">
            ∞
          </span>
          <span className="text-lg font-bold text-white group-hover:text-purple-200 transition-colors">
            Infinity Cloud
          </span>
        </button>

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-8">
          {NAV_LINKS.map((l) => (
            <button
              key={l.id}
              onClick={() => scrollTo(l.id)}
              className="text-sm text-gray-400 hover:text-white transition-colors relative after:absolute after:bottom-[-4px] after:left-0 after:h-px after:w-0 hover:after:w-full after:bg-purple-500 after:transition-all"
            >
              {l.label}
            </button>
          ))}
        </nav>

        {/* Desktop CTA */}
        <div className="hidden md:flex items-center gap-3">
          <Link
            href="/login"
            className="text-sm text-gray-300 hover:text-white transition-colors px-4 py-2"
          >
            Войти
          </Link>
          <Link
            href="/register"
            className="text-sm font-medium text-white bg-gradient-to-r from-purple-600 to-violet-600 hover:from-purple-500 hover:to-violet-500 px-5 py-2.5 rounded-xl transition-all hover:shadow-lg hover:shadow-purple-500/25"
          >
            Начать бесплатно
          </Link>
        </div>

        {/* Burger */}
        <button
          onClick={() => setMenuOpen(!menuOpen)}
          className="md:hidden text-white p-2"
          aria-label="Открыть меню"
        >
          {menuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </div>

      {/* Mobile dropdown */}
      <AnimatePresence>
        {menuOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3, ease }}
            className="md:hidden bg-[#06000f]/95 backdrop-blur-2xl border-b border-white/5 overflow-hidden"
          >
            <div className="px-6 py-4 space-y-1">
              {NAV_LINKS.map((l) => (
                <button
                  key={l.id}
                  onClick={() => {
                    scrollTo(l.id);
                    setMenuOpen(false);
                  }}
                  className="block w-full text-left text-gray-300 hover:text-white py-2.5 transition-colors"
                >
                  {l.label}
                </button>
              ))}
              <div className="pt-4 border-t border-white/10 flex flex-col gap-2">
                <Link
                  href="/login"
                  className="text-center text-gray-300 hover:text-white py-2.5 rounded-xl border border-white/10 transition-colors"
                >
                  Войти
                </Link>
                <Link
                  href="/register"
                  className="text-center text-white bg-gradient-to-r from-purple-600 to-violet-600 py-2.5 rounded-xl font-medium"
                >
                  Начать бесплатно
                </Link>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}

/* ================================================================== */
/*  2 · HERO                                                           */
/* ================================================================== */

function Hero() {
  const { scrollY } = useScroll();
  const orbY = useTransform(scrollY, [0, 700], [0, -140]);
  const contentY = useTransform(scrollY, [0, 700], [0, 70]);

  return (
    <section className="relative min-h-screen flex items-center overflow-hidden pt-20">
      {/* Animated gradient orbs */}
      <motion.div style={{ y: orbY }} className="absolute inset-0 pointer-events-none">
        <div className="absolute top-[15%] left-[20%] w-[500px] h-[500px] bg-purple-600/20 rounded-full blur-[150px]" />
        <div className="absolute bottom-[20%] right-[15%] w-[420px] h-[420px] bg-blue-600/15 rounded-full blur-[130px]" />
        <div className="absolute top-[45%] right-[35%] w-[300px] h-[300px] bg-fuchsia-600/10 rounded-full blur-[120px]" />
      </motion.div>

      {/* Grid overlay */}
      <div
        className="absolute inset-0 pointer-events-none opacity-[0.025]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(139,92,246,1) 1px, transparent 1px), linear-gradient(90deg, rgba(139,92,246,1) 1px, transparent 1px)",
          backgroundSize: "60px 60px",
        }}
      />

      <motion.div
        style={{ y: contentY }}
        className="relative max-w-7xl mx-auto px-6 w-full grid lg:grid-cols-2 gap-12 lg:gap-20 items-center"
      >
        {/* ── Left column: copy ── */}
        <div>
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease }}
          >
            <span className="inline-flex items-center gap-2 text-[11px] font-semibold tracking-[0.15em] uppercase text-purple-400 bg-purple-500/10 border border-purple-500/20 rounded-full px-4 py-1.5 mb-6">
              <span className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-pulse" />
              Облачный хостинг нового поколения
            </span>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.1, ease }}
            className="text-4xl sm:text-5xl md:text-6xl lg:text-[4.25rem] font-bold text-white leading-[1.08] tracking-tight"
          >
            Ваш сервер.
            <br className="hidden sm:block" />
            <GradientText>Бесконечные</GradientText>
            <br className="hidden sm:block" />
            возможности.
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.2, ease }}
            className="mt-6 text-lg text-gray-400 max-w-lg leading-relaxed"
          >
            Высокопроизводительные VPS-серверы на NVMe SSD в&nbsp;Европе.
            Мгновенный деплой, DDoS-защита и&nbsp;почасовая оплата&nbsp;— всё включено.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.3, ease }}
            className="mt-8 flex flex-wrap gap-4"
          >
            <Link
              href="/register"
              className="group inline-flex items-center gap-2 text-white font-medium bg-gradient-to-r from-purple-600 to-violet-600 hover:from-purple-500 hover:to-violet-500 px-7 py-3.5 rounded-xl transition-all duration-300 hover:shadow-xl hover:shadow-purple-500/25 hover:scale-[1.03] active:scale-[0.98]"
            >
              Начать бесплатно
              <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
            </Link>
            <button
              onClick={() => scrollTo("pricing")}
              className="inline-flex items-center gap-2 text-gray-300 hover:text-white font-medium bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 px-7 py-3.5 rounded-xl transition-all duration-300"
            >
              Смотреть тарифы
            </button>
          </motion.div>
        </div>

        {/* ── Right column: pseudo-dashboard ── */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.9, delay: 0.35, ease }}
          className="relative hidden lg:block"
        >
          {/* Background glow */}
          <div className="absolute -inset-12 bg-gradient-to-br from-purple-600/20 via-violet-600/10 to-blue-600/20 rounded-full blur-[80px]" />

          <motion.div
            animate={{ y: [0, -8, 0] }}
            transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
            className="relative"
          >
            {/* Terminal card */}
            <div className="bg-white/[0.04] backdrop-blur-xl border border-white/[0.08] rounded-2xl p-6 shadow-2xl shadow-purple-950/30">
              <div className="flex items-center gap-2 mb-5">
                <div className="w-3 h-3 rounded-full bg-red-400/80" />
                <div className="w-3 h-3 rounded-full bg-yellow-400/80" />
                <div className="w-3 h-3 rounded-full bg-green-400/80" />
                <span className="ml-3 text-[11px] text-gray-600 font-mono">
                  infinity-cloud ~ deploy
                </span>
              </div>
              <div className="space-y-2.5 font-mono text-[13px] leading-relaxed">
                <p className="text-green-400">$ infinity deploy --region eu-west</p>
                <p className="text-gray-500">Initializing VPS instance…</p>
                <p>
                  <span className="text-gray-600">Region: </span>
                  <span className="text-gray-300">Amsterdam, NL 🇳🇱</span>
                </p>
                <p>
                  <span className="text-gray-600">OS: </span>
                  <span className="text-gray-300">Ubuntu 24.04 LTS</span>
                </p>
                <p>
                  <span className="text-gray-600">Config: </span>
                  <span className="text-gray-300">4 vCPU · 8 GB · 160 GB NVMe</span>
                </p>
                <div className="h-px bg-white/5 my-1" />
                <p className="text-purple-400">✓ Network configured</p>
                <p className="text-purple-400">✓ Firewall rules applied</p>
                <p className="text-purple-400">✓ DDoS protection active</p>
                <div className="h-px bg-white/5 my-1" />
                <p className="text-green-400 font-semibold">✓ Server ready — 42 s</p>
                <p className="text-gray-600">SSH: ssh root@185.xxx.xxx.xxx</p>
                <p className="text-green-400 mt-1">
                  <span className="animate-pulse">█</span>
                </p>
              </div>
            </div>

            {/* Floating: status */}
            <motion.div
              animate={{ y: [0, 6, 0] }}
              transition={{ duration: 4, repeat: Infinity, ease: "easeInOut", delay: 1 }}
              className="absolute -bottom-6 -right-6 bg-white/[0.06] backdrop-blur-xl border border-white/[0.1] rounded-xl p-4 shadow-xl"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-green-500/20 flex items-center justify-center">
                  <Activity className="w-5 h-5 text-green-400" />
                </div>
                <div>
                  <p className="text-[11px] text-gray-400">Статус</p>
                  <p className="text-sm font-semibold text-green-400">Все системы ОК</p>
                </div>
              </div>
            </motion.div>

            {/* Floating: uptime */}
            <motion.div
              animate={{ y: [0, -6, 0] }}
              transition={{ duration: 4.5, repeat: Infinity, ease: "easeInOut", delay: 0.5 }}
              className="absolute -top-4 -left-6 bg-white/[0.06] backdrop-blur-xl border border-white/[0.1] rounded-xl p-4 shadow-xl"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-purple-500/20 flex items-center justify-center">
                  <Server className="w-5 h-5 text-purple-400" />
                </div>
                <div>
                  <p className="text-[11px] text-gray-400">Uptime</p>
                  <p className="text-sm font-semibold text-white">99.99 %</p>
                </div>
              </div>
            </motion.div>
          </motion.div>
        </motion.div>
      </motion.div>
    </section>
  );
}

/* ================================================================== */
/*  3 · FEATURES                                                       */
/* ================================================================== */

function Features() {
  return (
    <section id="features" className="relative py-24 md:py-32">
      <div className="max-w-7xl mx-auto px-6">
        <FadeIn className="text-center mb-16">
          <span className="inline-block text-xs font-semibold tracking-[0.2em] uppercase text-purple-400 mb-4">
            Преимущества
          </span>
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold text-white">
            Почему выбирают <GradientText>Infinity Cloud</GradientText>
          </h2>
          <p className="mt-4 text-gray-400 max-w-2xl mx-auto">
            Мы объединили лучшие технологии, чтобы предоставить вам надёжный и быстрый хостинг
          </p>
        </FadeIn>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {FEATURES.map((f, i) => (
            <FadeIn key={f.title} delay={i * 0.1}>
              <div className="group relative bg-white/[0.03] hover:bg-white/[0.06] backdrop-blur-sm border border-white/[0.06] hover:border-purple-500/30 rounded-2xl p-7 transition-all duration-300 hover:shadow-xl hover:shadow-purple-500/5 hover:-translate-y-1 h-full">
                {/* Subtle glow */}
                <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-purple-600/0 to-blue-600/0 group-hover:from-purple-600/5 group-hover:to-blue-600/5 transition-all duration-500 pointer-events-none" />
                <div className="relative">
                  <div className="w-12 h-12 rounded-xl bg-purple-500/10 group-hover:bg-purple-500/20 flex items-center justify-center mb-5 transition-colors duration-300">
                    <f.icon className="w-6 h-6 text-purple-400" />
                  </div>
                  <h3 className="text-lg font-semibold text-white mb-2">{f.title}</h3>
                  <p className="text-sm text-gray-400 leading-relaxed">{f.desc}</p>
                </div>
              </div>
            </FadeIn>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ================================================================== */
/*  4 · PRICING                                                        */
/* ================================================================== */

function Pricing() {
  const [plans, setPlans] = useState<Array<{
    id: number; name: string; cpu_cores: number; ram_mb: number;
    disk_gb: number; price_per_month: number;
  }>>([]);
  const [loading, setLoading] = useState(true);
  const [activeCountry, setActiveCountry] = useState("NL");

  const countries = [
    { code: "NL", name: "Нидерланды", flag: "🇳🇱" },
  ];

  useEffect(() => {
    const API_URL = process.env.NEXT_PUBLIC_API_URL || "";
    fetch(`${API_URL}/api/v1/public/plans`)
      .then(r => r.json())
      .then(data => { setPlans(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  return (
    <section id="pricing" className="relative py-24 md:py-32">
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[400px] bg-purple-600/10 rounded-full blur-[150px] pointer-events-none" />

      <div className="relative max-w-5xl mx-auto px-6">
        <FadeIn className="text-center mb-12">
          <span className="inline-block text-xs font-semibold tracking-[0.2em] uppercase text-purple-400 mb-4">
            Тарифы
          </span>
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold text-white">
            Простые и прозрачные <GradientText>цены</GradientText>
          </h2>
          <p className="mt-4 text-gray-400 max-w-2xl mx-auto">
            Выберите подходящий тариф под ваши задачи. Без скрытых платежей.
          </p>
        </FadeIn>

        <FadeIn className="flex gap-3 mb-8 justify-center">
          {countries.map(c => (
            <button
              key={c.code}
              onClick={() => setActiveCountry(c.code)}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium transition-all ${
                activeCountry === c.code
                  ? "bg-gradient-to-r from-purple-600 to-violet-600 text-white shadow-lg shadow-purple-500/25"
                  : "bg-white/[0.04] text-gray-400 hover:text-white border border-white/[0.08] hover:border-white/[0.15]"
              }`}
            >
              <span className="text-lg">{c.flag}</span>
              {c.name}
            </button>
          ))}
        </FadeIn>

        <FadeIn>
          <div className="bg-white/[0.03] backdrop-blur-sm border border-white/[0.06] rounded-2xl overflow-hidden">
            <div className="hidden sm:grid grid-cols-6 gap-4 px-6 py-4 border-b border-white/[0.06]">
              <div className="text-sm font-semibold text-gray-400">Тариф</div>
              <div className="text-sm font-semibold text-gray-400 text-center">vCPU</div>
              <div className="text-sm font-semibold text-gray-400 text-center">RAM</div>
              <div className="text-sm font-semibold text-gray-400 text-center">NVMe SSD</div>
              <div className="text-sm font-semibold text-gray-400 text-right">Цена</div>
              <div />
            </div>

            {loading ? (
              <div className="px-6 py-12 text-center text-gray-500">Загрузка тарифов…</div>
            ) : plans.length === 0 ? (
              <div className="px-6 py-12 text-center text-gray-500">Тарифы временно недоступны</div>
            ) : (
              plans.map((plan) => (
                <div
                  key={plan.id}
                  className="grid sm:grid-cols-6 gap-2 sm:gap-4 px-6 py-5 border-b border-white/[0.04] last:border-b-0 hover:bg-white/[0.03] transition-colors items-center group"
                >
                  <div className="font-semibold text-white">{plan.name}</div>
                  <div className="text-center text-gray-300">
                    <span className="sm:hidden text-gray-500 text-xs">vCPU: </span>
                    {plan.cpu_cores} ядер
                  </div>
                  <div className="text-center text-gray-300">
                    <span className="sm:hidden text-gray-500 text-xs">RAM: </span>
                    {plan.ram_mb >= 1024 ? `${(plan.ram_mb / 1024).toFixed(0)} ГБ` : `${plan.ram_mb} МБ`}
                  </div>
                  <div className="text-center text-gray-300">
                    <span className="sm:hidden text-gray-500 text-xs">Диск: </span>
                    {plan.disk_gb} ГБ
                  </div>
                  <div className="text-right">
                    <span className="text-white font-bold text-lg">{plan.price_per_month}</span>
                    <span className="text-gray-500 text-sm ml-1">₽/мес</span>
                  </div>
                  <div className="text-right">
                    <Link
                      href="/register"
                      className="inline-block text-xs font-medium text-white bg-gradient-to-r from-purple-600 to-violet-600 px-4 py-2 rounded-lg transition-all hover:shadow-lg hover:shadow-purple-500/25 sm:opacity-0 sm:group-hover:opacity-100"
                    >
                      Заказать
                    </Link>
                  </div>
                </div>
              ))
            )}
          </div>
        </FadeIn>
      </div>
    </section>
  );
}

/* ================================================================== */
/*  5 · HOW IT WORKS                                                   */
/* ================================================================== */

function HowItWorks() {
  return (
    <section id="how-it-works" className="relative py-24 md:py-32">
      <div className="max-w-7xl mx-auto px-6">
        <FadeIn className="text-center mb-16">
          <span className="inline-block text-xs font-semibold tracking-[0.2em] uppercase text-purple-400 mb-4">
            Как это работает
          </span>
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold text-white">
            Четыре шага до <GradientText>вашего сервера</GradientText>
          </h2>
        </FadeIn>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-8 relative">
          {/* Connecting line (desktop) */}
          <div className="hidden lg:block absolute top-12 left-[12.5%] right-[12.5%] h-px bg-gradient-to-r from-purple-500/20 via-violet-500/40 to-purple-500/20" />

          {STEPS.map((s, i) => (
            <FadeIn key={s.step} delay={i * 0.15} className="relative">
              <div className="text-center">
                <div className="relative mx-auto w-24 h-24 rounded-2xl bg-white/[0.04] border border-white/[0.08] flex items-center justify-center mb-6 transition-colors hover:border-purple-500/30 hover:bg-white/[0.06]">
                  <s.icon className="w-8 h-8 text-purple-400" />
                  <span className="absolute -top-3 -right-3 w-7 h-7 rounded-lg bg-gradient-to-br from-purple-600 to-violet-600 flex items-center justify-center text-xs font-bold text-white shadow-lg shadow-purple-600/30">
                    {s.step}
                  </span>
                </div>
                <h3 className="text-lg font-semibold text-white mb-2">{s.title}</h3>
                <p className="text-sm text-gray-400 leading-relaxed">{s.desc}</p>
              </div>
            </FadeIn>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ================================================================== */
/*  7 · SERVER STATUS                                                  */
/* ================================================================== */

function ServerStatus() {
  const [nodes, setNodes] = useState<Array<{
    id: number; name: string; location: string | null; country: string | null;
    is_online: boolean; ping_ms: number | null; last_ping_at: string | null;
  }>>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const API_URL = process.env.NEXT_PUBLIC_API_URL || "";
    fetch(`${API_URL}/api/v1/public/nodes/status`)
      .then(r => r.json())
      .then(data => { setNodes(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const displayNodes = nodes.length > 0 ? nodes : [
    { id: 0, name: "NL-AMS-1", location: "Амстердам", country: "Нидерланды", is_online: true, ping_ms: null, last_ping_at: null },
  ];

  return (
    <section id="servers" className="relative py-24 md:py-32">
      <div className="max-w-7xl mx-auto px-6">
        <FadeIn className="text-center mb-16">
          <span className="inline-block text-xs font-semibold tracking-[0.2em] uppercase text-purple-400 mb-4">
            Серверы
          </span>
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold text-white">
            Статус <GradientText>дата-центров</GradientText>
          </h2>
          <p className="mt-4 text-gray-400 max-w-2xl mx-auto">
            Мониторинг серверов в реальном времени
          </p>
        </FadeIn>

        <div className="flex justify-center">
          <div className="grid sm:grid-cols-1 gap-6 max-w-sm">
            {displayNodes.map((node, i) => (
              <FadeIn key={node.id || i} delay={i * 0.1}>
                <div className="bg-white/[0.03] backdrop-blur-sm border border-white/[0.06] rounded-2xl p-6 hover:border-green-500/20 transition-all duration-300 hover:-translate-y-1 min-w-[280px]">
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-3xl">🇳🇱</span>
                    <span className="flex items-center gap-2">
                      <span className="relative flex h-2.5 w-2.5">
                        {node.is_online ? (
                          <>
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-60" />
                            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-400" />
                          </>
                        ) : (
                          <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-400" />
                        )}
                      </span>
                      <span className={`text-xs font-medium uppercase tracking-wider ${node.is_online ? "text-green-400" : "text-red-400"}`}>
                        {node.is_online ? "Online" : "Offline"}
                      </span>
                    </span>
                  </div>
                  <h3 className="text-lg font-semibold text-white">{node.location || "Амстердам"}</h3>
                  <p className="text-sm text-gray-400 mt-0.5">{node.country || "Нидерланды"}</p>
                  <div className="mt-4 flex items-center gap-2 text-sm">
                    <Activity className="w-4 h-4 text-gray-500" />
                    <span className="text-gray-400">
                      Пинг: {node.ping_ms && node.ping_ms > 0 ? `${node.ping_ms} мс` : "—"}
                    </span>
                  </div>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

/* ================================================================== */
/*  8 · DOCS / ROADMAP / ABOUT                                        */
/* ================================================================== */

function InfoSection() {
  return (
    <section id="docs" className="relative py-24 md:py-32">
      <div className="max-w-7xl mx-auto px-6">
        <FadeIn className="text-center mb-16">
          <span className="inline-block text-xs font-semibold tracking-[0.2em] uppercase text-purple-400 mb-4">
            Ресурсы
          </span>
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold text-white">
            Всё для <GradientText>продуктивной работы</GradientText>
          </h2>
        </FadeIn>

        <div className="grid md:grid-cols-3 gap-6">
          {INFO_BLOCKS.map((item, i) => (
            <FadeIn key={item.title} delay={i * 0.1}>
              <div className="group bg-white/[0.03] hover:bg-white/[0.06] backdrop-blur-sm border border-white/[0.06] hover:border-purple-500/20 rounded-2xl p-7 transition-all duration-300 h-full flex flex-col">
                <div className="w-12 h-12 rounded-xl bg-purple-500/10 group-hover:bg-purple-500/20 flex items-center justify-center mb-5 transition-colors duration-300">
                  <item.icon className="w-6 h-6 text-purple-400" />
                </div>
                <h3 className="text-lg font-semibold text-white mb-2">{item.title}</h3>
                <p className="text-sm text-gray-400 leading-relaxed mb-6 flex-1">{item.desc}</p>
                <Link
                  href={item.href}
                  className="inline-flex items-center gap-2 text-sm font-medium text-purple-400 hover:text-purple-300 transition-colors"
                >
                  {item.btn}
                  <ExternalLink className="w-3.5 h-3.5" />
                </Link>
              </div>
            </FadeIn>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ================================================================== */
/*  9 · FAQ                                                            */
/* ================================================================== */

function FAQItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="border border-white/[0.06] rounded-2xl overflow-hidden hover:border-white/[0.1] transition-colors">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between p-6 text-left"
      >
        <span className="text-base font-medium text-white pr-4">{q}</span>
        <motion.div
          animate={{ rotate: open ? 180 : 0 }}
          transition={{ duration: 0.3 }}
          className="shrink-0"
        >
          <ChevronDown className="w-5 h-5 text-purple-400" />
        </motion.div>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease }}
          >
            <div className="px-6 pb-6 text-sm text-gray-400 leading-relaxed">{a}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function FAQ() {
  return (
    <section id="faq" className="relative py-24 md:py-32">
      <div className="max-w-3xl mx-auto px-6">
        <FadeIn className="text-center mb-16">
          <span className="inline-block text-xs font-semibold tracking-[0.2em] uppercase text-purple-400 mb-4">
            FAQ
          </span>
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold text-white">
            Частые <GradientText>вопросы</GradientText>
          </h2>
        </FadeIn>

        <div className="space-y-4">
          {FAQ_DATA.slice(0, 4).map((item, i) => (
            <FadeIn key={i} delay={i * 0.08}>
              <FAQItem q={item.q} a={item.a} />
            </FadeIn>
          ))}
        </div>

        <FadeIn className="text-center mt-10">
          <Link
            href="/faq"
            className="inline-flex items-center gap-2 text-purple-400 hover:text-purple-300 font-medium transition-colors"
          >
            Все вопросы и ответы
            <ArrowRight className="w-4 h-4" />
          </Link>
        </FadeIn>
      </div>
    </section>
  );
}



/* ================================================================== */
/*  11 · FINAL CTA                                                     */
/* ================================================================== */

function FinalCTA() {
  return (
    <section className="relative py-24 md:py-32">
      <div className="max-w-7xl mx-auto px-6">
        <FadeIn>
          <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-purple-600/20 via-violet-600/10 to-blue-600/20 border border-purple-500/20 p-12 md:p-20 text-center">
            {/* Glow */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-purple-600/20 rounded-full blur-[120px] pointer-events-none" />

            <div className="relative">
              <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold text-white mb-4">
                Готовы начать?
              </h2>
              <p className="text-lg text-gray-300 max-w-xl mx-auto mb-8 leading-relaxed">
                Создайте свой первый VPS-сервер за&nbsp;60&nbsp;секунд.
                Без скрытых платежей&nbsp;— начните бесплатно.
              </p>
              <Link
                href="/register"
                className="group inline-flex items-center gap-2 bg-white text-purple-700 font-semibold px-8 py-4 rounded-xl hover:bg-gray-100 transition-all duration-300 hover:scale-[1.03] active:scale-[0.98] shadow-xl shadow-purple-950/30"
              >
                Создать сервер бесплатно
                <ArrowRight className="w-5 h-5 group-hover:translate-x-0.5 transition-transform" />
              </Link>
            </div>
          </div>
        </FadeIn>
      </div>
    </section>
  );
}

/* ================================================================== */
/*  12 · FOOTER                                                        */
/* ================================================================== */

function Footer() {
  return (
    <footer className="border-t border-white/[0.06] pt-16 pb-10">
      <div className="max-w-7xl mx-auto px-6">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-8 mb-14">
          {/* Brand */}
          <div className="col-span-2 md:col-span-1">
            <div className="flex items-center gap-2.5 mb-4">
              <span className="text-2xl text-purple-400">∞</span>
              <span className="text-lg font-bold text-white">Infinity Cloud</span>
            </div>
            <p className="text-sm text-gray-500 leading-relaxed max-w-[200px]">
              Облачный VPS-хостинг провайдерского уровня
            </p>
          </div>

          {/* Link columns */}
          {Object.entries(FOOTER_LINKS).map(([title, links]) => (
            <div key={title}>
              <h4 className="text-sm font-semibold text-white mb-4">{title}</h4>
              <ul className="space-y-2.5">
                {links.map((link) => (
                  <li key={link.label}>
                    {link.href.startsWith("/") ? (
                      <Link
                        href={link.href}
                        className="text-sm text-gray-500 hover:text-gray-300 transition-colors"
                      >
                        {link.label}
                      </Link>
                    ) : (
                      <button
                        onClick={() => link.href.startsWith("#") ? scrollTo(link.href.slice(1)) : undefined}
                        className="text-sm text-gray-500 hover:text-gray-300 transition-colors"
                      >
                        {link.label}
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="border-t border-white/[0.06] pt-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-sm text-gray-600">
            © {new Date().getFullYear()} Infinity Cloud. Все права защищены.
          </p>
          <div className="flex items-center gap-6">
            <a href="#" className="text-gray-500 hover:text-gray-300 transition-colors text-sm">
              Telegram
            </a>
            <a href="#" className="text-gray-500 hover:text-gray-300 transition-colors text-sm">
              GitHub
            </a>
            <a href="#" className="text-gray-500 hover:text-gray-300 transition-colors text-sm">
              Twitter
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}

/* ================================================================== */
/*  PAGE EXPORT                                                        */
/* ================================================================== */

export default function HomePage() {
  return (
    <div className="min-h-screen bg-[#06000f] text-white overflow-x-hidden selection:bg-purple-500/30 selection:text-white">
      <Header />
      <Hero />
      <Features />
      <Pricing />
      <HowItWorks />
      <ServerStatus />
      <InfoSection />
      <FAQ />
      <FinalCTA />
      <Footer />
    </div>
  );
}
