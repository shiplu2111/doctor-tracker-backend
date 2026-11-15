# System Architecture

## 1. Overview
Three-tier architecture with a dedicated search service.

```
┌──────────────┐   HTTPS/JSON   ┌────────────────────┐    ┌───────────────┐
│ Next.js App  │ ─────────────► │ Express REST API   │ ─► │ MongoDB       │
│ (client)     │ ◄───────────── │ (standalone server)│    └───────────────┘
└──────────────┘  httpOnly      │                    │    ┌───────────────┐
                  cookies       │                    │ ─► │ Meilisearch   │
                                └────────────────────┘    └───────────────┘
```

## 2. Components
| Component | Responsibility |
|---|---|
| Next.js client | UI, routing, route protection (middleware), data fetching/caching |
| Express API | Auth, validation, business logic, RBAC, aggregation |
| MongoDB | Source of truth |
| Meilisearch | Typo-tolerant full-text search over doctors and patients |

## 3. Repository Layout
```
doctor-tracker/
├── client/                    # Next.js (App Router, TypeScript)
│   ├── src/app/(auth)/login
│   ├── src/app/(dashboard)/{dashboard,doctors,patients}
│   ├── src/components/{ui,layout,charts,tables,forms}
│   ├── src/hooks/  src/lib/api/  src/lib/validation/
│   └── middleware.ts
├── server/
│   ├── src/config/             # env, db, meili
│   ├── src/modules/
│   │   ├── auth/ users/ doctors/ patients/ dashboard/ search/
│   │   └── (each: routes, controller, service, repository, schema, validation)
│   ├── src/middlewares/        # auth, rbac, validate, error, rateLimit
│   ├── src/utils/  src/jobs/   # reindex, seed
│   └── src/app.ts  src/server.ts
├── docs/
├── .env.example
└── README.md
```

## 4. Request Flow
1. Browser requests a protected page → Next.js middleware checks session cookie; redirects to `/login` if missing.
2. Client calls API with credentials (httpOnly cookie).
3. Express pipeline: `helmet → cors → rateLimit → authenticate → authorize(permission) → validate(zod) → controller → service → repository`.
4. Mongoose queries run with lean + projection; list endpoints return `{ data, meta }`.
5. Writes also update Meilisearch (async, with retry).
6. Errors flow to a central error handler with a consistent shape.

## 5. REST API (v1)
| Method | Path | Purpose |
|---|---|---|
| POST | /auth/login · /auth/refresh · /auth/logout | Session |
| GET | /auth/me | Current user |
| GET/POST | /doctors | List (search/filter/paginate) / create |
| GET/PATCH/DELETE | /doctors/:id | Detail / update / delete |
| GET/POST | /doctors/:id/patients | List / add patient under doctor |
| DELETE | /doctors/:id/patients/:patientId | Remove patient |
| GET | /patients | List all (search/filter/paginate) |
| PATCH/DELETE | /patients/:id | Edit / delete |
| GET | /dashboard/summary | Totals |
| GET | /dashboard/patients-per-doctor | Aggregation |
| GET | /dashboard/timeseries?metric=&interval= | Date stats |
| GET | /dashboard/conditions | Condition distribution |
| GET | /search?q=&type= | Global search |

Response envelope:
```json
{ "data": [], "meta": { "page": 1, "limit": 20, "total": 134, "totalPages": 7 } }
{ "error": { "code": "VALIDATION_ERROR", "message": "...", "details": [] } }
```

## 6. Client State & Data Fetching
- Server state: TanStack Query (caching, background refetch, invalidation).
- URL state: filters/search/page stored in query string (shareable, back-button friendly).
- UI state: local component state; minimal global store (Zustand) for auth user + sidebar.
- Debounced search input; memoized table rows; stable callbacks to avoid re-renders.

## 7. Scalability
- Stateless API behind a load balancer.
- Indexes designed for every list/filter/sort (see `DATABASE.md`).
- Dashboard aggregations cached briefly (30–60 s) in memory/Redis (optional).
- Meilisearch scales reads independently.

## 8. Deployment (suggested)
Client on Vercel; API on Render/Railway/VPS (Docker); MongoDB Atlas; Meilisearch Cloud or Docker. CORS restricted to client origin.

## 9. Cross-Cutting Concerns
Logging (pino), request IDs, health endpoint `/health`, graceful shutdown, environment-based config validated at boot.
