# Definition of Done

A task is **done** only when every applicable box is checked. The agent must run through this list before ticking a task in `TASKS.md`.

## Code quality
- [ ] `npm run lint` passes with zero warnings (changed app)
- [ ] `npm run typecheck` passes (`strict`, no `any`, no `@ts-ignore`)
- [ ] No `console.log`, dead code, commented-out code, or unreferenced TODOs
- [ ] Follows `CODING_STANDARDS.md` (naming, layering, error handling, envelope)
- [ ] No new dependency unless approved

## Tests
- [ ] Unit/API tests added or updated for new behavior and bug fixes
- [ ] `npm test` passes in the changed app
- [ ] Auth/RBAC impact covered (401 / 403 / success) for any new endpoint
- [ ] E2E updated if a critical flow changed

## Backend (if applicable)
- [ ] Request validated with zod (body, query, params)
- [ ] Endpoint has an explicit permission (`authorize(...)`)
- [ ] List endpoints paginated, `limit ≤ 100`, sort/filter allowlisted
- [ ] Index exists for the query; `explain()` shows `IXSCAN`
- [ ] Uses `.lean()` + projection on reads
- [ ] Errors use `AppError` and documented codes; no internals leaked
- [ ] `docs/API.md` updated for any contract change
- [ ] Meilisearch sync updated if searchable fields changed

## Frontend (if applicable)
- [ ] Loading state (skeleton), empty state, and error state with retry
- [ ] Success/failure feedback (toast or inline)
- [ ] Forms: inline validation, submit disabled while pending, server errors mapped to fields
- [ ] Filters/search/page stored in URL; refresh preserves state
- [ ] Responsive at **360 / 768 / 1280 px**; no horizontal scroll; tables degrade to cards on mobile
- [ ] Keyboard accessible: focus visible, Esc closes dialogs, labeled inputs, adequate contrast
- [ ] No unnecessary re-renders on lists (checked with React Profiler for table pages)
- [ ] Matches `design.md` tokens and `WIREFRAMES.md` layout
- [ ] Permission-aware UI (`can()`), but server remains authoritative

## Security
- [ ] No tokens in web storage; cookies httpOnly/Secure/SameSite
- [ ] No secrets or PII in code, logs, URLs, or notifications
- [ ] Input sanitized (NoSQL operator keys stripped)

## Documentation & delivery
- [ ] Relevant doc updated if behavior changed
- [ ] `.env.example` updated if env vars changed
- [ ] `TASKS.md` box ticked
- [ ] Commit follows Conventional Commits, includes task ID
- [ ] App runs from a clean setup following `README.md` steps

## Final submission (once, at the end)
- [ ] Lighthouse performance ≥ 90 on list pages; no console errors
- [ ] Pre-release checklist in `SECURITY.md` complete
- [ ] README: pitch, setup, architecture, 2 technical decisions, desktop + mobile screenshots
- [ ] Live URL + GitHub link + credentials ready
