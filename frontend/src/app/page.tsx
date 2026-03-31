import Link from "next/link";

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-primary-900 via-primary-800 to-dark-900">
      <div className="text-center text-white max-w-2xl px-6">
        {/* Логотип */}
        <div className="mb-8">
          <h1 className="text-5xl font-bold tracking-tight">
            ∞ Infinity Cloud
          </h1>
          <p className="mt-4 text-xl text-primary-200">
            Облачный VPS-хостинг провайдерского уровня
          </p>
        </div>

        {/* Преимущества */}
        <div className="grid grid-cols-3 gap-6 mb-12 text-sm">
          <div className="bg-white/10 backdrop-blur rounded-xl p-4">
            <div className="text-2xl mb-2">⚡</div>
            <div className="font-semibold">Мгновенный деплой</div>
            <div className="text-primary-300 mt-1">VPS за 60 секунд</div>
          </div>
          <div className="bg-white/10 backdrop-blur rounded-xl p-4">
            <div className="text-2xl mb-2">🛡️</div>
            <div className="font-semibold">DDoS-защита</div>
            <div className="text-primary-300 mt-1">Включена бесплатно</div>
          </div>
          <div className="bg-white/10 backdrop-blur rounded-xl p-4">
            <div className="text-2xl mb-2">💰</div>
            <div className="font-semibold">Почасовая оплата</div>
            <div className="text-primary-300 mt-1">Платите только за использование</div>
          </div>
        </div>

        {/* CTA */}
        <div className="flex gap-4 justify-center">
          <Link
            href="/register"
            className="bg-white text-primary-700 font-semibold py-3 px-8 rounded-lg hover:bg-primary-50 transition-colors"
          >
            Начать бесплатно
          </Link>
          <Link
            href="/login"
            className="border border-white/30 text-white font-semibold py-3 px-8 rounded-lg hover:bg-white/10 transition-colors"
          >
            Войти
          </Link>
        </div>
      </div>
    </div>
  );
}
