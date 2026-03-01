# Wiki Generator — Claude Code Prompt Sequence

Each prompt below is designed to be run in Claude Code. Follow the sequence exactly — each task depends on the ones before it.

**Agent files location**: All agent instruction files live in `.claude/agents/` within the project root. Each prompt tells Claude Code to read the relevant file(s) by path before starting work. No manual attachment needed.

---

## Phase 1 — Project Scaffolding

### Task 1: Init monorepo

```
Read .claude/agents/01-project-architect.md completely before doing anything.

Initialize a Turborepo monorepo with Bun as the package manager. The project is called "wiki-generator".

Create two workspaces:
- apps/api — NestJS 10 application (TypeScript)
- apps/web — Next.js 15 application with App Router (TypeScript, Tailwind CSS)

Configure root turbo.json with dev, build, and lint pipelines.
Create .gitignore at root.
Verify both apps can start with "bun run dev".

Do NOT create a packages/ directory — there are no shared packages.
Follow every scaffolding rule in the agent file.
```

### Task 2: Configure API infrastructure

```
Read .claude/agents/01-project-architect.md completely before doing anything.

In apps/api, configure:

1. TypeORM datasource with PostgreSQL (read connection settings from environment variables: DATABASE_HOST, DATABASE_PORT, DATABASE_USER, DATABASE_PASSWORD, DATABASE_NAME)
2. Redis connection using ioredis (read from REDIS_HOST, REDIS_PORT env vars)
3. The global middleware stack in main.ts:
   - ValidationPipe (whitelist: true, transform: true, custom exception factory)
   - Exception filters (validation, HTTP, catch-all)
   - TransformInterceptor that wraps responses in the UseCaseResponse envelope
   - LoggingInterceptor
   - TimeoutInterceptor (30s default)
   - CORS from CORS_ORIGINS env var
4. Create .env.example with all required variables
5. Create a /health endpoint that checks database connectivity
6. Ensure emitDecoratorMetadata and experimentalDecorators are explicitly set in apps/api/tsconfig.json

Create a docker-compose.yml at the project root with PostgreSQL 16 and Redis 7 for local development.

Follow the response format, Bun gotchas, and middleware stack from the agent file exactly.
```

---

## Phase 2 — Database Foundation

### Task 3: Create enum and entities

```
Read .claude/agents/02-database-engineer.md completely before doing anything.

Create the following inside apps/api/src/wiki/:

1. enums/wiki-status.enum.ts — WikiStatus enum (PROCESSING, COMPLETE, FAILED)

2. entities/wiki.entity.ts — Wiki entity with:
   - id (UUID, auto-generated)
   - repoUrl (VARCHAR 500, not null)
   - repoName (VARCHAR 200, not null)
   - branch (VARCHAR 200, not null)
   - repoSummary (TEXT, nullable)
   - status (VARCHAR 20, default PROCESSING, uses WikiStatus enum)
   - totalFiles (INT, nullable)
   - totalSubsystems (INT, nullable)
   - processingStartedAt (TIMESTAMPTZ, default NOW)
   - completedAt (TIMESTAMPTZ, nullable)
   - deletedAt (TIMESTAMPTZ, nullable — @DeleteDateColumn for soft delete)
   - createdAt (TIMESTAMPTZ, default NOW)
   - OneToMany relation to WikiSubsystem (cascade)
   - OneToMany relation to WikiFileMap (cascade)

3. entities/wiki-subsystem.entity.ts — WikiSubsystem entity with all fields from the agent file. JSONB columns for publicInterfaces and citations. Text array for dependencies and keyFiles. ManyToOne to Wiki with cascade delete.

4. entities/wiki-file-map.entity.ts — WikiFileMap entity with all fields from the agent file. JSONB column for functionSummaries. ManyToOne to Wiki with cascade delete.

Use import type for all interface imports. Follow every entity rule in the agent file.
```

### Task 4: Generate and run migration

```
Read .claude/agents/02-database-engineer.md completely before doing anything.

Generate a TypeORM migration for the Wiki, WikiSubsystem, and WikiFileMap entities.

The migration must create:
- All three tables with correct column types
- Foreign key constraints with ON DELETE CASCADE
- Index on wiki_subsystems(wiki_id)
- Index on wiki_file_maps(wiki_id)
- Partial unique index: CREATE UNIQUE INDEX idx_wikis_repo_branch_active ON wikis(repo_url, branch) WHERE deleted_at IS NULL

Run the migration against the local database.
Verify all tables and indexes exist.
```

---

## Phase 3 — Module Skeleton & DTOs

### Task 5: Create interfaces

```
Read .claude/agents/03-backend-engineer.md completely before doing anything.

Create all interfaces in apps/api/src/wiki/interfaces/:

1. sse-event.interface.ts — SSEEvent with types: status, progress, complete, existing, error
2. subsystem-plan.interface.ts — GroupingPlan, SubsystemGroup
3. file-classification.interface.ts — ParsedFile, StructureRef, FileClassification, FunctionSummary
4. wiki-content.interface.ts — SubsystemWikiContent, Citation, InterfaceDoc
5. agent-context.interface.ts — AgentContext (wikiId, repoUrl, branch, repoName)

Use "export interface" — these are pure types.
Copy the exact field definitions from the agent file. Do not add or remove fields.
```

### Task 6: Create constants

