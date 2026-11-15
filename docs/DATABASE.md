# Database Design (MongoDB)

ODM: Mongoose. All collections use `timestamps: true` (`createdAt`, `updatedAt`).

## 1. Collections

### users
| Field | Type | Notes |
|---|---|---|
| _id | ObjectId | |
| name | String | required |
| email | String | unique, lowercase |
| passwordHash | String | select: false |
| role | enum | `super_admin` \| `admin` \| `viewer` |
| isActive | Boolean | default true |
| failedLoginCount / lockUntil | Number / Date | lockout |
| lastLoginAt | Date | |

### refresh_tokens
`userId`, `tokenHash`, `familyId`, `expiresAt` (TTL index), `revokedAt`, `userAgent`, `ip`.

### doctors
| Field | Type | Notes |
|---|---|---|
| name | String | required, trimmed |
| specialization | String | required |
| hospital | String | required |
| phone | String | required, E.164-ish validation |
| email | String | required, unique, lowercase |
| status | enum | `active` \| `inactive` (default active) |
| patientCount | Number | denormalized counter, default 0 |
| createdBy | ObjectId → users | |

### patients
| Field | Type | Notes |
|---|---|---|
| name | String | required |
| age | Number | 0–130 |
| gender | enum | `male` \| `female` \| `other` |
| phone | String | optional |
| email | String | optional |
| condition | String | required (e.g., Diabetes) |
| status | enum | `active` \| `recovered` \| `critical` \| `discharged` |
| notes | String | optional, max 1000 |
| doctorId | ObjectId → doctors | required, indexed |
| createdBy | ObjectId → users | |

### notifications
`userId`, `type`, `title`, `message`, `entity {kind, id}`, `readAt`, `createdAt` (see `notifications.md`).

### audit_logs (P2)
`actorId`, `action`, `entity`, `entityId`, `diff`, `ip`, `createdAt`.

## 2. Relationships
- Doctor 1 — N Patients (patient belongs to exactly one doctor, referenced by `doctorId`).
- Reference (not embed): patients grow unbounded and are queried independently.
- `patientCount` kept in sync with `$inc` on create/delete (inside a transaction when available) for fast list display.

## 3. Indexes
```js
// users
{ email: 1 } unique

// refresh_tokens
{ tokenHash: 1 } unique
{ expiresAt: 1 } expireAfterSeconds: 0
{ familyId: 1 }

// doctors
{ email: 1 } unique
{ createdAt: -1 }
{ specialization: 1, createdAt: -1 }
{ hospital: 1, createdAt: -1 }
{ status: 1, createdAt: -1 }

// patients
{ doctorId: 1, createdAt: -1 }          // doctor's patient list
{ createdAt: -1 }                       // global list + date stats
{ condition: 1, createdAt: -1 }         // condition filter + chart
{ status: 1, createdAt: -1 }

// notifications
{ userId: 1, readAt: 1, createdAt: -1 }
```
Free-text search is handled by Meilisearch (`SEARCH.md`); Mongo regex fallback uses anchored, case-insensitive prefix queries on `name`.

## 4. Query Patterns
**Paginated list with filters**
```js
Doctor.find(filter, projection).sort({ createdAt: -1 }).skip((page-1)*limit).limit(limit).lean();
Doctor.countDocuments(filter);   // run in parallel with find
```
For very deep pagination, support cursor pagination (`createdAt` + `_id`).

**Patients per doctor**
```js
Patient.aggregate([
  { $group: { _id: '$doctorId', count: { $sum: 1 } } },
  { $sort: { count: -1 } }, { $limit: 10 },
  { $lookup: { from: 'doctors', localField: '_id', foreignField: '_id', as: 'doctor',
               pipeline: [{ $project: { name: 1, specialization: 1 } }] } },
  { $unwind: '$doctor' }
]);
```

**Date-based stats**
```js
Patient.aggregate([
  { $match: { createdAt: { $gte: from, $lte: to } } },
  { $group: { _id: { $dateTrunc: { date: '$createdAt', unit: 'day' } }, count: { $sum: 1 } } },
  { $sort: { _id: 1 } }
]);
```

## 5. Integrity Rules
- Deleting a doctor with patients: blocked (409) unless `?reassignTo=<doctorId>` provided.
- Deleting a patient decrements `doctorId.patientCount`.
- Unique email conflicts return 409 `DUPLICATE_EMAIL`.

## 6. Seeding & Migrations
`npm run seed:admin`, `npm run seed:demo` (e.g., 50 doctors, 2000 patients for performance demo), `npm run reindex` (Meilisearch).

## 7. Performance Checklist
Use `.lean()`, projections, capped `limit` (≤ 100), `explain()` to confirm `IXSCAN` on all list queries, avoid `$where`/unanchored regex.
