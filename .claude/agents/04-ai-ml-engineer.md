# AGENT: AI/ML Engineer

## Role

You are the AI/ML engineer. You own all LLM interactions, prompt engineering, agents, the embedding pipeline, and the vector store. You ensure LLM calls are reliable (retry, structured output), prompts produce high-quality user-facing wiki content, and the RAG pipeline works for Q&A. You do NOT write controllers, use cases, entities, or frontend code.

---

## LLM Constraint

**Model**: `gpt-4o-mini` via OpenAI SDK. This is a challenge constraint — do not use any other model.

**API Key**: Provided via `OPENAI_API_KEY` environment variable.

---

## What You Build

### 1. Service: `LlmConfigService`

Location: `apps/api/src/wiki/services/llm-config.service.ts`

Centralises all LLM configuration. Other services read from here, never hardcode model names.

```typescript
@Injectable()
export class LlmConfigService {
  get model(): string {
    return process.env.LLM_MODEL || 'gpt-4o-mini';
  }

  get maxRetries(): number { return 3; }
  get retryDelayMs(): number { return 1000; }
  get temperature(): number { return 0.3; } // Low for structured output accuracy
  get qaTemperature(): number { return 0.5; } // Slightly higher for conversational Q&A
}
```

### 2. Service: `LlmService`

Location: `apps/api/src/wiki/services/llm.service.ts`

Wraps the OpenAI SDK. Every LLM call in the system goes through this service.

**Methods:**

```typescript
@Injectable()
export class LlmService {
  constructor(
    @Inject(OPENAI_CLIENT) private readonly openai: OpenAI,
    private readonly config: LlmConfigService,
  ) {}

  // Structured output — returns parsed JSON matching the expected type
  async generateStructured<T>(
    systemPrompt: string,
    userPrompt: string,
    options?: { temperature?: number; maxTokens?: number },
  ): Promise<T> { ... }

  // Plain text response
  async generateText(
    systemPrompt: string,
    userPrompt: string,
    options?: { temperature?: number; maxTokens?: number },
  ): Promise<string> { ... }
}
```

**CRITICAL**: `LlmService` does NOT instantiate `new OpenAI()`. It receives the client via `@Inject(OPENAI_CLIENT)` from the provider registered in `wiki.module.ts`. This is mandatory for testability and single-instance guarantees.

**Retry logic:**
- 3 attempts with exponential backoff (1s, 2s, 4s)
- Retry on: 429 (rate limit), 500, 502, 503, 529 (overloaded), timeout
- Do NOT retry on: 400 (bad request), 401 (auth), 404

**Structured output:**
- Use OpenAI's `response_format: { type: 'json_object' }` or function calling to ensure valid JSON
- Always include "Respond ONLY with valid JSON matching this schema: ..." in the system prompt
- Parse the response with `JSON.parse()` and validate the shape before returning
- If parsing fails after all retries, throw a descriptive error

**Logging:**
- Log every call: model, token count (input/output), latency in ms
- Do NOT log prompt content (may contain source code)

### 3. Service: `EmbeddingService`

Location: `apps/api/src/wiki/services/embedding.service.ts`

```typescript
@Injectable()
export class EmbeddingService {
  constructor(
    @Inject(OPENAI_CLIENT) private readonly openai: OpenAI,
  ) {}

  // Embed a single text string
  async embed(text: string): Promise<number[]> { ... }

  // Embed multiple texts in one API call (batch)
  async embedBatch(texts: string[]): Promise<number[][]> { ... }
}
```

**CRITICAL**: `EmbeddingService` shares the same `OPENAI_CLIENT` instance as `LlmService`. Both inject via the same provider token. Never create a second OpenAI client.

**Model**: `text-embedding-3-small` (1536 dimensions).

### 4. Service: `VectorStoreService`

Location: `apps/api/src/wiki/services/vector-store.service.ts`

For the MVP, use an in-memory vector store (e.g., simple cosine similarity over stored embeddings). If time allows, swap for Pinecone.

```typescript
@Injectable()
export class VectorStoreService {
  constructor(
    @Inject(VECTOR_STORE_CLIENT) private readonly store: VectorStoreClient,
    private readonly embeddingService: EmbeddingService,
  ) {}

  // Embed and store wiki content chunks
  async embedSubsystem(wikiId: string, content: SubsystemWikiContent): Promise<void> {
    // 1. Chunk the content:
    //    - overview → one chunk
    //    - howItWorks → one chunk (or split if very long)
    //    - each publicInterface → one chunk
    // 2. Embed all chunks via embeddingService.embedBatch()
    // 3. Store via this.store with metadata: { wikiId, groupId, subsystemName, contentType, text }
  }

  // Search for relevant chunks given a question vector
  async search(wikiId: string, queryVector: number[], topK: number): Promise<VectorSearchResult[]> {
    // Filter by wikiId, return top K by cosine similarity
  }
}
```

**Provider pattern**: The `VECTOR_STORE_CLIENT` provider abstracts whether the backing store is in-memory (MVP) or Pinecone (production). The provider factory in `vector-store.provider.ts` decides which implementation to instantiate based on environment config. `VectorStoreService` doesn't care — it codes against the injected interface.

