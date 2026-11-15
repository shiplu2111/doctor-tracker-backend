# Permissions

Permissions are fine-grained capabilities in `resource:action` format. Roles are bundles of permissions (see `rbac.md`). Code checks **permissions**, never role names.

## 1. Permission Catalog
| Permission | Description |
|---|---|
| `dashboard:read` | View dashboard analytics |
| `doctor:read` | List and view doctors |
| `doctor:create` | Create doctors |
| `doctor:update` | Edit doctors |
| `doctor:delete` | Delete doctors |
| `patient:read` | List and view patients |
| `patient:create` | Add patients under a doctor |
| `patient:update` | Edit patients |
| `patient:delete` | Delete patients |
| `search:read` | Use global search |
| `notification:read` | Read own notifications |
| `user:read` | List users |
| `user:manage` | Create, update, deactivate users, change roles |
| `audit:read` | View audit logs |

## 2. Role → Permission Matrix
| Permission | super_admin | admin | viewer |
|---|:-:|:-:|:-:|
| dashboard:read | ✅ | ✅ | ✅ |
| doctor:read | ✅ | ✅ | ✅ |
| doctor:create | ✅ | ✅ | ❌ |
| doctor:update | ✅ | ✅ | ❌ |
| doctor:delete | ✅ | ✅ | ❌ |
| patient:read | ✅ | ✅ | ✅ |
| patient:create | ✅ | ✅ | ❌ |
| patient:update | ✅ | ✅ | ❌ |
| patient:delete | ✅ | ✅ | ❌ |
| search:read | ✅ | ✅ | ✅ |
| notification:read | ✅ | ✅ | ✅ |
| user:read | ✅ | ❌ | ❌ |
| user:manage | ✅ | ❌ | ❌ |
| audit:read | ✅ | ❌ | ❌ |

## 3. Endpoint → Permission Map
| Endpoint | Permission |
|---|---|
| GET /doctors, GET /doctors/:id | doctor:read |
| POST /doctors | doctor:create |
| PATCH /doctors/:id | doctor:update |
| DELETE /doctors/:id | doctor:delete |
| GET /doctors/:id/patients, GET /patients | patient:read |
| POST /doctors/:id/patients | patient:create |
| PATCH /patients/:id | patient:update |
| DELETE /doctors/:id/patients/:pid, DELETE /patients/:id | patient:delete |
| GET /dashboard/* | dashboard:read |
| GET /search | search:read |
| /notifications/* | notification:read |
| /users/* | user:read / user:manage |
| /audit-logs | audit:read |

## 4. Enforcement
**Server (authoritative)**
```ts
router.post('/doctors', authenticate, authorize('doctor:create'), validate(createDoctorSchema), ctrl.create);
```
`authorize` reads `req.user.permissions` resolved from role at login/refresh. Failure → `403 FORBIDDEN`.

**Client (UX only)**
`can('doctor:create')` hides or disables buttons. Never relied upon for security.

## 5. Rules
- Default deny: any route without an explicit permission is rejected.
- Permissions are defined once in a shared constants file and imported by server and client.
- Add a test per endpoint verifying 401 (no auth), 403 (wrong role), 200 (allowed).
