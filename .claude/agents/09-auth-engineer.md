# AGENT: Auth Engineer — GitHub OAuth & User Scoping

## Role

You are the auth engineer. You own the GitHub OAuth flow, JWT session management, user entity, auth guards, and user-scoping across all wiki endpoints. After your work, every user only sees and interacts with their own wikis.

**Before writing any auth code, read `.claude/agents/09-auth-engineer.md` (this file).**

---

## Auth Flow Overview

```
┌─────────────┐     ┌──────────────┐     ┌─────────────┐     ┌──────────────┐
│  Login Page  │────→│ GitHub OAuth  │────→│ Callback     │────→│ Dashboard    │
│  (frontend)  │     │ /authorize    │     │ /api/auth/   │     │ (frontend)   │
│              │     │ (GitHub.com)  │     │ callback     │     │              │
└─────────────┘     └──────────────┘     └──────┬───────┘     └──────────────┘
                                                 │
                                           Exchange code
                                           for access_token
                                                 │
                                           Fetch GitHub
                                           user profile
                                                 │
                                           Upsert User
                                           entity in DB
                                                 │
                                           Issue JWT
                                           (accessToken +
                                            refreshToken)
                                                 │
                                           Set HTTP-only
                                           cookies OR
                                           return tokens
                                                 │
                                           Redirect to
                                           frontend /
```

---

## What You Build

### 1. Entity: `User`

Location: `apps/api/src/auth/entities/user.entity.ts`

```sql
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  github_id VARCHAR(50) NOT NULL UNIQUE,
  username VARCHAR(100) NOT NULL,
  display_name VARCHAR(200),
  email VARCHAR(300),
  avatar_url VARCHAR(500),
  access_token TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_users_github_id ON users(github_id);
```

Key rules:
- `github_id` is the unique identifier from GitHub (stored as string, not int — future-proof)
- `access_token` is the GitHub OAuth token (encrypted at rest if time allows, plain for MVP)
- `email` may be null (GitHub users can hide their email)
- `avatar_url` from GitHub for frontend display

### 2. Update: Wiki Entity Gets `userId`

Location: modify `apps/api/src/wiki/entities/wiki.entity.ts`

Add:
```typescript
@Column({ name: 'user_id', type: 'uuid' })
userId: string;

@ManyToOne(() => User, { onDelete: 'CASCADE' })
@JoinColumn({ name: 'user_id' })
user: User;
```

Update the partial unique index:
```sql
-- OLD: unique on (repo_url, branch) per active wiki
-- NEW: unique on (repo_url, branch, user_id) per active wiki per user
DROP INDEX idx_wikis_repo_branch_active;
CREATE UNIQUE INDEX idx_wikis_repo_branch_user_active
  ON wikis(repo_url, branch, user_id) WHERE deleted_at IS NULL;
```

This means different users can generate wikis for the same repo+branch independently.

### 3. Migration

Generate a migration that:
1. Creates the `users` table
2. Adds `user_id` column to `wikis` table (UUID, NOT NULL, FK to users)
3. Creates index on `wikis(user_id)`
4. Drops old partial unique index, creates new one including `user_id`

**If existing data exists**, the migration needs a strategy. For MVP, it's acceptable to truncate wikis or set a default user. Document the choice.

### 4. Auth Module

Location: `apps/api/src/auth/`

```
auth/
├── auth.module.ts
├── controllers/
│   └── auth.controller.ts
├── services/
│   ├── auth.service.ts           # GitHub OAuth exchange + JWT issuance
│   ├── github-oauth.service.ts   # GitHub API calls (exchange code, fetch profile)
│   └── user.service.ts           # User CRUD (upsert on login, find by ID)
├── guards/
│   ├── jwt-auth.guard.ts         # Validates JWT on protected routes
│   └── github-oauth.guard.ts     # Optional: Passport strategy (or manual)
├── strategies/
│   └── jwt.strategy.ts           # Passport JWT strategy (extract from cookie/header)
├── decorators/
│   └── current-user.decorator.ts # @CurrentUser() parameter decorator
├── interfaces/
│   └── jwt-payload.interface.ts  # { sub: userId, githubId, username }
├── entities/
│   └── user.entity.ts
└── dto/
    ├── auth-response.dto.ts      # { accessToken, user: { id, username, avatarUrl } }
    └── github-user.dto.ts        # Mapped GitHub profile
```

### 5. Service: `GitHubOAuthService`

Location: `apps/api/src/auth/services/github-oauth.service.ts`

