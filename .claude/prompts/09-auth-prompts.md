# Auth Implementation — Claude Code Prompt Sequence

These prompts add GitHub OAuth authentication and user-scoped data to the Wiki Generator. Run these AFTER Phase 2 (database foundation) and BEFORE Phase 3 (module skeleton).

Reference: `.claude/agents/09-auth-engineer.md`

---

## Auth Phase A — User Entity & Migration

### Auth Task 1: Create User entity and update Wiki entity

```
Read .claude/agents/09-auth-engineer.md and .claude/agents/02-database-engineer.md completely before doing anything.

1. Create apps/api/src/auth/entities/user.entity.ts
   - id (UUID, auto-generated)
   - githubId (VARCHAR 50, NOT NULL, UNIQUE)
   - username (VARCHAR 100, NOT NULL)
   - displayName (VARCHAR 200, nullable)
   - email (VARCHAR 300, nullable)
   - avatarUrl (VARCHAR 500, nullable)
   - accessToken (TEXT, nullable) — GitHub OAuth token
   - createdAt (TIMESTAMPTZ, default NOW)
   - updatedAt (TIMESTAMPTZ, default NOW, @UpdateDateColumn)

2. Modify apps/api/src/wiki/entities/wiki.entity.ts
   - Add userId column (UUID, NOT NULL)
   - Add @ManyToOne(() => User, { onDelete: 'CASCADE' }) relation
   - Add @JoinColumn({ name: 'user_id' })

3. Generate a migration that:
   - Creates the users table with unique index on github_id
   - Adds user_id column to wikis table with FK to users(id) ON DELETE CASCADE
   - Creates index on wikis(user_id)
   - Drops old partial unique index idx_wikis_repo_branch_active
   - Creates new: CREATE UNIQUE INDEX idx_wikis_repo_branch_user_active ON wikis(repo_url, branch, user_id) WHERE deleted_at IS NULL

4. Run the migration.

Use import type for interface imports. Follow entity rules from the database engineer agent.
```

---

## Auth Phase B — Auth Module Backend

### Auth Task 2: Create GitHub OAuth and User services

```
Read .claude/agents/09-auth-engineer.md completely before doing anything.

Create:

1. apps/api/src/auth/interfaces/jwt-payload.interface.ts
   - JwtPayload: { sub: string (userId), githubId: string, username: string }

2. apps/api/src/auth/interfaces/github-profile.interface.ts
   - GitHubProfile: { id: string, login: string, name: string | null, email: string | null, avatar_url: string }

3. apps/api/src/auth/dto/auth-response.dto.ts
   - AuthResponseDto: { accessToken: string, user: { id, username, displayName, avatarUrl } }

4. apps/api/src/auth/services/github-oauth.service.ts
   @Injectable() service with:
   - exchangeCode(code: string) → string (access_token)
     * POST https://github.com/login/oauth/access_token with client_id, client_secret, code
     * Headers: Accept: application/json
     * Returns the access_token string
   - getProfile(accessToken: string) → GitHubProfile
     * GET https://api.github.com/user
     * Headers: Authorization: Bearer {accessToken}
   - Use fetch (no SDK needed). Handle errors with descriptive messages.

5. apps/api/src/auth/services/user.service.ts
   @Injectable() service with:
   - upsertFromGitHub(profile: GitHubProfile, accessToken: string) → User
     * Find by github_id, create if not exists, update fields if changed
   - findById(id: string) → User | null

Reads GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET from environment.
Use import type for interface imports.
```

### Auth Task 3: Create AuthService, JWT strategy, guard, and decorator

```
Read .claude/agents/09-auth-engineer.md completely before doing anything.

Install dependencies: @nestjs/passport, passport, passport-jwt, @nestjs/jwt
Install types: @types/passport-jwt

Create:

1. apps/api/src/auth/services/auth.service.ts
   @Injectable() service that:
   - Injects GitHubOAuthService, UserService, JwtService
   - handleGitHubCallback(code: string) → AuthResponseDto
     * Exchange code → access token
     * Fetch GitHub profile
     * Upsert user
     * Sign JWT with payload: { sub: user.id, githubId: user.githubId, username: user.username }
     * Return { accessToken, user: { id, username, displayName, avatarUrl } }
   - validateToken(payload: JwtPayload) → User
     * Find user by payload.sub (userId)
     * Throw UnauthorizedException if not found
   - refreshToken(token: string) → { accessToken: string }

2. apps/api/src/auth/strategies/jwt.strategy.ts
   - Extends PassportStrategy(Strategy)
   - Extracts JWT from: HTTP-only cookie (access_token) first, then Authorization Bearer header
   - secretOrKey from JWT_SECRET env var
   - validate() calls authService.validateToken()

3. apps/api/src/auth/guards/jwt-auth.guard.ts
   - Extends AuthGuard('jwt')
   - handleRequest throws UnauthorizedException on failure

4. apps/api/src/auth/decorators/current-user.decorator.ts
   - createParamDecorator that extracts user from request
   - Supports optional property key: @CurrentUser('id') returns just the ID

Use import type for interface imports.
```

