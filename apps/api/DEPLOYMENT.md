# Backend Deployment Guide — Fly.io

Live URL: **https://wiki-generator-api.fly.dev/**

---

## Architecture Overview

```
┌─────────────────────────────────────────────────┐
│                  Fly.io (iad)                   │
│                                                 │
│  ┌───────────────────────────────────────────┐  │
│  │        wiki-generator-api (VM)            │  │
│  │                                           │  │
│  │   ┌─────────────┐   ┌─────────────────┐  │  │
│  │   │  NestJS API  │   │  Redis (in-    │  │  │
│  │   │  (Node 20)   │   │  container)    │  │  │
│  │   │  port 3001   │   │  port 6379     │  │  │
│  │   └──────┬───────┘   └────────────────┘  │  │
│  │          │                                │  │
│  └──────────┼────────────────────────────────┘  │
│             │ Fly private network (.flycast)     │
│  ┌──────────▼────────────────────────────────┐  │
│  │     wiki-generator-db (Postgres 17)       │  │
│  │     Separate Fly app, 1GB volume          │  │
│  │     port 5432                             │  │
│  └───────────────────────────────────────────┘  │
└─────────────────────────────────────────────────┘
```

### Component Roles

| Component | How deployed | Why it matters |
|-----------|-------------|----------------|
| **PostgreSQL 17** | Separate Fly app (`wiki-generator-db`) with a persistent 1GB volume | Stores all wiki data — wikis, subsystems, file maps. Persists across deploys. Connected over Fly's private network (`.flycast`) so no public exposure. |
| **Redis 7** | Installed inside the API container, started by `entrypoint.sh` | Used as a cache/queue for wiki generation pipeline state. Bundled in-container to simplify the deployment (no separate service to manage). Data is ephemeral — lost on redeploy, which is fine for caching. Capped at 128MB with LRU eviction. |
| **NestJS API** | Docker image built from monorepo root, deployed as Fly machine | The application server. Handles REST endpoints, SSE streaming for wiki generation, and Q&A. Binds to `0.0.0.0:3001` so Fly's proxy can reach it. |
| **Migration Runner** | Runs automatically before each deploy via `release_command` | Standalone TypeORM script that runs pending database migrations. If it fails, the deploy is aborted — no broken schema in production. |

---

## Prerequisites

