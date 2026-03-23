# Backend Deployment Guide — Railway

Live URL: **https://wiki-generator-api-production.up.railway.app/**

---

## Architecture Overview

```
┌──────────────────────────────────────────────────────────┐
│                   Railway (us-west1)                     │
│                                                          │
│  ┌────────────────────────────────────────────────────┐  │
│  │     wiki-generator-api (Docker service)            │  │
│  │                                                    │  │
│  │   ┌──────────────────────────────────────────┐     │  │
│  │   │  NestJS API (Node 20)                    │     │  │
│  │   │  port 3001                               │     │  │
│  │   │  Migrations run at container start       │     │  │
│  │   └──────────────┬───────────────────────────┘     │  │
│  └──────────────────┼─────────────────────────────────┘  │
│                     │ Railway private network             │
│  ┌──────────────────▼─────────────────────────────────┐  │
│  │     Postgres (managed service)                     │  │
│  │     postgres.railway.internal:5432                 │  │
│  │     Persistent volume                              │  │
│  └────────────────────────────────────────────────────┘  │
│                                                          │
│  ┌────────────────────────────────────────────────────┐  │
│  │     Redis (managed service)                        │  │
│  │     redis.railway.internal:6379                    │  │
│  │     Persistent volume                              │  │
│  └────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────┘
```

### Component Roles

| Component | How deployed | Why it matters |
|-----------|-------------|----------------|
| **PostgreSQL** | Railway managed database service with persistent volume | Stores all wiki data — wikis, subsystems, file maps. Persists across deploys. Connected over Railway's private network so no public exposure. |
| **Redis** | Railway managed database service with persistent volume | Used as a cache/queue for wiki generation pipeline state. Managed service with automatic health checks and restarts — unlike Fly.io, Redis runs as a separate service, not in-container. Data persists across redeploys. |
| **NestJS API** | Docker image built from monorepo root, deployed as Railway service | The application server. Handles REST endpoints, SSE streaming for wiki generation, and Q&A. Binds to `0.0.0.0:3001`. |
| **Migration Runner** | Runs automatically at container start via `entrypoint.sh` | Standalone TypeORM script that runs pending database migrations before the app starts. If it fails, the container exits — no broken schema in production. |

---

## Key Differences from Fly.io

| Aspect | Fly.io | Railway |
|--------|--------|---------|
| **Redis** | In-container (ephemeral, lost on redeploy) | Managed service (persistent, separate volume) |
| **Migrations** | `release_command` in `fly.toml` (runs before deploy) | `entrypoint.sh` (runs at container start) |
| **Config file** | `fly.toml` | `railway.toml` at monorepo root |
| **Deploy command** | `fly deploy --config ... --dockerfile ...` | `railway up --service wiki-generator-api` |
| **Private network** | `.internal` / `.flycast` domains | `.railway.internal` domains |
| **Secrets** | `fly secrets set` | `railway variables set` |
| **Logs** | `fly logs` | `railway logs` |

---

## Prerequisites

