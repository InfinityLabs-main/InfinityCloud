# ∞ Infinity Cloud — Облачный VPS-хостинг

> Полнофункциональная SaaS-платформа для облачного хостинга VPS-серверов провайдерского уровня.  
> Аналог intezio.net / hostoff.net.

---

## 📦 Стек технологий

| Компонент | Технология |
|-----------|-----------|
| **Backend API** | FastAPI (Python 3.11+), async SQLAlchemy 2.0 |
| **База данных** | PostgreSQL 16 |
| **Кэш / Очереди** | Redis 7 + Celery 5 |
| **Виртуализация** | Proxmox VE API |
| **Frontend** | Next.js 14 (App Router) + TailwindCSS |
| **Контейнеризация** | Docker Compose |
| **CI/CD** | GitHub Actions |

---

## 🗂️ Структура проекта

```
InfinityCloud/
├── docker-compose.yml          # Оркестрация всех сервисов
├── .env.example                # Шаблон переменных окружения
├── .github/workflows/ci.yml   # CI/CD pipeline
│
├── backend/                    # FastAPI Backend
│   ├── Dockerfile
│   ├── requirements.txt
│   ├── alembic.ini
│   ├── alembic/
│   │   ├── env.py
│   │   ├── script.py.mako
│   │   └── versions/
│   │       └── 001_initial.py  # Начальная миграция
│   ├── app/
│   │   ├── main.py             # Точка входа FastAPI
│   │   ├── config.py           # Конфигурация (из .env)
│   │   ├── database.py         # Async SQLAlchemy engine
│   │   ├── deps.py             # JWT dependencies
│   │   ├── exceptions.py       # Глобальные исключения
│   │   ├── models/             # ORM-модели
│   │   │   ├── user.py
│   │   │   ├── node.py
│   │   │   ├── plan.py
│   │   │   ├── server.py
│   │   │   ├── transaction.py
│   │   │   ├── ip_address.py
│   │   │   ├── os_template.py
│   │   │   └── activity_log.py
│   │   ├── schemas/            # Pydantic-валидация
│   │   │   ├── user.py
│   │   │   ├── server.py
│   │   │   ├── plan.py
│   │   │   ├── node.py
│   │   │   └── transaction.py
│   │   ├── routers/            # API-эндпоинты
│   │   │   ├── auth.py         # /api/auth/*
│   │   │   ├── users.py        # /api/users/*
│   │   │   ├── servers.py      # /api/servers/*
│   │   │   ├── plans.py        # /api/plans/*
│   │   │   ├── console.py      # /api/console/*
│   │   │   └── admin.py        # /api/admin/*
│   │   ├── services/           # Бизнес-логика
│   │   │   ├── auth.py         # JWT + bcrypt
│   │   │   ├── proxmox.py      # Proxmox VE API client
│   │   │   ├── billing.py      # Биллинг + списания
│   │   │   └── node_selector.py# Алгоритм выбора ноды
│   │   └── middleware/
│   │       └── rate_limit.py   # Rate-limiting (100 req/min)
│   └── tests/
│       ├── conftest.py
│       ├── test_auth.py
│       └── test_servers.py
│
├── worker/                     # Celery Worker + Beat
│   ├── Dockerfile
│   ├── requirements.txt
│   └── tasks/
│       ├── celery_app.py       # Конфигурация Celery
│       ├── vm_tasks.py         # create_vm, delete_vm, vm_action
│       └── billing_tasks.py    # Почасовой биллинг
│
└── frontend/                   # Next.js Frontend
    ├── Dockerfile
    ├── package.json
    ├── next.config.js
    ├── tailwind.config.js
    ├── tsconfig.json
    └── src/
        ├── lib/
        │   ├── api.ts          # Axios API клиент + типы
        │   └── auth.ts         # JWT helpers
        ├── components/
        │   ├── Navbar.tsx
        │   ├── ServerCard.tsx
        │   ├── PlanCard.tsx
        │   └── AdminSidebar.tsx
        └── app/
            ├── layout.tsx
            ├── page.tsx            # Landing page
            ├── globals.css
            ├── login/page.tsx
            ├── register/page.tsx
            ├── dashboard/
            │   ├── page.tsx        # Список VPS + баланс
            │   ├── create/page.tsx # Создание VPS
            │   └── servers/[id]/page.tsx  # Управление VPS
            └── admin/
                ├── layout.tsx      # Sidebar layout
                ├── page.tsx        # Обзор
                ├── plans/page.tsx  # CRUD тарифов
                ├── nodes/page.tsx  # CRUD нод
                ├── servers/page.tsx# Все серверы
                └── users/page.tsx  # Все пользователи
```

---

## 🗄️ Модели базы данных