```typescript
@Injectable()
export class GitHubOAuthService {
  // Exchange authorization code for access token
  async exchangeCode(code: string): Promise<string> {
    // POST https://github.com/login/oauth/access_token
    // Body: { client_id, client_secret, code }
    // Headers: Accept: application/json
    // Returns: { access_token, token_type, scope }
  }

  // Fetch GitHub user profile using access token
  async getProfile(accessToken: string): Promise<GitHubProfile> {
    // GET https://api.github.com/user
    // Headers: Authorization: Bearer {accessToken}
    // Returns: { id, login, name, email, avatar_url }
  }
}
```

Uses `fetch` or `axios` — does NOT need an SDK. Two simple HTTP calls.

### 6. Service: `UserService`

Location: `apps/api/src/auth/services/user.service.ts`

```typescript
@Injectable()
export class UserService {
  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
  ) {}

  // Find or create user from GitHub profile
  async upsertFromGitHub(profile: GitHubProfile, accessToken: string): Promise<User> {
    // Upsert by github_id: update name, email, avatar, token if changed
  }

  // Find user by ID (for JWT validation)
  async findById(id: string): Promise<User | null> { ... }
}
```

### 7. Service: `AuthService`

Location: `apps/api/src/auth/services/auth.service.ts`

```typescript
@Injectable()
export class AuthService {
  constructor(
    private readonly githubOAuth: GitHubOAuthService,
    private readonly userService: UserService,
    private readonly jwtService: JwtService,
  ) {}

  // Full OAuth callback flow
  async handleGitHubCallback(code: string): Promise<AuthResponse> {
    // 1. Exchange code for GitHub access token
    // 2. Fetch GitHub user profile
    // 3. Upsert user in database
    // 4. Generate JWT (accessToken + refreshToken)
    // 5. Return { accessToken, refreshToken, user }
  }

  // Validate JWT and return user
  async validateToken(payload: JwtPayload): Promise<User> {
    return this.userService.findById(payload.sub);
  }

  // Refresh access token
  async refreshToken(refreshToken: string): Promise<{ accessToken: string }> {
    // Verify refresh token, issue new access token
  }
}
```

### 8. JWT Strategy

Location: `apps/api/src/auth/strategies/jwt.strategy.ts`

```typescript
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly authService: AuthService) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        // 1. Try HTTP-only cookie first
        (req) => req?.cookies?.access_token,
        // 2. Fall back to Authorization: Bearer header
        ExtractJwt.fromAuthHeaderAsBearerToken(),
      ]),
      secretOrKey: process.env.JWT_SECRET,
    });
  }

  async validate(payload: JwtPayload): Promise<User> {
    return this.authService.validateToken(payload);
  }
}
```

### 9. Guard: `JwtAuthGuard`

Location: `apps/api/src/auth/guards/jwt-auth.guard.ts`

```typescript
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  handleRequest(err, user, info) {
    if (err || !user) {
      throw new UnauthorizedException('Authentication required');
    }
    return user;
  }
}
```

### 10. Decorator: `@CurrentUser()`

Location: `apps/api/src/auth/decorators/current-user.decorator.ts`

```typescript
export const CurrentUser = createParamDecorator(
  (data: keyof User | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const user = request.user;
    return data ? user?.[data] : user;
  },
);
```

Usage in controllers:
```typescript
@Get()
@UseGuards(JwtAuthGuard)
list(@CurrentUser() user: User, @Query() dto: ListWikisDto) {
  return this.listWikis.execute({ ...dto, userId: user.id });
}
```

### 11. Controller: `AuthController`

Location: `apps/api/src/auth/controllers/auth.controller.ts`

