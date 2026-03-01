# Wiki Generator

Automatic developer documentation generator for public GitHub repositories. Paste a repo URL, get navigable wiki pages organized by user-facing features — with inline source citations and Q&A.

> **Live Demo**: [https://web-tan-two-17.vercel.app](https://web-tan-two-17.vercel.app/)

---

## How It Works

The system uses a **3-pass LLM pipeline** to analyze a codebase and produce structured documentation:

```
REPO URL
   │
   ▼
┌─────────────────────────────────────────────────────────────┐
│  STEP 1: INGESTION                                          │
│  git clone → file tree → regex extraction (line numbers)    │
├─────────────────────────────────────────────────────────────┤
│  STEP 2: GROUPING PLAN (Pass 1 — single LLM call)          │
│  file tree + snippets + README → identify subsystems        │
│  Groups by USER-FACING FEATURES, not technical layers       │
├─────────────────────────────────────────────────────────────┤
│  STEP 3: FILE CLASSIFICATION (Pass 2 — batched LLM calls)  │
│  classify each file into its subsystem group                │
│  add descriptions to pre-parsed functions/classes           │
├─────────────────────────────────────────────────────────────┤
│  STEP 4: DEEP ANALYSIS (Pass 3 — parallel LLM calls)       │
│  one call per subsystem → overview, how it works,           │
│  public interfaces, citations with GitHub line links        │
├─────────────────────────────────────────────────────────────┤
│  STEP 5: ASSEMBLY                                           │
│  persist to PostgreSQL, cache in Redis, embed for Q&A       │
└─────────────────────────────────────────────────────────────┘
   │
   ▼
NAVIGABLE WIKI + Q&A
```

The entire pipeline streams progress to the browser via **Server-Sent Events (SSE)**, so you see each phase happen in real time.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Monorepo | Turborepo + Bun |
| Backend | NestJS 10, TypeORM, TypeScript |
| Frontend | Next.js 15 (App Router), React 19, Tailwind CSS |
| LLM | OpenAI gpt-4o-mini |
| Database | PostgreSQL 16 |
| Cache | Redis 7 |
| Vector Store | Pinecone (serverless) |
| Embeddings | OpenAI text-embedding-3-small |
| Deployment | Fly.io (API) + Vercel (Frontend) |

---

## Project Structure

```
wiki-generator/
├── apps/
│   ├── api/                          # NestJS backend
│   │   └── src/
│   │       ├── wiki/                 # Core module
│   │       │   ├── controllers/      # REST + SSE endpoints
│   │       │   ├── usecases/         # Business logic (5 use cases)
│   │       │   ├── orchestrator/     # 6-step pipeline coordinator
│   │       │   ├── agents/           # LLM agents (3 passes)
│   │       │   ├── services/         # Domain services (8 services)
│   │       │   ├── providers/        # Third-party client factories
│   │       │   ├── prompts/          # LLM prompt templates
│   │       │   ├── entities/         # TypeORM entities
│   │       │   ├── interfaces/       # TypeScript interfaces
│   │       │   ├── dto/              # Request/response DTOs
│   │       │   └── constants/        # Token budgets, ignore patterns
│   │       └── shared/               # Global filters, interceptors
│   │
│   └── web/                          # Next.js frontend
│       └── src/
│           ├── app/                  # Pages (home, processing, wiki viewer)
│           ├── components/           # UI components
│           ├── hooks/                # SSE stream, React Query hooks
│           ├── lib/                  # API client
│           └── types/                # Shared type definitions
│
├── .claude/agents/                   # Agent specification files
├── docker-compose.yml                # Local PostgreSQL + Redis
└── turbo.json                        # Turborepo pipeline config
```

---

## API Endpoints

| Method | Path | Purpose |
|---|---|---|
| `POST` | `/api/wiki/generate` | Generate wiki (SSE stream) |
| `GET` | `/api/wiki` | List all wikis (paginated, searchable) |
| `GET` | `/api/wiki/check` | Check if wiki exists for repo+branch |
| `GET` | `/api/wiki/:id` | Get complete wiki data |
| `POST` | `/api/wiki/:id/ask` | Ask a question about a wiki (RAG) |
| `GET` | `/health` | Health check |

---

## Local Setup

### Prerequisites

- [Bun](https://bun.sh/) (v1.0+)
- [Docker](https://www.docker.com/) (for PostgreSQL + Redis)
- OpenAI API key
- Pinecone API key (free tier works)

### Steps

```bash
# 1. Clone the repository
git clone https://github.com/your-username/wiki-generator.git
cd wiki-generator

# 2. Install dependencies
bun install

# 3. Start PostgreSQL and Redis
docker compose up -d

# 4. Configure environment
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env.local
# Edit apps/api/.env and add your OPENAI_API_KEY

# 5. Run database migrations
cd apps/api && bun run db:migrate && cd ../..

# 6. Start both apps
bun run dev
```

The API runs on `http://localhost:3001` and the frontend on `http://localhost:3000`.

### Environment Variables

**`apps/api/.env`**:
```
DATABASE_HOST=localhost
DATABASE_PORT=5432
DATABASE_USER=postgres
DATABASE_PASSWORD=postgres
DATABASE_NAME=wiki_generator
REDIS_HOST=localhost
REDIS_PORT=6379
OPENAI_API_KEY=sk-proj-your-key-here
PINECONE_API_KEY=pcsk_your-key-here
PINECONE_INDEX=wiki-embeddings
PORT=3001
NODE_ENV=development
CORS_ORIGINS=http://localhost:3000
```

**`apps/web/.env.local`**:
```
NEXT_PUBLIC_API_URL=http://localhost:3001
```

---

## Architecture Decisions

### 3-Pass LLM Pipeline

Instead of asking one LLM call to analyze an entire repo, the pipeline uses three specialised passes. Pass 1 identifies the high-level subsystem structure. Pass 2 classifies every file into those subsystems with function-level detail. Pass 3 generates deep wiki content per subsystem. This produces significantly better documentation than a single-shot approach, at the cost of more API calls.

### Feature-Driven Grouping

The grouping prompt explicitly instructs the LLM to organize by user-facing features ("User Authentication", "Todo Management") rather than technical layers ("Frontend", "Backend", "Utils"). This produces documentation that matches how developers think about a codebase.

### Regex-Parsed Line Numbers

Function names and line numbers come from regex extraction in `FileParserService`, never from the LLM. This prevents hallucinated line references in citations. The LLM only adds semantic descriptions to pre-parsed structures.

### Provider Pattern for Third-Party Clients

OpenAI, Redis, and Pinecone are injected via NestJS custom providers (`@Inject(OPENAI_CLIENT)`). Services never instantiate SDK clients directly. This gives us a single shared instance, easy mocking in tests, and the ability to swap implementations without changing service code.

### SSE for Real-Time Progress

Wiki generation takes 20-40 seconds. Rather than polling, the backend streams progress events via Server-Sent Events. The frontend shows each pipeline phase completing in real time, making the wait feel interactive rather than uncertain.

### Branch-Aware Deduplication

Each wiki is uniquely identified by `normalised_repo_url + branch`. Requesting the same repo+branch returns the existing wiki instantly. "Force regenerate" soft-deletes the old wiki and runs a fresh pipeline. Different branches of the same repo are treated as separate wikis.

### Redis Cache with Self-Healing

Full wiki responses are cached in Redis (24h TTL). On cache miss, the use case falls through to PostgreSQL, serves the response, and re-populates the cache. This means the cache self-heals after expiry with zero manual intervention.

### Graceful Agent Degradation

During Pass 3, if one subsystem's analysis fails, the pipeline continues with the remaining subsystems. A wiki with 5/6 subsystems is better than a failed generation. The `safeDispatch` wrapper catches individual agent errors and emits a warning SSE event.

---

## Key Design Patterns

| Pattern | Where | Purpose |
|---|---|---|
| Controller → UseCase → Service | All endpoints | Strict layering, zero business logic in controllers |
| BaseUseCase\<TInput, TOutput\> | All use cases | Consistent execute() + transform() contract |
| UseCaseResponse\<T\> | All responses | Standard envelope: data, statusCode, message, meta |
| Optional EntityManager | All services | Transaction propagation from use case to services |
| safeDispatch | Orchestrator | Graceful per-agent failure handling |
| Fire-and-forget embedding | Orchestrator | Non-blocking vector store writes during generation |
| Two-key Redis design | WikiCacheService | wiki:{id} for content, wiki:lookup:{hash} for dedup |

---

## Improvements With More Time

- **Incremental regeneration** — detect which files changed and only re-analyze affected subsystems
- **Private repo support** — GitHub OAuth flow for authenticated cloning
- **Export formats** — download wiki as Markdown files, PDF, or push to GitHub Wiki
- **Rate limiting** — per-user generation limits to manage OpenAI costs
- **Webhook triggers** — auto-regenerate wiki on push events
- **Syntax highlighting** — proper code block rendering with language detection
- **Search** — full-text search across all wiki content (not just subsystem names)

---

## License

MIT