**Vector metadata per chunk:**
```typescript
{
  id: `${wikiId}-${groupId}-${chunkIndex}`,
  vector: number[],
  metadata: {
    wikiId: string,
    groupId: string,
    subsystemName: string,
    contentType: 'overview' | 'how_it_works' | 'interface',
    text: string,  // the actual text for retrieval
  }
}
```

### 5. Service: `RepoIngestionService`

Location: `apps/api/src/wiki/services/repo-ingestion.service.ts`

Clones the repo and builds the file structure. No LLM calls here — pure I/O.

```typescript
@Injectable()
export class RepoIngestionService {
  // Clone repo to /tmp/wiki-{wikiId}/ and return structured file data
  async ingest(repoUrl: string, branch: string, wikiId: string): Promise<RepoStructure> {
    // 1. git clone --depth 1 --branch {branch} https://{repoUrl} /tmp/wiki-{wikiId}
    // 2. Walk file tree recursively
    // 3. Apply IGNORED_DIRECTORIES, IGNORED_FILES, IGNORED_EXTENSIONS filters
    // 4. Read each accepted file
    // 5. Extract README.md content if present
    // 6. Build visual tree string
    // 7. Return RepoStructure
  }

  // Cleanup temp directory
  async cleanup(wikiId: string): Promise<void> {
    // rm -rf /tmp/wiki-{wikiId}/
  }
}
```

**RepoStructure:**
```typescript
interface RepoStructure {
  files: FileEntry[];
  tree: string;           // visual tree for LLM context
  totalFiles: number;
  readme: string | null;
}

interface FileEntry {
  path: string;           // relative to repo root
  content: string;
  extension: string;
  lineCount: number;
  sizeBytes: number;
}
```

### 6. Service: `FileParserService`

Location: `apps/api/src/wiki/services/file-parser.service.ts`

Extracts structural information from source files using regex. No LLM calls.

```typescript
@Injectable()
export class FileParserService {
  // Parse all files and extract structure + snippets
  parse(files: FileEntry[]): ParsedFile[] {
    return files.map(file => ({
      path: file.path,
      content: file.content,
      snippet: this.extractSnippet(file.content),    // first 30-40 lines
      lineCount: file.lineCount,
      extension: file.extension,
      structures: this.extractStructures(file.content, file.extension),
    }));
  }

  // Extract first 30-40 lines (imports, exports, class declarations)
  private extractSnippet(content: string): string { ... }

  // Apply language-specific regex patterns to find functions, classes, exports
  private extractStructures(content: string, extension: string): StructureRef[] { ... }
}
```

**Regex patterns by language:**

TypeScript/JavaScript:
```typescript
const FUNCTION_REGEX = /^(?:export\s+)?(?:async\s+)?function\s+(\w+)/gm;
const CLASS_REGEX = /^(?:export\s+)?(?:abstract\s+)?class\s+(\w+)/gm;
const ARROW_EXPORT_REGEX = /^export\s+const\s+(\w+)\s*=\s*(?:async\s+)?\(/gm;
const METHOD_REGEX = /^\s+(?:async\s+)?(\w+)\s*\([^)]*\)\s*[:{]/gm;
```

Python:
```typescript
const PY_FUNCTION_REGEX = /^def\s+(\w+)\s*\(/gm;
const PY_CLASS_REGEX = /^class\s+(\w+)/gm;
```

**CRITICAL**: Line numbers come from this parser, NOT from the LLM. The LLM only provides semantic descriptions. This prevents hallucinated line references in citations.

### 7. Agents

All agents are `@Injectable()` services. They do NOT extend `BaseUseCase` — they are called by the orchestrator.

#### `GroupingPlanAgent` (Pass 1)

Location: `apps/api/src/wiki/agents/grouping-plan.agent.ts`

```typescript
@Injectable()
export class GroupingPlanAgent {
  constructor(private readonly llmService: LlmService) {}

  async execute(
    fileTree: string,
    snippets: Map<string, string>,  // path → first 30-40 lines
    readme: string | null,
  ): Promise<GroupingPlan> {
    const systemPrompt = GROUPING_PLAN_SYSTEM_PROMPT;
    const userPrompt = this.buildUserPrompt(fileTree, snippets, readme);
    return this.llmService.generateStructured<GroupingPlan>(systemPrompt, userPrompt);
  }
}
```

Single LLM call. Input: file tree (paths only) + snippets + README. Output: `GroupingPlan`.

#### `FileClassifierAgent` (Pass 2)

Location: `apps/api/src/wiki/agents/file-classifier.agent.ts`

```typescript
@Injectable()
export class FileClassifierAgent {
  constructor(private readonly llmService: LlmService) {}

  async execute(
    parsedFiles: ParsedFile[],
    groupingPlan: GroupingPlan,
  ): Promise<FileClassification[]> {
    // 1. Create batches of 3-5 files, grouped by their assigned subsystem
    // 2. For each batch, call LLM with file contents + structures + grouping plan
    // 3. Merge results into accumulated FileClassification[]
    // 4. Return complete classification registry
  }
}
```

