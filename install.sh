#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════
#  Infinity Cloud — Автоматический установщик
#
#  Установка одной командой (работает и для private repo при доступе по git):
#    git clone https://github.com/InfinityLabs-main/InfinityCloud.git /tmp/infinitycloud && sudo bash /tmp/infinitycloud/install.sh
#
#  Вариант через raw (только если репозиторий публичный):
#    bash <(curl -Ls https://raw.githubusercontent.com/InfinityLabs-main/InfinityCloud/main/install.sh)
#
# ═══════════════════════════════════════════════════════════════════
set -euo pipefail
# ── Перенаправление stdin на терминал (curl | bash совместимость) ───────────
if [[ ! -t 0 ]]; then
    exec < /dev/tty
fi
# ── Цвета ─────────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m' # No Color

# ── Константы ─────────────────────────────────────────────────────
REPO_URL="https://github.com/InfinityLabs-main/InfinityCloud.git"
INSTALL_DIR="/opt/infinitycloud"
COMPOSE_FILE="docker-compose.prod.yml"
ADMIN_EMAIL="admin@infinity.cloud"
ADMIN_PASSWORD="admin"
GITHUB_TOKEN="${GITHUB_TOKEN:-}"
USE_MANUAL_BUILD=0

# ── Логирование ───────────────────────────────────────────────────
log()   { echo -e "${GREEN}[✓]${NC} $1"; }
warn()  { echo -e "${YELLOW}[!]${NC} $1"; }
error() { echo -e "${RED}[✗]${NC} $1"; }
info()  { echo -e "${CYAN}[i]${NC} $1"; }
header(){ echo -e "\n${BOLD}═══ $1 ═══${NC}\n"; }

build_repo_url_with_token() {
    local token="$1"
    echo "https://x-access-token:${token}@github.com/InfinityLabs-main/InfinityCloud.git"
}

clone_repo_with_auth_fallback() {
    if git clone --depth 1 "$REPO_URL" "$INSTALL_DIR" 2>/dev/null; then
        return 0
    fi

    warn "Не удалось клонировать репозиторий без авторизации (возможно, репозиторий приватный)."
    info "Нужен GitHub Personal Access Token (PAT) с доступом на чтение репозитория."

    if [[ -z "$GITHUB_TOKEN" ]]; then
        read -rsp "Введите GitHub PAT: " GITHUB_TOKEN
        echo ""
    fi

    if [[ -z "$GITHUB_TOKEN" ]]; then
        error "Токен не указан. Установка прервана."
        return 1
    fi

    local auth_repo_url
    auth_repo_url=$(build_repo_url_with_token "$GITHUB_TOKEN")

    git clone --depth 1 "$auth_repo_url" "$INSTALL_DIR" 2>/dev/null
}

# ── Проверка root ─────────────────────────────────────────────────
if [[ $EUID -ne 0 ]]; then
    error "Скрипт необходимо запускать от root (sudo bash install.sh)"
    exit 1
fi

# ═══════════════════════════════════════════════════════════════════
#  Баннер
# ═══════════════════════════════════════════════════════════════════
clear
echo -e "${CYAN}"
cat << 'BANNER'
    ╔══════════════════════════════════════════════╗
    ║          ∞  INFINITY CLOUD  ∞               ║
    ║       Автоматическая установка v1.0          ║
    ║                                              ║
    ║   Облачный VPS-хостинг провайдерского уровня ║
    ╚══════════════════════════════════════════════╝
BANNER
echo -e "${NC}"

# ═══════════════════════════════════════════════════════════════════
#  Определение ОС
# ═══════════════════════════════════════════════════════════════════
header "Определение операционной системы"

detect_os() {
    if [ -f /etc/os-release ]; then
        . /etc/os-release
        OS_NAME="$ID"
        OS_VERSION="$VERSION_ID"
    elif [ -f /etc/redhat-release ]; then
        OS_NAME="centos"
        OS_VERSION=$(rpm -q --queryformat '%{VERSION}' centos-release 2>/dev/null || echo "unknown")
    else
        OS_NAME="unknown"
        OS_VERSION="unknown"
    fi
}

detect_os
log "Операционная система: ${BOLD}${OS_NAME} ${OS_VERSION}${NC}"

case "$OS_NAME" in
    ubuntu|debian) PKG_MGR="apt" ;;
    centos|rhel|rocky|almalinux|fedora) PKG_MGR="yum" ;;
    *)
        error "Неподдерживаемая ОС: $OS_NAME"
        error "Поддерживаются: Ubuntu 20.04+, Debian 11+, CentOS 8+, Rocky/Alma Linux"
        exit 1
        ;;
esac