### Auth Task 4: Create AuthController

```
Read .claude/agents/09-auth-engineer.md completely before doing anything.

Create apps/api/src/auth/controllers/auth.controller.ts

@ApiTags('auth')
@Controller('auth')

Endpoints:

1. GET /api/auth/github
   - No guard (public)
   - Builds GitHub OAuth URL with client_id, redirect_uri, scope (read:user user:email)
   - Redirects (302) to https://github.com/login/oauth/authorize?{params}

2. GET /api/auth/github/callback?code=...
   - No guard (public)
   - Calls authService.handleGitHubCallback(code)
   - Sets HTTP-only cookie: access_token, secure in production, sameSite: 'lax', maxAge: 7 days
   - Redirects (302) to FRONTEND_URL env var (default http://localhost:3000)

3. GET /api/auth/me
   - @UseGuards(JwtAuthGuard)
   - Returns current user: { id, username, displayName, avatarUrl }

4. POST /api/auth/logout
   - Clears the access_token cookie
   - Returns { message: 'Logged out' }

5. POST /api/auth/refresh
   - Calls authService.refreshToken()
   - Returns new { accessToken }

IMPORTANT: Auth routes must NOT require JWT. Use @Public() decorator or don't apply the guard on the /github and /github/callback routes.
```

### Auth Task 5: Create AuthModule and register

```
Read .claude/agents/09-auth-engineer.md and .claude/agents/01-project-architect.md completely before doing anything.

1. Create apps/api/src/auth/auth.module.ts
   - imports: TypeOrmModule.forFeature([User]), JwtModule.register({ secret, signOptions }), PassportModule.register({ defaultStrategy: 'jwt' })
   - controllers: [AuthController]
   - providers: [AuthService, GitHubOAuthService, UserService, JwtStrategy]
   - exports: [AuthService, JwtAuthGuard, JwtStrategy]

2. Add AuthModule to AppModule imports (BEFORE WikiModule)

3. Update CORS in main.ts:
   app.enableCors({ origin: process.env.CORS_ORIGINS, credentials: true })

4. Enable cookie parsing:
   Install cookie-parser, add app.use(cookieParser()) in main.ts

5. Add new environment variables to .env.example:
   GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET, GITHUB_CALLBACK_URL, JWT_SECRET, FRONTEND_URL

6. Verify the auth endpoints work:
   - GET /api/auth/github → redirects to GitHub
   - After GitHub auth, callback sets cookie and redirects
   - GET /api/auth/me with cookie → returns user profile
   - GET /api/auth/me without cookie → 401
```

---

## Auth Phase C — Apply Guards to Wiki Endpoints

### Auth Task 6: User-scope all wiki endpoints

