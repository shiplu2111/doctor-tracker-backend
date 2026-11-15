# Doctor Onboarding

Defines how a doctor record is created, validated, activated, and maintained in Doctor Tracker. Doctors here are **records managed by admins** (they do not log in).

## 1. Onboarding Flow
```
Admin clicks "Add Doctor"
   → fills form (name, specialization, hospital, phone, email)
   → client validation (zod)
   → POST /api/v1/doctors
   → server validation + duplicate email check
   → doctor saved (status: active) + indexed in Meilisearch
   → success toast, redirect to doctor detail page
   → admin can immediately "Add patient"
```

## 2. Required Fields & Validation
| Field | Rules |
|---|---|
| name | required, 2–100 chars, trimmed |
| specialization | required, from suggestion list (free text allowed), 2–80 chars |
| hospital | required, 2–120 chars |
| phone | required, valid phone (E.164; BD numbers accepted as `+8801XXXXXXXXX` or `01XXXXXXXXX`, normalized) |
| email | required, valid email, lowercased, **unique** |

Server is authoritative; same zod schema is shared with the client.

## 3. API
**POST /api/v1/doctors** (`doctor:create`)
```json
{ "name": "Dr. Ayesha Rahman", "specialization": "Cardiology",
  "hospital": "Square Hospital", "phone": "+8801712345678", "email": "ayesha@example.com" }
```
- `201` → `{ data: { id, ...doctor } }`
- `400 VALIDATION_ERROR` with per-field `details`
- `409 DUPLICATE_EMAIL`

## 4. Lifecycle & Status
| Status | Meaning | Allowed actions |
|---|---|---|
| `active` | Can be assigned new patients | all |
| `inactive` | On leave/retired; keeps history | view, edit, reactivate; no new patients |

- Deactivate via `PATCH /doctors/:id { status: "inactive" }`.
- Existing patients remain visible; admin is prompted to reassign them (optional bulk reassign).

## 5. Deleting a Doctor
- If doctor has **0 patients** → deleted.
- If doctor has patients → `409 HAS_PATIENTS`; UI offers: **Reassign patients to…** (select doctor) then delete, or cancel.
- Delete requires confirmation dialog, `doctor:delete` permission, and writes an audit log entry.

## 6. After Onboarding: Adding Patients
From the doctor detail page → "Add patient" drawer: name, age, gender, condition, status, phone (optional), notes (optional). Saved via `POST /doctors/:id/patients`; doctor's `patientCount` is incremented; list refreshes via query invalidation. Removing a patient uses `DELETE /doctors/:id/patients/:patientId` with confirmation.

## 7. Duplicate & Data Quality Handling
- Email uniqueness enforced by unique index and a pre-check for a friendly message.
- Normalize name spacing/case-insensitive compare to warn about probable duplicates (same name + hospital): non-blocking warning.
- Specialization values suggested from existing distinct values (`GET /doctors/specializations`) to keep filters clean.

## 8. UX Requirements
- Single-column form on mobile, two-column on desktop.
- Inline field errors on blur; submit disabled while pending.
- Preserve form data on failure.
- Success state clearly shows next step ("Add first patient").

## 9. Side Effects
- Search index updated (`SEARCH.md`).
- Dashboard totals reflect the new doctor (cache invalidated).
- In-app notification to admins (P2, `notifications.md`).
- Audit log entry (`doctor.created`).

## 10. Bulk Import (P2)
CSV upload (`name, specialization, hospital, phone, email`): validate all rows, show a preview with row-level errors, import valid rows in batches (`insertMany` with `ordered:false`), return a summary (created / skipped / errors).

## 11. Acceptance Criteria
- [ ] Admin can create a doctor with all 5 fields.
- [ ] Invalid or duplicate input shows clear errors.
- [ ] New doctor appears in list and search within ~1 s.
- [ ] Viewer role cannot see "Add Doctor".
- [ ] Doctor with patients cannot be deleted without reassignment.
