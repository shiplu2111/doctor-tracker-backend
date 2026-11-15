# Frontend Roadmap

Stack: Next.js (App Router) · TypeScript · Tailwind + shadcn/ui · TanStack Query/Table · react-hook-form + zod · Recharts · Zustand.

## Phase 0 — Setup (0.5 day)
- [ ] Create Next.js app, ESLint, Prettier, absolute imports
- [ ] Tailwind + shadcn/ui, design tokens (`design.md`)
- [ ] Axios/fetch wrapper (credentials, refresh-on-401, error normalization)
- [ ] `.env.example` (`NEXT_PUBLIC_API_URL`)

## Phase 1 — App Shell & Auth (1 day)
- [ ] Route groups: `(auth)`, `(dashboard)`
- [ ] Login page + form validation
- [ ] `middleware.ts` route protection
- [ ] Auth store + `useAuth`, logout
- [ ] Sidebar, top bar, responsive drawer, theme toggle
- [ ] Global error boundary, 404, toast provider

## Phase 2 — Shared UI Kit (1 day)
- [ ] DataTable (sorting, loading, empty), Pagination
- [ ] SearchInput (debounced), FilterBar, DateRangePicker
- [ ] ConfirmDialog, Modal/Drawer, StatCard, ChartCard, Skeletons
- [ ] `useQueryParams` hook (URL-synced filters)

## Phase 3 — Doctors Module (1.5 days)
- [ ] List with search/filter/pagination
- [ ] Create/Edit doctor form
- [ ] Doctor detail page + patients table
- [ ] Add patient (drawer), delete patient (confirm + optimistic)
- [ ] Delete doctor flow (reassign prompt on 409)

## Phase 4 — Patients Module (1 day)
- [ ] Global patients list with filters (date, condition, status, doctor)
- [ ] Edit patient drawer, delete confirm
- [ ] Doctor select (async search)

## Phase 5 — Dashboard (1 day)
- [ ] KPI cards
- [ ] Patients per doctor (bar), time series (area) with range selector, condition donut
- [ ] Skeletons, empty and error states, query caching (`staleTime` 60 s)

## Phase 6 — Search & RBAC UI (0.5–1 day)
- [ ] Global command-palette search (Ctrl/Cmd+K) → `/search`
- [ ] Permission-aware UI (hide/disable actions for Viewer) via `can(permission)`
- [ ] Notification bell + dropdown (P2)

## Phase 7 — Polish & Performance (1 day)
- [ ] Memoize rows/cells, stable callbacks, avoid prop drilling
- [ ] Code-split charts (`next/dynamic`), image optimization
- [ ] Lighthouse ≥ 90, a11y pass (keyboard, contrast, aria)
- [ ] Responsive QA: 360 / 768 / 1280 / 1536

## Phase 8 — Delivery (0.5 day)
- [ ] Screenshots (desktop + mobile) for README
- [ ] Deployment, env config, CORS check
- [ ] Final README review

## Folder Conventions
```
src/
  app/            routes only (thin)
  components/ui   primitives
  components/{layout,charts,tables,forms}
  features/{doctors,patients,dashboard,auth}/{api,hooks,components,types}
  lib/{api,utils,validation}
  hooks/ store/ types/
```

## Definition of Done (per feature)
Typed, validated, loading/empty/error states, responsive, keyboard accessible, no console errors, no unnecessary re-renders (checked in React Profiler).
