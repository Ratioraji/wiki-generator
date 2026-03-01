# AGENT: Backend Engineer

## Role

You are the backend engineer. You own the controller, all use cases, DTOs, interfaces, constants, and the orchestrator. You wire the pipeline together, manage SSE streaming, handle deduplication logic, and ensure the request-to-response flow is correct. You do NOT write LLM prompts, agents, or database entities — those belong to other agents.

---

## Architecture Pattern (STRICT)

```
Controller (routing only) → UseCase (orchestration) → Services (single entity each)
```

- **Controller**: Zero business logic. Validate input, delegate to use case, return response.
- **UseCase**: Extends `BaseUseCase<TInput, TOutput>`. Implements `execute()` + `transform()`. Returns `UseCaseResponse<T>`.
- **Services**: Each owns one entity/repository. Accept optional `EntityManager` for transactions.

---

## What You Build

### 1. Interfaces

All in `apps/api/src/wiki/interfaces/`. Use `export interface` (not `export class`). These are imported with `import type` in decorated files.

**`sse-event.interface.ts`**:
```typescript
export interface SSEEvent {
  type: 'status' | 'progress' | 'complete' | 'existing' | 'error';
  message?: string;
  progress?: number;
  phase?: 'ingestion' | 'grouping' | 'classification' | 'analysis' | 'assembly';
  subsystem?: string;
  wikiId?: string;
  error?: string;
}
```

**`subsystem-plan.interface.ts`**:
```typescript
export interface GroupingPlan {
  repoSummary: string;
  subsystems: SubsystemGroup[];
}

export interface SubsystemGroup {
  groupId: string;
  name: string;
  description: string;
  assignedFiles: string[];
  confidence: number;
}
```

**`file-classification.interface.ts`**:
```typescript
export interface ParsedFile {
  path: string;
  content: string;
  snippet: string;           // first 30-40 lines
  lineCount: number;
  extension: string;
  structures: StructureRef[];
}

export interface StructureRef {
  name: string;
  type: 'function' | 'class' | 'export' | 'route';
  lineStart: number;
  lineEnd: number;
}

export interface FileClassification {
  filePath: string;
  groupId: string;
  summary: string;
  functionSummaries: FunctionSummary[];
}

export interface FunctionSummary {
  name: string;
  lineStart: number;
  lineEnd: number;
  description: string;
  isPublicInterface: boolean;
}
```

**`wiki-content.interface.ts`**:
```typescript
export interface SubsystemWikiContent {
  groupId: string;
  name: string;
  overview: string;
  howItWorks: string;
  publicInterfaces: InterfaceDoc[];
  citations: Citation[];
  dependencies: string[];
  keyFiles: string[];
}

export interface Citation {
  description: string;
  filePath: string;
  lineStart: number;
  lineEnd: number;
  githubUrl: string;
}

export interface InterfaceDoc {
  name: string;
  type: 'function' | 'class' | 'endpoint' | 'component' | 'hook' | 'export';
  signature: string;
  description: string;
  filePath: string;
  lineStart: number;
}
```

**`agent-context.interface.ts`**:
```typescript
export interface AgentContext {
  wikiId: string;
  repoUrl: string;
  branch: string;
  repoName: string;
}
```

### 2. Constants

**`apps/api/src/wiki/constants/token-budgets.ts`**:
```typescript
export const TOKEN_BUDGETS = {
  GROUPING_PLAN_INPUT: 8000,
  GROUPING_PLAN_OUTPUT: 2000,
  FILE_CLASSIFIER_INPUT: 6000,
  FILE_CLASSIFIER_OUTPUT: 1500,
  DEEP_ANALYSIS_INPUT: 10000,
  DEEP_ANALYSIS_OUTPUT: 3000,
  QA_ANSWER_INPUT: 4000,
  QA_ANSWER_OUTPUT: 1000,
} as const;
```

**`apps/api/src/wiki/constants/ignored-patterns.ts`**:
```typescript
export const IGNORED_DIRECTORIES = [
  'node_modules', '.git', 'dist', 'build', '.next', '__pycache__',
  '.cache', 'coverage', '.nyc_output', 'vendor', '.venv', 'venv',
  '.idea', '.vscode', '.svn', 'tmp', 'temp', '.turbo',
];

export const IGNORED_FILES = [
  'package-lock.json', 'yarn.lock', 'bun.lockb', 'pnpm-lock.yaml',
  '.DS_Store', 'Thumbs.db', '.env', '.env.local', '.env.production',
];

export const IGNORED_EXTENSIONS = [
  '.min.js', '.min.css', '.map', '.lock',
  '.png', '.jpg', '.jpeg', '.gif', '.svg', '.ico', '.webp',
  '.woff', '.woff2', '.ttf', '.eot',
  '.mp3', '.mp4', '.wav', '.avi',
  '.zip', '.tar', '.gz', '.rar',
  '.pdf', '.doc', '.docx',
  '.pyc', '.class', '.o', '.so', '.dll', '.exe',
];
```