# ═══════════════════════════════════════════════════════════════════
#  Запрос домена
# ═══════════════════════════════════════════════════════════════════
header "Настройка домена"

echo -e "${BOLD}Введите доменное имя${NC} для Infinity Cloud"
echo -e "  Пример: ${CYAN}cloud.example.com${NC}"
echo -e "  Оставьте пустым для развёртывания на IP-адресе сервера"
echo ""
read -rp "Домен: " DOMAIN_INPUT

DOMAIN="${DOMAIN_INPUT:-}"
USE_SSL=false

if [[ -n "$DOMAIN" ]]; then
    log "Домен: ${BOLD}${DOMAIN}${NC}"
    echo ""
    echo -e "Хотите автоматически получить SSL-сертификат Let's Encrypt?"
    echo -e "  ${YELLOW}Убедитесь, что DNS A-запись ${DOMAIN} → IP этого сервера уже настроена!${NC}"
    echo ""
    read -rp "Получить SSL-сертификат? [Y/n]: " SSL_ANSWER
    SSL_ANSWER="${SSL_ANSWER:-Y}"
    if [[ "$SSL_ANSWER" =~ ^[Yy]$ ]]; then
        USE_SSL=true
        log "SSL: ${BOLD}Let's Encrypt (автоматически)${NC}"
        echo ""
        read -rp "Email для Let's Encrypt (уведомления об истечении): " LE_EMAIL
        LE_EMAIL="${LE_EMAIL:-admin@${DOMAIN}}"
    else
        warn "SSL отключён — сайт будет доступен по HTTP"
    fi
else
    # Определяем внешний IP
    SERVER_IP=$(curl -4 -s --max-time 5 https://ifconfig.me || \
                curl -4 -s --max-time 5 https://api.ipify.org || \
                curl -4 -s --max-time 5 https://icanhazip.com || \
                hostname -I | awk '{print $1}')
    DOMAIN="$SERVER_IP"
    warn "Домен не указан — проект будет развёрнут на ${BOLD}http://${SERVER_IP}${NC}"
fi

# ═══════════════════════════════════════════════════════════════════
#  Установка системных зависимостей
# ═══════════════════════════════════════════════════════════════════
header "Установка системных зависимостей"

install_apt_deps() {
    log "Обновление пакетов (apt)…"
    apt-get update -qq
    apt-get install -y -qq \
        ca-certificates curl gnupg lsb-release git \
        openssl ufw software-properties-common > /dev/null 2>&1
    log "Системные пакеты установлены"
}

install_yum_deps() {
    log "Обновление пакетов (yum)…"
    yum install -y -q \
        ca-certificates curl gnupg git \
        openssl firewalld yum-utils > /dev/null 2>&1
    log "Системные пакеты установлены"
}

case "$PKG_MGR" in
    apt) install_apt_deps ;;
    yum) install_yum_deps ;;
esac

# ═══════════════════════════════════════════════════════════════════
#  Установка Docker
# ═══════════════════════════════════════════════════════════════════
header "Установка Docker"

if command -v docker &> /dev/null; then
    DOCKER_VER=$(docker --version | awk '{print $3}' | tr -d ',')
    log "Docker уже установлен: ${BOLD}v${DOCKER_VER}${NC}"
else
    info "Устанавливаю Docker…"

    if [[ "$PKG_MGR" == "apt" ]]; then
        # Docker GPG ключ
        install -m 0755 -d /etc/apt/keyrings
        curl -fsSL "https://download.docker.com/linux/${OS_NAME}/gpg" | \
            gpg --dearmor -o /etc/apt/keyrings/docker.gpg 2>/dev/null
        chmod a+r /etc/apt/keyrings/docker.gpg

        # Docker репозиторий
        echo \
          "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
          https://download.docker.com/linux/${OS_NAME} \
          $(lsb_release -cs) stable" > /etc/apt/sources.list.d/docker.list

        apt-get update -qq
        apt-get install -y -qq docker-ce docker-ce-cli containerd.io docker-compose-plugin docker-buildx-plugin > /dev/null 2>&1

    elif [[ "$PKG_MGR" == "yum" ]]; then
        yum-config-manager --add-repo https://download.docker.com/linux/centos/docker-ce.repo > /dev/null 2>&1
        yum install -y -q docker-ce docker-ce-cli containerd.io docker-compose-plugin docker-buildx-plugin > /dev/null 2>&1
    fi

    systemctl enable docker --now > /dev/null 2>&1
    log "Docker установлен: $(docker --version | awk '{print $3}' | tr -d ',')"
fi