```
Read .claude/agents/03-backend-engineer.md completely before doing anything.

Create all constants in apps/api/src/wiki/constants/:

1. token-budgets.ts — TOKEN_BUDGETS object with input/output budgets for each pipeline stage
2. ignored-patterns.ts — IGNORED_DIRECTORIES, IGNORED_FILES, IGNORED_EXTENSIONS arrays
3. supported-languages.ts — SUPPORTED_EXTENSIONS record mapping file extensions to language names

Copy the exact values from the agent file.
```

### Task 7: Create DTOs

```
Read .claude/agents/03-backend-engineer.md completely before doing anything.

Create all DTOs in apps/api/src/wiki/dto/:

1. generate-wiki.dto.ts — repoUrl (IsString, IsUrl), branch (IsString, default "main"), forceRegenerate (IsOptional, IsBoolean, default false)
2. check-existing-wiki.dto.ts — repoUrl (IsString), branch (IsString, default "main")
3. list-wikis.dto.ts — extends PaginationDto, adds search (IsOptional, IsString)
4. ask-question.dto.ts — question (IsString, MinLength 3)
5. wiki-response.dto.ts — full wiki shape with subsystems and file maps
6. qa-response.dto.ts — answer string and sources array

Every DTO must use class-validator decorators and @ApiProperty()/@ApiPropertyOptional() for Swagger.
Follow the DTO definitions in the agent file exactly.
```

---

## Phase 4 — Providers

### Task 8: Create third-party providers

```
Read .claude/agents/01-project-architect.md completely, paying close attention to Section 2.1 Provider Rules.

Create all providers in apps/api/src/wiki/providers/:

1. openai.provider.ts
   - Export token: OPENAI_CLIENT = 'OPENAI_CLIENT'
   - useFactory: returns new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
   - This single instance will be shared by LlmService and EmbeddingService

2. redis.provider.ts
   - Export token: REDIS_CLIENT = 'REDIS_CLIENT'
   - useFactory: returns new Redis({ host: process.env.REDIS_HOST, port: parseInt(process.env.REDIS_PORT || '6379') })
   - Handle connection error logging

3. vector-store.provider.ts
   - Export token: VECTOR_STORE_CLIENT = 'VECTOR_STORE_CLIENT'
   - useFactory: returns an in-memory vector store instance for MVP
   - Design the interface so it can be swapped to Pinecone later without changing VectorStoreService

No service should ever instantiate these clients directly. The providers are the single source of truth.
```

---

## Phase 5 — Core Services

### Task 9: Create WikiPersistenceService

```
Read .claude/agents/02-database-engineer.md completely before doing anything.

Create apps/api/src/wiki/services/wiki-persistence.service.ts

This service extends BaseService<Wiki> and owns ALL database operations for the wiki module.

Implement these methods (all accept optional EntityManager):
- createWiki(repoUrl, repoName, branch, manager?) → Wiki
- findActiveByRepoAndBranch(repoUrl, branch, manager?) → Wiki | null (WHERE deleted_at IS NULL)
- softDelete(wikiId, manager?) → void (sets deleted_at = NOW())
- completeWiki(wikiId, data) → Wiki — THIS method creates its own transaction to atomically: update wiki status to complete, bulk insert WikiSubsystem records, bulk insert WikiFileMap records
- getFullWiki(wikiId) → Wiki | null — joins subsystems and file maps, filters deleted_at IS NULL
- listWikis(page, limit, search?) → { data: Wiki[], total: number } — paginated, optional ILIKE search on repo_name
- markFailed(wikiId, manager?) → void

Use this.getRepo(manager) for all repository access.
Follow every database rule in the agent file.
```

### Task 10: Create WikiCacheService

```
Read .claude/agents/02-database-engineer.md completely before doing anything.

Create apps/api/src/wiki/services/wiki-cache.service.ts

This service receives Redis via @Inject(REDIS_CLIENT). It does NOT extend BaseService.

Implement these methods:
- cacheWiki(wikiId, repoUrl, branch, data: WikiResponseDto) → void — Redis pipeline SET for both wiki:{wikiId} and wiki:lookup:{repoHash}, TTL 24 hours
- getWiki(wikiId) → WikiResponseDto | null — GET wiki:{wikiId}, parse JSON
- findExistingWikiId(repoUrl, branch) → string | null — GET wiki:lookup:{repoHash}
- invalidate(wikiId, repoUrl, branch) → void — DEL both keys
- private hashRepoKey(repoUrl, branch) → string — SHA-256 of normalised URL + ":" + branch, truncated to 16 chars

Import REDIS_CLIENT token from the provider file. Use import type for interface imports.
```

### Task 11: Create LlmConfigService and LlmService

```
Read .claude/agents/04-ai-ml-engineer.md completely before doing anything.

Create two services:

1. apps/api/src/wiki/services/llm-config.service.ts
   - model getter (reads LLM_MODEL env var, defaults to "gpt-4o-mini")
   - maxRetries: 3
   - retryDelayMs: 1000
   - temperature: 0.3 (for structured output)
   - qaTemperature: 0.5 (for conversational Q&A)

2. apps/api/src/wiki/services/llm.service.ts
   - Inject OPENAI_CLIENT via @Inject(OPENAI_CLIENT) — do NOT instantiate new OpenAI()
   - Inject LlmConfigService
   - generateStructured<T>(systemPrompt, userPrompt, options?) → T
     * Uses response_format: { type: 'json_object' }
     * Parses response with JSON.parse(), validates shape
     * Retry logic: 3 attempts, exponential backoff (1s, 2s, 4s)
     * Retry on 429, 500, 502, 503, 529, timeout
     * Do NOT retry on 400, 401, 404
   - generateText(systemPrompt, userPrompt, options?) → string
   - Log every call: model, input/output tokens, latency in ms
   - Do NOT log prompt content

Follow every LLM rule in the agent file.
```

