/**
 * End-to-end pipeline test for the Wiki Generator API.
 *
 * Prerequisites:
 *   - API running on localhost:3001 (bun run dev)
 *   - PostgreSQL + Redis running (docker compose up -d)
 *   - Valid OPENAI_API_KEY and PINECONE_API_KEY in apps/api/.env
 *
 * Run:
 *   cd apps/api && bun test test/wiki-pipeline.e2e.test.ts
 */

import { describe, test, expect, beforeAll } from 'bun:test';

const API = process.env.API_URL ?? 'http://localhost:3001';
const BASE = `${API}/api/wiki`;

// Small repo for testing — fast to clone and analyze
const TEST_REPO = 'https://github.com/martinmimigames/little-music-player';
const TEST_BRANCH = 'main';

// Generous timeout for LLM-powered generation (10 minutes)
const GENERATION_TIMEOUT = 10 * 60 * 1000;

// ── Types ────────────────────────────────────────────────────────────────────

interface SSEEvent {
  type: 'status' | 'progress' | 'complete' | 'existing' | 'error';
  message?: string;
  progress?: number;
  phase?: string;
  subsystem?: string;
  wikiId?: string;
  error?: string;
}

interface WikiResponse {
  id: string;
  repoUrl: string;
  repoName: string;
  branch: string;
  repoSummary: string | null;
  status: string;
  totalFiles: number | null;
  totalSubsystems: number | null;
  subsystems: Array<{
    id: string;
    groupId: string;
    name: string;
    overview: string;
    howItWorks: string | null;
    publicInterfaces: unknown[] | null;
    citations: unknown[] | null;
    dependencies: string[] | null;
    keyFiles: string[] | null;
  }>;
  fileMaps: Array<{
    id: string;
    filePath: string;
    groupId: string;
    summary: string | null;
    functionSummaries: unknown[] | null;
  }>;
  completedAt: string | null;
  createdAt: string;
}

interface PaginatedData<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

interface ApiEnvelope<T> {
  success: boolean;
  data: T;
  statusCode: number;
  message: string;
  meta?: Record<string, unknown>;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Consume a POST SSE stream and return all parsed events.
 *
 * Uses AbortController to enforce a timeout so the test never hangs.
 * Logs each event as it arrives for visibility during long pipeline runs.
 */
async function consumeSSE(
  url: string,
  body: Record<string, unknown>,
  timeoutMs: number = GENERATION_TIMEOUT,
): Promise<SSEEvent[]> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    if (!res.body) {
      const text = await res.text();
      throw new Error(`SSE request failed (${res.status}): ${text}`);
    }

    const events: SSEEvent[] = [];
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      const parts = buffer.split('\n\n');
      buffer = parts.pop()!;

      for (const part of parts) {
        const trimmed = part.trim();
        if (!trimmed.startsWith('data: ')) continue;
        try {
          const event = JSON.parse(trimmed.slice(6)) as SSEEvent;
          const label = event.phase ?? event.type;
          const detail = event.message ?? event.error ?? '';
          console.log(`  [SSE] ${label}${detail ? ': ' + detail : ''}`);
          events.push(event);
        } catch {
          // skip malformed frames
        }
      }
    }

    // Flush remaining buffer
    if (buffer.trim().startsWith('data: ')) {
      try {
        events.push(JSON.parse(buffer.trim().slice(6)) as SSEEvent);
      } catch {
        // skip
      }
    }

    return events;
  } finally {
    clearTimeout(timer);
  }
}

// ── State shared across sequential tests ─────────────────────────────────────

let generatedWikiId: string;
let secondWikiId: string;

// ─────────────────────────────────────────────────────────────────────────────