# Docker Compose (проверяем plugin или standalone)
if docker compose version &> /dev/null; then
    COMPOSE_CMD="docker compose"
    log "Docker Compose (plugin): $(docker compose version --short 2>/dev/null || echo 'ok')"
elif command -v docker-compose &> /dev/null; then
    COMPOSE_CMD="docker-compose"
    log "Docker Compose (standalone): $(docker-compose --version | awk '{print $4}' | tr -d ',')"
else
    info "Устанавливаю Docker Compose plugin…"
    apt-get install -y -qq docker-compose-plugin docker-buildx-plugin > /dev/null 2>&1 || \
    yum install -y -q docker-compose-plugin docker-buildx-plugin > /dev/null 2>&1 || true
    COMPOSE_CMD="docker compose"
    log "Docker Compose установлен"
fi

# Buildx необходим для docker compose build
if ! docker buildx version &> /dev/null; then
    warn "Docker Buildx не найден. Пытаюсь установить docker-buildx-plugin…"
    if [[ "$PKG_MGR" == "apt" ]]; then
        apt-get install -y -qq docker-buildx-plugin > /dev/null 2>&1 || true
    else
        yum install -y -q docker-buildx-plugin > /dev/null 2>&1 || true
    fi
fi

if docker buildx version &> /dev/null; then
    log "Docker Buildx: $(docker buildx version | head -n1)"
else
    warn "Docker Buildx недоступен. Перехожу на fallback-сборку через 'docker build'."
    USE_MANUAL_BUILD=1
fi

# ═══════════════════════════════════════════════════════════════════
#  Установка Certbot (если нужен SSL)
# ═══════════════════════════════════════════════════════════════════
if [[ "$USE_SSL" == true ]]; then
    header "Установка Certbot"

    if command -v certbot &> /dev/null; then
        log "Certbot уже установлен"
    else
        info "Устанавливаю Certbot…"
        if [[ "$PKG_MGR" == "apt" ]]; then
            apt-get install -y -qq certbot > /dev/null 2>&1
        else
            yum install -y -q certbot > /dev/null 2>&1
        fi
        log "Certbot установлен"
    fi
fi

# ═══════════════════════════════════════════════════════════════════
#  Клонирование репозитория
# ═══════════════════════════════════════════════════════════════════
header "Клонирование Infinity Cloud"

if [[ -d "$INSTALL_DIR" ]]; then
    warn "Директория ${INSTALL_DIR} уже существует"
    read -rp "Перезаписать? [y/N]: " OVERWRITE
    if [[ "$OVERWRITE" =~ ^[Yy]$ ]]; then
        rm -rf "$INSTALL_DIR"
    else
        error "Установка отменена"
        exit 1
    fi
fi

clone_repo_with_auth_fallback
cd "$INSTALL_DIR"
git remote set-url origin "$REPO_URL" >/dev/null 2>&1 || true
unset GITHUB_TOKEN
log "Репозиторий клонирован в ${BOLD}${INSTALL_DIR}${NC}"

# ═══════════════════════════════════════════════════════════════════
#  Генерация секретов и .env
# ═══════════════════════════════════════════════════════════════════
header "Генерация конфигурации"

# Генерация безопасного ключа
SECRET_KEY=$(openssl rand -hex 32)
POSTGRES_PASSWORD=$(openssl rand -hex 16)
DB_USER="infinity"
DB_NAME="infinity_cloud"

# Определяем URL-схему
if [[ "$USE_SSL" == true ]]; then
    SCHEME="https"
else
    SCHEME="http"
fi

BASE_URL="${SCHEME}://${DOMAIN}"

cat > "${INSTALL_DIR}/.env" << ENVFILE
# ═══════════════════════════════════════════════════════
#  Infinity Cloud — Автоматически сгенерированный .env
#  Дата: $(date '+%Y-%m-%d %H:%M:%S')
#  Домен: ${DOMAIN}
# ═══════════════════════════════════════════════════════

# ── PostgreSQL ────────────────────────────────────────
POSTGRES_USER=${DB_USER}
POSTGRES_PASSWORD=${POSTGRES_PASSWORD}
POSTGRES_DB=${DB_NAME}
DATABASE_URL=postgresql+asyncpg://${DB_USER}:${POSTGRES_PASSWORD}@postgres:5432/${DB_NAME}
DATABASE_URL_SYNC=postgresql://${DB_USER}:${POSTGRES_PASSWORD}@postgres:5432/${DB_NAME}

# ── Redis ─────────────────────────────────────────────
REDIS_URL=redis://redis:6379/0
CELERY_BROKER_URL=redis://redis:6379/1
CELERY_RESULT_BACKEND=redis://redis:6379/2