### Task 12: Create EmbeddingService

```
Read .claude/agents/04-ai-ml-engineer.md completely before doing anything.

Create apps/api/src/wiki/services/embedding.service.ts

- Inject OPENAI_CLIENT via @Inject(OPENAI_CLIENT) — same instance as LlmService
- embed(text: string) → number[] — single text embedding using text-embedding-3-small (1536 dims)
- embedBatch(texts: string[]) → number[][] — batch embedding in one API call

Handle errors gracefully. Log embedding calls with text length and latency.
```

### Task 13: Create VectorStoreService

```
Read .claude/agents/04-ai-ml-engineer.md completely before doing anything.

Create apps/api/src/wiki/services/vector-store.service.ts

- Inject VECTOR_STORE_CLIENT via @Inject(VECTOR_STORE_CLIENT)
- Inject EmbeddingService

Implement:
- embedSubsystem(wikiId, content: SubsystemWikiContent) → void
  * Chunk content: overview → 1 chunk, howItWorks → 1 chunk, each publicInterface → 1 chunk
  * Embed all chunks via embeddingService.embedBatch()
  * Store with metadata: wikiId, groupId, subsystemName, contentType, text

- search(wikiId, queryVector, topK) → VectorSearchResult[]
  * Filter by wikiId
  * Return top K results by cosine similarity
  * Each result includes: text, subsystemName, contentType, score

Use import type for interface imports.
```

### Task 14: Create RepoIngestionService

```
Read .claude/agents/04-ai-ml-engineer.md completely before doing anything.

Create apps/api/src/wiki/services/repo-ingestion.service.ts

Implement:
- ingest(repoUrl, branch, wikiId) → RepoStructure
  * Clone to /tmp/wiki-{wikiId}/ using: git clone --depth 1 --branch {branch} https://{repoUrl}
  * Walk file tree recursively
  * Apply IGNORED_DIRECTORIES, IGNORED_FILES, IGNORED_EXTENSIONS from constants
  * Read each accepted file: path, content, extension, lineCount, sizeBytes
  * Extract README.md content if present (truncate to ~2000 chars)
  * Build visual tree string (indented directory listing)
  * Return RepoStructure { files, tree, totalFiles, readme }

- cleanup(wikiId) → void
  * rm -rf /tmp/wiki-{wikiId}/

Use child_process.execSync or execa for git clone. Handle clone failures with descriptive errors.
```

### Task 15: Create FileParserService

```
Read .claude/agents/04-ai-ml-engineer.md completely before doing anything.

Create apps/api/src/wiki/services/file-parser.service.ts

Implement:
- parse(files: FileEntry[]) → ParsedFile[]
  * For each file, extract:
    - snippet: first 30-40 lines
    - structures: StructureRef[] using language-specific regex patterns

Language-specific regex patterns to implement:
- TypeScript/JavaScript: function declarations, class declarations, arrow export functions, methods
- Python: def functions, class declarations
- Other languages: basic function/class patterns

Each StructureRef must have accurate lineStart and lineEnd from the regex match positions.
These line numbers will be used in citations — they MUST be accurate. The LLM never generates line numbers.

This is a pure logic service with no external dependencies or decorators beyond @Injectable().
```

---

## Phase 6 — Prompts

### Task 16: Create all prompt templates

```
Read .claude/agents/04-ai-ml-engineer.md completely, paying close attention to the prompt requirements for each agent.

Create all prompts in apps/api/src/wiki/prompts/:

1. grouping-plan.prompt.ts — export const GROUPING_PLAN_SYSTEM_PROMPT
   - Instruct: identify user-facing, feature-driven subsystems
   - Explicitly forbid: "Do NOT group by technical layers like frontend, backend, utils, helpers, middleware"
   - Give examples: GOOD (User Authentication, Todo Management) vs BAD (Frontend, API Routes, Database Layer)
   - Require JSON output matching GroupingPlan schema
   - Require repoSummary (2-3 sentences), confidence score per subsystem

2. file-classifier.prompt.ts — export const FILE_CLASSIFIER_SYSTEM_PROMPT
   - Instruct: classify each file into the provided subsystem groups
   - Emphasize: "Line numbers are provided and accurate. Do NOT generate line numbers. Only provide descriptions."
   - Require JSON output matching FileClassification[]

3. deep-analysis.prompt.ts — export const DEEP_ANALYSIS_SYSTEM_PROMPT
   - Instruct: generate comprehensive wiki content for one subsystem
   - Require: overview (2-3 paragraphs), howItWorks (technical), publicInterfaces, citations with GitHub URLs, dependencies
   - Instruct: "Write for a developer audience. Be specific, reference actual function names and file paths."
   - Require JSON output matching SubsystemWikiContent

4. qa-answer.prompt.ts — export const QA_ANSWER_SYSTEM_PROMPT
   - Instruct: answer using ONLY the provided wiki context
   - If answer isn't in context, say so honestly
   - Require JSON output matching { answer, sources[] }

Each prompt must include the exact JSON schema the LLM should return.
Export each as a const string.
```

