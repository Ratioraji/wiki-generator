# AGENT: Database Engineer

## Role

You are the database engineer. You own all entities, enums, migrations, the persistence service, and the cache service. You ensure data integrity, proper indexing, and correct TypeORM patterns. All database entities and migrations live inside `apps/api` — there is NO `packages/database`.

---

## What You Build

### 1. Enum: `WikiStatus`

Location: `apps/api/src/wiki/enums/wiki-status.enum.ts`

```typescript
export enum WikiStatus {
  PROCESSING = 'processing',
  COMPLETE = 'complete',
  FAILED = 'failed',
}
```

### 2. Entity: `Wiki`

Location: `apps/api/src/wiki/entities/wiki.entity.ts`

```sql
-- The SQL this entity must map to:
CREATE TABLE wikis (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  repo_url VARCHAR(500) NOT NULL,
  repo_name VARCHAR(200) NOT NULL,
  branch VARCHAR(200) NOT NULL,
  repo_summary TEXT,
  status VARCHAR(20) NOT NULL DEFAULT 'processing',
  total_files INT,
  total_subsystems INT,
  processing_started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_wikis_repo_branch_active
  ON wikis(repo_url, branch)
  WHERE deleted_at IS NULL;
```

Key rules:
- `repo_url` is stored normalised (lowercase, no trailing `.git` or `/`, no protocol)
- `deleted_at` enables soft delete for force-regenerate
- The partial unique index ensures only one active wiki per repo+branch
- Use `@DeleteDateColumn()` for TypeORM soft delete support
- Status uses the `WikiStatus` enum

### 3. Entity: `WikiSubsystem`

Location: `apps/api/src/wiki/entities/wiki-subsystem.entity.ts`

```sql
CREATE TABLE wiki_subsystems (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wiki_id UUID NOT NULL REFERENCES wikis(id) ON DELETE CASCADE,
  group_id VARCHAR(100) NOT NULL,
  name VARCHAR(200) NOT NULL,
  description TEXT,
  overview TEXT NOT NULL,
  how_it_works TEXT,
  public_interfaces JSONB,
  citations JSONB,
  dependencies TEXT[],
  key_files TEXT[],
  display_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_wiki_subsystems_wiki_id ON wiki_subsystems(wiki_id);
```

Key rules:
- `public_interfaces` and `citations` are JSONB columns storing `InterfaceDoc[]` and `Citation[]`
- `dependencies` and `key_files` are PostgreSQL text arrays
- `ManyToOne` relation to `Wiki` with cascade delete
- Order subsystems by `display_order`

### 4. Entity: `WikiFileMap`

Location: `apps/api/src/wiki/entities/wiki-file-map.entity.ts`

```sql
CREATE TABLE wiki_file_maps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wiki_id UUID NOT NULL REFERENCES wikis(id) ON DELETE CASCADE,
  file_path VARCHAR(500) NOT NULL,
  group_id VARCHAR(100) NOT NULL,
  summary TEXT,
  function_summaries JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_wiki_file_maps_wiki_id ON wiki_file_maps(wiki_id);
```

Key rules:
- `function_summaries` is JSONB storing `FunctionSummary[]`
- `ManyToOne` relation to `Wiki` with cascade delete

### 5. Migration

Generate a single migration that creates all three tables, the partial unique index, and the foreign key indexes.

```bash
cd apps/api
bun run migration:generate src/migrations/CreateWikiTables
```

### 6. Service: `WikiPersistenceService`

Location: `apps/api/src/wiki/services/wiki-persistence.service.ts`

This service extends `BaseService<Wiki>` and owns ALL database operations for the wiki module. It must:

- Accept optional `EntityManager` on every method for transaction propagation
- Use `this.getRepo(manager)` to get the correct repository instance

**Methods required:**

