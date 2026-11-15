# Authentication

## 1. Strategy
Email + password login. Short-lived JWT access token and rotating refresh token, both delivered as **httpOnly, Secure, SameSite cookies**. No tokens in localStorage.

| Token | Lifetime | Cookie | Path |
|---|---|---|---|
| Access | 15 min | `dt_access` | `/` |
| Refresh | 7 days | `dt_refresh` | `/api/v1/auth` |

## 2. Endpoints
### POST /api/v1/auth/login
Body: `{ email, password }` → sets cookies, returns `{ data: { user } }`.
Errors: 400 validation, 401 invalid credentials (generic message), 423 locked, 429 rate limited.

### POST /api/v1/auth/refresh
Rotates refresh token; old token invalidated. Reuse of a revoked token revokes the whole token family.

### POST /api/v1/auth/logout
Revokes current refresh token, clears cookies.

### GET /api/v1/auth/me
Returns current user `{ id, name, email, role, permissions }`.

## 3. Password Handling
- Hash with argon2id (or bcrypt cost ≥ 12).
- Policy: min 10 chars, upper/lower/number; reject common passwords.
- Never log or return hashes.

## 4. Brute-Force Protection
- Rate limit: 5 login attempts / 15 min per IP + email.
- Account lock for 15 min after 5 consecutive failures.
- Generic error messages (no user enumeration).

## 5. Route Protection
**Server:** `authenticate` middleware verifies access token on every `/api/v1/*` route except `/auth/login`, `/auth/refresh`, `/health`. Then `authorize(permission)` (see `rbac.md`).

**Client:** `middleware.ts` checks for the session cookie and redirects unauthenticated users to `/login?next=<path>`. Authoritative check is always the API (401 → client clears state and redirects).

## 6. CSRF
Cookies are `SameSite=Lax`; state-changing requests additionally require a custom header (`X-Requested-With`) or double-submit CSRF token. CORS allows only the client origin with credentials.

## 7. Session Flow
1. Login → cookies set.
2. API returns 401 `TOKEN_EXPIRED` → client calls `/auth/refresh` once → retries original request.
3. Refresh fails → redirect to login.

## 8. Initial Admin
Seeded via `npm run seed:admin` using `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` from env. No public registration.

## 9. Environment Variables
`JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `ACCESS_TTL`, `REFRESH_TTL`, `COOKIE_DOMAIN`, `CLIENT_ORIGIN`.

## 10. Testing Checklist
- Unauthenticated request to each route → 401.
- Expired token → refresh works.
- Reused refresh token → family revoked.
- Viewer cannot call mutating endpoints → 403.