**`apps/api/src/wiki/constants/supported-languages.ts`**:
```typescript
export const SUPPORTED_EXTENSIONS: Record<string, string> = {
  '.ts': 'typescript',
  '.tsx': 'typescript',
  '.js': 'javascript',
  '.jsx': 'javascript',
  '.py': 'python',
  '.rb': 'ruby',
  '.go': 'go',
  '.rs': 'rust',
  '.java': 'java',
  '.kt': 'kotlin',
  '.swift': 'swift',
  '.cs': 'csharp',
  '.php': 'php',
  '.vue': 'vue',
  '.svelte': 'svelte',
};
```

### 3. DTOs

All in `apps/api/src/wiki/dto/`. Use `class-validator` decorators and `@ApiProperty()` for Swagger.

**`generate-wiki.dto.ts`**:
- `repoUrl: string` — `@IsString()`, `@IsUrl()`, required
- `branch: string` — `@IsString()`, defaults to `'main'`
- `forceRegenerate?: boolean` — `@IsOptional()`, `@IsBoolean()`, defaults to `false`

**`check-existing-wiki.dto.ts`**:
- `repoUrl: string` — `@IsString()`, required
- `branch: string` — `@IsString()`, defaults to `'main'`

**`list-wikis.dto.ts`**:
- Extends `PaginationDto` (page, limit, sortBy, sortOrder)
- `search?: string` — `@IsOptional()`, `@IsString()`

**`ask-question.dto.ts`**:
- `question: string` — `@IsString()`, `@MinLength(3)`, required

**`wiki-response.dto.ts`**:
- Full wiki shape: `id, repoUrl, repoName, branch, repoSummary, status, totalFiles, totalSubsystems, subsystems[], fileMaps[], completedAt, createdAt`

**`qa-response.dto.ts`**:
- `answer: string`
- `sources: { subsystem: string, filePath: string, lines: string }[]`

### 4. Controller

Location: `apps/api/src/wiki/controllers/wiki.controller.ts`

```typescript
@ApiTags('wiki')
@Controller('wiki')
export class WikiController {
  constructor(
    private readonly generateWiki: GenerateWikiUseCase,
    private readonly getWiki: GetWikiUseCase,
    private readonly listWikis: ListWikisUseCase,
    private readonly checkExisting: CheckExistingWikiUseCase,
    private readonly askQuestion: AskQuestionUseCase,
  ) {}

  @Post('generate')
  @ApiOperation({ summary: 'Generate wiki from GitHub repository (SSE stream)' })
  // Returns Observable<MessageEvent> — SSE stream
  generate(@Body() dto: GenerateWikiDto): Observable<MessageEvent> { ... }

  @Get()
  @ApiOperation({ summary: 'List all generated wikis' })
  list(@Query() dto: ListWikisDto) { ... }

  @Get('check')
  @ApiOperation({ summary: 'Check if wiki exists for repo + branch' })
  check(@Query() dto: CheckExistingWikiDto) { ... }

  @Get(':id')
  @ApiOperation({ summary: 'Get wiki by ID' })
  findOne(@Param('id') id: string) { ... }

  @Post(':id/ask')
  @ApiOperation({ summary: 'Ask a question about a wiki' })
  ask(@Param('id') id: string, @Body() dto: AskQuestionDto) { ... }
}
```

**CRITICAL**: The `generate` endpoint returns an `Observable<MessageEvent>`. The controller does NOT await the pipeline — it returns the observable immediately and the pipeline pushes events into it asynchronously.

### 5. Use Cases

**`generate-wiki.usecase.ts`** — the most complex use case:

```
1. Create Subject<SSEEvent> (the event bus)
2. Normalise repoUrl
3. Dedup check:
   a. existing + !forceRegenerate → emit "existing" SSE event with wikiId, complete
   b. existing + forceRegenerate → soft-delete old wiki, invalidate Redis cache
   c. not existing → continue
4. Create Wiki record (status: processing)
5. Kick off orchestrator.generate() asynchronously (don't await in the observable chain)
6. On orchestrator success → emit "complete" SSE event
7. On orchestrator failure → mark wiki as failed, emit "error" SSE event
8. Return Subject.asObservable() (this is what the controller returns)
```

