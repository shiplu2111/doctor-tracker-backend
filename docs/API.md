# API Reference (v1)

Base URL: `/api/v1`. JSON only. Auth via httpOnly cookies (`dt_access`, `dt_refresh`) — see `auth.md`. State-changing requests must send `X-Requested-With: XMLHttpRequest`.

## Conventions
**Success**
```json
{ "data": { }, "meta": { } }
```
**List meta**
```json
{ "page": 1, "limit": 20, "total": 134, "totalPages": 7, "searchEngine": "meilisearch" }
```
**Error**
```json
{ "error": { "code": "VALIDATION_ERROR", "message": "Invalid input", "details": [{ "path": "email", "message": "Invalid email" }] } }
```
**Pagination:** `page` (default 1), `limit` (default 20, max 100). **Sort:** `sort=field:asc|desc` from an allowlist. **Dates:** ISO 8601; `from`/`to` filter on `createdAt` (inclusive).

## Error Codes
| HTTP | Code | When |
|---|---|---|
| 400 | `VALIDATION_ERROR` | zod validation failed |
| 401 | `UNAUTHENTICATED` | no/invalid session |
| 401 | `TOKEN_EXPIRED` | access token expired (client should refresh) |
| 401 | `INVALID_CREDENTIALS` | wrong email/password |
| 403 | `FORBIDDEN` | missing permission |
| 404 | `NOT_FOUND` | resource missing |
| 409 | `DUPLICATE_EMAIL` | doctor/user email exists |
| 409 | `HAS_PATIENTS` | deleting doctor with patients and no `reassignTo` |
| 409 | `DOCTOR_INACTIVE` | adding patient to inactive doctor |
| 423 | `ACCOUNT_LOCKED` | too many failed logins |
| 429 | `RATE_LIMITED` | rate limit hit |
| 500 | `INTERNAL_ERROR` | unexpected (no details leaked) |

---

## Auth
### POST /auth/login — public
Req: `{ "email": "admin@example.com", "password": "********" }`
Res 200: `{ "data": { "user": { "id": "665f1", "name": "Admin", "email": "admin@example.com", "role": "admin", "permissions": ["doctor:read", "..."] } } }` + `Set-Cookie`.
Errors: 400, 401 `INVALID_CREDENTIALS`, 423, 429.

### POST /auth/refresh — refresh cookie
Res 200: `{ "data": { "ok": true } }` + rotated cookies. Errors: 401.

### POST /auth/logout
Res 204. Clears cookies, revokes refresh token.

### GET /auth/me
Res 200: `{ "data": { "id", "name", "email", "role", "permissions": [] } }`.

---

## Doctors
Doctor object:
```json
{ "id": "665f2", "name": "Dr. Ayesha Rahman", "specialization": "Cardiology", "hospital": "Square Hospital",
  "phone": "+8801712345678", "email": "ayesha@example.com", "status": "active", "patientCount": 14,
  "createdAt": "2026-11-01T08:30:00.000Z", "updatedAt": "2026-11-01T08:30:00.000Z" }
```

### GET /doctors — `doctor:read`
Query: `q`, `specialization`, `hospital`, `status` (`active|inactive`), `from`, `to`, `page`, `limit`, `sort` (`createdAt|name|patientCount`).
Res 200: `{ "data": [Doctor], "meta": {...} }`.

### GET /doctors/specializations — `doctor:read`
Res 200: `{ "data": ["Cardiology", "Neurology"] }`.

### POST /doctors — `doctor:create`
Req: `{ "name", "specialization", "hospital", "phone", "email" }` (rules in `doctor-onboarding.md`).
Res 201: `{ "data": Doctor }`. Errors: 400, 409 `DUPLICATE_EMAIL`.

### GET /doctors/:id — `doctor:read`
Res 200: `{ "data": Doctor }`. 404.

### PATCH /doctors/:id — `doctor:update`
Req: any subset of fields incl. `status`. Res 200: `{ "data": Doctor }`. 409 `DUPLICATE_EMAIL`.

### DELETE /doctors/:id?reassignTo=<doctorId> — `doctor:delete`
Res 204. 409 `HAS_PATIENTS` if patients exist and no `reassignTo`.

---

## Patients
Patient object:
```json
{ "id": "665f3", "name": "Rahim Uddin", "age": 42, "gender": "male", "phone": "+8801800000000",
  "email": null, "condition": "Diabetes", "status": "active", "notes": "",
  "doctorId": "665f2", "doctor": { "id": "665f2", "name": "Dr. Ayesha Rahman" },
  "createdAt": "2026-11-02T10:00:00.000Z" }
```

### GET /doctors/:id/patients — `patient:read`
Query: `q`, `condition`, `status`, `from`, `to`, `page`, `limit`, `sort`. Res 200: `{ "data": [Patient], "meta" }`.

### POST /doctors/:id/patients — `patient:create`
Req: `{ "name", "age", "gender", "condition", "status", "phone?", "email?", "notes?" }`.
Res 201: `{ "data": Patient }`. Errors: 400, 404, 409 `DOCTOR_INACTIVE`.

### DELETE /doctors/:id/patients/:patientId — `patient:delete`
Res 204. Decrements `patientCount`.

### GET /patients — `patient:read`
Query: `q`, `condition`, `status`, `gender`, `doctorId`, `from`, `to`, `page`, `limit`, `sort` (`createdAt|name|age`).
Res 200: `{ "data": [Patient], "meta" }`.

### PATCH /patients/:id — `patient:update`
Req: subset of patient fields (`doctorId` change moves the patient and adjusts both counters). Res 200: `{ "data": Patient }`.

### DELETE /patients/:id — `patient:delete`
Res 204.

---

## Dashboard — `dashboard:read`
### GET /dashboard/summary
```json
{ "data": { "totalDoctors": 50, "totalPatients": 2000, "newPatientsThisMonth": 180,
            "newDoctorsThisMonth": 4, "avgPatientsPerDoctor": 40 } }
```
### GET /dashboard/patients-per-doctor?limit=10
```json
{ "data": [{ "doctorId": "665f2", "name": "Dr. Ayesha Rahman", "specialization": "Cardiology", "count": 87 }] }
```
### GET /dashboard/timeseries?metric=patients|doctors&interval=day|week|month&from=&to=
```json
{ "data": [{ "date": "2026-11-01", "count": 12 }] }
```
Missing dates are zero-filled.
### GET /dashboard/conditions?limit=8
```json
{ "data": [{ "condition": "Diabetes", "count": 310 }] }
```
### GET /dashboard/specializations
```json
{ "data": [{ "specialization": "Cardiology", "count": 6 }] }
```

---

## Search — `search:read`
### GET /search?q=ayesha&type=all|doctors|patients&limit=5
```json
{ "data": { "doctors": [{ "id", "name", "specialization", "hospital", "_highlight": "<mark>Ayesha</mark> Rahman" }],
            "patients": [{ "id", "name", "condition", "doctorName" }] },
  "meta": { "searchEngine": "meilisearch" } }
```

## Users (P1) — `user:read` / `user:manage`
`GET /users`, `POST /users`, `PATCH /users/:id/role`, `PATCH /users/:id/status` — see `rbac.md`.

## Notifications (P2) — `notification:read`
`GET /notifications`, `GET /notifications/unread-count`, `PATCH /notifications/:id/read`, `POST /notifications/read-all` — see `notifications.md`.

## Health
`GET /health` — public — `{ "status": "ok", "mongo": "up", "search": "up" }`.