# ── JWT ───────────────────────────────────────────────
SECRET_KEY=${SECRET_KEY}
JWT_ALGORITHM=HS256
JWT_ACCESS_TOKEN_EXPIRE_MINUTES=60

# ── Proxmox VE ───────────────────────────────────────
PROXMOX_HOST=https://proxmox.example.com:8006
PROXMOX_USER=root@pam
PROXMOX_TOKEN_NAME=infinity
PROXMOX_TOKEN_VALUE=change-me
PROXMOX_VERIFY_SSL=false

# ── URL-ы ─────────────────────────────────────────────
NEXT_PUBLIC_API_URL=${BASE_URL}/api
CORS_ORIGINS=${BASE_URL},http://localhost:3000

# ── Безопасность ──────────────────────────────────────
RATE_LIMIT_PER_MINUTE=100

# ── Sentry (опционально) ─────────────────────────────
SENTRY_DSN=

# ── Администратор по умолчанию ────────────────────────
ADMIN_EMAIL=${ADMIN_EMAIL}
ADMIN_PASSWORD=${ADMIN_PASSWORD}

# ── Домен ─────────────────────────────────────────────
DOMAIN=${DOMAIN}
USE_SSL=${USE_SSL}
ENVFILE

log ".env сгенерирован (пароль БД: случайный, JWT-ключ: случайный)"
info "Админ-аккаунт: ${BOLD}admin@infinity.cloud / admin${NC}"

# ═══════════════════════════════════════════════════════════════════
#  Генерация Nginx конфигурации
# ═══════════════════════════════════════════════════════════════════
header "Настройка Nginx (reverse proxy)"

mkdir -p "${INSTALL_DIR}/nginx"

# ── Главный nginx.conf ────────────────────────────────
if [[ "$USE_SSL" == true ]]; then
    # ── HTTPS (с Let's Encrypt) ───────────────────────
    cat > "${INSTALL_DIR}/nginx/default.conf" << 'NGINXCONF'
# ── Редирект HTTP → HTTPS ─────────────────────────────
server {
    listen 80;
    server_name DOMAIN_PLACEHOLDER;

    # Certbot challenge
    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }

    location / {
        return 301 https://$host$request_uri;
    }
}

