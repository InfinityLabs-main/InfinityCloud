# syntax=docker/dockerfile:1
FROM node:20-alpine AS builder

WORKDIR /app

ENV npm_config_loglevel=error \
	npm_config_fund=false \
	npm_config_audit=false \
	npm_config_update_notifier=false \
	NEXT_TELEMETRY_DISABLED=1

COPY package*.json ./
RUN --mount=type=cache,target=/root/.npm \
	set -e; \
	if [ -f package-lock.json ]; then \
		npm ci --no-fund --no-audit --loglevel=error || (rm -f package-lock.json && npm install --no-fund --no-audit --loglevel=error); \
	else \
		npm install --no-fund --no-audit --loglevel=error; \
	fi

COPY . .
RUN mkdir -p public

# NEXT_PUBLIC_* переменные инлайнятся в JS-бандл на этапе build
ARG NEXT_PUBLIC_API_URL=http://localhost:8000
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL

RUN --mount=type=cache,target=/app/.next/cache \
	npm run build

# ── Production ────────────────────────────────────
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production \
	NEXT_TELEMETRY_DISABLED=1

COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

EXPOSE 3000

CMD ["node", "server.js"]
