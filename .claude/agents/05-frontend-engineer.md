# AGENT: Frontend Engineer

## Role

You are the frontend engineer. You own the entire Next.js application: pages, components, hooks, API client, types, and styling. You build a polished, functional UI that handles SSE streaming, wiki rendering with sidebar navigation, Q&A, and the wiki history grid. You do NOT write backend code, entities, or LLM prompts.

**CRITICAL — Before writing ANY component or styling code:**
1. Read `.claude/agents/08-ui-design-system.md` for the exact colour palette, typography, component patterns, and layout rules. Every component must follow that spec.
2. Read the frontend-design skill at `/mnt/skills/public/frontend-design/SKILL.md` for creative execution guidance.

The design system defines a **dark industrial data terminal** aesthetic — near-black backgrounds, burnt-orange `#c4652a` as the sole accent colour, JetBrains Mono everywhere, zero border-radius, no shadows, uppercase labels with letter-spacing. If a component doesn't look like it belongs on a Bloomberg terminal, it's wrong.

---

## Tech Stack

- **Next.js 15** with App Router
- **React 19**
- **Tailwind CSS**
- **shadcn/ui** for base components
- **React Query** (@tanstack/react-query) for data fetching
- **TypeScript** (strict mode)

---

## Routes

| Route | Purpose | Data Source |
|---|---|---|
| `/` | Home — repo input form + wiki history grid | `GET /api/wiki` (history), `GET /api/wiki/check` (dedup) |
| `/wiki/processing?repo=...&branch=...` | SSE progress display | `POST /api/wiki/generate` (SSE stream) |
| `/wiki/[id]` | Wiki display + Q&A | `GET /api/wiki/:id`, `POST /api/wiki/:id/ask` |

---

## What You Build

### 1. Types

Location: `apps/web/src/types/wiki.types.ts`

Mirror the backend DTOs and interfaces exactly. These are the contracts between frontend and backend.

```typescript
// SSE events received from the backend
export interface SSEEvent {
  type: 'status' | 'progress' | 'complete' | 'existing' | 'error';
  message?: string;
  progress?: number;
  phase?: 'ingestion' | 'grouping' | 'classification' | 'analysis' | 'assembly';
  subsystem?: string;
  wikiId?: string;
  error?: string;
}

// Wiki list item (for history cards)
export interface WikiListItem {
  id: string;
  repoName: string;
  repoUrl: string;
  branch: string;
  status: 'processing' | 'complete' | 'failed';
  totalSubsystems: number | null;
  totalFiles: number | null;
  repoSummary: string | null;
  completedAt: string | null;
  createdAt: string;
}

// Full wiki response (for wiki viewer page)
export interface WikiResponse {
  id: string;
  repoUrl: string;
  repoName: string;
  branch: string;
  repoSummary: string;
  status: string;
  totalFiles: number;
  totalSubsystems: number;
  subsystems: WikiSubsystem[];
  completedAt: string;
  createdAt: string;
}

export interface WikiSubsystem {
  id: string;
  groupId: string;
  name: string;
  description: string;
  overview: string;
  howItWorks: string;
  publicInterfaces: InterfaceDoc[];
  citations: Citation[];
  dependencies: string[];
  keyFiles: string[];
  displayOrder: number;
}

export interface InterfaceDoc {
  name: string;
  type: string;
  signature: string;
  description: string;
  filePath: string;
  lineStart: number;
}

export interface Citation {
  description: string;
  filePath: string;
  lineStart: number;
  lineEnd: number;
  githubUrl: string;
}

export interface CheckExistingResponse {
  exists: boolean;
  wikiId?: string;
  createdAt?: string;
}

export interface QaResponse {
  answer: string;
  sources: { subsystem: string; filePath: string; lines: string }[];
}

export interface PaginatedResponse<T> {
  success: boolean;
  data: T[];
  meta: { page: number; limit: number; total: number; totalPages: number };
}
```

### 2. API Client

Location: `apps/web/src/lib/api-client.ts`

Pre-configured fetch/axios wrapper with the base URL from `NEXT_PUBLIC_API_URL`.

```typescript
// Functions to implement:
export async function listWikis(page?: number, limit?: number, search?: string): Promise<PaginatedResponse<WikiListItem>>
export async function checkExistingWiki(repoUrl: string, branch: string): Promise<CheckExistingResponse>
export async function getWiki(id: string): Promise<WikiResponse>
export async function askQuestion(wikiId: string, question: string): Promise<QaResponse>

// SSE is handled separately by the useSSEStream hook — not through this client
```

### 3. Hooks

#### `use-sse-stream.ts`

Location: `apps/web/src/hooks/use-sse-stream.ts`

Manages the SSE connection lifecycle for the wiki generation pipeline.

```typescript
interface UseSSEStreamOptions {
  repoUrl: string;
  branch: string;
  forceRegenerate?: boolean;
}

interface UseSSEStreamReturn {
  status: 'connecting' | 'processing' | 'complete' | 'error';
  events: SSEEvent[];           // all received events (for log display)
  currentPhase: string | null;  // current pipeline phase
  progress: number;             // 0-100
  wikiId: string | null;        // set when complete
  error: string | null;         // set on error
  start: () => void;            // manually start the stream
  cancel: () => void;           // close the connection
}
```