```
Read .claude/agents/09-auth-engineer.md and .claude/agents/03-backend-engineer.md completely before doing anything.

Update the wiki module to require authentication and scope all data to the current user:

1. WikiController — add @UseGuards(JwtAuthGuard) at the controller level (applies to all routes)
   - Every endpoint method adds @CurrentUser() user: User parameter
   - Pass user.id to every use case call

2. GenerateWikiUseCase
   - Receives userId in the DTO/input
   - Passes userId to WikiPersistenceService.createWiki()
   - Dedup check uses userId: findActiveByRepoAndBranch(url, branch, userId)

3. GetWikiUseCase
   - Receives userId
   - WikiPersistenceService.getFullWiki(wikiId, userId) — WHERE user_id = ?
   - Return 404 (NOT 403) if wiki doesn't belong to user

4. ListWikisUseCase
   - Receives userId
   - WikiPersistenceService.listWikis(page, limit, search, userId) — WHERE user_id = ?

5. CheckExistingWikiUseCase
   - Receives userId
   - findActiveByRepoAndBranch(url, branch, userId) — per-user dedup

6. AskQuestionUseCase
   - Receives userId
   - Validates wiki belongs to user before processing

7. WikiPersistenceService — update ALL methods:
   - createWiki(repoUrl, repoName, branch, userId, manager?)
   - findActiveByRepoAndBranch(repoUrl, branch, userId, manager?)
   - getFullWiki(wikiId, userId) — add WHERE user_id = ?
   - listWikis(page, limit, search, userId) — add WHERE user_id = ?
   - softDelete and markFailed — optionally verify ownership

8. WikiCacheService — user-scoped keys:
   - Cache keys: wiki:{userId}:{wikiId} and wiki:lookup:{userId}:{repoHash}
   - Update cacheWiki, getWiki, findExistingWikiId, invalidate to include userId

9. Import AuthModule in WikiModule (for JwtAuthGuard and JwtStrategy)

Test: start the API, attempt to hit /api/wiki without a cookie → 401. Login via GitHub, then /api/wiki → returns only your wikis.
```

---

## Auth Phase D — Frontend Auth

### Auth Task 7: Create login page and auth hooks

```
Read .claude/agents/05-frontend-engineer.md, .claude/agents/08-ui-design-system.md, and .claude/agents/09-auth-engineer.md completely before doing anything. Also read /mnt/skills/public/frontend-design/SKILL.md.

Create:

1. apps/web/src/hooks/use-auth.ts
   - Calls GET /api/auth/me on mount (with credentials: 'include')
   - Returns { user, isLoading, isAuthenticated, logout }
   - logout() calls POST /api/auth/logout then redirects to /login

2. apps/web/src/providers/auth-provider.tsx
   - React context wrapping the app
   - Provides useAuth() hook to all children
   - Manages auth state centrally

3. apps/web/src/components/protected-route.tsx
   - If on /login → render children (public)
   - If isLoading → render loading state (dark bg, subtle spinner)
   - If isAuthenticated → render children
   - If !isAuthenticated → redirect to /login

4. apps/web/src/app/login/page.tsx
   - Centered layout on bg-primary (#1a1a1a)
   - "WIKI GENERATOR" title (14px, 600, uppercase, tracking, text-primary)
   - Subtitle: "Generate developer documentation from any public GitHub repository" (13px, text-secondary)
   - Button: "■ CONTINUE WITH GITHUB" (accent bg, white text, uppercase, zero radius, mono font)
   - Button click: window.location.href = `${API_URL}/api/auth/github`
   - Simple, minimal, follows design system exactly
   - No emojis, no icons beyond ■ symbol

5. apps/web/src/components/header.tsx
   - Left: "WIKI GENERATOR" (title style from design system)
   - Right: @{username} (text-secondary, 12px) + avatar (24px, round — the ONE exception to zero radius) + "LOGOUT" (ghost button)
   - Background: bg-card (#242424), border-bottom 1px solid #333
   - Include on all authenticated pages

6. Update apps/web/src/app/layout.tsx
   - Wrap in AuthProvider
   - Wrap content in ProtectedRoute
   - Include Header on authenticated pages (not on /login)

7. Update apps/web/src/lib/api-client.ts
   - Add credentials: 'include' to every fetch call
   - Add global 401 handler: redirect to /login

Follow the design system exactly. Dark bg, mono font, accent button, zero radius on everything except avatar.
```

---

## Auth Phase E — Integration Test

### Auth Task 8: Test the full auth flow

```
Read .claude/agents/09-auth-engineer.md for expected behaviour.

Test the complete authentication flow:

1. Navigate to http://localhost:3000 → should redirect to /login
2. Click "CONTINUE WITH GITHUB" → redirects to GitHub OAuth
3. Authorize the app on GitHub → callback sets cookie, redirects to /
4. Verify / page loads with user info in header (username, avatar)
5. Generate a wiki → verify it's stored with user_id
6. Open a private/incognito window → navigate to / → should see /login
7. Login as the same user → verify wikis from step 5 appear
8. If possible, test with a second GitHub account → verify user A cannot see user B's wikis
9. Click LOGOUT → verify cookie cleared, redirected to /login
10. Try to access /api/wiki directly without cookie → verify 401
11. Try to access /api/wiki/{id} with a valid cookie but another user's wiki ID → verify 404

Fix any issues found. Ensure the auth flow is seamless and the user-scoping is airtight.
```
