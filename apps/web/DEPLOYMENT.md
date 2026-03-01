# Frontend Deployment Guide — Vercel

Live URL: **https://web-tan-two-17.vercel.app**

---

## Architecture Overview

```
┌──────────────────────────────────────────────────────────┐
│                     Vercel (Edge)                        │
│                                                          │
│  ┌────────────────────────────────────────────────────┐  │
│  │              Next.js 15 (Standalone)               │  │
│  │                                                    │  │
│  │   /                  → Home page (wiki list)       │  │
│  │   /wiki/processing   → SSE processing stream      │  │
│  │   /wiki/[id]         → Wiki viewer + Q&A           │  │
│  │                                                    │  │
│  │   All /api/* routes  → Rewritten to Fly.io API     │  │
│  └──────────┬─────────────────────────────────────────┘  │
│             │                                            │
└─────────────┼────────────────────────────────────────────┘
              │ HTTPS (client-side fetch)
              ▼
┌──────────────────────────────────────────────────────────┐
│              Fly.io (wiki-generator-api)                 │
│              https://wiki-generator-api.fly.dev          │
│                                                          │
│   /api/wiki           → List / generate wikis            │
│   /api/wiki/:id       → Wiki detail                      │
│   /api/wiki/:id/ask   → Q&A                              │
│   /health             → Health check                     │
└──────────────────────────────────────────────────────────┘
```

### How the Frontend Connects to the API

The frontend uses `NEXT_PUBLIC_API_URL` in two places:

| File | Purpose |
|------|---------|
| `src/lib/api-client.ts` | Base URL for all REST calls (`listWikis`, `getWiki`, `checkExistingWiki`, `askQuestion`) |
| `src/hooks/use-sse-stream.ts` | Base URL for SSE stream connection (`POST /wiki/generate`) |

Both read `process.env.NEXT_PUBLIC_API_URL` with a fallback to `http://localhost:3001`.

Additionally, `next.config.ts` configures rewrites to proxy `/api/*` requests to the API server — this is mainly used during local development.

---

## Prerequisites

- [Vercel CLI](https://vercel.com/docs/cli) installed: `bun add -g vercel`
- Node.js available (Vercel CLI requires it): `nvm use 22`
- Authenticated: `vercel login`
- API already deployed (see `apps/api/DEPLOYMENT.md`)

---

## Step-by-Step: Initial Deployment

### 1. Install Vercel CLI

```bash
bun add -g vercel
```

If `vercel` isn't found after install, ensure the bun global bin is in your PATH:
```bash
export PATH="/Users/<you>/.bun/bin:$PATH"
```

The Vercel CLI also requires Node.js. If `node` is not in PATH:
```bash
export PATH="/Users/<you>/.nvm/versions/node/v22.10.0/bin:$PATH"
```

### 2. Authenticate

```bash
vercel login
```

Verify:
```bash
vercel whoami
```

### 3. Link the Project

From the `apps/web` directory:

```bash
cd apps/web
vercel link --yes
```

This auto-detects the Next.js framework and creates a `.vercel/` directory (gitignored).

### 4. Set Environment Variable

```bash
echo "https://wiki-generator-api.fly.dev/api" | vercel env add NEXT_PUBLIC_API_URL production
```

This sets the API base URL that the frontend uses for all fetch calls and SSE connections.

**Important:** The value includes `/api` at the end because the frontend calls paths like `/wiki/generate`, `/wiki/:id`, etc., and the backend routes are prefixed with `/api` (via NestJS `setGlobalPrefix('api')`).

Verify:
```bash
vercel env ls
```

### 5. Deploy to Production

```bash
vercel deploy --prod --yes
```

This will:
1. Upload the source files to Vercel
2. Install dependencies (`npm install`)
3. Run `next build` (compiles pages, generates static content)
4. Deploy to Vercel's edge network
5. Return the production URL

### 6. Update CORS on the API

After getting the Vercel URL, update the API's CORS origins to allow the frontend domain:

```bash
fly secrets set CORS_ORIGINS="https://your-app.vercel.app" --app wiki-generator-api
```

For multiple domains (e.g., custom domain + vercel domain):
```bash
fly secrets set CORS_ORIGINS="https://your-app.vercel.app,https://your-custom-domain.com" --app wiki-generator-api
```

---

## Step-by-Step: Subsequent Deploys

After code changes, redeploy from `apps/web`:

```bash
cd apps/web
vercel deploy --prod --yes
```

No need to re-set environment variables or CORS — those persist across deploys.

---

## Configuration Files

### `next.config.ts`

```typescript
import type { NextConfig } from 'next';

const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

const nextConfig: NextConfig = {
  output: 'standalone',
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${apiUrl}/:path*`,
      },
    ];
  },
};