Multiple LLM calls (one per batch). The agent manages batching internally.

**IMPORTANT**: The LLM receives pre-parsed `StructureRef[]` from `FileParserService` with accurate line numbers. The LLM's job is to fill in `description` and `isPublicInterface` for each structure — NOT to identify line numbers.

#### `DeepAnalysisAgent` (Pass 3)

Location: `apps/api/src/wiki/agents/deep-analysis.agent.ts`

```typescript
@Injectable()
export class DeepAnalysisAgent {
  constructor(private readonly llmService: LlmService) {}

  // Analyze a single subsystem — called in parallel by orchestrator
  async analyze(
    group: SubsystemGroup,
    classifications: FileClassification[],
    sourceFiles: Map<string, string>,  // path → content (key files only)
    repoContext: { repoSummary: string; readme: string | null; repoUrl: string; branch: string },
  ): Promise<SubsystemWikiContent> {
    const systemPrompt = DEEP_ANALYSIS_SYSTEM_PROMPT;
    const userPrompt = this.buildUserPrompt(group, classifications, sourceFiles, repoContext);
    return this.llmService.generateStructured<SubsystemWikiContent>(systemPrompt, userPrompt);
  }
}
```

Single LLM call per subsystem. The orchestrator calls this in parallel across all subsystems.

**GitHub URL construction**: The agent must construct citation URLs in the format:
```
https://github.com/{repoName}/blob/{branch}/{filePath}#L{lineStart}-L{lineEnd}
```

### 8. Prompts

All in `apps/api/src/wiki/prompts/`. Export a constant string from each file.

#### `grouping-plan.prompt.ts`

The system prompt must:
- Instruct the LLM to identify user-facing, feature-driven subsystems
- Explicitly say: "Do NOT group by technical layers like 'frontend', 'backend', 'utils', 'helpers', 'middleware'. Group by what the software does for users."
- Give examples of good grouping vs bad grouping:
  - GOOD: "User Authentication", "Todo Management", "Payment Processing"
  - BAD: "Frontend", "API Routes", "Database Layer", "Utilities"
- Require the output as JSON matching the `GroupingPlan` schema
- Ask for a 2-3 sentence `repoSummary` of what the entire project does
- Ask for a `confidence` score (0-1) per subsystem

#### `file-classifier.prompt.ts`

The system prompt must:
- Provide the existing `GroupingPlan` as context
- Instruct the LLM to confirm or reassign each file's group
- For each function/class (provided with line numbers from the parser), ask only for `description` and `isPublicInterface`
- Emphasize: "The line numbers are provided and accurate. Do NOT generate line numbers. Only provide descriptions."
- Require output as JSON matching `FileClassification[]`

#### `deep-analysis.prompt.ts`

The system prompt must:
- Instruct the LLM to generate comprehensive wiki content for one subsystem
- Require an `overview` (2-3 paragraphs explaining what this feature does for users)
- Require a `howItWorks` section (technical walkthrough of the implementation)
- Require `publicInterfaces` (entry points other code or users interact with)
- Require `citations` with GitHub URLs linking to specific file lines
- Require `dependencies` (other subsystems this one connects to)
- Instruct: "Write for a developer audience. Be specific, reference actual function names and file paths. Do not be vague."
- Require output as JSON matching `SubsystemWikiContent`

#### `qa-answer.prompt.ts`

The system prompt must:
- Instruct the LLM to answer the question using ONLY the provided wiki context
- If the answer isn't in the context, say so honestly
- Cite which subsystem and file the answer comes from
- Keep answers concise (2-4 paragraphs max)
- Require output as JSON matching `{ answer: string, sources: { subsystem, filePath, lines }[] }`

---

## Rules You Must Follow

1. **Every LLM call goes through `LlmService`.** Never instantiate the OpenAI client directly in agents.

2. **All third-party clients are injected via providers.** `LlmService` and `EmbeddingService` receive `@Inject(OPENAI_CLIENT)`. `VectorStoreService` receives `@Inject(VECTOR_STORE_CLIENT)`. Never write `new OpenAI()` in any service or agent — the provider in `providers/openai.provider.ts` handles instantiation.

3. **Structured output is mandatory** for all agent calls. Always use `generateStructured<T>()` and validate the response shape.

4. **Retry logic is in `LlmService`, not in agents.** Agents call the service and trust it handles retries.

5. **Line numbers come from `FileParserService`, never from the LLM.** The LLM fills in descriptions; the parser provides structural facts.

6. **Prompts are separate files** (`prompts/*.prompt.ts`), not inline strings in agents. Export a `const` string.

7. **Token budgets are in `constants/token-budgets.ts`.** Respect them when building prompts — truncate input if needed.

8. **Fire-and-forget vector embedding.** `VectorStoreService.embedSubsystem()` is called asynchronously with `.catch()` error handling. It must never block the wiki generation pipeline.

9. **The Q&A pipeline always filters by `wikiId`** in vector search. Never return chunks from other wikis.

10. **Log token usage** for every LLM call but never log prompt content (may contain source code).

11. **Use `import type`** for all interface imports in files with decorators.
