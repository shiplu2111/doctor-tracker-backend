# Security

Doctor and patient data is sensitive. This document defines the baseline controls.

## 1. Threat Model (summary)
| Threat | Control |
|---|---|
| Unauthorized access | Authentication on all routes, RBAC, default deny |
| Credential stuffing / brute force | Rate limiting, lockout, generic errors |
| XSS / token theft | httpOnly cookies, React escaping, CSP |
| CSRF | SameSite cookies + CSRF header/token, strict CORS |
| NoSQL injection | Schema validation, `express-mongo-sanitize`, no raw operators from input |
| Mass assignment | Whitelisted DTO fields via zod |
| Data leakage | Field projection, no hashes/stack traces in responses |
| Dependency vulns | `npm audit`, Dependabot, lockfiles |

## 2. Authentication & Sessions
See `auth.md`. Short-lived access tokens, rotating refresh tokens, argon2id/bcrypt, lockout.

## 3. Authorization
See `rbac.md` and `PERMISSIONS.md`. Every endpoint declares a permission; verified server-side.

## 4. Input Validation
- zod schemas for body, query, params on every endpoint; unknown keys stripped.
- Pagination limits enforced (`limit ≤ 100`).
- Sort and filter fields from an allowlist only.
- Strip `$` and `.` keys from request objects.

## 5. HTTP Hardening
- `helmet` (HSTS, noSniff, frameguard, referrer-policy).
- CSP on the client: `default-src 'self'`; allow only API origin in `connect-src`.
- CORS: single allowed origin, `credentials: true`.
- Body size limit 100 KB; request timeouts.
- Rate limits: global 100 req/min/IP; auth 5 per 15 min.

## 6. Data Protection
- HTTPS everywhere; cookies `Secure`.
- MongoDB: auth enabled, network-restricted (Atlas IP allowlist), TLS, least-privilege DB user.
- Encrypted backups; encryption at rest on the DB host.
- Do not log PII, passwords, tokens; redact in logs (pino `redact`).
- Do not put patient clinical details into notifications, URLs, or search indexes beyond what is necessary.
- Consider field-level encryption for `notes` (P2).

## 7. Secrets Management
- All secrets in env vars; `.env` git-ignored; only `.env.example` committed with placeholders.
- Separate secrets per environment; rotate on suspicion of leak.
- Env validated at boot (fail fast).

## 8. Error Handling
- Central handler returns `{ error: { code, message } }`.
- No stack traces in production.
- 404 for missing resources the user lacks access to (avoid object enumeration).

## 9. Audit & Monitoring
- Audit log for logins, failed logins, role changes, and create/update/delete of doctors/patients.
- Structured logs with request ID; alert on spikes of 401/403/429.
- `/health` endpoint (no sensitive info).

## 10. Compliance Notes
If used with real patient data, evaluate HIPAA / local data-protection law (e.g., Bangladesh Data Protection regulations): data minimization, retention policy, access logging, breach procedure. Demo deployments must use synthetic data only.

## 11. Pre-Release Checklist
- [ ] All routes return 401 when unauthenticated
- [ ] RBAC matrix tests pass
- [ ] `npm audit` has no high/critical findings
- [ ] No secrets in git history
- [ ] CORS and cookie flags verified in production
- [ ] Meilisearch and MongoDB not publicly reachable
- [ ] Rate limiting verified
- [ ] Demo data contains no real personal information
