# Role-Based Access Control (RBAC)

## 1. Model
```
User ──has one──► Role ──grants many──► Permission
```
Single role per user (keeps the model simple for this scope). Permissions are defined in `PERMISSIONS.md`.

## 2. Roles
| Role | Purpose | Summary |
|---|---|---|
| `super_admin` | System owner | Everything, including user management and audit logs |
| `admin` | Day-to-day operator | Full CRUD on doctors and patients, dashboard, search |
| `viewer` | Read-only / auditor | Read doctors, patients, dashboard, search |

The project spec's "Admin" maps to `admin` (and `super_admin`). Minimum viable delivery can ship with only `admin`, with the others added as P1.

## 3. Role Definition (shared constants)
```ts
export const ROLE_PERMISSIONS = {
  super_admin: ['*'],
  admin: [
    'dashboard:read',
    'doctor:read', 'doctor:create', 'doctor:update', 'doctor:delete',
    'patient:read', 'patient:create', 'patient:update', 'patient:delete',
    'search:read', 'notification:read',
  ],
  viewer: ['dashboard:read', 'doctor:read', 'patient:read', 'search:read', 'notification:read'],
} as const;
```

## 4. Middleware Chain
`authenticate` → loads user, verifies `isActive` → `authorize(permission)` → controller.
- Deactivated users are rejected immediately, even with a valid token (check `isActive` or token version).
- Role changes bump `tokenVersion`, invalidating existing sessions so new permissions apply.

## 5. Business Rules
- Only `super_admin` can create users or change roles.
- A user cannot change their own role or deactivate themselves.
- The last active `super_admin` cannot be demoted or deactivated.
- All role changes and deactivations are written to `audit_logs`.

## 6. User Management Endpoints (P1)
| Method | Path | Permission |
|---|---|---|
| GET | /users | user:read |
| POST | /users | user:manage |
| PATCH | /users/:id/role | user:manage |
| PATCH | /users/:id/status | user:manage |

## 7. Client Integration
`/auth/me` returns `permissions[]`. A `useCan()` hook and `<Can permission="...">` component control visibility of buttons/menu items. Route-level guards redirect to a 403 page when the page's permission is missing.

## 8. Extensibility
To add ownership/department scoping later (e.g., admin only sees their hospital), add a `scope` field to users and apply it as a query filter in repositories (`hospital: user.scope.hospital`). Not required for current spec.

## 9. Testing
Matrix test over every (role × endpoint) pair asserting expected status code.