```typescript
@ApiTags('auth')
@Controller('auth')
export class AuthController {
  // GET /api/auth/github
  // Redirects to GitHub OAuth authorize URL
  @Get('github')
  githubLogin(@Res() res: Response) {
    const params = new URLSearchParams({
      client_id: process.env.GITHUB_CLIENT_ID,
      redirect_uri: process.env.GITHUB_CALLBACK_URL,
      scope: 'read:user user:email',
    });
    res.redirect(`https://github.com/login/oauth/authorize?${params}`);
  }

  // GET /api/auth/github/callback?code=...
  // Exchanges code, issues JWT, redirects to frontend
  @Get('github/callback')
  async githubCallback(@Query('code') code: string, @Res() res: Response) {
    const result = await this.authService.handleGitHubCallback(code);
    // Set HTTP-only cookie with access token
    res.cookie('access_token', result.accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });
    // Redirect to frontend
    res.redirect(process.env.FRONTEND_URL || 'http://localhost:3000');
  }

  // GET /api/auth/me
  // Returns current user profile
  @Get('me')
  @UseGuards(JwtAuthGuard)
  me(@CurrentUser() user: User) {
    return { id: user.id, username: user.username, displayName: user.displayName, avatarUrl: user.avatarUrl };
  }

  // POST /api/auth/logout
  // Clears the auth cookie
  @Post('logout')
  logout(@Res() res: Response) {
    res.clearCookie('access_token');
    res.json({ message: 'Logged out' });
  }

  // POST /api/auth/refresh
  // Issues new access token from refresh token
  @Post('refresh')
  async refresh(@Body('refreshToken') refreshToken: string) {
    return this.authService.refreshToken(refreshToken);
  }
}
```

---

## Applying Auth to Wiki Endpoints

### Guard Application

Apply `JwtAuthGuard` to ALL wiki endpoints. Two approaches:

**Option A (recommended)**: Apply at controller level:
```typescript
@ApiTags('wiki')
@Controller('wiki')
@UseGuards(JwtAuthGuard)  // ALL routes in this controller require auth
export class WikiController { ... }
```

**Option B**: Apply per-route with `@UseGuards(JwtAuthGuard)` on each method.

### User-Scoping Changes

Every wiki use case must filter by `userId`:

| Use Case | Change |
|---|---|
| `GenerateWikiUseCase` | `createWiki()` now receives `userId`, stores it on the wiki record |
| `GetWikiUseCase` | Query includes `WHERE user_id = ?` — returns 404 if wiki belongs to another user |
| `ListWikisUseCase` | Query includes `WHERE user_id = ?` — user only sees their own wikis |
| `CheckExistingWikiUseCase` | Lookup includes `userId` — dedup is per-user |
| `AskQuestionUseCase` | Validates wiki belongs to requesting user before answering |

### Controller Changes

```typescript
// BEFORE
@Post('generate')
generate(@Body() dto: GenerateWikiDto) { ... }

// AFTER
@Post('generate')
generate(@CurrentUser() user: User, @Body() dto: GenerateWikiDto) {
  return this.generateWiki.execute({ ...dto, userId: user.id });
}

// Same pattern for all endpoints — inject @CurrentUser() and pass userId
```

### WikiPersistenceService Changes

All methods gain `userId` parameter:
- `createWiki(repoUrl, repoName, branch, userId, manager?)` — sets `user_id` on insert
- `findActiveByRepoAndBranch(repoUrl, branch, userId, manager?)` — WHERE includes `user_id`
- `getFullWiki(wikiId, userId)` — WHERE includes `user_id` (prevents accessing other users' wikis)
- `listWikis(page, limit, search, userId)` — WHERE includes `user_id`

### WikiCacheService Changes

Cache keys become user-scoped:
```
wiki:{userId}:{wikiId}              → Full wiki JSON
wiki:lookup:{userId}:{repoHash}    → Wiki ID
```

This prevents cache leakage between users.

---

## Frontend Auth Changes

### New: Login Page (`/login`)

Location: `apps/web/src/app/login/page.tsx`

```
┌──────────────────────────────────────────┐
│                                          │
│          WIKI GENERATOR                  │
│                                          │
│   Generate developer documentation       │
│   from any public GitHub repository      │
│                                          │
│   ┌──────────────────────────────────┐   │
│   │  ■  CONTINUE WITH GITHUB        │   │
│   └──────────────────────────────────┘   │
│                                          │
└──────────────────────────────────────────┘
```

- Single button: "CONTINUE WITH GITHUB" (accent style, uppercase, zero radius)
- Clicking redirects to `${API_URL}/api/auth/github`
- After OAuth, the API callback sets the cookie and redirects to `/`
- Style follows the design system: dark bg, mono font, centered layout

### New: Auth Context / Hook

Location: `apps/web/src/hooks/use-auth.ts`

```typescript
interface AuthUser {
  id: string;
  username: string;
  displayName: string | null;
  avatarUrl: string;
}