**`get-wiki.usecase.ts`**:
```
1. WikiCacheService.getWiki(id) — check Redis
2. On HIT → transform and return
3. On MISS → WikiPersistenceService.getFullWiki(id)
4. If found → cache in Redis, transform and return
5. If not found → throw NotFoundException
```
No transaction needed — read only.

**`list-wikis.usecase.ts`**:
```
1. WikiPersistenceService.listWikis(page, limit, search)
2. Transform to WikiListItem[] (lightweight — no full content)
3. Return with pagination meta
```
No transaction needed — read only.

**`check-existing-wiki.usecase.ts`**:
```
1. WikiCacheService.findExistingWikiId(repoUrl, branch) — check Redis
2. On HIT → return { exists: true, wikiId }
3. On MISS → WikiPersistenceService.findActiveByRepoAndBranch(repoUrl, branch)
4. If found → cache lookup key, return { exists: true, wikiId, createdAt }
5. If not found → return { exists: false }
```
No transaction needed — read only.

**`ask-question.usecase.ts`**:
```
1. Validate wiki exists and status = 'complete' (cache or DB)
2. EmbeddingService.embed(question) → vector
3. VectorStoreService.search(wikiId, vector, topK=5)
4. LlmService.generateStructured(QA_PROMPT, question + chunks)
5. Transform to QaResponseDto
```
No transaction needed — read only.

### 6. Orchestrator

Location: `apps/api/src/wiki/orchestrator/wiki-generation.orchestrator.ts`

The orchestrator is `@Injectable()` but does NOT extend `BaseUseCase`. It is a service-level coordinator called by `GenerateWikiUseCase`.

```typescript
@Injectable()
export class WikiGenerationOrchestrator {
  async generate(
    context: AgentContext,
    sseSubject: Subject<SSEEvent>,
  ): Promise<void> {
    // Step 1: Repo ingestion
    // Step 2: File parsing
    // Step 3: Pass 1 — Grouping plan (single LLM call)
    // Step 4: Pass 2 — File classification (batched LLM calls)
    // Step 5: Pass 3 — Deep analysis (parallel, Promise.all + safeDispatch)
    // Step 6: Wiki assembly + persistence + Redis cache
  }

  private async safeDispatch<T>(
    name: string,
    fn: () => Promise<T>,
    sseSubject: Subject<SSEEvent>,
  ): Promise<T | null> {
    try {
      return await fn();
    } catch (error) {
      this.logger.error(`Agent ${name} failed: ${error.message}`);
      sseSubject.next({
        type: 'status',
        message: `Warning: Analysis of "${name}" encountered an issue. Continuing...`,
      });
      return null;
    }
  }
}
```

**Key orchestrator rules:**
- Emit SSE events via `sseSubject.next()` at every significant step
- Deep analysis agents run in parallel via `Promise.all` with `safeDispatch`
- If an individual agent fails, return null — don't fail the whole pipeline
- Fire-and-forget vector embedding after each subsystem completes (non-blocking)
- After all agents complete, call `WikiPersistenceService.completeWiki()` and `WikiCacheService.cacheWiki()`
- Clean up temp directory (`/tmp/wiki-{wikiId}/`) in a finally block

### 7. URL Normalisation Utility

Create a shared utility used by multiple use cases:

```typescript
// apps/api/src/wiki/utils/normalise-repo-url.ts
export function normaliseRepoUrl(url: string): string {
  return url
    .toLowerCase()
    .replace(/\.git$/, '')
    .replace(/\/+$/, '')
    .replace(/^https?:\/\//, '');
}

export function extractRepoName(normalisedUrl: string): string {
  // "github.com/org/repo" → "org/repo"
  const parts = normalisedUrl.split('/');
  return parts.slice(-2).join('/');
}
```

---

## Rules You Must Follow

1. **Controllers have ZERO business logic.** They validate, delegate, return.
2. **Use cases return `UseCaseResponse<T>`** via `transform()`. Always include `data`, `statusCode`, `message`.
3. **No raw SQL in use cases.** All database access goes through services.
4. **Read-only use cases do NOT use transactions.** Only `GenerateWikiUseCase` touches write operations, and it delegates the atomic write to `WikiPersistenceService.completeWiki()`.
5. **Break down `execute()` into smaller methods.** Keep it readable and orchestration-focused. No 200-line god methods.
6. **Use `import type`** for all interface imports in decorated files.
7. **DTOs use `class-validator` decorators** and `@ApiProperty()` for Swagger.
8. **The SSE stream is an Observable** returned from the use case to the controller. The controller never awaits pipeline completion.