### users
| Поле | Тип | Описание |
|------|-----|----------|
| id | INT PK | |
| email | VARCHAR(255) UNIQUE | |
| hashed_password | VARCHAR(255) | bcrypt |
| role | VARCHAR(20) | `user` / `admin` |
| balance | FLOAT | Баланс в ₽ |
| is_active | BOOL | Активен / заблокирован |
| created_at, updated_at | TIMESTAMP | |

### plans
| Поле | Тип | Описание |
|------|-----|----------|
| id | INT PK | |
| name, slug | VARCHAR | Название / URL-slug |
| cpu_cores | INT | Кол-во vCPU |
| ram_mb | INT | RAM в МБ |
| disk_gb | INT | Диск SSD ГБ |
| bandwidth_tb | FLOAT | Трафик ТБ |
| price_per_hour | FLOAT | ₽/час |
| price_per_month | FLOAT | ₽/мес |
| is_active | BOOL | |

### nodes
| Поле | Тип | Описание |
|------|-----|----------|
| id | INT PK | |
| name | VARCHAR UNIQUE | Имя ноды |
| hostname | VARCHAR | IP/FQDN Proxmox |
| port | INT | Порт (8006) |
| api_user, api_token_name, api_token_value | VARCHAR | Proxmox API auth |
| total_cpu, used_cpu | INT | Ядра |
| total_ram_mb, used_ram_mb | INT | RAM |
| total_disk_gb, used_disk_gb | INT | Disk |
| is_active | BOOL | |
| max_vms | INT | Макс. VM |

### servers
| Поле | Тип | Описание |
|------|-----|----------|
| id | INT PK | |
| user_id | FK → users | Владелец |
| plan_id | FK → plans | Тариф |
| node_id | FK → nodes | Нода размещения |
| ip_id | FK → ip_addresses | |
| proxmox_vmid | INT | VMID в Proxmox |
| hostname | VARCHAR | |
| os_template | VARCHAR | Шаблон ОС |
| status | VARCHAR | creating/running/stopped/suspended/deleting/error |
| idempotency_key | VARCHAR UNIQUE | Защита от дублей |
| rdns | VARCHAR | rDNS запись |

### transactions
| Поле | Тип | Описание |
|------|-----|----------|
| id | INT PK | |
| user_id | FK → users | |
| server_id | FK → servers | NULL для депозитов |
| type | VARCHAR | deposit/charge/refund/bonus |
| amount | FLOAT | +deposit / -charge |
| balance_after | FLOAT | Баланс после операции |
| description | TEXT | |

### ip_addresses, os_templates, activity_logs
Дополнительные таблицы для пула IP, шаблонов ОС и журнала действий.

---

## 🔌 API-эндпоинты

### Авторизация
| Метод | URL | Описание |
|-------|-----|----------|
| POST | `/api/auth/register` | Регистрация `{email, password}` → UserOut |
| POST | `/api/auth/login` | Логин → `{access_token, token_type}` |
| GET | `/api/auth/me` | Текущий пользователь (Bearer) |

### Пользователь
| Метод | URL | Описание |
|-------|-----|----------|
| GET | `/api/users/balance` | Баланс |
| POST | `/api/users/deposit` | Пополнить `{amount}` |
| GET | `/api/users/transactions?page=1` | История транзакций |

### VPS-серверы
| Метод | URL | Описание |
|-------|-----|----------|
| GET | `/api/servers` | Мои серверы |
| POST | `/api/servers` | Создать VPS `{plan_id, hostname, os_template}` |
| GET | `/api/servers/{id}` | Детали VPS |
| POST | `/api/servers/{id}/action` | Действие `{action: start\|stop\|restart\|suspend}` |
| PUT | `/api/servers/{id}/rdns` | Обновить rDNS `{rdns}` |
| DELETE | `/api/servers/{id}` | Удалить VPS |

### Тарифы (публичные)
| Метод | URL | Описание |
|-------|-----|----------|
| GET | `/api/plans` | Все активные тарифы |
| GET | `/api/plans/{id}` | Детали тарифа |

### Консоль
| Метод | URL | Описание |
|-------|-----|----------|
| GET | `/api/console/{id}/vnc` | noVNC URL + ticket |

### Админ-панель (role=admin)
| Метод | URL | Описание |
|-------|-----|----------|
| POST | `/api/admin/plans` | Создать тариф |
| PUT | `/api/admin/plans/{id}` | Обновить тариф |
| DELETE | `/api/admin/plans/{id}` | Удалить тариф |
| GET | `/api/admin/nodes` | Список нод |
| POST | `/api/admin/nodes` | Добавить ноду |
| PUT/DELETE | `/api/admin/nodes/{id}` | Изменить/деактивировать |
| GET | `/api/admin/servers` | Все VPS |
| POST | `/api/admin/servers/{id}/action` | Управление любым VPS |
| GET | `/api/admin/users` | Все пользователи |
| POST | `/api/admin/users/{id}/deposit` | Пополнить баланс |
| GET | `/api/admin/transactions` | Все транзакции |
| GET | `/api/admin/logs` | Журнал действий |