describe('Wiki Pipeline E2E', () => {
  beforeAll(async () => {
    const health = await fetch(`${API}/health`).catch(() => null);
    if (!health || !health.ok) {
      throw new Error(
        `API is not reachable at ${API}. Start it with: cd apps/api && bun run dev`,
      );
    }
  });

  // ── 1. Health check ──────────────────────────────────────────────────────

  test('GET /health returns 200', async () => {
    const res = await fetch(`${API}/health`);
    expect(res.status).toBe(200);
  });

  // ── 2. Generate wiki via SSE stream ──────────────────────────────────────
  //
  // Fast path: if a completed wiki already exists, reuse it.
  // Slow path: generate a new one with forceRegenerate to clear stale records.

  test(
    'POST /api/wiki/generate produces a completed wiki',
    async () => {
      // Fast path — reuse existing wiki from a prior successful run
      const checkParams = new URLSearchParams({ repoUrl: TEST_REPO, branch: TEST_BRANCH });
      const checkRes = await fetch(`${BASE}/check?${checkParams}`);
      const checkBody = (await checkRes.json()) as ApiEnvelope<{ exists: boolean; wikiId?: string }>;

      if (checkBody.data.exists && checkBody.data.wikiId) {
        console.log(`  [REUSE] Existing wiki ${checkBody.data.wikiId}`);
        generatedWikiId = checkBody.data.wikiId;
        return;
      }

      // Slow path — generate (forceRegenerate clears any stale failed/processing records)
      console.log('  [GENERATE] No existing wiki found, running full pipeline...');
      const events = await consumeSSE(`${BASE}/generate`, {
        repoUrl: TEST_REPO,
        branch: TEST_BRANCH,
        forceRegenerate: true,
      });

      expect(events.length).toBeGreaterThan(0);

      // Full pipeline should run — verify phase progression
      const phases = events.filter((e) => e.phase).map((e) => e.phase);
      const expectedPhases = ['ingestion', 'grouping', 'classification', 'analysis', 'assembly'];
      for (const phase of expectedPhases) {
        expect(phases).toContain(phase);
      }

      // Must end with a complete event carrying the wiki ID
      const completeEvent = events.find((e) => e.type === 'complete');
      expect(completeEvent).toBeDefined();
      expect(completeEvent!.wikiId).toBeDefined();

      // No error events
      const errorEvents = events.filter((e) => e.type === 'error');
      expect(errorEvents).toHaveLength(0);

      generatedWikiId = completeEvent!.wikiId!;
    },
    GENERATION_TIMEOUT,
  );

  // ── 3. GET /api/wiki/:id — full wiki data ───────────────────────────────

  test('GET /api/wiki/:id returns full wiki with subsystems and fileMaps', async () => {
    expect(generatedWikiId).toBeDefined();

    const res = await fetch(`${BASE}/${generatedWikiId}`);
    expect(res.status).toBe(200);

    const body = (await res.json()) as ApiEnvelope<WikiResponse>;
    expect(body.success).toBe(true);

    const wiki = body.data;
    expect(wiki.id).toBe(generatedWikiId);
    expect(wiki.status).toBe('complete');
    expect(wiki.repoName).toBeTruthy();
    expect(wiki.branch).toBe(TEST_BRANCH);
    expect(wiki.repoSummary).toBeTruthy();

    // Must have subsystems
    expect(wiki.subsystems.length).toBeGreaterThan(0);
    for (const sub of wiki.subsystems) {
      expect(sub.groupId).toBeTruthy();
      expect(sub.name).toBeTruthy();
      expect(sub.overview).toBeTruthy();
    }

    // Must have file maps
    expect(wiki.fileMaps.length).toBeGreaterThan(0);
    for (const fm of wiki.fileMaps) {
      expect(fm.filePath).toBeTruthy();
      expect(fm.groupId).toBeTruthy();
    }

    // Counts should be populated
    expect(wiki.totalSubsystems).toBeGreaterThan(0);
    expect(wiki.totalFiles).toBeGreaterThan(0);
    expect(wiki.completedAt).toBeTruthy();
  });

  // ── 4. GET /api/wiki — wiki list ─────────────────────────────────────────

  test('GET /api/wiki returns a paginated list containing the generated wiki', async () => {
    expect(generatedWikiId).toBeDefined();

    const res = await fetch(`${BASE}?page=1&limit=50`);
    expect(res.status).toBe(200);

    const body = (await res.json()) as ApiEnvelope<PaginatedData<Record<string, unknown>>>;
    expect(body.success).toBe(true);
    expect(Array.isArray(body.data.data)).toBe(true);
    expect(body.data.data.length).toBeGreaterThan(0);
    expect(typeof body.data.total).toBe('number');
    expect(typeof body.data.page).toBe('number');

    // The generated wiki should appear in the list
    const found = body.data.data.find((w) => w.id === generatedWikiId);
    expect(found).toBeDefined();
  });

  // ── 5. GET /api/wiki/check — dedup check ─────────────────────────────────

  test('GET /api/wiki/check returns exists: true for the generated wiki', async () => {
    expect(generatedWikiId).toBeDefined();

    const params = new URLSearchParams({
      repoUrl: TEST_REPO,
      branch: TEST_BRANCH,
    });
    const res = await fetch(`${BASE}/check?${params}`);
    expect(res.status).toBe(200);

    const body = (await res.json()) as ApiEnvelope<{ exists: boolean; wikiId?: string }>;
    expect(body.success).toBe(true);
    expect(body.data.exists).toBe(true);
    expect(body.data.wikiId).toBe(generatedWikiId);
  });

  // ── 6. Duplicate generation without force — returns existing ─────────────

  test(
    'POST /api/wiki/generate with forceRegenerate=false returns existing event',
    async () => {
      expect(generatedWikiId).toBeDefined();

      const events = await consumeSSE(`${BASE}/generate`, {
        repoUrl: TEST_REPO,
        branch: TEST_BRANCH,
        forceRegenerate: false,
      });

      // Should get an "existing" event pointing to the same wiki
      const existingEvent = events.find((e) => e.type === 'existing');
      expect(existingEvent).toBeDefined();
      expect(existingEvent!.wikiId).toBe(generatedWikiId);

      // Should NOT have any phase events (no pipeline ran)
      const phaseEvents = events.filter((e) => e.phase);
      expect(phaseEvents).toHaveLength(0);
    },
    30_000,
  );

  // ── 7. Force regeneration — soft-deletes old, creates new ────────────────

  test(
    'POST /api/wiki/generate with forceRegenerate=true creates a new wiki',
    async () => {
      expect(generatedWikiId).toBeDefined();

      const events = await consumeSSE(`${BASE}/generate`, {
        repoUrl: TEST_REPO,
        branch: TEST_BRANCH,
        forceRegenerate: true,
      });

      // Full pipeline should run again
      const phases = events.filter((e) => e.phase).map((e) => e.phase);
      expect(phases).toContain('ingestion');

      const completeEvent = events.find((e) => e.type === 'complete');
      expect(completeEvent).toBeDefined();
      expect(completeEvent!.wikiId).toBeDefined();

      // New wiki should have a DIFFERENT ID
      secondWikiId = completeEvent!.wikiId!;
      expect(secondWikiId).not.toBe(generatedWikiId);

      // /check should now point to the new wiki
      const params = new URLSearchParams({
        repoUrl: TEST_REPO,
        branch: TEST_BRANCH,
      });
      const checkRes = await fetch(`${BASE}/check?${params}`);
      const checkBody = (await checkRes.json()) as ApiEnvelope<{ exists: boolean; wikiId?: string }>;
      expect(checkBody.data.exists).toBe(true);
      expect(checkBody.data.wikiId).toBe(secondWikiId);

      // Old wiki should return 404 (soft-deleted)
      const oldRes = await fetch(`${BASE}/${generatedWikiId}`);
      expect(oldRes.status).toBe(404);
    },
    GENERATION_TIMEOUT,
  );

  // ── 8. Q&A endpoint ──────────────────────────────────────────────────────

  test(
    'POST /api/wiki/:id/ask returns an answer with sources',
    async () => {
      const wikiId = secondWikiId ?? generatedWikiId;
      expect(wikiId).toBeDefined();

      const res = await fetch(`${BASE}/${wikiId}/ask`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: 'How does the todo model work?' }),
      });
      expect(res.status).toBe(200);

      const body = (await res.json()) as ApiEnvelope<{ answer: string; sources: unknown[] }>;
      expect(body.success).toBe(true);
      expect(body.data.answer).toBeTruthy();
      expect(typeof body.data.answer).toBe('string');
      expect(Array.isArray(body.data.sources)).toBe(true);
    },
    60_000,
  );

  // ── 9. Q&A on non-existent wiki — 404 ───────────────────────────────────

  test('POST /api/wiki/:id/ask with invalid wiki ID returns 404', async () => {
    const res = await fetch(`${BASE}/00000000-0000-0000-0000-000000000000/ask`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question: 'How does it work?' }),
    });
    expect(res.status).toBe(404);
  });

  // ── 10. Invalid repo URL — wiki marked as failed ─────────────────────────

  test(
    'POST /api/wiki/generate with invalid repo URL results in error event',
    async () => {
      const events = await consumeSSE(`${BASE}/generate`, {
        repoUrl: 'https://github.com/this-org-does-not-exist/no-such-repo-xyz-12345',
        branch: 'main',
        forceRegenerate: true,
      });

      // Should get an error event (git clone fails)
      const errorEvent = events.find((e) => e.type === 'error');
      expect(errorEvent).toBeDefined();
      expect(errorEvent!.error).toBeTruthy();
    },
    60_000,
  );

  // ── 11. Validation — missing required fields ─────────────────────────────

  test('POST /api/wiki/generate with missing repoUrl returns 400', async () => {
    const res = await fetch(`${BASE}/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(400);
  });

  // ── 12. Validation — Q&A question too short ──────────────────────────────

  test('POST /api/wiki/:id/ask with question shorter than 3 chars returns 400', async () => {
    const wikiId = secondWikiId ?? generatedWikiId;
    const res = await fetch(`${BASE}/${wikiId}/ask`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question: 'hi' }),
    });
    expect(res.status).toBe(400);
  });

  // ── 13. GET non-existent wiki — 404 ──────────────────────────────────────

  test('GET /api/wiki/:id with non-existent ID returns 404', async () => {
    const res = await fetch(`${BASE}/00000000-0000-0000-0000-000000000000`);
    expect(res.status).toBe(404);
  });

  // ── 14. Check for non-existent repo — exists: false ──────────────────────

  test('GET /api/wiki/check for unknown repo returns exists: false', async () => {
    const params = new URLSearchParams({
      repoUrl: 'https://github.com/nonexistent/repo-that-will-never-exist',
      branch: 'main',
    });
    const res = await fetch(`${BASE}/check?${params}`);
    expect(res.status).toBe(200);

    const body = (await res.json()) as ApiEnvelope<{ exists: boolean }>;
    expect(body.data.exists).toBe(false);
  });
});