---

## Phase 7 — Agents

### Task 17: Create GroupingPlanAgent

```
Read .claude/agents/04-ai-ml-engineer.md completely before doing anything.

Create apps/api/src/wiki/agents/grouping-plan.agent.ts

@Injectable() class that:
- Injects LlmService (not OpenAI directly)
- Has one public method: execute(fileTree, snippets: Map<string, string>, readme: string | null) → GroupingPlan
- Builds the user prompt from file tree + snippets + readme
- Calls llmService.generateStructured<GroupingPlan>() with GROUPING_PLAN_SYSTEM_PROMPT
- Returns the parsed GroupingPlan

Keep the agent thin — it builds the prompt and delegates to LlmService. No retry logic here.
Use import type for interface imports.
```

### Task 18: Create FileClassifierAgent

```
Read .claude/agents/04-ai-ml-engineer.md completely before doing anything.

Create apps/api/src/wiki/agents/file-classifier.agent.ts

@Injectable() class that:
- Injects LlmService
- Has one public method: execute(parsedFiles: ParsedFile[], groupingPlan: GroupingPlan) → FileClassification[]
- Internally batches files into groups of 3-5 (grouped by their assigned subsystem from the plan)
- For each batch: builds user prompt with file contents + pre-parsed structures + grouping plan context
- Calls llmService.generateStructured<FileClassification[]>() per batch
- Merges results into accumulated FileClassification[] across all batches
- Returns the complete classification array

The agent manages batching internally. The orchestrator calls it once and gets back all classifications.
Use import type for interface imports.
```

### Task 19: Create DeepAnalysisAgent

```
Read .claude/agents/04-ai-ml-engineer.md completely before doing anything.

Create apps/api/src/wiki/agents/deep-analysis.agent.ts

@Injectable() class that:
- Injects LlmService
- Has one public method: analyze(group: SubsystemGroup, classifications: FileClassification[], sourceFiles: Map<string, string>, repoContext: { repoSummary, readme, repoUrl, branch }) → SubsystemWikiContent
- Builds user prompt with: subsystem description, file classifications for this group, raw source of key files, repo context
- Constructs GitHub citation URLs: https://github.com/{repoName}/blob/{branch}/{filePath}#L{lineStart}-L{lineEnd}
- Calls llmService.generateStructured<SubsystemWikiContent>() with DEEP_ANALYSIS_SYSTEM_PROMPT
- Returns SubsystemWikiContent

This agent processes ONE subsystem. The orchestrator calls it in parallel for all subsystems.
Use import type for interface imports.
```

---

## Phase 8 — Orchestrator

### Task 20: Create WikiGenerationOrchestrator

```
Read both .claude/agents/03-backend-engineer.md and .claude/agents/04-ai-ml-engineer.md completely before doing anything. The backend engineer file defines the orchestrator's structure and flow. The AI/ML engineer file defines what each agent and service does.

Create apps/api/src/wiki/orchestrator/wiki-generation.orchestrator.ts

@Injectable() class that coordinates the entire pipeline. It receives a Subject<SSEEvent> from the use case and pushes events at each step.

Implement generate(context: AgentContext, sseSubject: Subject<SSEEvent>):

Step 1 — Repo Ingestion:
  - Call repoIngestionService.ingest(repoUrl, branch, wikiId)
  - Emit SSE status: "Cloned repository. Found {n} files..."

Step 2 — File Parsing:
  - Call fileParserService.parse(files)
  - No SSE event (fast, <100ms)

Step 3 — Pass 1 Grouping Plan:
  - Build snippets map from parsed files
  - Call groupingPlanAgent.execute(fileTree, snippets, readme)
  - Emit SSE status: "Identified {n} subsystems: {names}..."

Step 4 — Pass 2 File Classification:
  - Call fileClassifierAgent.execute(parsedFiles, groupingPlan)
  - Emit SSE progress events during classification
  - Emit SSE status: "All {n} files classified into {n} subsystems"

Step 5 — Pass 3 Deep Analysis (PARALLEL):
  - Group classifications by groupId
  - Dispatch all subsystems in parallel using Promise.all + safeDispatch
  - safeDispatch catches individual failures, logs, emits SSE warning, returns null
  - After each agent completes: emit SSE progress, fire-and-forget vectorStoreService.embedSubsystem()
  - Filter out null results

Step 6 — Wiki Assembly:
  - Call wikiPersistenceService.completeWiki(wikiId, data)
  - Call wikiCacheService.cacheWiki(wikiId, repoUrl, branch, fullResponse)
  - Emit SSE complete: { type: "complete", wikiId }

Finally block:
  - Call repoIngestionService.cleanup(wikiId)

Implement safeDispatch<T>(name, fn, sseSubject) → T | null — try/catch wrapper.

Break generate() into smaller private methods for each step. No god methods.
Use import type for all interface imports.
```

---

## Phase 9 — Use Cases

### Task 21: Create GenerateWikiUseCase

