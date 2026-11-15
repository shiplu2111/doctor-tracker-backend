# Testing Strategy

Goal: prove the parts evaluators care about (auth, RBAC, query correctness, key UI flows) without over-testing trivia.

## 1. Tools
| Level | Tool | Where |
|---|---|---|
| Unit | Vitest | server services/utils, client hooks/utils |
| API / integration | Vitest + Supertest + `mongodb-memory-server` | server |
| Component | Vitest + React Testing Library | client (key components) |
| E2E | Playwright | client + running server |

## 2. Coverage Targets
| Area | Minimum |
|---|---|
| Server services + middleware | 80% lines |
| Server overall | 70% |
| Client shared components/hooks | 60% |
| E2E | 3 critical flows pass |

Coverage is a floor, not a goal; do not write assertion-free tests to hit numbers.

## 3. What MUST Be Tested

### Auth (server, Supertest)
- Login success sets httpOnly cookies, returns user without hash.
- Wrong password → 401 `INVALID_CREDENTIALS` (same message as unknown email).
- 5 failures → 423 `ACCOUNT_LOCKED`; rate limit → 429.
- Refresh rotates token; reusing an old refresh token → 401 and family revoked.
- Logout revokes token and clears cookies.
- Every protected route → 401 without cookie (table-driven over all routes).

### RBAC matrix (server)
Table-driven: for each `(role, endpoint)` assert expected status.
| Endpoint | admin | viewer | none |
|---|---|---|---|
| GET /doctors | 200 | 200 | 401 |
| POST /doctors | 201 | 403 | 401 |
| PATCH /doctors/:id | 200 | 403 | 401 |
| DELETE /doctors/:id | 204 | 403 | 401 |
| POST /doctors/:id/patients | 201 | 403 | 401 |
| DELETE /patients/:id | 204 | 403 | 401 |
| GET /dashboard/summary | 200 | 200 | 401 |
| /users/* | 403 | 403 | 401 (super_admin 200) |

### Doctors
- Create valid; validation errors per field; duplicate email → 409.
- Delete with patients → 409 `HAS_PATIENTS`; with `reassignTo` → patients moved, counts updated.
- Inactive doctor cannot receive patients (409 `DOCTOR_INACTIVE`).

### Patients
- Add under doctor increments `patientCount`; delete decrements.
- Moving a patient via `doctorId` adjusts both counters.

### Pagination / filters / search (seeded data)
- `meta.total`, `totalPages` correct; `limit > 100` rejected or capped.
- Each filter alone and combined (specialization + status + date range).
- Date range inclusive boundaries.
- Sort allowlist: invalid sort field → 400.
- Search: typo tolerance (`cardilogy`), filter + `q`, fallback when Meilisearch is down (`meta.searchEngine = "mongo-fallback"`).

### Dashboard
- Summary totals match DB counts.
- Patients-per-doctor ordering and limit.
- Time series zero-fills missing days; interval `day|week|month`.

### Query performance
- Script/test runs `explain("executionStats")` on each list query and asserts `IXSCAN` and no `COLLSCAN`.

### Client component tests
- `DataTable` renders loading/empty/error/data states.
- `SearchInput` debounces.
- Doctor form shows field errors (incl. server 409 mapped to email field).
- `<Can>` hides actions for viewer.

### E2E (Playwright)
1. **Auth:** unauthenticated → `/login`; login; logout; protected URL redirect with `next`.
2. **Doctor flow:** create doctor → appears in list → open detail → add patient → delete patient.
3. **List controls:** search + filter + paginate on Doctors and Patients; URL reflects state; refresh preserves it.
Optional: mobile viewport smoke (360 px) of the main pages.

## 4. Conventions
- Test files: `*.test.ts(x)` next to code or in `__tests__/`; E2E in `client/e2e/`.
- Naming: `describe('<unit>') / it('should <behavior> when <condition>')`.
- Each API test starts from a clean in-memory DB; use factories (`makeDoctor()`, `makePatient()`).
- No test depends on another test's state or order.
- Mock only external boundaries (Meilisearch, SMTP, time). Do not mock the DB in API tests.
- Never use real secrets or real personal data.

## 5. Commands
```bash
cd server && npm test            # unit + API
npm run test:coverage
cd client && npm test            # components/hooks
npm run test:e2e                 # Playwright (needs server + seeded data)
```

## 6. CI (recommended)
GitHub Actions: install → lint → typecheck → test (both apps) → build. E2E on main branch or nightly.
