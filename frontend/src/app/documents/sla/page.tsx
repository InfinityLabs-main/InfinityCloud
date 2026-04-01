import DocumentPageLayout from "@/components/DocumentPageLayout";

export default function SlaPage() {
  return (
    <DocumentPageLayout
      title="Соглашение об уровне сервиса (SLA)"
      icon="📊"
      date="1 апреля 2026 г."
    >
      <p className="text-gray-400 italic">
        Настоящее Соглашение об уровне сервиса (Service Level Agreement, далее —
        SLA) определяет целевые показатели доступности и качества услуг,
        предоставляемых сервисом Infinity Cloud («Сервис»).
      </p>

      {/* 1 */}
      <h2 className="text-xl font-semibold text-white mt-10 mb-4">
        1. Общие положения
      </h2>
      <p>
        SLA устанавливает ориентиры доступности инфраструктуры и описывает
        порядок реагирования на инциденты.
      </p>
      <p>
        SLA носит целевой характер и не является гарантией непрерывной работы.
      </p>

      {/* 2 */}
      <h2 className="text-xl font-semibold text-white mt-10 mb-4">
        2. Доступность сервиса (Uptime)
      </h2>
      <p>Целевая доступность Сервиса составляет:</p>
      <div className="bg-purple-500/10 border border-purple-500/20 rounded-xl px-5 py-3 mt-2 mb-4">
        <p className="text-white font-semibold text-lg">
          Не менее 99.0% в течение календарного месяца
        </p>
      </div>
      <p>
        Доступность рассчитывается на основе времени доступности инфраструктуры
        виртуальных серверов.
      </p>

      {/* 3 */}
      <h2 className="text-xl font-semibold text-white mt-10 mb-4">
        3. Исключения из расчёта доступности
      </h2>
      <p>
        Время недоступности не учитывается в SLA в следующих случаях:
      </p>
      <ul className="list-disc list-inside space-y-1 text-gray-400">
        <li>плановые технические работы;</li>
        <li>аварии на стороне дата-центра или сетевых провайдеров;</li>
        <li>форс-мажорные обстоятельства;</li>
        <li>атаки (включая DDoS);</li>
        <li>действия Пользователя или его программного обеспечения;</li>
        <li>блокировки, вызванные нарушением правил (AUP, ToS).</li>
      </ul>

      {/* 4 */}
      <h2 className="text-xl font-semibold text-white mt-10 mb-4">
        4. Плановые работы
      </h2>
      <p>Сервис вправе проводить технические работы для:</p>
      <ul className="list-disc list-inside space-y-1 text-gray-400">
        <li>обновления инфраструктуры;</li>
        <li>повышения стабильности;</li>
        <li>устранения уязвимостей.</li>
      </ul>
      <p>Во время таких работ возможны кратковременные перебои.</p>
      <p>
        Плановые работы, по возможности, проводятся в периоды минимальной
        нагрузки.
      </p>

      {/* 5 */}
      <h2 className="text-xl font-semibold text-white mt-10 mb-4">
        5. Реагирование на инциденты
      </h2>
      <p>
        При возникновении технических проблем Сервис предпринимает меры по их
        устранению.
      </p>
      <p>Ориентировочные приоритеты:</p>
      <ul className="list-disc list-inside space-y-1 text-gray-400">
        <li>
          <strong className="text-white">
            критические сбои (недоступность узлов)
          </strong>{" "}
          — оперативное реагирование;
        </li>
        <li>
          <strong className="text-white">частичные сбои</strong> — устранение
          в разумные сроки;
        </li>
        <li>
          <strong className="text-white">некритичные ошибки</strong> — по мере
          приоритета.
        </li>
      </ul>
      <p>Точные сроки устранения не гарантируются.</p>

      {/* 6 */}
      <h2 className="text-xl font-semibold text-white mt-10 mb-4">
        6. Производительность
      </h2>
      <p>
        Сервис стремится обеспечивать стабильную производительность VPS в рамках
        выделенных ресурсов.
      </p>
      <p>Однако производительность может зависеть от:</p>
      <ul className="list-disc list-inside space-y-1 text-gray-400">
        <li>конфигурации виртуального сервера;</li>
        <li>нагрузки на физическую ноду;</li>
        <li>сетевых условий;</li>
        <li>действий Пользователя.</li>
      </ul>

      {/* 7 */}
      <h2 className="text-xl font-semibold text-white mt-10 mb-4">
        7. Ограничение гарантий
      </h2>
      <p>
        Сервис предоставляется по модели &quot;как есть&quot;.
      </p>
      <p>Не гарантируется:</p>
      <ul className="list-disc list-inside space-y-1 text-gray-400">
        <li>отсутствие простоев;</li>
        <li>стабильная работа при любых нагрузках;</li>
        <li>соответствие индивидуальным ожиданиям пользователя;</li>
        <li>доступность отдельных интернет-ресурсов.</li>
      </ul>

      {/* 8 */}
      <h2 className="text-xl font-semibold text-white mt-10 mb-4">
        8. Компенсации
      </h2>
      <p>Данный SLA не предусматривает автоматических компенсаций.</p>
      <p>Любые компенсации:</p>
      <ul className="list-disc list-inside space-y-1 text-gray-400">
        <li>рассматриваются индивидуально;</li>
        <li>предоставляются по усмотрению Сервиса;</li>
        <li>не являются обязательством.</li>
      </ul>

      {/* 9 */}
      <h2 className="text-xl font-semibold text-white mt-10 mb-4">
        9. Обязанности пользователя
      </h2>
      <p>Для корректной работы сервиса Пользователь обязан:</p>
      <ul className="list-disc list-inside space-y-1 text-gray-400">
        <li>соблюдать условия использования (ToS и AUP);</li>
        <li>не создавать чрезмерную нагрузку;</li>
        <li>корректно настраивать свои VPS;</li>
        <li>обеспечивать безопасность своих систем.</li>
      </ul>

      {/* 10 */}
      <h2 className="text-xl font-semibold text-white mt-10 mb-4">
        10. Ограничение ответственности
      </h2>
      <p>Сервис не несёт ответственности за:</p>
      <ul className="list-disc list-inside space-y-1 text-gray-400">
        <li>убытки, вызванные простоем;</li>
        <li>потерю данных;</li>
        <li>недоступность сторонних сервисов;</li>
        <li>действия третьих лиц.</li>
      </ul>

      {/* 11 */}
      <h2 className="text-xl font-semibold text-white mt-10 mb-4">
        11. Изменения SLA
      </h2>
      <p>Сервис вправе обновлять настоящее соглашение.</p>
      <p>
        Продолжение использования Сервиса означает согласие с новой редакцией.
      </p>
    </DocumentPageLayout>
  );
}
