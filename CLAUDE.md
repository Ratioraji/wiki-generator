# CLAUDE.md — Wiki Generator

This file provides Claude Code with all the context needed to work on this project. Read this file first before any task.

---

## Project Overview

Wiki Generator is a Turborepo monorepo (Bun) that takes a public GitHub repo URL, analyzes it using a 3-pass LLM pipeline, and produces navigable developer documentation organized by user-facing features with inline source citations and Q&A.

---

## Monorepo Layout

```
wiki-generator/
├── apps/
│   ├── api/              ← NestJS 10 backend (TypeScript, TypeORM, PostgreSQL, Redis)
│   └── web/              ← Next.js 15 frontend (App Router, React 19, Tailwind CSS)
├── .claude/
│   └── agents/           ← Agent specification files (read these before working on any area)
├── docker-compose.yml    ← Local PostgreSQL 16 + Redis 7
├── turbo.json            ← Turborepo pipelines: dev, build, lint
└── bun.lockb
```

There is **NO `packages/` directory**. All entities, migrations, enums, and database configuration live inside `apps/api`.

---

## Runtime & Tooling

| Tool | Version | Notes |
|---|---|---|
| Bun | 1.0+ | Package manager AND dev runtime for both apps |
| Node.js | 20+ | Production runtime for API only (nest build → node dist/main.js) |
| TypeScript | 5.x | Strict mode in both apps |
| Turborepo | Latest | Monorepo orchestration |

### Commands

```bash
bun install                    # Install all dependencies (from root)
bun run dev                    # Start both apps (API :3001, Web :3000)
bun run build                  # Build both apps
bun run lint                   # Lint both apps

# API-specific
cd apps/api
bun run db:migrate             # Run TypeORM migrations
bun run db:migrate:generate    # Generate a new migration
bun run db:migrate:revert      # Revert last migration
bun --watch src/main.ts        # Dev mode (Bun direct)
```

---

## Architecture Pattern (STRICT)

```
Controller (routing only) → UseCase (orchestration) → Service (single entity each)
```

### Rules

1. **Controllers** have zero business logic. They validate input (DTOs), delegate to a use case, and return the response.
2. **Use cases** extend `BaseUseCase<TInput, TOutput>`, implement `execute()` and `transform()`, and return `UseCaseResponse<T>`.
3. **Services** each own exactly ONE entity/repository. They extend `BaseService<T>` for standard CRUD. They accept optional `EntityManager` for transaction propagation.
4. **Transactions** are created ONLY in use cases (or in self-contained service methods like `completeWiki`), NEVER in controllers.
5. **Read-only use cases** do NOT use transactions.
6. All responses use the `UseCaseResponse<T>` envelope: `{ data, statusCode, message, meta? }`.

### Provider Pattern (CRITICAL)

Third-party clients (OpenAI, Redis, Pinecone) are registered as NestJS custom providers. Services inject them via `@Inject(TOKEN)`.

```typescript
// Provider creates the instance
export const OpenAIProvider: Provider = {
  provide: OPENAI_CLIENT,
  useFactory: () => new OpenAI({ apiKey: process.env.OPENAI_API_KEY }),
};

// Service injects it — NEVER instantiates directly
@Injectable()
export class LlmService {
  constructor(@Inject(OPENAI_CLIENT) private readonly openai: OpenAI) {}
}
```

**Anti-patterns to reject:**
- ❌ `new OpenAI()` inside a service constructor
- ❌ `new Redis()` inside a service constructor
- ❌ Raw SQL in use cases (encapsulate in service methods)
- ❌ Business logic in controllers
- ❌ Transactions in read-only use cases

---

## Bun + NestJS Gotchas

These will silently break the app if ignored:

1. **`emitDecoratorMetadata: true`** must be explicitly set in `apps/api/tsconfig.json`. Do NOT rely on extends chains. NestJS DI fails silently without it.

2. **Use `import type` for interface-only imports** in any file with decorators (`@Injectable()`, `@Controller()`, etc.):

```typescript
// CORRECT — Bun won't try to reference the type at runtime
import type { SSEEvent } from '../interfaces/sse-event.interface';

// WRONG — will crash at runtime with emitDecoratorMetadata
import { SSEEvent } from '../interfaces/sse-event.interface';
```

3. **Stale build cache**: If builds produce empty output or old code, delete `tsconfig.build.tsbuildinfo` and rebuild.

4. **Dev runs Bun directly** (`bun --watch src/main.ts`). **Production runs Node** (`node dist/main.js` after `nest build`).

---

## Backend Module Structure

All backend code for the wiki feature lives in `apps/api/src/wiki/`:

```
wiki/
├── wiki.module.ts              # Module registration
├── controllers/                # REST + SSE endpoints
├── usecases/                   # Business logic (5 use cases)
├── orchestrator/               # 6-step pipeline coordinator
├── agents/                     # LLM agents (3 passes)
├── services/                   # Domain services (8 services)
├── providers/                  # Third-party client factories (OpenAI, Redis, Pinecone)
├── prompts/                    # LLM prompt templates (4 prompts)
├── entities/                   # TypeORM entities (3 entities)
├── enums/                      # WikiStatus enum
├── interfaces/                 # TypeScript interfaces (5 files)
├── dto/                        # Request/response DTOs (6 DTOs)
├── constants/                  # Token budgets, ignore patterns, language support
└── utils/                      # URL normalisation utility
```

### File Naming

| Type | Pattern | Example |
|---|---|---|
| Entity | `<name>.entity.ts` | `wiki.entity.ts` |
| Service | `<name>.service.ts` | `wiki-cache.service.ts` |
| Controller | `<name>.controller.ts` | `wiki.controller.ts` |
| Use Case | `<verb>-<noun>.usecase.ts` | `generate-wiki.usecase.ts` |
| DTO | `<name>.dto.ts` | `generate-wiki.dto.ts` |
| Agent | `<name>.agent.ts` | `grouping-plan.agent.ts` |
| Prompt | `<name>.prompt.ts` | `grouping-plan.prompt.ts` |
| Interface | `<name>.interface.ts` | `sse-event.interface.ts` |
| Provider | `<name>.provider.ts` | `openai.provider.ts` |
| Enum | `<name>.enum.ts` | `wiki-status.enum.ts` |

---

## API Endpoints

| Method | Path | Purpose | Use Case |
|---|---|---|---|
| `POST` | `/api/wiki/generate` | Generate wiki (SSE stream) | GenerateWikiUseCase |
| `GET` | `/api/wiki` | List all wikis (paginated) | ListWikisUseCase |
| `GET` | `/api/wiki/check` | Dedup check for repo+branch | CheckExistingWikiUseCase |
| `GET` | `/api/wiki/:id` | Get complete wiki | GetWikiUseCase |
| `POST` | `/api/wiki/:id/ask` | Q&A against wiki content | AskQuestionUseCase |
| `GET` | `/health` | Health check | — |

**Route order matters**: `/api/wiki/check` must be declared BEFORE `/api/wiki/:id` in the controller to avoid route conflicts.

---

## Pipeline Flow

```
1. INGESTION    → git clone --depth 1, file tree walk, ignore patterns, README extraction
2. PARSING      → Regex-based function/class extraction with accurate line numbers
3. PASS 1       → Single LLM call: file tree + snippets → GroupingPlan (feature-driven subsystems)
4. PASS 2       → Batched LLM calls (3-5 files each): classify files into groups, add descriptions
5. PASS 3       → Parallel LLM calls (one per subsystem): deep wiki content with citations
6. ASSEMBLY     → PostgreSQL transaction (wiki + subsystems + file maps), Redis cache, vector embeddings
```

**Key rules:**
- Line numbers come from `FileParserService` regex, NEVER from the LLM
- Pass 3 agents run in parallel via `Promise.all` + `safeDispatch` (individual failure → null → pipeline continues)
- Vector embedding is fire-and-forget (non-blocking) — persisted to Pinecone
- Temp directory `/tmp/wiki-{id}/` is cleaned up in a finally block

---

## Database

### Entities

- **Wiki** — id, repoUrl, repoName, branch, status, repoSummary, totalFiles, totalSubsystems, deletedAt (soft delete)
- **WikiSubsystem** — id, wikiId, groupId, name, overview, howItWorks, publicInterfaces (JSONB), citations (JSONB), dependencies (text[]), keyFiles (text[])
- **WikiFileMap** — id, wikiId, filePath, groupId, summary, functionSummaries (JSONB)

### Key Index

```sql
CREATE UNIQUE INDEX idx_wikis_repo_branch_active
  ON wikis(repo_url, branch) WHERE deleted_at IS NULL;
```

This partial unique index enforces one active wiki per repo+branch while allowing soft-deleted duplicates.

### Deduplication Logic

| Scenario | forceRegenerate | Action |
|---|---|---|
| No existing wiki | — | Create new, run pipeline |
| Existing wiki | false | Return existing immediately (no pipeline) |
| Existing wiki | true | Soft-delete old, invalidate cache, run pipeline |
| Same repo, different branch | — | Always new wiki |

---

## Redis Cache

```
wiki:{wikiId}              → Full wiki JSON (24h TTL)
wiki:lookup:{repoHash}     → Wiki ID string (24h TTL)
```

On cache miss, use case falls through to PostgreSQL and re-populates Redis (self-healing).

---

## Frontend

### Tech

Next.js 15 (App Router), React 19, Tailwind CSS, shadcn/ui (heavily overridden), React Query, JetBrains Mono.

### Design System

**Read `.claude/agents/08-ui-design-system.md` before writing any frontend code.**

Dark industrial data terminal aesthetic:
- Background: `#1a1a1a` (primary), `#242424` (cards)
- Accent: `#c4652a` (burnt orange) — the ONLY accent colour
- Font: JetBrains Mono everywhere (monospace-only UI)
- Border-radius: `0px` on everything — zero rounding
- No shadows, no gradients
- Uppercase labels with letter-spacing
- Status symbols: `●` `◷` `✗` `■` `▪` `→` (no emojis)
- Dark-only (no light mode)

