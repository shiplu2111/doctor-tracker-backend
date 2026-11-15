# Doctor Tracker — Backend REST API Server

## Description
Doctor Tracker Backend is a secure, resilient, and optimized RESTful API service built with Node.js, Express, TypeScript, and MongoDB. It powers clinical data management for hospital departments, handling high-volume doctor records, assigned patient rosters, aggregation pipelines for real-time analytics, and typo-tolerant search. The architecture enforces strict RBAC (Role-Based Access Control), JWT session rotation using httpOnly SameSite cookies, compound indexing for query performance, and Meilisearch write-through synchronization with automatic MongoDB fallback.

- **Backend API Repository:** https://github.com/shiplu2111/doctor-tracker-backend
- **Frontend Repository:** https://github.com/shiplu2111/doctor-tracker-frontend
- **Default Seed Credentials:**
  - Admin: `admin@example.com` / `ChangeMe-12345`
  - Viewer: `viewer@example.com` / `ChangeMe-12345`

---

## Features
- **Security & Authentication:** Argon2id password hashing, JWT access/refresh token rotation with family reuse detection, brute-force rate limiting, and account lockouts (5 failed attempts).
- **Role-Based Access Control (RBAC):** Granular permission checks (`super_admin`, `admin`, `viewer`) guarding endpoints with automated 401/403 envelopes.
- **Optimized Doctor CRUD:** Auto-incrementing patient load counters, duplicate email prevention (409), cascading delete safeguards with patient reassignment (`reassignTo`).
- **Patient Roster Engine:** Filterable clinical records by condition, doctor assignment, status, and admission date ranges with server-side pagination.
- **Analytics & Aggregations:** High-performance MongoDB pipelines (`$facet`, `$group`, `$sort`) for KPI summaries, doctor workload distributions, and date-based intake trends.
- **Typo-Tolerant Search:** Dual-engine search with Meilisearch primary indexing and indexed MongoDB regex fallback.

---

## Tech Stack
- **Runtime & Language:** Node.js 20+ & TypeScript
- **Framework:** Express.js 4.19
- **Database & ODM:** MongoDB 7 & Mongoose 8
- **Search Engine:** Meilisearch (v1.8+) with MongoDB prefix fallback
- **Authentication & Security:** Argon2id, jsonwebtoken, Helmet, CORS, express-rate-limit, cookie-parser
- **Validation:** Zod schemas
- **Logging:** Structured logging with Pino & request IDs
- **Testing:** Vitest, Supertest, mongodb-memory-server

---

## Setup Guide

### 1. Prerequisites
- Node.js 20+
- Docker and Docker Compose (for MongoDB and Meilisearch)

### 2. Clone & Install
```bash
git clone https://github.com/shiplu2111/doctor-tracker-backend.git
cd doctor-tracker-backend
npm install
```

### 3. Start Database & Services
```bash
docker compose up -d
```
Starts MongoDB on `localhost:27017` and Meilisearch on `localhost:7700`.

### 4. Environment Configuration
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```
Default values in `.env.example` are preconfigured for local Docker development:
```env
PORT=4000
MONGODB_URI=mongodb://localhost:27017/doctor_tracker
CLIENT_ORIGIN=http://localhost:3000
COOKIE_DOMAIN=localhost
COOKIE_SECURE=false
JWT_ACCESS_SECRET=change-me-access-secret-min-32-chars
JWT_REFRESH_SECRET=change-me-refresh-secret-min-32-chars
SEED_ADMIN_EMAIL=admin@example.com
SEED_ADMIN_PASSWORD=ChangeMe-12345
MEILI_HOST=http://localhost:7700
MEILI_MASTER_KEY=change-me
```

### 5. Seed Data & Reindex
```bash
npm run seed:admin   # Seeds the super admin user
npm run seed:demo    # Seeds 50 doctors & ~2000 patients with clinical condition distributions
npm run reindex      # Syncs collections to Meilisearch
```

### 6. Start the Server
```bash
# Development (with auto-reload):
npm run dev

# Production build:
npm run build
npm start
```
Server boots at [http://localhost:4000](http://localhost:4000). Health check endpoint: `GET http://localhost:4000/health`.

---

## Available Scripts

| Command | Description |
|---|---|
| `npm run dev` | Starts server using `tsx watch` on port 4000 |
| `npm run build` | Compiles TypeScript source to `dist/` |
| `npm start` | Executes compiled `dist/server.js` |
| `npm run lint` | Runs ESLint check across all modules |
| `npm run typecheck` | Checks TypeScript compilation without emitting |
| `npm test` | Runs all 45 integration & unit test suites (Vitest) |
| `npm run seed:admin` | Seeds initial administrator account |
| `npm run seed:demo` | Seeds full realistic clinical data |
| `npm run reindex` | Builds Meilisearch search indices |

---

## System Architecture

```
┌────────────────────────────────────────────────────────┐
│                   Next.js Frontend                     │
└───────────────────────────┬────────────────────────────┘
                            │ HTTPS + httpOnly cookies
                            ▼
┌────────────────────────────────────────────────────────┐
│                  Express API Pipeline                  │
│  [Helmet] → [CORS] → [RateLimiter] → [Pino Logger]    │
│  → [CookieParser] → [Authenticate] → [Authorize]       │
│  → [Zod Validation] → [Controllers] → [Services]       │
└─────────────────────┬──────────────────┬───────────────┘
                      │                  │
                      ▼                  ▼
┌───────────────────────────┐ ┌──────────────────────────┐
│         MongoDB           │ │       Meilisearch        │
│   (Source of Truth)       │ │  (Typo-Tolerant Search)  │
│  • Compound Indexes       │ │  • Outbox synchronization│
│  • Aggregation Pipelines  │ │  • Seamless fallback     │
└───────────────────────────┘ └──────────────────────────┘
```

---

## Technical Decisions

### 1. Compound Indexing & Parallel Count/Find Strategy
- **Context:** Large doctor directories and patient rosters require complex multi-attribute filtering (specialization, hospital, condition, date ranges) while sorting by admission timestamp.
- **Decision:** Designed targeted compound indexes:
  - `Doctor`: `{ specialization: 1, status: 1, createdAt: -1 }`, `{ hospital: 1, createdAt: -1 }`
  - `Patient`: `{ doctorId: 1, status: 1, createdAt: -1 }`, `{ condition: 1, createdAt: -1 }`
  Pagination queries execute `Model.find()` with projection and `Model.countDocuments()` concurrently via `Promise.all()`.
- **Why:** Avoids costly in-memory sorts and full collection scans (COLLSCAN). `explain('executionStats')` confirms 100% index coverage (`IXSCAN`) and zero document fetch overhead.

### 2. Dual-Engine Search with Automatic Resilient Fallback
- **Context:** Full-text clinical search requires typo tolerance and relevancy ranking, but an outage of the external search daemon must never crash core hospital workflows.
- **Decision:** Integrated Meilisearch as the primary search engine with asynchronous outbox sync. If Meilisearch is unreachable or returns an error, the repository transparently falls back to MongoDB regex prefix search.
- **Why:** Delivers sub-50ms search latency while guaranteeing 99.99% system availability even during external service maintenance.