```
Read .claude/agents/03-backend-engineer.md completely before doing anything.

Create apps/api/src/wiki/usecases/generate-wiki.usecase.ts

This use case returns an Observable<SSEEvent> — it does NOT use the standard transform() pattern because it streams.

Implement execute(dto: GenerateWikiDto) → Observable<SSEEvent>:

1. Create Subject<SSEEvent>
2. Normalise repoUrl using the utility function (lowercase, strip .git, strip trailing /, strip protocol)
3. Extract repoName from normalised URL
4. Dedup check via WikiPersistenceService.findActiveByRepoAndBranch():
   a. EXISTS + !forceRegenerate → subject.next({ type: "existing", wikiId }), subject.complete(), return
   b. EXISTS + forceRegenerate → WikiPersistenceService.softDelete(oldId), WikiCacheService.invalidate(oldId, url, branch)
   c. NOT EXISTS → continue
5. Create wiki record: WikiPersistenceService.createWiki(url, name, branch)
6. Kick off orchestrator asynchronously (don't block the observable):
   setImmediate or Promise.resolve().then() to run orchestrator.generate(context, subject)
   On success → subject.complete()
   On error → WikiPersistenceService.markFailed(wikiId), subject.next({ type: "error" }), subject.complete()
7. Return subject.asObservable()

Create the normaliseRepoUrl and extractRepoName utility in apps/api/src/wiki/utils/normalise-repo-url.ts

Use import type for interface imports.
```

### Task 22: Create GetWikiUseCase

```
Read .claude/agents/03-backend-engineer.md completely before doing anything.

Create apps/api/src/wiki/usecases/get-wiki.usecase.ts

Extends BaseUseCase<string, WikiResponseDto>.

Implement execute(wikiId: string):
1. WikiCacheService.getWiki(wikiId) — check Redis
2. On HIT → return transform(cachedData)
3. On MISS → WikiPersistenceService.getFullWiki(wikiId)
4. If found → WikiCacheService.cacheWiki(...) to repopulate cache, return transform(wiki)
5. If not found → throw NotFoundException

No transaction — read only.
Transform maps entity to WikiResponseDto.
```

### Task 23: Create ListWikisUseCase

```
Read .claude/agents/03-backend-engineer.md completely before doing anything.

Create apps/api/src/wiki/usecases/list-wikis.usecase.ts

Extends BaseUseCase<ListWikisDto, PaginatedResponseDto<WikiListItemDto>>.

Implement execute(dto: ListWikisDto):
1. WikiPersistenceService.listWikis(dto.page, dto.limit, dto.search)
2. Transform each Wiki entity to WikiListItemDto (lightweight — id, repoName, repoUrl, branch, status, totalSubsystems, totalFiles, repoSummary truncated to 150 chars, completedAt, createdAt)
3. Return with pagination meta using buildPaginationMeta()

No transaction — read only.
```

### Task 24: Create CheckExistingWikiUseCase

```
Read .claude/agents/03-backend-engineer.md completely before doing anything.

Create apps/api/src/wiki/usecases/check-existing-wiki.usecase.ts

Extends BaseUseCase<CheckExistingWikiDto, CheckExistingResponseDto>.

Implement execute(dto: CheckExistingWikiDto):
1. Normalise repoUrl
2. WikiCacheService.findExistingWikiId(repoUrl, branch) — check Redis
3. On HIT → return { exists: true, wikiId }
4. On MISS → WikiPersistenceService.findActiveByRepoAndBranch(repoUrl, branch)
5. If found → return { exists: true, wikiId: wiki.id, createdAt: wiki.createdAt }
6. If not found → return { exists: false }

No transaction — read only.
```

### Task 25: Create AskQuestionUseCase

```
Read both .claude/agents/03-backend-engineer.md and .claude/agents/04-ai-ml-engineer.md completely before doing anything.

Create apps/api/src/wiki/usecases/ask-question.usecase.ts

Extends BaseUseCase<{ wikiId: string; question: string }, QaResponseDto>.

Implement execute({ wikiId, question }):
1. Validate wiki exists and status is COMPLETE (via cache or DB). Throw NotFoundException if not found, throw BadRequestException if not complete.
2. EmbeddingService.embed(question) → queryVector
3. VectorStoreService.search(wikiId, queryVector, topK=5) → relevant chunks
4. Build user prompt with question + chunk texts
5. LlmService.generateStructured<QaResult>(QA_ANSWER_SYSTEM_PROMPT, userPrompt, { temperature: config.qaTemperature })
6. Transform to QaResponseDto

No transaction — read only.
Use import type for interface imports.
```

---

## Phase 10 — Controller

### Task 26: Create WikiController

```
Read .claude/agents/03-backend-engineer.md completely before doing anything.

Create apps/api/src/wiki/controllers/wiki.controller.ts

@ApiTags('wiki')
@Controller('wiki')

Endpoints — zero business logic, just delegate to use cases:

1. @Post('generate') — SSE endpoint
   Returns Observable<MessageEvent> from GenerateWikiUseCase
   Use @Sse() decorator or manually set headers for text/event-stream
   Map SSEEvent objects to MessageEvent format: { data: JSON.stringify(event) }
   Set headers: Cache-Control: no-cache, X-Accel-Buffering: no, Connection: keep-alive

2. @Get() — List wikis
   Takes @Query() ListWikisDto, delegates to ListWikisUseCase

3. @Get('check') — Check existing
   Takes @Query() CheckExistingWikiDto, delegates to CheckExistingWikiUseCase

4. @Get(':id') — Get wiki by ID
   Takes @Param('id') string, delegates to GetWikiUseCase

5. @Post(':id/ask') — Ask question
   Takes @Param('id') + @Body() AskQuestionDto, delegates to AskQuestionUseCase

Add @ApiOperation and @ApiResponse decorators on every endpoint.
IMPORTANT: The 'check' route must be declared BEFORE the ':id' route to avoid route conflicts.
```

