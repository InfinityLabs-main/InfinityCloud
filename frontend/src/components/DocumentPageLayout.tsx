"use client";

import Link from "next/link";

export default function DocumentPageLayout({
  title,
  icon,
  date,
  children,
}: {
  title: string;
  icon: string;
  date: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-[#06000f] relative overflow-hidden">
      {/* Background effects */}
      <div className="absolute top-[15%] left-[5%] w-[500px] h-[500px] bg-purple-600/8 rounded-full blur-[150px] pointer-events-none" />
      <div className="absolute bottom-[15%] right-[5%] w-[400px] h-[400px] bg-blue-600/6 rounded-full blur-[130px] pointer-events-none" />

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
            href="/documents"
            className="text-sm text-gray-400 hover:text-white transition-colors"
          >
            ← Все документы
          </Link>
        </div>
      </header>

      {/* Content */}
      <div className="relative max-w-4xl mx-auto px-6 py-12">
        {/* Breadcrumb */}
        <nav className="flex items-center gap-2 text-sm text-gray-500 mb-8">
          <Link href="/" className="hover:text-gray-300 transition-colors">
            Главная
          </Link>
          <span>/</span>
          <Link
            href="/documents"
            className="hover:text-gray-300 transition-colors"
          >
            Документы
          </Link>
          <span>/</span>
          <span className="text-gray-400">{title}</span>
        </nav>

        {/* Title */}
        <div className="mb-10">
          <h1 className="text-3xl sm:text-4xl font-bold text-white flex items-center gap-3">
            <span className="text-3xl">{icon}</span>
            {title}
          </h1>
          <p className="mt-3 text-sm text-gray-500">
            Дата последнего обновления: {date}
          </p>
        </div>

        {/* Document body */}
        <article className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-8 sm:p-10">
          <div className="doc-content space-y-6 text-[15px] text-gray-300 leading-relaxed">
            {children}
          </div>
        </article>

        {/* Back link */}
        <div className="mt-10 text-center">
          <Link
            href="/documents"
            className="inline-flex items-center gap-2 text-purple-400 hover:text-purple-300 font-medium transition-colors"
          >
            ← Вернуться к списку документов
          </Link>
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t border-white/[0.06] mt-8 py-8">
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