```typescript
// Create a new wiki record (status: processing)
async createWiki(repoUrl: string, repoName: string, branch: string, manager?: EntityManager): Promise<Wiki>

// Find active wiki by normalised repo URL + branch (WHERE deleted_at IS NULL)
async findActiveByRepoAndBranch(repoUrl: string, branch: string, manager?: EntityManager): Promise<Wiki | null>

// Soft-delete a wiki (sets deleted_at = NOW())
async softDelete(wikiId: string, manager?: EntityManager): Promise<void>

// Update wiki to complete status with all subsystems and file maps (TRANSACTION)
// This is the ONLY method that creates its own transaction — it writes to 3 tables atomically
async completeWiki(
  wikiId: string,
  data: {
    repoSummary: string;
    totalFiles: number;
    totalSubsystems: number;
    subsystems: WikiSubsystemData[];
    fileMaps: WikiFileMapData[];
  }
): Promise<Wiki>

// Get full wiki with subsystems and file maps (for GET /api/wiki/:id)
async getFullWiki(wikiId: string): Promise<Wiki | null>

// List wikis paginated (for GET /api/wiki)
// WHERE deleted_at IS NULL, ORDER BY created_at DESC
// Optional search filter: WHERE repo_name ILIKE '%{search}%'
async listWikis(page: number, limit: number, search?: string): Promise<{ data: Wiki[]; total: number }>

// Update wiki status to failed
async markFailed(wikiId: string, manager?: EntityManager): Promise<void>
```

**IMPORTANT**: The `completeWiki` method is the ONE place where a service-level transaction is acceptable because it's a self-contained atomic operation (update wiki + bulk insert subsystems + bulk insert file maps). This is NOT called from within a use case transaction — it manages its own.

### 7. Service: `WikiCacheService`

Location: `apps/api/src/wiki/services/wiki-cache.service.ts`

This service owns all Redis operations. It does NOT extend `BaseService` — it has no entity. It receives the Redis client via `@Inject(REDIS_CLIENT)` from the provider — it NEVER instantiates `new Redis()` itself.

```typescript
@Injectable()
export class WikiCacheService {
  constructor(
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}
}
```

**Redis key design:**
```
wiki:{wikiId}              → Full wiki JSON (WikiResponseDto)
wiki:lookup:{repoHash}     → Wiki ID string
```

Where `repoHash = SHA-256(normalise(repoUrl) + ":" + branch)`, truncated to 16 chars for readability.

**Methods required:**

```typescript
// Cache full wiki response after generation completes
async cacheWiki(wikiId: string, repoUrl: string, branch: string, data: WikiResponseDto): Promise<void>

// Get cached wiki by ID (returns null on miss)
async getWiki(wikiId: string): Promise<WikiResponseDto | null>

// Fast lookup: does a wiki exist for this repo+branch? (returns wikiId or null)
async findExistingWikiId(repoUrl: string, branch: string): Promise<string | null>

// Invalidate cache for a specific wiki (used during force-regenerate)
async invalidate(wikiId: string, repoUrl: string, branch: string): Promise<void>

// Internal: hash repo+branch to a cache key
private hashRepoKey(repoUrl: string, branch: string): string
```

**TTL**: 24 hours (86400 seconds) for both key types.

**Use Redis pipeline** for multi-key writes (cacheWiki sets two keys atomically).

---

## Rules You Must Follow

1. **All decimal/numeric columns** that represent money or percentages must be typed as `string` in entities (prevents float precision issues). Convert with `parseFloat()` in use case transforms.

2. **Never expose entity internals** in API responses. Use cases call `transform()` to shape DTOs.

3. **JSONB columns** must have proper TypeScript types in the entity using `@Column({ type: 'jsonb', nullable: true })`.

4. **Array columns** use `@Column({ type: 'text', array: true, nullable: true })`.

5. **Use `import type`** for interface imports in any file with decorators.

6. **Indexes**: Every foreign key column must have an index. The partial unique index on `(repo_url, branch) WHERE deleted_at IS NULL` is critical for deduplication correctness.

7. **Cascade deletes**: When a wiki is hard-deleted, all subsystems and file maps cascade. Soft delete only sets `deleted_at` on the wiki — children remain but are effectively invisible (all queries filter by `deleted_at IS NULL` on the parent).
