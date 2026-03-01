# ── Stage 1: Install dependencies ─────────────────────────────────────────────
FROM oven/bun:1-slim AS deps

WORKDIR /app

# Copy root workspace manifest + lockfile and ALL workspace package.jsons
# so bun can resolve the full workspace graph for the lockfile
COPY package.json bun.lock ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json

# Install all workspace deps
RUN bun install --frozen-lockfile

# ── Stage 2: Build NestJS ─────────────────────────────────────────────────────
FROM deps AS build

WORKDIR /app

# Copy API source
COPY apps/api/ apps/api/

# Build with NestJS CLI (bunx since npx isn't available in bun image)
RUN cd apps/api && bunx nest build

# ── Stage 3: Production install (Node.js-compatible node_modules) ─────────────
FROM node:20-slim AS prod-deps

WORKDIR /app

COPY apps/api/package.json ./
RUN npm install --omit=dev

# ── Stage 4: Production image ────────────────────────────────────────────────
FROM node:20-slim AS production

RUN apt-get update && apt-get install -y --no-install-recommends git redis-server ca-certificates && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy compiled output from build stage
COPY --from=build /app/apps/api/dist ./dist

# Copy Node.js-compatible production deps from prod-deps stage
COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=prod-deps /app/package.json ./package.json

ENV NODE_ENV=production
ENV PORT=3001
ENV REDIS_URL=redis://localhost:6379

EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://localhost:3001/health').then(r => r.ok ? process.exit(0) : process.exit(1)).catch(() => process.exit(1))"

COPY apps/api/entrypoint.sh ./entrypoint.sh
RUN chmod +x entrypoint.sh

CMD ["./entrypoint.sh"]