- [Fly CLI](https://fly.io/docs/flyctl/install/) installed
- Authenticated: `fly auth login`
- Docker available locally (Fly uses remote builders, but local builds are useful for testing)

---

## Step-by-Step: Initial Deployment

### 1. Create the Fly App

```bash
fly apps create wiki-generator-api --org personal
```

This registers the app name on Fly. No machines are created yet.

### 2. Provision PostgreSQL

```bash
fly postgres create \
  --name wiki-generator-db \
  --region iad \
  --vm-size shared-cpu-1x \
  --volume-size 1 \
  --initial-cluster-size 1 \
  --org personal
```

This creates a separate Fly app running Postgres 17 with a 1GB persistent volume.

**Save the credentials from the output** — they won't be shown again:
```
Username:    postgres
Password:    <generated>
Hostname:    wiki-generator-db.internal
Proxy port:  5432
```

### 3. Attach Postgres to the API App

```bash
fly postgres attach wiki-generator-db --app wiki-generator-api
```

This:
- Creates a dedicated database user (`wiki_generator_api`)
- Creates a dedicated database (`wiki_generator_api`)
- Sets `DATABASE_URL` as a secret on the API app

**Note:** Our app uses individual env vars, not `DATABASE_URL`, so we set those separately in step 4.

### 4. Set Secrets (Environment Variables)

The database connection (parsed from the attach output):
```bash
fly secrets set \
  DATABASE_HOST="wiki-generator-db.flycast" \
  DATABASE_PORT="5432" \
  DATABASE_USER="wiki_generator_api" \
  DATABASE_PASSWORD="<password-from-step-2>" \
  DATABASE_NAME="wiki_generator_api" \
  --app wiki-generator-api
```

API keys and config:
```bash
fly secrets set \
  OPENAI_API_KEY="sk-proj-..." \
  PINECONE_API_KEY="pcsk_..." \
  PINECONE_INDEX="wiki-embeddings" \
  CORS_ORIGINS="*" \
  --app wiki-generator-api
```

Verify all secrets are staged:
```bash
fly secrets list --app wiki-generator-api
```

**Note:** `REDIS_URL` is NOT set as a secret — it defaults to `redis://localhost:6379` inside the Dockerfile since Redis runs in the same container.

### 5. Deploy

From the **monorepo root** (not `apps/api/`), because the Dockerfile needs access to the root `package.json` and `bun.lock`:

```bash
cd wiki-generator/  # monorepo root
fly deploy --config apps/api/fly.toml --dockerfile apps/api/Dockerfile
```

This will:
1. Build the Docker image remotely (4-stage build)
2. Push it to Fly's registry
3. Run the release command (`node dist/src/migration-runner.js`) — runs migrations
4. Start 2 machines (for high availability, configured by `min_machines_running = 1`)

### 6. Verify

```bash
# Health check
curl https://wiki-generator-api.fly.dev/health

# API root
curl https://wiki-generator-api.fly.dev/api

# List wikis
curl "https://wiki-generator-api.fly.dev/api/wiki?page=1&limit=10"

# Check logs
fly logs --app wiki-generator-api --no-tail
```

---

## Step-by-Step: Subsequent Deploys

After code changes, just redeploy from the monorepo root:

```bash
fly deploy --config apps/api/fly.toml --dockerfile apps/api/Dockerfile
```

Migrations run automatically before each deploy. If a migration fails, the deploy is aborted.

---

## Docker Build Stages Explained

The Dockerfile uses a 4-stage build to keep the production image small (~92MB):

| Stage | Base Image | Purpose |
|-------|-----------|---------|
| **deps** | `oven/bun:1-slim` | Installs all workspace dependencies using `bun install --frozen-lockfile`. Needs ALL workspace `package.json` files to resolve the lockfile. |
| **build** | (from deps) | Copies API source and compiles TypeScript with `bunx nest build`. Output goes to `apps/api/dist/`. |
| **prod-deps** | `node:20-slim` | Runs `npm install --omit=dev` to create a standard Node.js-compatible `node_modules/`. Bun's internal module layout (`.bun/`) doesn't work with Node.js at runtime. |
| **production** | `node:20-slim` | Final image. Copies compiled JS from build, node_modules from prod-deps. Installs git (for cloning repos), redis-server (cache), and ca-certificates (HTTPS git clone). |

---

## fly.toml Configuration

| Setting | Value | Why |
|---------|-------|-----|
| `primary_region` | `iad` | US East — close to GitHub/OpenAI/Pinecone APIs |
| `release_command` | `node dist/src/migration-runner.js` | Runs TypeORM migrations before each deploy |
| `internal_port` | `3001` | Port NestJS listens on |
| `force_https` | `true` | All traffic encrypted |
| `auto_stop_machines` | `stop` | Machines stop when idle (saves cost) |
| `auto_start_machines` | `true` | Machines restart on incoming request |
| `min_machines_running` | `1` | Always keep at least 1 machine warm |
| `response_header_timeout` | `600` | 10 minutes — required for SSE wiki generation streams that can take several minutes |
| `memory` | `1gb` | Shared CPU, 1GB RAM |

---

## Environment Variables Reference

| Variable | Source | Description |
|----------|--------|-------------|
| `DATABASE_HOST` | Fly secret | Postgres hostname (`wiki-generator-db.flycast`) |
| `DATABASE_PORT` | Fly secret | Postgres port (`5432`) |
| `DATABASE_USER` | Fly secret | Database username |
| `DATABASE_PASSWORD` | Fly secret | Database password |
| `DATABASE_NAME` | Fly secret | Database name |
| `DATABASE_URL` | Auto-set by `fly postgres attach` | Full connection string (not used by the app, but kept) |
| `OPENAI_API_KEY` | Fly secret | OpenAI API key for embeddings and LLM calls |
| `PINECONE_API_KEY` | Fly secret | Pinecone API key for vector storage |
| `PINECONE_INDEX` | Fly secret | Pinecone index name (`wiki-embeddings`) |
| `CORS_ORIGINS` | Fly secret | Allowed origins, comma-separated (`*` for now) |
| `REDIS_URL` | Dockerfile default | `redis://localhost:6379` — Redis runs in-container |
| `NODE_ENV` | fly.toml env | `production` |
| `PORT` | fly.toml env | `3001` |

---

## Common Operations

### View logs
```bash
fly logs --app wiki-generator-api --no-tail
```

### SSH into a running machine
```bash
fly ssh console --app wiki-generator-api
```

### Check Postgres status
```bash
fly status --app wiki-generator-db
```

### Start Postgres if stopped
```bash
fly status --app wiki-generator-db          # get machine ID
fly machine start <machine-id> --app wiki-generator-db
```

### Connect to Postgres directly
```bash
fly postgres connect --app wiki-generator-db
```

### Update a secret
```bash
fly secrets set OPENAI_API_KEY="sk-proj-new-key" --app wiki-generator-api
fly deploy --config apps/api/fly.toml --dockerfile apps/api/Dockerfile
```

### Scale memory/CPU
Edit `apps/api/fly.toml`:
```toml
[[vm]]
  memory = "2gb"
  cpu_kind = "shared"
  cpus = 2
```
Then redeploy.

---

## Troubleshooting

| Issue | Cause | Fix |
|-------|-------|-----|
| Migration fails with "Connection terminated" | Postgres machine is stopped | `fly machine start <id> --app wiki-generator-db`, then redeploy |
| App not reachable (502) | NestJS binding to localhost instead of 0.0.0.0 | Ensure `app.listen(port, '0.0.0.0')` in `main.ts` |
| Git clone fails with SSL error | Missing CA certificates in container | Ensure `ca-certificates` is in the Dockerfile `apt-get install` line |
| SSE stream cuts off early | Fly proxy timeout too low | `response_header_timeout = 600` in fly.toml (already set) |
| Pinecone auth error on startup | Invalid or missing `PINECONE_API_KEY` | `fly secrets set PINECONE_API_KEY="pcsk_..."` then redeploy |
| Redis connection refused | `entrypoint.sh` not starting Redis | Check that `entrypoint.sh` has execute permissions and is copied in Dockerfile |