---

## Phase 11 — Wire Module

### Task 27: Wire WikiModule and register in AppModule

```
Read .claude/agents/01-project-architect.md completely, paying close attention to Section 2.1 Provider Rules and the module registration example.

Create apps/api/src/wiki/wiki.module.ts

Register in this order:
1. imports: TypeOrmModule.forFeature([Wiki, WikiSubsystem, WikiFileMap])
2. controllers: [WikiController]
3. providers (in this order):
   - Third-party providers: OpenAIProvider, RedisProvider, VectorStoreProvider
   - Config: LlmConfigService
   - Services: LlmService, EmbeddingService, WikiPersistenceService, WikiCacheService, RepoIngestionService, FileParserService, VectorStoreService
   - Agents: GroupingPlanAgent, FileClassifierAgent, DeepAnalysisAgent
   - Orchestrator: WikiGenerationOrchestrator
   - UseCases: GenerateWikiUseCase, GetWikiUseCase, ListWikisUseCase, CheckExistingWikiUseCase, AskQuestionUseCase

Then add WikiModule to AppModule imports.

Verify the app starts without dependency injection errors with "bun run dev --filter=@wiki/api".
```

---

## Phase 12 — Frontend Foundation

### Task 28: Create frontend types, API client, and design system setup

```
Read .claude/agents/05-frontend-engineer.md and .claude/agents/08-ui-design-system.md completely before doing anything. Also read the frontend-design skill at /mnt/skills/public/frontend-design/SKILL.md for creative execution guidance.

Create:

1. apps/web/src/types/wiki.types.ts
   Mirror ALL backend interfaces/DTOs: SSEEvent, WikiListItem, WikiResponse, WikiSubsystem, InterfaceDoc, Citation, CheckExistingResponse, QaResponse, PaginatedResponse<T>
   Copy the exact type definitions from the frontend engineer agent file.

2. apps/web/src/lib/api-client.ts
   Pre-configured fetch wrapper with NEXT_PUBLIC_API_URL base.
   Functions:
   - listWikis(page?, limit?, search?) → PaginatedResponse<WikiListItem>
   - checkExistingWiki(repoUrl, branch) → CheckExistingResponse
   - getWiki(id) → WikiResponse
   - askQuestion(wikiId, question) → QaResponse

3. Configure next.config.ts with API proxy rewrites: /api/* → NEXT_PUBLIC_API_URL/*

4. Set up the design system:
   - Add JetBrains Mono from Google Fonts in app/layout.tsx
   - Configure tailwind.config.ts with the EXACT colour palette, borderRadius overrides (all 0px), and fontFamily from .claude/agents/08-ui-design-system.md
   - Create apps/web/src/styles/globals.css with all CSS variables from the design system
   - Override shadcn/ui defaults: remove all border-radius, remove shadows, apply dark palette
   - The app must look like a dark industrial data terminal — NOT generic SaaS

5. Install dependencies: @tanstack/react-query, react-markdown, date-fns
   Set up React Query provider in the app layout.

The design system is dark-only. Background #1a1a1a, accent #c4652a (burnt orange), JetBrains Mono everywhere, zero border-radius on everything. Read the full spec before writing any CSS.
```

### Task 29: Create hooks

```
Read .claude/agents/05-frontend-engineer.md completely before doing anything.

Create all hooks in apps/web/src/hooks/:

1. use-sse-stream.ts
   - Takes { repoUrl, branch, forceRegenerate? }
   - Returns { status, events[], currentPhase, progress, wikiId, error, start(), cancel() }
   - Opens EventSource/fetch to POST /api/wiki/generate
   - Parses SSE events, updates state
   - Handles: complete → set wikiId, existing → set wikiId, error → set error
   - Cleans up on unmount

2. use-wiki-data.ts
   - React Query hook wrapping getWiki(id)
   - 60s stale time

3. use-wiki-history.ts
   - React Query hook wrapping listWikis(page, limit, search)
   - 30s stale time

Follow every hook rule in the agent file. Use proper TypeScript types.
```

---

## Phase 13 — Frontend Pages & Components

### Task 30: Create home page components