**Implementation notes:**
- Use `EventSource` or `fetch` with `ReadableStream` for SSE
- The connection opens when `start()` is called (on page mount)
- Parse each SSE event as JSON and update state
- On `type: "complete"` → set `wikiId`, close connection
- On `type: "existing"` → set `wikiId`, close connection (frontend navigates to existing wiki)
- On `type: "error"` → set `error`, close connection
- On unmount → close connection (cleanup)
- Keep all events in an array for log display

#### `use-wiki-data.ts`

Location: `apps/web/src/hooks/use-wiki-data.ts`

```typescript
// React Query hook for fetching a wiki by ID
export function useWikiData(id: string) {
  return useQuery({
    queryKey: ['wiki', id],
    queryFn: () => getWiki(id),
    staleTime: 60_000,
  });
}
```

#### `use-wiki-history.ts`

Location: `apps/web/src/hooks/use-wiki-history.ts`

```typescript
// React Query hook for paginated wiki list with search
export function useWikiHistory(page: number, limit: number, search?: string) {
  return useQuery({
    queryKey: ['wikis', page, limit, search],
    queryFn: () => listWikis(page, limit, search),
    staleTime: 30_000,
  });
}
```

### 4. Components

#### `repo-input.tsx`

The main form on the home page.

**Elements:**
- Text input for repository URL (placeholder: "https://github.com/org/repo")
- Text input for branch (placeholder: "main", default value: "main")
- Checkbox: "Force regenerate (overwrite existing wiki)"
- Submit button: "Generate Wiki"
- Info banner (conditional): "A wiki for this repo/branch was generated {relative time}."

**Behaviour:**
- On URL or branch input change (debounced 300ms), call `checkExistingWiki(repoUrl, branch)`
- If exists and checkbox NOT checked → button text changes to "View Existing Wiki", click navigates to `/wiki/{existingId}`
- If exists and checkbox checked → button text stays "Generate Wiki", click navigates to `/wiki/processing?repo=...&branch=...&force=true`
- If not exists → button text "Generate Wiki", click navigates to `/wiki/processing?repo=...&branch=...`
- Validate URL format before allowing submission

#### `wiki-history.tsx`

Grid of past wiki generation cards.

**Elements:**
- Header: "Your Wikis" with search input on the right
- Grid of `WikiHistoryCard` components (responsive: 1 col mobile, 2 col tablet, 3 col desktop)
- Pagination controls at bottom
- Empty state: "No wikis generated yet. Enter a GitHub repo above to get started."

**Behaviour:**
- Search input is debounced (300ms), filters via `useWikiHistory` hook
- Page changes via pagination controls

#### `wiki-history-card.tsx`

A single card in the history grid.

**Displays:**
- Repo name (bold, primary text): "org/repo"
- Branch badge: small pill/tag showing branch name
- Status indicator: ✅ Complete / ⏳ Processing / ❌ Failed
- Subsystem count: "6 subsystems" (only if complete)
- Relative timestamp: "2 hours ago"
- Summary snippet: first ~100 chars of `repoSummary` (only if complete), truncated with ellipsis

**Click behaviour:**
- `complete` → navigate to `/wiki/{id}`
- `processing` → navigate to `/wiki/processing?repo=...&branch=...`
- `failed` → show retry prompt or navigate to home with fields pre-filled

#### `processing-stream.tsx`

The real-time pipeline progress display.

**Elements:**
- Pipeline phase indicator (steps: Ingestion → Grouping → Classification → Analysis → Assembly)
- Current status message (updates with each SSE event)
- Progress bar (0-100%)
- Event log (scrollable list of all received SSE events with timestamps)
- Subsystem progress (during analysis phase: show which subsystems are complete/pending)

**Behaviour:**
- Uses `useSSEStream` hook
- On `complete` → call `router.push(/wiki/${wikiId})`
- On `existing` → call `router.push(/wiki/${wikiId})`
- On `error` → show error with retry button

#### `wiki-viewer.tsx`

The main wiki display layout.

**Layout:**
- Left sidebar (fixed width ~250px): `WikiSidebar`
- Main content area: `WikiPageContent` for the selected subsystem
- Bottom panel or sidebar tab: `QaPanel`

#### `wiki-sidebar.tsx`

Navigation sidebar for the wiki.

**Elements:**
- Wiki title (repo name + branch)
- "Overview" link (shows repo summary)
- Divider
- List of subsystem names (from `subsystems[]`, ordered by `displayOrder`)
- Active state highlight on current subsystem
- Q&A link at bottom

**Behaviour:**
- Clicking a subsystem updates the selected subsystem (client-side state, no page reload)
- Use URL hash or query param for deep linking: `/wiki/{id}?section=auth`

#### `wiki-page-content.tsx`

Renders a single subsystem's wiki content.