# ── HTTPS ─────────────────────────────────────────────
server {
    listen 443 ssl http2;
    server_name DOMAIN_PLACEHOLDER;

    # SSL-сертификаты Let's Encrypt
    ssl_certificate     /etc/letsencrypt/live/DOMAIN_PLACEHOLDER/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/DOMAIN_PLACEHOLDER/privkey.pem;

    # Современные SSL-настройки
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384;
    ssl_prefer_server_ciphers off;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 1d;

    # HSTS
    add_header Strict-Transport-Security "max-age=63072000; includeSubDomains" always;

    # Лимиты
    client_max_body_size 100M;
    proxy_read_timeout 300s;
    proxy_send_timeout 300s;

    # ── API Backend (FastAPI) ─────────────────────────
    location /api/ {
        proxy_pass http://backend:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # WebSocket support (для noVNC)
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }

    # ── Swagger docs ──────────────────────────────────
    location /docs {
        proxy_pass http://backend:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /openapi.json {
        proxy_pass http://backend:8000;
        proxy_set_header Host $host;
    }

    # ── Frontend (Next.js) ────────────────────────────
    location / {
        proxy_pass http://frontend:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # Next.js HMR WebSocket
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
NGINXCONF

    # Подставляем реальный домен
    sed -i "s/DOMAIN_PLACEHOLDER/${DOMAIN}/g" "${INSTALL_DIR}/nginx/default.conf"
    log "Nginx настроен: HTTPS + Let's Encrypt для ${BOLD}${DOMAIN}${NC}"

else
    # ── Только HTTP (IP или домен без SSL) ────────────
    cat > "${INSTALL_DIR}/nginx/default.conf" << NGINXCONF
server {
    listen 80;
    server_name ${DOMAIN};

    client_max_body_size 100M;
    proxy_read_timeout 300s;
    proxy_send_timeout 300s;

    # ── API Backend (FastAPI) ─────────────────────────
    location /api/ {
        proxy_pass http://backend:8000;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;

        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
    }

    # ── Swagger docs ──────────────────────────────────
    location /docs {
        proxy_pass http://backend:8000;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }

    location /openapi.json {
        proxy_pass http://backend:8000;
        proxy_set_header Host \$host;
    }

    # ── Frontend (Next.js) ────────────────────────────
    location / {
        proxy_pass http://frontend:3000;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;

        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
NGINXCONF

    log "Nginx настроен: HTTP на ${BOLD}${DOMAIN}${NC}"
fi

# ═══════════════════════════════════════════════════════════════════
#  Генерация docker-compose.prod.yml (с Nginx)
# ═══════════════════════════════════════════════════════════════════
header "Генерация production Docker Compose"

cat > "${INSTALL_DIR}/docker-compose.prod.yml" << 'COMPOSEFILE'
services:
  # ─── PostgreSQL ──────────────────────────────────────
  postgres:
    image: postgres:16-alpine
    restart: unless-stopped
    environment:
      POSTGRES_USER: ${POSTGRES_USER:-infinity}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:-infinity_secret}
      POSTGRES_DB: ${POSTGRES_DB:-infinity_cloud}
    volumes:
      - pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${POSTGRES_USER:-infinity} -d ${POSTGRES_DB:-infinity_cloud}"]
      interval: 5s
      retries: 5
    networks:
      - internal

  # ─── Redis ───────────────────────────────────────────
  redis:
    image: redis:7-alpine
    restart: unless-stopped
    volumes:
      - redisdata:/data
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 5s
      retries: 5
    networks:
      - internal

  # ─── Backend (FastAPI) ───────────────────────────────
  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile
    restart: unless-stopped
    env_file: .env
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    command: >
      sh -c "alembic upgrade head &&
             uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers 4"
    networks:
      - internal

  # ─── Celery Worker ──────────────────────────────────
  worker:
    build:
      context: ./worker
      dockerfile: Dockerfile
    restart: unless-stopped
    env_file: .env
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    command: celery -A tasks.celery_app worker -l info -c 4
    networks:
      - internal

  # ─── Celery Beat ────────────────────────────────────
  beat:
    build:
      context: ./worker
      dockerfile: Dockerfile
    restart: unless-stopped
    env_file: .env
    depends_on:
      redis:
        condition: service_healthy
    command: celery -A tasks.celery_app beat -l info
    networks:
      - internal

  # ─── Frontend (Next.js) ─────────────────────────────
  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile
    restart: unless-stopped
    environment:
      NEXT_PUBLIC_API_URL: ${NEXT_PUBLIC_API_URL:-http://localhost:8000}
    depends_on:
      - backend
    networks:
      - internal

  # ─── Nginx (Reverse Proxy) ──────────────────────────
  nginx:
    image: nginx:1.27-alpine
    restart: unless-stopped
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx/default.conf:/etc/nginx/conf.d/default.conf:ro
      - certbot-webroot:/var/www/certbot:ro
      - certbot-certs:/etc/letsencrypt:ro
    depends_on:
      - backend
      - frontend
    networks:
      - internal

volumes:
  pgdata:
  redisdata:
  certbot-webroot:
  certbot-certs:

networks:
  internal:
    driver: bridge
COMPOSEFILE

log "docker-compose.prod.yml сгенерирован"

# ═══════════════════════════════════════════════════════════════════
#  Настройка фаервола
# ═══════════════════════════════════════════════════════════════════
header "Настройка фаервола"

if command -v ufw &> /dev/null; then
    ufw allow 22/tcp   > /dev/null 2>&1 || true
    ufw allow 80/tcp   > /dev/null 2>&1 || true
    ufw allow 443/tcp  > /dev/null 2>&1 || true
    ufw --force enable  > /dev/null 2>&1 || true
    log "UFW: открыты порты 22, 80, 443"
elif command -v firewall-cmd &> /dev/null; then
    firewall-cmd --permanent --add-service=ssh    > /dev/null 2>&1 || true
    firewall-cmd --permanent --add-service=http   > /dev/null 2>&1 || true
    firewall-cmd --permanent --add-service=https  > /dev/null 2>&1 || true
    firewall-cmd --reload                          > /dev/null 2>&1 || true
    log "Firewalld: открыты порты SSH, HTTP, HTTPS"
else
    warn "Фаервол не обнаружен — настройте вручную (порты 80, 443)"
fi

# ═══════════════════════════════════════════════════════════════════
#  Получение SSL-сертификата (до запуска nginx)
# ═══════════════════════════════════════════════════════════════════
if [[ "$USE_SSL" == true ]]; then
    header "Получение SSL-сертификата Let's Encrypt"

    # Создаём временный nginx только для прохождения ACME challenge
    mkdir -p "${INSTALL_DIR}/nginx-tmp"
    cat > "${INSTALL_DIR}/nginx-tmp/default.conf" << TMPNGINX
server {
    listen 80;
    server_name ${DOMAIN};
    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }
    location / {
        return 200 'Infinity Cloud — SSL setup in progress...';
        add_header Content-Type text/plain;
    }
}
TMPNGINX

    mkdir -p /var/www/certbot

    # Запускаем временный nginx-контейнер
    info "Запуск временного веб-сервера для ACME challenge…"
    docker run -d --name ic-certbot-nginx \
        -p 80:80 \
        -v "${INSTALL_DIR}/nginx-tmp/default.conf:/etc/nginx/conf.d/default.conf:ro" \
        -v "/var/www/certbot:/var/www/certbot" \
        nginx:1.27-alpine > /dev/null 2>&1

    sleep 2

    # Запрашиваем сертификат
    info "Запрашиваю сертификат для ${DOMAIN}…"
    if certbot certonly \
        --webroot \
        --webroot-path /var/www/certbot \
        -d "${DOMAIN}" \
        --email "${LE_EMAIL}" \
        --agree-tos \
        --non-interactive \
        --no-eff-email; then
        log "SSL-сертификат успешно получен!"
    else
        error "Не удалось получить SSL-сертификат"
        warn "Проверьте, что DNS A-запись ${DOMAIN} указывает на IP этого сервера"
        warn "Продолжаю установку без SSL…"
        USE_SSL=false
        # Переключаемся на HTTP-конфиг
        cat > "${INSTALL_DIR}/nginx/default.conf" << FALLBACKNGINX
server {
    listen 80;
    server_name ${DOMAIN};
    client_max_body_size 100M;
    proxy_read_timeout 300s;

    location /api/ {
        proxy_pass http://backend:8000;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
    }
    location /docs {
        proxy_pass http://backend:8000;
        proxy_set_header Host \$host;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
    location /openapi.json {
        proxy_pass http://backend:8000;
        proxy_set_header Host \$host;
    }
    location / {
        proxy_pass http://frontend:3000;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
FALLBACKNGINX
    fi

    # Останавливаем временный контейнер
    docker stop ic-certbot-nginx > /dev/null 2>&1 || true
    docker rm ic-certbot-nginx > /dev/null 2>&1 || true
    rm -rf "${INSTALL_DIR}/nginx-tmp"
fi

# ═══════════════════════════════════════════════════════════════════
#  Обновляем docker-compose volumes для SSL
# ═══════════════════════════════════════════════════════════════════
if [[ "$USE_SSL" == true ]]; then
    # Монтируем системные Let's Encrypt сертификаты в nginx контейнер
    sed -i 's|certbot-certs:/etc/letsencrypt:ro|/etc/letsencrypt:/etc/letsencrypt:ro|g' \
        "${INSTALL_DIR}/docker-compose.prod.yml"
    sed -i 's|certbot-webroot:/var/www/certbot:ro|/var/www/certbot:/var/www/certbot:ro|g' \
        "${INSTALL_DIR}/docker-compose.prod.yml"
    log "Docker Compose обновлён для SSL"
fi

# ═══════════════════════════════════════════════════════════════════
#  Сборка и запуск всех контейнеров
# ═══════════════════════════════════════════════════════════════════
header "Сборка и запуск Infinity Cloud"

cd "$INSTALL_DIR"
info "Сборка Docker-образов (это может занять 3-5 минут)…"

BUILD_LOG="${INSTALL_DIR}/install-build.log"
set +e
if [[ "$USE_MANUAL_BUILD" -eq 1 ]]; then
    {
        echo "[fallback] docker build backend"
        DOCKER_BUILDKIT=0 docker build --no-cache -t infinitycloud-backend:latest -f backend/Dockerfile backend
        echo "[fallback] docker build worker"
        DOCKER_BUILDKIT=0 docker build --no-cache -t infinitycloud-worker:latest -f worker/Dockerfile worker
        echo "[fallback] docker tag worker -> beat"
        docker tag infinitycloud-worker:latest infinitycloud-beat:latest
        echo "[fallback] docker build frontend"
        DOCKER_BUILDKIT=0 docker build --no-cache -t infinitycloud-frontend:latest -f frontend/Dockerfile frontend
    } 2>&1 | tee "$BUILD_LOG"
    BUILD_EXIT_CODE=${PIPESTATUS[0]}
else
    $COMPOSE_CMD -f "$COMPOSE_FILE" build --no-cache 2>&1 | tee "$BUILD_LOG"
    BUILD_EXIT_CODE=${PIPESTATUS[0]}
fi
set -e

if [[ $BUILD_EXIT_CODE -ne 0 ]]; then
    error "Сборка Docker-образов завершилась ошибкой (код: ${BUILD_EXIT_CODE})."
    warn "Последние строки лога сборки:"
    tail -n 60 "$BUILD_LOG" || true
    error "Полный лог: ${BUILD_LOG}"
    exit $BUILD_EXIT_CODE
fi

info "Запуск контейнеров…"
if [[ "$USE_MANUAL_BUILD" -eq 1 ]]; then
    $COMPOSE_CMD -f "$COMPOSE_FILE" up -d --no-build
else
    $COMPOSE_CMD -f "$COMPOSE_FILE" up -d
fi

# Ждём готовности
info "Ожидание готовности сервисов…"
MAX_WAIT=120
WAITED=0
while [[ $WAITED -lt $MAX_WAIT ]]; do
    if $COMPOSE_CMD -f "$COMPOSE_FILE" ps | grep -q "backend.*running\|backend.*Up"; then
        # Проверяем health endpoint
        if curl -sf http://localhost:8000/api/health > /dev/null 2>&1; then
            break
        fi
    fi
    sleep 3
    WAITED=$((WAITED + 3))
    echo -ne "\r  ${CYAN}│${NC} Ожидание… ${WAITED}s / ${MAX_WAIT}s"
done
echo ""

if [[ $WAITED -ge $MAX_WAIT ]]; then
    warn "Таймаут ожидания. Проверьте логи: cd ${INSTALL_DIR} && ${COMPOSE_CMD} -f ${COMPOSE_FILE} logs"
else
    log "Все сервисы запущены!"
fi

# ═══════════════════════════════════════════════════════════════════
#  Настройка автообновления SSL-сертификата (cron)
# ═══════════════════════════════════════════════════════════════════
if [[ "$USE_SSL" == true ]]; then
    header "Настройка авто-обновления SSL"

    CRON_JOB="0 3 * * * certbot renew --quiet --deploy-hook 'docker restart \$(docker ps -qf name=nginx)' >> /var/log/certbot-renew.log 2>&1"

    if ! crontab -l 2>/dev/null | grep -qF "certbot renew"; then
        (crontab -l 2>/dev/null; echo "$CRON_JOB") | crontab -
        log "Cron-задача для обновления SSL добавлена (ежедневно в 3:00)"
    else
        log "Cron-задача для certbot уже существует"
    fi
fi

# ═══════════════════════════════════════════════════════════════════
#  Создание утилитарных скриптов
# ═══════════════════════════════════════════════════════════════════
header "Создание утилитарных скриптов"

# ── Скрипт перезапуска ────────────────────────────────
cat > "${INSTALL_DIR}/restart.sh" << RESTARTSH
#!/usr/bin/env bash
cd "${INSTALL_DIR}"
${COMPOSE_CMD} -f ${COMPOSE_FILE} down
${COMPOSE_CMD} -f ${COMPOSE_FILE} up -d
echo "Infinity Cloud перезапущен"
RESTARTSH
chmod +x "${INSTALL_DIR}/restart.sh"

# ── Скрипт обновления ────────────────────────────────
cat > "${INSTALL_DIR}/update.sh" << UPDATESH
#!/usr/bin/env bash
set -euo pipefail
cd "${INSTALL_DIR}"
echo "Обновление Infinity Cloud…"
git pull origin main

if docker buildx version >/dev/null 2>&1; then
    ${COMPOSE_CMD} -f ${COMPOSE_FILE} build --no-cache
    NO_BUILD_FLAG=""
else
    echo "[fallback] Buildx не найден, использую docker build"
    DOCKER_BUILDKIT=0 docker build --no-cache -t infinitycloud-backend:latest -f backend/Dockerfile backend
    DOCKER_BUILDKIT=0 docker build --no-cache -t infinitycloud-worker:latest -f worker/Dockerfile worker
    docker tag infinitycloud-worker:latest infinitycloud-beat:latest
    DOCKER_BUILDKIT=0 docker build --no-cache -t infinitycloud-frontend:latest -f frontend/Dockerfile frontend
    NO_BUILD_FLAG="--no-build"
fi

${COMPOSE_CMD} -f ${COMPOSE_FILE} down
${COMPOSE_CMD} -f ${COMPOSE_FILE} up -d ${NO_BUILD_FLAG}
echo "✅ Infinity Cloud обновлён!"
UPDATESH
chmod +x "${INSTALL_DIR}/update.sh"

# ── Скрипт просмотра логов ───────────────────────────
cat > "${INSTALL_DIR}/logs.sh" << LOGSSH
#!/usr/bin/env bash
cd "${INSTALL_DIR}"
${COMPOSE_CMD} -f ${COMPOSE_FILE} logs -f --tail=100 \${1:-}
LOGSSH
chmod +x "${INSTALL_DIR}/logs.sh"

# ── Скрипт удаления ──────────────────────────────────
cat > "${INSTALL_DIR}/uninstall.sh" << 'UNINSTALLSH'
#!/usr/bin/env bash
set -euo pipefail
RED='\033[0;31m'; GREEN='\033[0;32m'; BOLD='\033[1m'; NC='\033[0m'
echo -e "${RED}${BOLD}⚠  ВНИМАНИЕ: Это полностью удалит Infinity Cloud!${NC}"
echo "  - Все контейнеры будут остановлены и удалены"
echo "  - Все данные (БД, файлы) будут уничтожены"
echo ""
read -rp "Вы уверены? Введите 'DELETE' для подтверждения: " CONFIRM
if [[ "$CONFIRM" != "DELETE" ]]; then
    echo "Отменено."
    exit 0
fi
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"
COMPOSEFILE=$(ls docker-compose.prod.yml docker-compose.yml 2>/dev/null | head -1)
if [ -n "$COMPOSEFILE" ]; then
    docker compose -f "$COMPOSEFILE" down -v --remove-orphans 2>/dev/null || \
    docker-compose -f "$COMPOSEFILE" down -v --remove-orphans 2>/dev/null || true
fi
echo -e "${GREEN}Контейнеры удалены${NC}"
cd /
rm -rf "$SCRIPT_DIR"
echo -e "${GREEN}✅ Infinity Cloud полностью удалён из системы${NC}"
UNINSTALLSH
chmod +x "${INSTALL_DIR}/uninstall.sh"

log "Утилиты созданы: restart.sh, update.sh, logs.sh, uninstall.sh"

# ═══════════════════════════════════════════════════════════════════
#  Символическая ссылка для удобства
# ═══════════════════════════════════════════════════════════════════
ln -sf "${INSTALL_DIR}/restart.sh" /usr/local/bin/ic-restart 2>/dev/null || true
ln -sf "${INSTALL_DIR}/update.sh" /usr/local/bin/ic-update 2>/dev/null || true
ln -sf "${INSTALL_DIR}/logs.sh" /usr/local/bin/ic-logs 2>/dev/null || true

# ═══════════════════════════════════════════════════════════════════
#  Финальный отчёт
# ═══════════════════════════════════════════════════════════════════
echo ""
echo ""
echo -e "${GREEN}${BOLD}"
cat << 'DONE'
    ╔══════════════════════════════════════════════════╗
    ║                                                  ║
    ║     ✅  INFINITY CLOUD УСПЕШНО УСТАНОВЛЕН!       ║
    ║                                                  ║
    ╚══════════════════════════════════════════════════╝
DONE
echo -e "${NC}"

echo -e "  ${BOLD}Адрес панели:${NC}      ${CYAN}${BASE_URL}${NC}"
echo -e "  ${BOLD}API Swagger:${NC}       ${CYAN}${BASE_URL}/docs${NC}"
if [[ "$USE_SSL" == true ]]; then
echo -e "  ${BOLD}SSL:${NC}               ${GREEN}Let's Encrypt (автообновление)${NC}"
fi
echo ""
echo -e "  ${BOLD}━━━ Вход в панель администратора ━━━${NC}"
echo -e "  ${BOLD}Email:${NC}             ${YELLOW}${ADMIN_EMAIL}${NC}"
echo -e "  ${BOLD}Пароль:${NC}            ${YELLOW}${ADMIN_PASSWORD}${NC}"
echo ""
echo -e "  ${BOLD}━━━ Директория проекта ━━━${NC}"
echo -e "  ${BOLD}Путь:${NC}              ${INSTALL_DIR}"
echo -e "  ${BOLD}Логи:${NC}              ${INSTALL_DIR}/logs.sh  или  ${CYAN}ic-logs${NC}"
echo -e "  ${BOLD}Перезапуск:${NC}        ${INSTALL_DIR}/restart.sh  или  ${CYAN}ic-restart${NC}"
echo -e "  ${BOLD}Обновление:${NC}        ${INSTALL_DIR}/update.sh  или  ${CYAN}ic-update${NC}"
echo -e "  ${BOLD}Удаление:${NC}          ${INSTALL_DIR}/uninstall.sh"
echo ""
echo -e "  ${BOLD}━━━ Следующие шаги ━━━${NC}"
echo -e "  1. Откройте ${CYAN}${BASE_URL}${NC} в браузере"
echo -e "  2. Войдите как ${YELLOW}${ADMIN_EMAIL} / ${ADMIN_PASSWORD}${NC}"
echo -e "  3. В админке добавьте Proxmox-ноды и тарифы"
echo -e "  4. Настройте Proxmox API в ${INSTALL_DIR}/.env"
echo ""
echo -e "  ${RED}${BOLD}⚠  Рекомендуется сменить пароль администратора после входа!${NC}"
echo ""
