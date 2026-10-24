# ============================================================================
# DOCKERFILE MULTISTAGE — SOMA v1.2 + ARGON LIGHT PDF ENGINE (Cloud Run)
# Base: Debian GNU/Linux (node:22-slim) para compatibilidad nativa glibc con sharp
# ============================================================================

# ── Stage 1: Builder ────────────────────────────────────────────────────────
FROM node:22-slim AS builder

WORKDIR /app
ENV HUSKY=0

# Instalamos dependencias para el build
COPY package*.json ./
RUN npm ci

# Copiamos exclusivamente los módulos del microservicio Cloud
COPY tsconfig.cloud.json ./
COPY scripts/build-cloud.mjs ./scripts/build-cloud.mjs
COPY src/core ./src/core
COPY src/lib/curator ./src/lib/curator
COPY src/cloud ./src/cloud

# Compilación aislada hacia dist/cloud/server.js
RUN npm run build:cloud

# ── Stage 2: Runner de Producción ───────────────────────────────────────────
FROM node:22-slim AS runner

WORKDIR /app
ENV NODE_ENV=production
ENV PORT=8080
ENV HUSKY=0

# Instalamos únicamente dependencias de producción
COPY package*.json ./
RUN npm ci --omit=dev --ignore-scripts=false

# Copiamos el bundle compilado desde el stage builder
COPY --from=builder /app/dist/cloud ./dist/cloud

EXPOSE 8080

# Healthcheck interno del contenedor
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD node -e "fetch('http://localhost:' + (process.env.PORT || 8080) + '/health').then(r => r.ok ? process.exit(0) : process.exit(1)).catch(() => process.exit(1))"

CMD ["node", "dist/cloud/server.js"]