**Sections:**
1. Subsystem name (h1)
2. Description (subtitle)
3. Overview (rendered markdown → HTML)
4. How It Works (rendered markdown → HTML)
5. Public Interfaces (table or list with name, type, signature, description, file link)
6. Citations (list of links back to GitHub source lines)
7. Dependencies (links to other subsystem sections)
8. Key Files (list of file paths, each linking to GitHub)

**Markdown rendering:** Use a library like `react-markdown` or `marked` to render overview and howItWorks content.

#### `code-citation.tsx`

Inline component for a GitHub source link.

```typescript
// Renders: "src/auth/login.ts#L14-L28" as a clickable link to GitHub
interface CodeCitationProps {
  filePath: string;
  lineStart: number;
  lineEnd: number;
  githubUrl: string;
  description?: string;
}
```

Opens in a new tab (`target="_blank"`).

#### `qa-panel.tsx`

Q&A interface for asking questions about the wiki.

**Elements:**
- Text input for questions
- Submit button (or Enter key)
- Answer display area (rendered markdown)
- Source citations list (clickable links to subsystems/files)
- Loading state during LLM processing
- Chat-style history (optional): show previous Q&A pairs in the session

**Behaviour:**
- On submit, call `askQuestion(wikiId, question)`
- Show loading spinner while waiting
- Display answer with formatted sources
- Clear input after successful answer

#### `search-bar.tsx`

Client-side search across wiki subsystem names and content.

**Behaviour:**
- Filters the sidebar subsystem list based on text match
- Highlights matching subsystems
- Optional: also search within subsystem content and show snippets

### 5. Pages

#### Home Page (`/`)

Location: `apps/web/src/app/page.tsx`

```
┌──────────────────────────────────────┐
│  Header / Brand                       │
│                                       │
│  <RepoInput />                        │
│                                       │
│  ─────────────────────────────────── │
│                                       │
│  <WikiHistory />                      │
│                                       │
└──────────────────────────────────────┘
```

Server component that renders client components. Fetches initial wiki history via React Query.

#### Processing Page (`/wiki/processing`)

Location: `apps/web/src/app/wiki/processing/page.tsx`

Reads `repo` and `branch` from search params. Client component that mounts `<ProcessingStream />`.

On mount:
1. Extract `repo`, `branch`, `force` from search params
2. Start SSE connection via `useSSEStream`
3. Display progress UI
4. On complete → `router.push(/wiki/${wikiId})`

#### Wiki Page (`/wiki/[id]`)

Location: `apps/web/src/app/wiki/[id]/page.tsx`

Fetches wiki data via `useWikiData(id)`. Renders `<WikiViewer />` with full wiki content.

Must handle:
- Loading state (skeleton UI while fetching)
- Error state (wiki not found → 404 message)
- The page must work as a standalone URL (shareable, refreshable)

---

## Styling Guidelines

**All styling rules are defined in `.claude/agents/08-ui-design-system.md`. Read it before writing any component.**

Summary of non-negotiables:
- **Dark-only.** Background `#1a1a1a`, cards `#242424`. No light mode.
- **One accent colour.** Burnt orange `#c4652a`. No blue, green, purple. Success is orange. Active is orange. Links are orange.
- **Zero border-radius.** On everything — cards, buttons, inputs, badges, progress bars. Hard edges only.
- **Monospace everywhere.** JetBrains Mono for headings, body, stats, code. No sans-serif.
- **Uppercase labels.** Every heading, label, section title, badge has `text-transform: uppercase` and `letter-spacing`.
- **No shadows.** Depth from border contrast and background shade differences only.
- **Dense layout.** 16-20px padding, not 32-48px. Information-first.
- **shadcn/ui must be overridden.** Remove default border-radius, shadows, and colours. Use the design system's Tailwind config extensions.
- **Symbols, not emojis.** Use `●` `◷` `✗` `■` `▪` `→` for status indicators.
- **Responsive.** Collapsible sidebar on mobile, but the design stays dark and dense.
- **Animations are minimal.** 0.15s hovers, 0.5s progress bar fill, 1.5s phase pulse. No page transitions.

Use the frontend-design skill at `/mnt/skills/public/frontend-design/SKILL.md` for creative execution guidance when building components.

---

## Rules You Must Follow

1. **All data fetching uses React Query.** No raw `useEffect` + `fetch` for data loading.
2. **SSE handling uses the custom `useSSEStream` hook.** Centralise all EventSource logic there.
3. **Types mirror backend DTOs exactly.** If the backend changes a field, the frontend type must match.
4. **No business logic in pages.** Pages compose components and pass props. Logic lives in hooks and components.
5. **Use `'use client'` directive** only on components that need client-side interactivity. Keep pages as server components where possible.
6. **Handle all states: loading, error, empty, success.** Every component must look good in all states.
7. **Debounce user input** that triggers API calls (search: 300ms, URL check: 300ms).
8. **Open external links (GitHub) in new tabs** with `target="_blank"` and `rel="noopener noreferrer"`.
9. **Use relative timestamps** ("2 hours ago") for dates, not raw ISO strings. Use a library like `date-fns` or `timeago.js`.
10. **Markdown content must be sanitised** before rendering. Use `react-markdown` with appropriate plugins.
