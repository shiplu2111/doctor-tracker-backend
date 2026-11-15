# Coding Standards

## 1. General
- TypeScript `strict`. No `any`; use `unknown` + narrowing. Prefer `type` for unions, `interface` for object contracts.
- ESLint + Prettier are the source of truth. Lint must pass with zero warnings.
- Small functions, single responsibility, early returns, no deep nesting (> 3 levels).
- No dead code, no commented-out code, no `console.log` (use pino on the server).
- Comments explain **why**, not what.

## 2. Naming
| Thing | Convention | Example |
|---|---|---|
| Files (server) | `kebab-case.ts`, suffix by role | `doctor.service.ts`, `doctor.routes.ts` |
| Files (React components) | `PascalCase.tsx` | `DoctorTable.tsx` |
| Hooks | `useXxx.ts` | `useDoctors.ts` |
| Variables/functions | `camelCase` | `getDoctorById` |
| Types/interfaces/classes | `PascalCase` | `CreateDoctorInput` |
| Constants | `UPPER_SNAKE_CASE` | `MAX_PAGE_SIZE` |
| Mongo collections | `snake_case` plural | `refresh_tokens` |
| API paths | `kebab-case` plural nouns | `/patients-per-doctor` under `/dashboard` |
| Permissions | `resource:action` | `doctor:create` |
| Env vars | `UPPER_SNAKE_CASE` | `JWT_ACCESS_SECRET` |

## 3. Folder Rules
**Server** — feature modules under `src/modules/<feature>/`:
```
<feature>.routes.ts       # route + middleware wiring only
<feature>.controller.ts   # parse req, call service, shape response
<feature>.service.ts      # business logic, orchestration
<feature>.repository.ts   # the only place that touches Mongoose
<feature>.schema.ts       # Mongoose schema + indexes
<feature>.validation.ts   # zod schemas
<feature>.types.ts
```
Cross-cutting: `src/middlewares/`, `src/config/`, `src/utils/`, `src/jobs/`. A module never imports another module's repository; it calls that module's service.

**Client** — `src/app/` is routing only. Feature code in `src/features/<feature>/{api,hooks,components,types}`. Shared UI in `src/components/ui`. Shared helpers in `src/lib`. A feature may import from `components/` and `lib/`, not from another feature's internals.

## 4. Error Handling
**Server**
- Throw `AppError(code, httpStatus, message, details?)` from services. Never throw raw strings.
- Controllers use an `asyncHandler` wrapper; no try/catch noise in controllers.
- One central error middleware maps `AppError`, zod errors, Mongoose duplicate-key (11000 → `DUPLICATE_EMAIL`), and unknown errors (→ `INTERNAL_ERROR`, no leak).
- Log errors with request ID; never log passwords, tokens, or PII.

**Client**
- API wrapper normalizes errors to `{ code, message, details }`.
- Field errors (`VALIDATION_ERROR`, `DUPLICATE_EMAIL`) map to form fields; other errors show a toast or an error state with Retry.
- Error boundaries at route-segment level.

## 5. API Response Envelope
```json
{ "data": <payload>, "meta": { "page": 1, "limit": 20, "total": 0, "totalPages": 0 } }
{ "error": { "code": "VALIDATION_ERROR", "message": "…", "details": [] } }
```
- 201 on create, 204 on delete/logout, never 200 with an error body.
- Codes and statuses: `docs/API.md`.

## 6. Validation
- zod schema per endpoint for `body`, `query`, `params`. Strip unknown keys. Coerce query numbers.
- Share schemas with the client via `shared/` where possible.
- Allowlist sortable/filterable fields.

## 7. Database
- `.lean()` for reads, explicit projection, `limit` ≤ 100.
- Run `find` and `countDocuments` in parallel.
- Every new query path gets an index; verify with `explain()` (`IXSCAN`).
- No unanchored regex, no `$where`.

## 8. React / Next.js
- Server Components by default; `"use client"` only where needed (interactivity, hooks).
- Data fetching through TanStack Query hooks per feature (`useDoctors`, `useCreateDoctor`).
- Query keys are centralized and include all filters.
- Memoize heavy table rows/cells; keep callbacks stable (`useCallback`); avoid inline object props in hot lists.
- Debounce search 300 ms. Keep filter state in the URL.
- Forms: react-hook-form + zod resolver. Disable submit while pending.
- Every data view: loading (skeleton), empty, error states.
- Accessibility: labeled inputs, focus states, semantic HTML, `aria-live` toasts.

## 9. Git & Commits
Conventional Commits:
```
<type>(<scope>): <summary in imperative mood, ≤ 72 chars>

<optional body: why, not what>
```
Types: `feat`, `fix`, `refactor`, `perf`, `test`, `docs`, `chore`, `style`, `build`, `ci`.
Scopes: `auth`, `doctors`, `patients`, `dashboard`, `search`, `rbac`, `ui`, `db`, `infra`.
Examples: `feat(doctors): add paginated list endpoint`, `fix(auth): revoke token family on refresh reuse`.
- One logical change per commit; reference task ID in body (e.g., `Task: T-021`).
- Branches: `feat/T-021-doctor-list`. Keep `main` deployable.

## 10. Dependencies
Use only the stack in `CLAUDE.md`. New dependency needs a one-line justification in the PR/commit body.

## 11. Security Reminders
Never store tokens in web storage; never log secrets; validate all input; check permissions server-side. See `SECURITY.md`.