- [Railway CLI](https://docs.railway.com/guides/cli) installed: `brew install railway`
- Authenticated: `railway login`
- Project linked: `railway link` (run from monorepo root)

---

## Step-by-Step: Initial Deployment

### 1. Create the Railway Project

```bash
cd wiki-generator/  # monorepo root
railway init --name wiki-generator-api
```

This creates a project on Railway and links the current directory to it.

### 2. Provision PostgreSQL

From the Railway dashboard (https://railway.com), open the project and:

1. Click **+ New** → **Database** → **PostgreSQL**

Railway auto-provisions the database with a persistent volume and sets connection variables on the service.

### 3. Provision Redis

1. Click **+ New** → **Database** → **Redis**

Railway auto-provisions Redis with a persistent volume.

### 4. Create the API Service

```bash
railway add --service wiki-generator-api
```

Then link to it:

```bash
railway service wiki-generator-api
```

### 5. Generate a Public Domain

```bash
railway domain
```

This generates a URL like `https://wiki-generator-api-production.up.railway.app`.

### 6. Set Environment Variables

Database connection (values from Postgres service variables):
```bash
railway variables set \
  DATABASE_HOST="postgres.railway.internal" \
  DATABASE_PORT="5432" \
  DATABASE_USER="postgres" \
  DATABASE_PASSWORD="<from-postgres-service>" \
  DATABASE_NAME="railway"
```

Redis connection (values from Redis service variables):
```bash
railway variables set \
  REDIS_URL="redis://default:<password>@redis.railway.internal:6379"
```

App config:
```bash
railway variables set \
  NODE_ENV="production" \
  PORT="3001" \
  CORS_ORIGINS="https://wiki-generator-web.vercel.app" \
  JWT_EXPIRES_IN="7d"
```

API keys and auth:
```bash
railway variables set \
  OPENAI_API_KEY="sk-proj-..." \
  PINECONE_API_KEY="pcsk_..." \
  PINECONE_INDEX="wiki-embeddings" \
  GITHUB_CLIENT_ID="..." \
  GITHUB_CLIENT_SECRET="..." \
  GITHUB_CALLBACK_URL="https://wiki-generator-api-production.up.railway.app/api/auth/github/callback" \
  JWT_SECRET="..." \
  FRONTEND_URL="https://wiki-generator-web.vercel.app"
```

Verify all variables:
```bash
railway variables --json
```

**Important:** `CORS_ORIGINS` must be the exact frontend origin (not `*`) because `credentials: true` is enabled for cross-origin cookie auth.

### 7. Deploy

From the **monorepo root**:

```bash
railway up --service wiki-generator-api
```

This will:
1. Upload the project files to Railway
2. Build the Docker image using the 4-stage Dockerfile
3. Start the container, which runs migrations then starts NestJS

### 8. Verify

```bash
# Health check
curl https://wiki-generator-api-production.up.railway.app/health

# API root
curl https://wiki-generator-api-production.up.railway.app/api

# List wikis
curl "https://wiki-generator-api-production.up.railway.app/api/wiki?page=1&limit=10"

# Check logs
railway logs --service wiki-generator-api
```

---

## Step-by-Step: Subsequent Deploys

After code changes, redeploy from the monorepo root:

```bash
railway up --service wiki-generator-api
```

Migrations run automatically at container start. If a migration fails, the container exits and Railway marks it as a failed deployment.

---

## Docker Build Stages Explained

The Dockerfile uses a 4-stage build to keep the production image small:

| Stage | Base Image | Purpose |
|-------|-----------|---------|
| **deps** | `oven/bun:1-slim` | Installs all workspace dependencies using `bun install --frozen-lockfile`. Needs ALL workspace `package.json` files to resolve the lockfile. |
| **build** | (from deps) | Copies API source and compiles TypeScript with `bunx nest build`. Output goes to `apps/api/dist/`. |
| **prod-deps** | `node:20-slim` | Runs `npm install --omit=dev` to create a standard Node.js-compatible `node_modules/`. Bun's internal module layout (`.bun/`) doesn't work with Node.js at runtime. |
| **production** | `node:20-slim` | Final image. Copies compiled JS from build, node_modules from prod-deps. Installs git (for cloning repos) and ca-certificates (HTTPS git clone). |

---

## railway.toml Configuration

Located at the **monorepo root** (`wiki-generator/railway.toml`):

```toml
[build]
dockerfilePath = "apps/api/Dockerfile"

[deploy]
healthcheckPath = "/health"
healthcheckTimeout = 30
restartPolicyType = "ON_FAILURE"
restartPolicyMaxRetries = 3
```

| Setting | Value | Why |
|---------|-------|-----|
| `dockerfilePath` | `apps/api/Dockerfile` | Points Railway to the API Dockerfile within the monorepo |
| `healthcheckPath` | `/health` | Railway pings this endpoint to verify the service is healthy |
| `healthcheckTimeout` | `30` | Seconds to wait for health check response |
| `restartPolicyType` | `ON_FAILURE` | Automatically restart container if it crashes |
| `restartPolicyMaxRetries` | `3` | Maximum restart attempts before marking as failed |

---

## entrypoint.sh

```sh
#!/bin/sh
set -e

# Run database migrations before starting the app
echo "Running migrations..."
node dist/src/migration-runner.js

# Start the Node.js app
exec node dist/src/main.js
```

Migrations run at container start (not as a separate release step like Fly.io). If `migration-runner.js` exits non-zero, `set -e` ensures the container stops — preventing the app from starting with an inconsistent schema.

---

## Environment Variables Reference

| Variable | Source | Description |
|----------|--------|-------------|
| `DATABASE_HOST` | Railway variable | Postgres hostname (`postgres.railway.internal`) |
| `DATABASE_PORT` | Railway variable | Postgres port (`5432`) |
| `DATABASE_USER` | Railway variable | Database username (`postgres`) |
| `DATABASE_PASSWORD` | Railway variable | Database password |
| `DATABASE_NAME` | Railway variable | Database name (`railway`) |
| `REDIS_URL` | Railway variable | Full Redis connection string (managed service) |
| `OPENAI_API_KEY` | Railway variable | OpenAI API key for embeddings and LLM calls |
| `PINECONE_API_KEY` | Railway variable | Pinecone API key for vector storage |
| `PINECONE_INDEX` | Railway variable | Pinecone index name (`wiki-embeddings`) |
| `CORS_ORIGINS` | Railway variable | Exact frontend origin (`https://wiki-generator-web.vercel.app`) |
| `GITHUB_CLIENT_ID` | Railway variable | GitHub OAuth app client ID |
| `GITHUB_CLIENT_SECRET` | Railway variable | GitHub OAuth app client secret |
| `GITHUB_CALLBACK_URL` | Railway variable | OAuth callback URL (`https://wiki-generator-api-production.up.railway.app/api/auth/github/callback`) |
| `JWT_SECRET` | Railway variable | Secret key for signing JWT tokens |
| `JWT_EXPIRES_IN` | Railway variable | JWT token expiry (`7d`) |
| `FRONTEND_URL` | Railway variable | Frontend URL for OAuth redirect (`https://wiki-generator-web.vercel.app`) |
| `NODE_ENV` | Railway variable | `production` |
| `PORT` | Railway variable | `3001` |

---

## Common Operations

### View logs
```bash
railway logs --service wiki-generator-api
```

### Check service status
```bash
railway service status
```

### Update an environment variable
```bash
railway service wiki-generator-api
railway variables set OPENAI_API_KEY="sk-proj-new-key"
railway up --service wiki-generator-api
```

### Connect to Postgres directly
```bash
railway connect Postgres
```

### Open project dashboard
```bash
railway open
```

### Redeploy without code changes
```bash
railway service redeploy wiki-generator-api
```

---

## Troubleshooting

| Issue | Cause | Fix |
|-------|-------|-----|
| Migration fails with "Connection refused" | Postgres service not running | Check Postgres service status in Railway dashboard, restart if needed |
| App not reachable (502) | NestJS binding to localhost instead of 0.0.0.0 | Ensure `app.listen(port, '0.0.0.0')` in `main.ts` |
| Git clone fails with SSL error | Missing CA certificates in container | Ensure `ca-certificates` is in the Dockerfile `apt-get install` line |
| SSE stream cuts off early | Railway's default proxy timeout | Contact Railway support or consider increasing timeout via dashboard |
| Auth cookie not sent (401 after login) | `CORS_ORIGINS` set to `*` with `credentials: true` | Set `CORS_ORIGINS` to exact frontend origin (e.g., `https://wiki-generator-web.vercel.app`) |
| Pinecone auth error on startup | Invalid or missing `PINECONE_API_KEY` | `railway variables set PINECONE_API_KEY="pcsk_..."` then redeploy |
| Redis connection refused | Wrong `REDIS_URL` or Redis service down | Verify `REDIS_URL` matches Redis service variables, check Redis service status |
| Build uses Nixpacks instead of Dockerfile | Missing `railway.toml` at monorepo root | Ensure `railway.toml` with `dockerfilePath` exists at the repo root |
| OAuth redirect fails | `GITHUB_CALLBACK_URL` or GitHub OAuth app misconfigured | Ensure callback URL matches in both Railway env vars and GitHub OAuth app settings |