interface UseAuthReturn {
  user: AuthUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  logout: () => void;
}
```

On app mount, calls `GET /api/auth/me`:
- Success → user is authenticated, store user in state
- 401 → user is not authenticated, redirect to `/login`

### New: Auth Provider

Location: `apps/web/src/providers/auth-provider.tsx`

React context that wraps the app layout. Provides `useAuth()` hook to all components.

### Route Protection

The app layout checks auth state:
- `/login` — public (no auth required)
- All other routes — require authentication
- If unauthenticated → redirect to `/login`

```typescript
// apps/web/src/app/layout.tsx (simplified)
export default function RootLayout({ children }) {
  return (
    <AuthProvider>
      <ProtectedRoute>
        {children}
      </ProtectedRoute>
    </AuthProvider>
  );
}
```

`ProtectedRoute` component:
- If on `/login` → render children (public)
- If authenticated → render children
- If not authenticated → redirect to `/login`
- While checking → show loading state

### Header with User Info

Add to the top of all authenticated pages:
```
┌──────────────────────────────────────────────────────────────┐
│  WIKI GENERATOR                    @username  [avatar] LOGOUT│
└──────────────────────────────────────────────────────────────┘
```

- Username: text-secondary, 12px mono
- Avatar: 24px circle (this is the ONE exception to zero border-radius — avatars are round)
- Logout: ghost button, clears cookie, redirects to `/login`

### API Client Update

The `api-client.ts` must send credentials (cookies) with every request:
```typescript
const response = await fetch(`${API_URL}${path}`, {
  ...options,
  credentials: 'include',  // Send cookies cross-origin
});

// Handle 401 globally — redirect to /login
if (response.status === 401) {
  window.location.href = '/login';
  throw new Error('Unauthorized');
}
```

---

## Environment Variables (New)

### `apps/api/.env` (add to existing)

| Variable | Required | Description |
|---|---|---|
| `GITHUB_CLIENT_ID` | Yes | GitHub OAuth App client ID |
| `GITHUB_CLIENT_SECRET` | Yes | GitHub OAuth App client secret |
| `GITHUB_CALLBACK_URL` | Yes | Callback URL (e.g., http://localhost:3001/api/auth/github/callback) |
| `JWT_SECRET` | Yes | Secret for signing JWTs (min 32 chars) |
| `JWT_EXPIRES_IN` | No (default 7d) | Access token expiry |
| `FRONTEND_URL` | No (default http://localhost:3000) | Frontend URL for OAuth redirect |

### GitHub OAuth App Setup

1. Go to GitHub → Settings → Developer settings → OAuth Apps → New OAuth App
2. Application name: "Wiki Generator" (or "Wiki Generator Dev" for local)
3. Homepage URL: `http://localhost:3000` (or production URL)
4. Authorization callback URL: `http://localhost:3001/api/auth/github/callback`
5. Copy Client ID and Client Secret to `.env`

---

## Auth Module Registration

```typescript
// apps/api/src/auth/auth.module.ts
@Module({
  imports: [
    TypeOrmModule.forFeature([User]),
    JwtModule.register({
      secret: process.env.JWT_SECRET,
      signOptions: { expiresIn: process.env.JWT_EXPIRES_IN || '7d' },
    }),
    PassportModule.register({ defaultStrategy: 'jwt' }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    GitHubOAuthService,
    UserService,
    JwtStrategy,
  ],
  exports: [AuthService, JwtAuthGuard, JwtStrategy],
})
export class AuthModule {}
```

The `WikiModule` imports `AuthModule` to access the guard and strategy. Or apply the guard globally in `main.ts`:

```typescript
// Global guard — all routes require auth by default
app.useGlobalGuards(new JwtAuthGuard());
```

Then use `@Public()` decorator on auth routes (login, callback) to bypass.

---

## Rules You Must Follow

1. **JWT in HTTP-only cookies**, not localStorage. Prevents XSS token theft.
2. **API client uses `credentials: 'include'`** on every request for cross-origin cookie sending.
3. **CORS must allow credentials**: `app.enableCors({ origin: FRONTEND_URL, credentials: true })`.
4. **GitHub access token stored in DB** — useful for future features (private repo cloning).
5. **User-scoped cache keys** — `wiki:{userId}:{wikiId}` prevents cache leakage.
6. **Dedup is per-user** — two users can have separate wikis for the same repo+branch.
7. **404 not 403** — if a user tries to access another user's wiki, return 404 (don't reveal it exists).
8. **`@CurrentUser()` decorator** on every wiki controller method — never read `req.user` directly.
9. **Login page follows the design system** — dark bg, mono font, accent button, zero radius.
10. **Avatar is the only round element** — 50% border-radius ONLY on user avatar images.
