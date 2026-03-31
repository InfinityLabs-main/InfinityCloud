FROM node:20-alpine AS builder

WORKDIR /app

ENV npm_config_loglevel=error \
	npm_config_fund=false \
	npm_config_audit=false \
	npm_config_update_notifier=false

COPY package*.json ./
RUN if [ -f package-lock.json ]; then npm ci --no-fund --no-audit --loglevel=error; else npm install --no-fund --no-audit --loglevel=error; fi

COPY . .
RUN npm run build

# ── Production ────────────────────────────────────
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production

COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

EXPOSE 3000

CMD ["node", "server.js"]