export default nextConfig;
```

| Setting | Why |
|---------|-----|
| `output: 'standalone'` | Produces a self-contained build for serverless deployment |
| `rewrites` | Proxies `/api/*` requests to the backend — used during local dev to avoid CORS issues |

### `.env.example`

```
NEXT_PUBLIC_API_URL=http://localhost:3001
```

### `.env.local` (local development)

```
NEXT_PUBLIC_API_URL=http://localhost:3001/api
```

---

## Environment Variables Reference

| Variable | Where Set | Value | Description |
|----------|-----------|-------|-------------|
| `NEXT_PUBLIC_API_URL` | Vercel dashboard / CLI | `https://wiki-generator-api.fly.dev/api` | Base URL for all API calls. Includes `/api` suffix to match NestJS global prefix. |

This is the **only** environment variable the frontend needs.

---

## Pages and Routes

| Route | Type | Description |
|-------|------|-------------|
| `/` | Static + Client | Home page — repo input form + wiki history list |
| `/wiki/processing?repo=...&branch=...` | Client | SSE processing page — shows real-time progress during wiki generation |
| `/wiki/[id]` | Dynamic | Wiki viewer — sidebar navigation + markdown content + Q&A panel |

---

## How It Works End-to-End

1. **User enters a repo URL** on the home page (`/`)
2. **Redirects to processing page** (`/wiki/processing?repo=...&branch=...`)
3. **SSE connection opens** — `use-sse-stream.ts` sends a POST to `${API_BASE}/wiki/generate` and streams progress events (ingestion → grouping → classification → analysis → assembly)
4. **On completion**, redirects to wiki viewer (`/wiki/[id]`)
5. **Wiki viewer loads** — fetches full wiki data from `${API_BASE}/wiki/${id}`, renders subsystems with sidebar navigation
6. **Q&A panel** — user asks questions, sent to `${API_BASE}/wiki/${id}/ask`, answers rendered with source citations linking to GitHub

---

## Common Operations

### Check deployment status
```bash
vercel ls --app web
```

### View build logs
```bash
vercel inspect <deployment-url> --logs
```

### Redeploy from last successful build
```bash
vercel redeploy <deployment-url>
```

### Update environment variable
```bash
vercel env rm NEXT_PUBLIC_API_URL production
echo "https://new-api-url.fly.dev/api" | vercel env add NEXT_PUBLIC_API_URL production
vercel deploy --prod --yes  # redeploy to pick up the change
```

### Add a custom domain
```bash
vercel domains add your-domain.com
```

---

## Troubleshooting

| Issue | Cause | Fix |
|-------|-------|-----|
| Build fails with ESLint errors | `<a href="/">` used instead of `<Link>` | Replace `<a>` with `next/link` `<Link>` for internal navigation |
| "Loading..." stuck on wiki list | Frontend can't reach API (CORS blocked) | Update `CORS_ORIGINS` on Fly.io to include the Vercel domain |
| SSE stream doesn't connect | Wrong `NEXT_PUBLIC_API_URL` or missing `/api` suffix | Verify env var: should be `https://wiki-generator-api.fly.dev/api` |
| 404 on wiki pages | Vercel not configured for dynamic routes | Ensure `output: 'standalone'` in `next.config.ts` |
| API calls return CORS error | Vercel domain not in API's allowed origins | `fly secrets set CORS_ORIGINS="https://your-app.vercel.app"` then Fly auto-restarts |
| `vercel` command not found | Bun global bin not in PATH | `export PATH="/Users/<you>/.bun/bin:$PATH"` |
| `env: node: No such file or directory` | Node.js not in PATH (Vercel CLI needs it) | `export PATH="/Users/<you>/.nvm/versions/node/v22.10.0/bin:$PATH"` |
