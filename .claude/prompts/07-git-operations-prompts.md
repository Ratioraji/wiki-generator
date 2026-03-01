# Git Operations — Quick Prompts (Wiki Generator)

Reference: `.claude/agents/07-git-operations.md`

---

## ⚠️ Global Rules — All Commits

1. **NEVER stage or commit any Anthropic/Claude configuration files.** This includes `.claude/`, `claude.md`, `CLAUDE.md`, `.claudeignore`, or any Anthropic-related files. If they show up in `git status`, leave them untracked or add them to `.gitignore`. Always review `git diff --staged` before committing to ensure none have slipped in.

2. **NEVER add Anthropic or Claude as a co-author or contributor.** Do not include `Co-authored-by`, `Signed-off-by`, or any other trailer that references Anthropic, Claude, or any AI assistant in commit messages. Commits are authored solely by the developer.

---

## Starting a New Feature

```
Read .claude/agents/07-git-operations.md.

Start a new feature branch for the wiki generation pipeline on the API. Pull latest main first.
```

```
Read .claude/agents/07-git-operations.md.

Start a new branch for adding the wiki, wiki_subsystems, and wiki_file_maps entity migrations.
```

```
Read .claude/agents/07-git-operations.md.

Create a feature branch for the frontend wiki viewer and Q&A panel.
```

```
Read .claude/agents/07-git-operations.md.

Create a chore branch for Fly.io deployment configuration and Dockerfile.
```

---

## Committing Work

```
Read .claude/agents/07-git-operations.md.

Review what's changed, then commit the core services work with properly scoped conventional commits. Split into logical commits — don't bundle everything into one. Services to commit: LlmService, EmbeddingService, WikiPersistenceService, WikiCacheService, RepoIngestionService, FileParserService, VectorStoreService.
```

```
Read .claude/agents/07-git-operations.md.

I've finished the orchestrator and all use cases. The orchestrator coordinates agents, and the use cases handle SSE streaming. Commit in logical order — orchestrator first, then use cases.
```

```
Read .claude/agents/07-git-operations.md.

I've finished the wiki history feature. It touches apps/api (list-wikis usecase + DTO) and apps/web (hook + components). Commit in the correct order for a cross-app change — backend before frontend.
```

```
Read .claude/agents/07-git-operations.md.

Commit the three providers (openai, redis, vector-store) separately from the services that inject them.
```

```
Read .claude/agents/07-git-operations.md.

Amend my last commit — I forgot to add the wiki-response.dto.ts file.
```

---

## Phase-Based Branch Flow

```
Read .claude/agents/07-git-operations.md.

I've completed Phase 1-2 (scaffolding + database foundation). Commit everything on chore/api-project-scaffolding, push, and create a PR against main. Then after merge, start the next branch for Phase 3-4 (interfaces, constants, DTOs, providers).
```

```
Read .claude/agents/07-git-operations.md.

Phase 5 (core services) is done on feat/api-core-services. Push and create a PR. Generate the description from my commits — make sure it lists all 7 services and mentions the provider injection pattern.
```

```
Read .claude/agents/07-git-operations.md.

I just merged feat/api-llm-agents into main. Start the next phase branch feat/api-pipeline-orchestration from updated main for the orchestrator and use cases.
```

---

## Worktrees

```
Read .claude/agents/07-git-operations.md.

I'm mid-feature on the API pipeline (orchestrator + use cases) but want to start the frontend foundation in parallel. Set up a worktree for feat/web-foundation.
```

```
Read .claude/agents/07-git-operations.md.

There's an SSE buffering bug in production. Create a hotfix worktree off main while keeping my current frontend branch untouched.
```

```
Read .claude/agents/07-git-operations.md.

I want to work on deployment config while the API is being tested. Set up a worktree for chore/infra-deployment.
```

```
Read .claude/agents/07-git-operations.md.

List my active worktrees and clean up any that have been merged.
```

---

## Pushing & Pull Requests

```
Read .claude/agents/07-git-operations.md.

Push my current branch and create a PR against main. Generate the PR description from my commits.
```

```
Read .claude/agents/07-git-operations.md.

The API pipeline branch is large (orchestrator + 5 use cases + controller + module wiring). I want to split it into stacked PRs: first the orchestrator, then the use cases, then the controller + wiring. Set up the stacked branches from my current commits.
```

```
Read .claude/agents/07-git-operations.md.

My PR base branch (feat/api-pipeline-orchestration) just merged into main. Rebase my feat/web-foundation branch onto main now.
```

---

## Keeping Up to Date

```
Read .claude/agents/07-git-operations.md.

Rebase my feature branch onto the latest main. Resolve any conflicts.
```

```
Read .claude/agents/07-git-operations.md.

Someone merged a migration fix to main while I'm on my feature branch. Pull it in without a merge commit.
```

---

## Checking State & History

```
Read .claude/agents/07-git-operations.md.

Show me what I've changed vs main — files, commit log, and which areas are touched (api services, agents, frontend, etc.).
```

```
Read .claude/agents/07-git-operations.md.

Check if my commit messages follow the project conventions. Fix any that don't.
```

```
Read .claude/agents/07-git-operations.md.

Show me all commits on this branch that touch the wiki orchestrator or agents.
```

---

## Tagging & Releases

```
Read .claude/agents/07-git-operations.md.

Tag the current main as v1.0.0 — initial release with wiki generation and Q&A. Push the tag.
```

---

## Undo & Recovery

```
Read .claude/agents/07-git-operations.md.

I committed to the wrong branch. Move my last 2 commits to a new feature branch instead.
```

```
Read .claude/agents/07-git-operations.md.

Undo my last commit but keep the changes — I want to split it into smaller commits (separate the service from the provider).
```

```
Read .claude/agents/07-git-operations.md.

I need to apply the SSE header fix from the hotfix branch onto my feature branch without merging.
```

```
Read .claude/agents/07-git-operations.md.

I accidentally committed the .env file. Remove it from the last commit and add it to .gitignore.
```
