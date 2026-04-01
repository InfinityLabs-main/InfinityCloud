"use client";

import Link from "next/link";

const DOCUMENTS = [
  {
    slug: "terms",
    icon: "⚖️",
    title: "Условия использования",
    subtitle: "Terms of Service",
    date: "1 апреля 2026 г.",
    desc: "Публичная оферта, предмет соглашения, порядок оплаты, политика добросовестного использования и Anti-Abuse Policy.",
  },
  {
    slug: "privacy",
    icon: "🔐",
    title: "Политика конфиденциальности",
    subtitle: "Privacy Policy",
    date: "1 апреля 2026 г.",
    desc: "Порядок обработки, хранения и защиты персональных данных, cookies и аналитика, права пользователей.",
  },
  {
    slug: "aup",
    icon: "🛡",
    title: "Acceptable Use Policy",
    subtitle: "Политика допустимого использования",
    date: "1 апреля 2026 г.",
    desc: "Правила использования инфраструктуры, запрещённая деятельность, система предупреждений и блокировок.",
  },
  {
    slug: "refund",
    icon: "💳",
    title: "Refund Policy",
    subtitle: "Политика возвратов",
    date: "1 апреля 2026 г.",
    desc: "Условия и порядок возврата средств, сроки обращения, исключения и процедура запроса.",
  },
  {
    slug: "security",
    icon: "🔐",
    title: "Security Policy",
    subtitle: "Политика безопасности",
    date: "1 апреля 2026 г.",
    desc: "Принципы защиты инфраструктуры, изоляция VPS, шифрование, мониторинг и реагирование на инциденты.",
  },
  {
    slug: "sla",
    icon: "📊",
    title: "Соглашение об уровне сервиса",
    subtitle: "Service Level Agreement (SLA)",
    date: "1 апреля 2026 г.",
    desc: "Целевые показатели доступности, плановые работы, реагирование на инциденты и компенсации.",
  },
];

export default function DocumentsPage() {
  return (
    <div className="min-h-screen bg-[#06000f] relative overflow-hidden">
      {/* Background effects */}
      <div className="absolute top-[20%] left-[10%] w-[500px] h-[500px] bg-purple-600/10 rounded-full blur-[150px] pointer-events-none" />
      <div className="absolute bottom-[20%] right-[10%] w-[400px] h-[400px] bg-blue-600/8 rounded-full blur-[130px] pointer-events-none" />

      {/* Header */}
      <header className="sticky top-0 z-50 bg-[#06000f]/80 backdrop-blur-2xl border-b border-white/[0.06]">
        <div className="max-w-7xl mx-auto flex items-center justify-between px-6 py-4">
          <Link href="/" className="flex items-center gap-2.5 group">
            <span className="text-2xl text-purple-400 group-hover:text-purple-300 transition-colors">
              ∞
            </span>
            <span className="text-lg font-bold text-white group-hover:text-purple-200 transition-colors">
              Infinity Cloud
            </span>
          </Link>
          <Link
            href="/"
            className="text-sm text-gray-400 hover:text-white transition-colors"
          >
            ← На главную
          </Link>
        </div>
      </header>

      <div className="relative max-w-5xl mx-auto px-6 py-12">
        {/* Page title */}
        <div className="text-center mb-14">
          <h1 className="text-3xl sm:text-4xl font-bold text-white">
            Юридические документы
          </h1>
          <p className="mt-3 text-gray-400 max-w-lg mx-auto">
            Правовая информация, политики и соглашения сервиса Infinity Cloud
          </p>
        </div>

        {/* Document cards */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {DOCUMENTS.map((doc) => (
            <Link key={doc.slug} href={`/documents/${doc.slug}`}>
              <div className="group h-full bg-white/[0.03] hover:bg-white/[0.06] backdrop-blur-sm border border-white/[0.06] hover:border-purple-500/20 rounded-2xl p-7 transition-all duration-300 hover:shadow-xl hover:shadow-purple-500/5 hover:-translate-y-1">
                <div className="text-3xl mb-4">{doc.icon}</div>
                <h2 className="text-lg font-semibold text-white mb-1 group-hover:text-purple-300 transition-colors">
                  {doc.title}
                </h2>
                <p className="text-xs text-gray-500 mb-3">{doc.subtitle}</p>
                <p className="text-sm text-gray-400 leading-relaxed mb-4">
                  {doc.desc}
                </p>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-600">
                    Обновлено: {doc.date}
                  </span>
                  <span className="text-purple-400 group-hover:text-purple-300 text-sm font-medium transition-colors">
                    Читать →
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t border-white/[0.06] mt-16 py-8">
        <div className="max-w-7xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-sm text-gray-600">
            © {new Date().getFullYear()} Infinity Cloud. Все права защищены.
          </p>
          <Link
            href="/"
            className="text-sm text-gray-500 hover:text-gray-300 transition-colors"
          >
            На главную
          </Link>
        </div>
      </footer>
    </div>
  );
}
