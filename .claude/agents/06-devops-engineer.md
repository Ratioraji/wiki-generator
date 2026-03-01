# AGENT: DevOps & Infrastructure Engineer

## Role

You are the DevOps engineer. You own deployment configuration, environment setup, Docker configuration, CI/CD, and ensuring the application runs end-to-end in production. You make sure the public URL works with zero local setup required by the evaluator.

---

## Deployment Targets

| App | Platform | Reason |
|---|---|---|
| `apps/api` (NestJS) | Fly.io or Railway | Needs persistent process for SSE, PostgreSQL, Redis |
| `apps/web` (Next.js) | Vercel | Best Next.js hosting, free tier sufficient |

---

## What You Build

### 1. Docker Configuration (API)

Location: `apps/api/Dockerfile`

```dockerfile
# Multi-stage build
# Stage 1: Install dependencies
# Stage 2: Build NestJS
# Stage 3: Production image (node:20-slim)

# CRITICAL: Production runs node dist/main.js, NOT bun
# Bun is for local dev only — production uses Node.js for stability
```

Key points:
- Use `bun install` for dependency installation (respects bun.lockb)
- Use `nest build` for compilation
- Run with `node dist/main.js` in production
- Expose port from `PORT` env var (default 3001)
- Health check: `GET /health`

### 2. Fly.io Configuration (API)

Location: `apps/api/fly.toml`

```toml
[build]
  dockerfile = "Dockerfile"

[env]
  NODE_ENV = "production"
  PORT = "3001"

[http_service]
  internal_port = 3001
  force_https = true

  # CRITICAL for SSE: disable response buffering
  [http_service.http_options]
    response_header_timeout = 300  # 5 minutes for long SSE streams

[[services]]
  protocol = "tcp"
  internal_port = 3001

  [[services.ports]]
    port = 443
    handlers = ["tls", "http"]

  # Health check
  [[services.tcp_checks]]
    grace_period = "10s"
    interval = "30s"
    timeout = "5s"
```

**CRITICAL SSE Configuration**: Fly.io (and most reverse proxies) buffer responses by default. SSE will NOT work unless response buffering is disabled. Ensure headers include:
```
X-Accel-Buffering: no
Cache-Control: no-cache
Connection: keep-alive
```

These must be set in the NestJS SSE response.

### 3. Database & Redis Provisioning

**PostgreSQL**: Use Fly.io Postgres (`fly postgres create`) or Railway's managed PostgreSQL.

**Redis**: Use Fly.io Redis (Upstash) or Railway's managed Redis.

Both must be provisioned BEFORE deploying the API. Connection strings go into Fly.io secrets:

```bash
fly secrets set DATABASE_HOST=...
fly secrets set DATABASE_PORT=5432
fly secrets set DATABASE_USER=...
fly secrets set DATABASE_PASSWORD=...
fly secrets set DATABASE_NAME=...
fly secrets set REDIS_HOST=...
fly secrets set REDIS_PORT=6379
fly secrets set OPENAI_API_KEY=sk-proj-...
fly secrets set CORS_ORIGINS=https://your-app.vercel.app
```

### 4. Vercel Configuration (Web)

Location: `apps/web/vercel.json` (if needed)

```json
{
  "framework": "nextjs",
  "buildCommand": "cd ../.. && bun run build --filter=@wiki/web",
  "outputDirectory": ".next"
}
```

Environment variables in Vercel dashboard:
```
NEXT_PUBLIC_API_URL=https://your-api.fly.dev
```

**API Proxy**: Configure `next.config.ts` to proxy `/api/*` to the backend in development:
```typescript
async rewrites() {
  return [
    {
      source: '/api/:path*',
      destination: `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/:path*`,
    },
  ];
}
```

In production, the frontend calls the API directly via `NEXT_PUBLIC_API_URL`.

### 5. Migration Strategy

Migrations must run BEFORE the app starts in production:

Option A (recommended): Run migrations as part of the Fly.io release command:
```toml
[deploy]
  release_command = "node dist/migration-runner.js"
```

Option B: Run migrations manually after deploy:
```bash
fly ssh console -C "node dist/migration-runner.js"
```

Create a standalone migration runner script:
```typescript
// apps/api/src/migration-runner.ts
import { DataSource } from 'typeorm';
// Initialize datasource and run migrations
```

### 6. Environment Files

**`apps/api/.env.example`**:
```
DATABASE_HOST=localhost
DATABASE_PORT=5432
DATABASE_USER=postgres
DATABASE_PASSWORD=postgres
DATABASE_NAME=wiki_generator
REDIS_HOST=localhost
REDIS_PORT=6379
OPENAI_API_KEY=sk-proj-your-key-here
PORT=3001
NODE_ENV=development
CORS_ORIGINS=http://localhost:3000
```

**`apps/web/.env.example`**:
```
NEXT_PUBLIC_API_URL=http://localhost:3001
```

### 7. Git Configuration

**`.gitignore`** (root):
```
node_modules/
dist/
.next/
.turbo/
*.tsbuildinfo
.env
.env.local
.env.production
/tmp/
```

**Commit message convention**: Use conventional commits:
```
feat: add wiki generation pipeline
fix: handle SSE connection drops
chore: configure fly.io deployment
docs: add README with setup instructions
```

### 8. README

Location: root `README.md`

Must include:
- Project overview (1-2 sentences)
- Live demo URL
- Tech stack
- Local setup instructions (step by step):
  1. Clone repo
  2. `bun install`
  3. Copy `.env.example` files
  4. Start PostgreSQL and Redis (docker-compose or local)
  5. `bun run db:migrate`
  6. `bun run dev`
- Architecture overview (brief)
- Link to detailed architecture docs (if included)

### 9. Docker Compose (Local Development)

Location: `docker-compose.yml` (root)

```yaml
services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
      POSTGRES_DB: wiki_generator
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"

volumes:
  postgres_data:
```

This gives developers one command (`docker compose up -d`) to start all dependencies.

---

## Pre-Deploy Checklist

1. PostgreSQL provisioned and accessible
2. Redis provisioned and accessible
3. All environment variables set (secrets)
4. Migrations run successfully
5. API health check passes (`GET /health`)
6. CORS configured to allow the Vercel frontend domain
7. SSE response buffering disabled (test with a real generation)
8. Frontend can reach the API (test check endpoint, test wiki list)
9. Full pipeline test: generate a wiki from a small public repo end-to-end
10. Q&A test: ask a question about a generated wiki

---

## Rules You Must Follow

1. **Never commit API keys or secrets.** Use `.env` files locally and platform secrets in production.
2. **SSE requires special proxy configuration.** Always disable response buffering. Test SSE works through the production proxy.
3. **Migrations run before app start**, never during request handling.
4. **Production uses `node`, not `bun`**, for the API runtime. Bun is dev-only.
5. **CORS must be explicitly configured** with the production frontend domain. Do not use `*` in production.
6. **Health check endpoint** must verify database connectivity, not just return 200.
7. **The evaluator must be able to click a URL and use the app with zero setup.** Test this yourself before submitting.