```
Read .claude/agents/05-frontend-engineer.md and .claude/agents/08-ui-design-system.md completely before doing anything. Also read /mnt/skills/public/frontend-design/SKILL.md for creative execution guidance.

Create:

1. apps/web/src/components/repo-input.tsx
   - URL input, branch input (default "main"), force regenerate checkbox
   - Debounced check call (300ms) on URL/branch change via checkExistingWiki()
   - Info banner when existing wiki found (use accent-muted background, accent border)
   - Button text changes: "VIEW EXISTING WIKI" vs "GENERATE WIKI" (uppercase, zero radius, accent background)
   - On submit: navigate to /wiki/processing?repo=...&branch=...&force=... OR /wiki/{existingId}
   - All inputs: dark bg (#1e1e1e), 1px border (#333), no border-radius, mono font, focus border goes accent orange

2. apps/web/src/components/wiki-history-card.tsx
   - Card: bg-card (#242424), 1px border (#333), zero radius, 16px padding
   - Repo name: bold mono, text-primary
   - Branch: badge with accent-muted bg, accent border, uppercase 11px
   - Status indicators using symbols: ● COMPLETE (orange), ◷ PROCESSING (orange pulse), ✗ FAILED (muted red)
   - Subsystem count: stat number style (20px, bold)
   - Timestamp: text-muted, 11px, uppercase label
   - Click: complete → /wiki/{id}, processing → /wiki/processing, failed → retry

3. apps/web/src/components/wiki-history.tsx
   - "RECENT WIKIS" header (12px, uppercase, tracking 0.08em, text-secondary)
   - Search input matching design system input style
   - Responsive grid of WikiHistoryCard (1/2/3 cols)
   - Pagination controls (ghost button style)
   - Empty state: text-muted, mono, centered
   - Uses useWikiHistory hook

4. apps/web/src/app/page.tsx
   - Top: "WIKI GENERATOR" title (14px, 600, uppercase, tracking)
   - RepoInput card below
   - WikiHistory section below that
   - Page background: bg-primary (#1a1a1a)
   - Dense layout — 16-20px padding between sections

Follow the design system EXACTLY. Zero border-radius, mono font everywhere, uppercase labels, symbols not emojis.
```

### Task 31: Create processing page

```
Read .claude/agents/05-frontend-engineer.md and .claude/agents/08-ui-design-system.md completely before doing anything. Also read /mnt/skills/public/frontend-design/SKILL.md for creative execution guidance.

Create:

1. apps/web/src/components/processing-stream.tsx
   - Pipeline phase indicator using symbols:
     [■] complete (accent orange), [▪] active (accent orange with pulse animation), [ ] pending (text-muted)
     Phases: INGESTION → GROUPING → CLASSIFICATION → ANALYSIS → ASSEMBLY
     Labels: 10px, uppercase, tracking 0.12em
   - Progress bar: 4px height, zero radius, accent fill on #333 track, smooth width transition (0.5s ease-out)
   - Current status message: 13px mono, text-primary
   - Scrollable event log styled as terminal output:
     Background: bg-primary (#1a1a1a), border 1px solid #333
     Each line: timestamp (text-muted, 11px) + message (text-primary, 12px)
     Phase labels in the log: text-accent, uppercase
     Auto-scroll to bottom, new lines fade in (opacity 0→1, 0.2s)
     Max-height 400px, overflow-y scroll
   - During analysis phase: show subsystem names with ● complete / ◷ pending indicators
   - Error state with retry button (ghost style, accent border on hover)
   - Uses useSSEStream hook

2. apps/web/src/app/wiki/processing/page.tsx
   - Client component ('use client')
   - Page title: "GENERATING WIKI — {repoName} @ {branch}" (14px, 600, uppercase, tracking)
   - Reads repo, branch, force from search params
   - Mounts ProcessingStream with those params
   - On complete event → router.push(/wiki/${wikiId})
   - On existing event → router.push(/wiki/${wikiId})

The processing page should feel like watching a build pipeline. Dense, terminal-like, information streaming in real-time.
Use the phase-pulse animation from the design system for the active phase indicator.
```

### Task 32: Create wiki viewer page

```
Read .claude/agents/05-frontend-engineer.md and .claude/agents/08-ui-design-system.md completely before doing anything. Also read /mnt/skills/public/frontend-design/SKILL.md for creative execution guidance.

Create:

1. apps/web/src/components/wiki-sidebar.tsx
   - Background: bg-card (#242424), border-right 1px solid #333, width 250px
   - Wiki title: repo name + branch badge (accent-muted bg, accent border)
   - "OVERVIEW" link (12px, uppercase, tracking)
   - Separator: 1px solid #2a2a2a
   - Subsystem names: 12px mono, text-secondary
   - Inactive hover: bg-elevated (#2a2a2a), text-primary
   - Active item: bg-elevated, text-accent, border-left 2px solid accent
   - "Q&A" link at bottom
   - Collapsible on mobile

2. apps/web/src/components/code-citation.tsx
   - File path + line range as clickable link: text-accent, 12px mono
   - Format: "src/auth/auth.service.ts#L14-L45 →"
   - Opens in new tab (target="_blank", rel="noopener noreferrer")
   - Hover: underline

3. apps/web/src/components/wiki-page-content.tsx
   - Renders one subsystem following the design system markdown rules:
     h1: 18px, 600, uppercase, tracking, text-primary, border-bottom 1px solid #333
     h2: 14px, 600, uppercase, tracking, text-secondary
     p: 13px, 400, text-primary, line-height 1.7
     code inline: bg-card, 12px, padding 2px 6px, text-accent
     code blocks: bg-card-inner, border 1px solid #333, 12px mono
     links: text-accent, no underline, hover underline
   - Public interfaces: table with bg-card-inner rows, 1px borders, mono text
   - Citations: list of CodeCitation components
   - Dependencies: links to other subsystem sections (text-accent)
   - Key files: list with mono text-secondary
   - Use react-markdown with custom component overrides matching the design system

4. apps/web/src/components/wiki-viewer.tsx
   - Layout: fixed sidebar (250px) + scrollable content area
   - Content max-width 800px, padding 24px 32px
   - Manages selected subsystem state
   - Overview page shows repo summary when no subsystem selected
   - Background: bg-primary (#1a1a1a)

5. apps/web/src/components/qa-panel.tsx
   - Section label: "ASK A QUESTION" (12px, uppercase, tracking, text-secondary)
   - Input: design system input style (dark bg, border, mono, zero radius)
   - Submit button: "ASK" (primary button style — accent bg, uppercase)
   - Answer display: markdown rendered with design system rules
   - Source citations as CodeCitation components
   - Loading: text-muted "Processing..." with subtle pulse

6. apps/web/src/components/search-bar.tsx
   - Design system input style
   - Client-side filter across subsystem names
   - Highlights matching items in sidebar (text-accent)

7. apps/web/src/app/wiki/[id]/page.tsx
   - Uses useWikiData(id) hook
   - Renders WikiViewer + QaPanel
   - Loading: skeleton with bg-card-inner blocks on bg-primary
   - 404: text-muted centered message
   - Must work as standalone URL (shareable, refreshable)

The wiki viewer should feel like reading developer documentation on a dark terminal — dense, information-rich, zero visual fluff. Follow the design system page layout wireframe exactly.
```