---

## 🚀 Быстрый старт

### 1. Клонировать и настроить
```bash
git clone https://github.com/InfinityLabs-main/InfinityCloud.git
cd InfinityCloud
cp .env.example .env
# Отредактируйте .env — укажите реальные значения
```

### 2. Запустить
```bash
docker-compose up -d --build
```

Сервисы будут доступны:
- **Frontend:** http://localhost:3000
- **Backend API:** http://localhost:8000
- **API Docs (Swagger):** http://localhost:8000/docs

### 3. Миграции применяются автоматически
Backend выполняет `alembic upgrade head` при старте.  
Администратор создаётся автоматически из `ADMIN_EMAIL` / `ADMIN_PASSWORD`.

---

## 📝 Примеры API-запросов (curl)

### Регистрация
```bash
curl -X POST http://localhost:8000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email": "user@example.com", "password": "mypass123"}'
```

### Логин
```bash
curl -X POST http://localhost:8000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "user@example.com", "password": "mypass123"}'
# → {"access_token": "eyJ...", "token_type": "bearer"}
```

### Баланс
```bash
curl http://localhost:8000/api/users/balance \
  -H "Authorization: Bearer <TOKEN>"
```

### Создать VPS
```bash
curl -X POST http://localhost:8000/api/servers \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"plan_id": 1, "hostname": "my-vps", "os_template": "ubuntu-22.04"}'
```

### Start / Stop
```bash
curl -X POST http://localhost:8000/api/servers/1/action \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"action": "stop"}'
```

---

## 🔒 Безопасность

- **JWT-авторизация** с bcrypt-хешированием паролей
- **RBAC** — роли `user` и `admin`, middleware защиты админ-эндпоинтов
- **Rate limiting** — 100 запросов/минуту на IP
- **Pydantic-валидация** всех входных данных
- **CORS** — настраивается через `.env`
- **Idempotency keys** — защита от повторного создания VM
- **Sentry** — опциональное подключение для отслеживания ошибок
- **Секреты** — все чувствительные данные в `.env`, не в коде

---

## ⚙️ Автоматизация и очереди

### Celery Tasks
| Задача | Описание |
|--------|----------|
| `create_vm_task` | Выбор ноды (least-used) → Proxmox clone → configure → start |
| `delete_vm_task` | Stop → delete в Proxmox → освобождение IP + ресурсов |
| `vm_action_task` | Start/Stop/Restart/Suspend через Proxmox API |
| `hourly_billing_task` | Списание по тарифу каждый час (Celery Beat) |

### Обработка ошибок
- **Retry** с exponential backoff (до 3-5 попыток)
- **Idempotency** — `idempotency_key` в таблице servers
- **Graceful degradation** — при ошибке Proxmox → `status=error` + запись в `note`
- **Биллинг** — при нехватке средств VPS → `suspended`

---

## 🧪 Тесты

```bash
cd backend
pip install -r requirements.txt
pytest tests/ -v
```

---

## 📋 Follow-up prompt (самопроверка)

> Ты только что сгенерировал проект Infinity Cloud. Теперь проведи аудит самого себя:
>
> 1. **Безопасность:** Проверь все эндпоинты на уязвимости — SQL injection (через ORM?), XSS во фронтенде, IDOR (может ли user получить чужой VPS по ID?), утечку секретов в ответах API. Нет ли хардкод-секретов?
>
> 2. **Race conditions:** Проверь, есть ли проблемы конкурентного доступа при биллинге (двойное списание?) и при создании VM (двойное создание при retry?). Достаточно ли `with_for_update()` и `idempotency_key`?
>
> 3. **Масштабируемость:** Что будет при 1000 одновременных пользователях? Rate limiter in-memory не работает с несколькими инстансами — нужен Redis-бэкенд. Celery-worker — достаточно ли 4 потоков?
>
> 4. **Отказоустойчивость:** Что произойдёт, если Proxmox-нода недоступна? Если Redis упадёт? Если PostgreSQL перезапустится? Есть ли health-checks и reconnect-логика?
>
> 5. **Billing edge-cases:** Что если пользователь удалил VPS во время hourly_billing? Что если два beat-процесса запустятся одновременно? Нужен ли distributed lock?
>
> 6. **Frontend:** Проверь авторизацию на клиенте — нет ли страниц без проверки токена? Защищена ли админка от обычного пользователя на уровне фронтенда?
>
> 7. **Улучшения:** Предложи добавить: WebSocket для real-time статуса VPS, интеграцию платёжных систем, 2FA, email-уведомления, метрики (Prometheus), автоскейлинг нод.
>
> Выведи результат аудита в формате таблицы с колонками: Категория | Проблема | Критичность | Решение.