### Pages

| Route | Purpose |
|---|---|
| `/` | Home — repo input form + wiki history grid |
| `/wiki/processing` | SSE progress display during generation |
| `/wiki/[id]` | Wiki viewer with sidebar + Q&A panel |

### Hooks

- `use-sse-stream.ts` — EventSource connection for generation pipeline
- `use-wiki-data.ts` — React Query hook for wiki by ID
- `use-wiki-history.ts` — React Query hook for paginated wiki list

---

## Agent Specification Files

Detailed implementation specs live in `.claude/agents/`. **Always read the relevant agent file before working on that area:**

| File | Scope |
|---|---|
| `01-project-architect.md` | Scaffolding, module wiring, provider rules, architecture enforcement |
| `02-database-engineer.md` | Entities, enums, migrations, WikiPersistenceService, WikiCacheService |
| `03-backend-engineer.md` | Controller, use cases, DTOs, interfaces, constants, orchestrator |
| `04-ai-ml-engineer.md` | LLM services, agents, prompts, embeddings, vector store, file parser |
| `05-frontend-engineer.md` | Next.js pages, components, hooks, API client, types |
| `06-devops-engineer.md` | Docker, Fly.io, Vercel, deployment, environment config |
| `07-git-operations.md` | Git workflow, branching, conventional commits, PRs |
| `08-ui-design-system.md` | Colour palette, typography, component patterns, layout rules |

The prompt sequence for building the project step-by-step is in `prompt-sequence.md`.

---

## Environment Variables

### `apps/api/.env`

| Variable | Required | Description |
|---|---|---|
| `DATABASE_HOST` | Yes | PostgreSQL host |
| `DATABASE_PORT` | No (5432) | PostgreSQL port |
| `DATABASE_USER` | Yes | Database user |
| `DATABASE_PASSWORD` | Yes | Database password |
| `DATABASE_NAME` | Yes | Database name |
| `REDIS_HOST` | Yes | Redis host |
| `REDIS_PORT` | No (6379) | Redis port |
| `OPENAI_API_KEY` | Yes | OpenAI API key |
| `PINECONE_API_KEY` | Yes | Pinecone API key |
| `PINECONE_INDEX` | No (wiki-embeddings) | Pinecone index name (auto-created if missing) |
| `LLM_MODEL` | No (gpt-4o-mini) | LLM model to use |
| `PORT` | No (3001) | API server port |
| `NODE_ENV` | No (development) | Environment |
| `CORS_ORIGINS` | No (http://localhost:3000) | Allowed origins |

### `apps/web/.env.local`

| Variable | Required | Description |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | No (http://localhost:3001) | API base URL |

---

## Deployment

| App | Platform | Notes |
|---|---|---|
| API | Fly.io | SSE requires disabling response buffering (X-Accel-Buffering: no) |
| Frontend | Vercel | Standard Next.js deployment |
| PostgreSQL | Fly.io Postgres or Railway | Managed |
| Redis | Upstash or Railway | Managed |
| Pinecone | Pinecone Serverless (aws/us-east-1) | Free tier works |

Production API runs `node dist/main.js` (not Bun). Migrations run via release command before app start.

---

## Git Conventions

**Read `.claude/agents/07-git-operations.md` for the full git workflow.**

### Branch naming

```
{type}/{scope}-{short-description}
# feat/api-wiki-generation-pipeline
# fix/web-sse-connection-cleanup
# chore/infra-flyio-deployment
```

### Commit messages (conventional commits)

```
{type}({scope}): {description}
# feat(api:agent): implement grouping plan agent (pass 1)
# fix(api:cache): correct redis pipeline exec call
# feat(web:component): build wiki viewer with sidebar navigation
```

### Global rules

1. **NEVER stage or commit `.claude/`, `CLAUDE.md`, or any Anthropic configuration files.** Add to `.gitignore`.
2. **NEVER add Anthropic/Claude as a co-author or contributor** in commit messages. No `Co-authored-by` or `Signed-off-by` trailers referencing AI assistants.

---

## Testing Checklist

Before considering any phase complete:

- [ ] API starts without DI errors (`bun run dev --filter=api`)
- [ ] All DTOs validate correctly (send invalid data, expect 400)
- [ ] SSE stream delivers events for each pipeline phase
- [ ] Deduplication works (same repo+branch → existing, different branch → new)
- [ ] Force regenerate soft-deletes old wiki and generates new
- [ ] Redis cache hit returns instantly, cache miss falls through to PostgreSQL
- [ ] Individual agent failure doesn't crash the pipeline (safeDispatch)
- [ ] Wiki viewer renders all subsystems with working citations
- [ ] Q&A returns relevant answers with source references
- [ ] Frontend handles loading, error, and empty states for every component