---

## Phase 14 — Integration Testing

### Task 33: End-to-end pipeline test

```
Read both .claude/agents/03-backend-engineer.md and .claude/agents/04-ai-ml-engineer.md for context on expected behaviour.

Test the full pipeline end-to-end:

1. Start the API: bun run dev --filter=@wiki/api
2. POST /api/wiki/generate with { repoUrl: "https://github.com/tastejs/todomvc", branch: "master" }
3. Verify SSE events stream correctly through all phases
4. Verify wiki is saved in PostgreSQL and cached in Redis
5. GET /api/wiki/{id} — verify full wiki data returns
6. GET /api/wiki — verify the wiki appears in the list
7. GET /api/wiki/check?repoUrl=...&branch=master — verify { exists: true }
8. POST /api/wiki/generate with same repo+branch, forceRegenerate: false — verify "existing" SSE event
9. POST /api/wiki/generate with same repo+branch, forceRegenerate: true — verify old wiki soft-deleted, new wiki generated
10. POST /api/wiki/{id}/ask with { question: "How does the todo model work?" } — verify Q&A returns answer with sources

Fix any issues found. Ensure error handling works: test with an invalid repo URL and verify the wiki is marked as failed.
```

### Task 34: Frontend integration test

```
Read .claude/agents/05-frontend-engineer.md for context on expected UI behaviour.

Test the full frontend flow:

1. Start both apps: bun run dev
2. Navigate to http://localhost:3000
3. Verify wiki history loads (empty state if no wikis)
4. Enter a valid repo URL and branch
5. Verify debounced check call works (info banner appears if wiki exists)
6. Click Generate Wiki
7. Verify processing page shows SSE events streaming in real time
8. Verify navigation to /wiki/{id} on completion
9. Verify wiki renders correctly: sidebar, content, citations (GitHub links open in new tab)
10. Test Q&A: ask a question, verify answer displays
11. Navigate back to home, verify the new wiki appears in history
12. Click the wiki card, verify it opens the wiki page
13. Test force regenerate flow

Add loading states, error states, and empty states to every component that doesn't already have them.
```

---

## Phase 15 — Deployment

### Task 35: Deploy API

```
Read .claude/agents/06-devops-engineer.md completely before doing anything.

1. Create apps/api/Dockerfile (multi-stage: bun install → nest build → node dist/main.js)
2. Create apps/api/fly.toml with SSE-compatible configuration (disable response buffering)
3. Provision PostgreSQL and Redis on Fly.io (or Railway)
4. Set all secrets: DATABASE_*, REDIS_*, OPENAI_API_KEY, CORS_ORIGINS
5. Create migration runner script for release command
6. Deploy: fly deploy
7. Verify /health endpoint returns OK
8. Test SSE works through Fly.io proxy (this is the most common failure point)

Follow every deployment rule in the agent file. SSE response buffering MUST be disabled.
```

### Task 36: Deploy frontend

```
Read .claude/agents/06-devops-engineer.md completely before doing anything.

1. Configure Vercel project for apps/web
2. Set environment variable: NEXT_PUBLIC_API_URL = https://your-api.fly.dev
3. Deploy to Vercel
4. Verify the public URL works end-to-end:
   - Home page loads with wiki history
   - Generate a wiki from a public repo
   - SSE streaming works (processing page)
   - Wiki page renders correctly
   - Q&A works
   - GitHub citation links open correctly

This is what the evaluator will see. Test everything as if you're the evaluator clicking for the first time.
```

### Task 37: Create README

```
Read .claude/agents/06-devops-engineer.md completely before doing anything.

Create a root README.md with:

1. Project name and one-line description
2. Live demo URL (the Vercel link)
3. Tech stack (NestJS, Next.js, OpenAI, PostgreSQL, Redis, Turborepo, Bun)
4. Architecture overview — brief description of the 3-pass pipeline (grouping → classification → analysis)
5. Local setup instructions:
   - Clone, bun install
   - Copy .env.example files
   - docker compose up -d (PostgreSQL + Redis)
   - bun run db:migrate
   - bun run dev
6. Key design decisions:
   - Provider pattern for third-party integrations
   - SSE for real-time progress
   - Redis caching with 24h TTL
   - Branch-aware deduplication with soft delete
   - Fire-and-forget vector embedding for Q&A
7. What I'd improve with more time

Keep it concise. The evaluator should be able to understand the project in 2 minutes.
```
