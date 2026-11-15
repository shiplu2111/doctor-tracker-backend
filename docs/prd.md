# Product Requirements Document — Doctor Tracker

## 1. Summary
Doctor Tracker is a fast, clean admin portal where clinic or hospital administrators keep track of doctors and the patients assigned to them, and see at a glance how the practice is doing.

## 2. Problem
Admin teams manage doctor and patient data in spreadsheets, which are slow to search, hard to filter, impossible to visualize, and insecure.

## 3. Goals
- Single secure place to manage doctors and patients.
- Find any record in under 3 seconds (search + filters).
- Understand workload distribution through dashboard analytics.
- Deliver a polished, responsive UX.

## 4. Non-Goals
- Appointments, scheduling, billing, prescriptions.
- Patient or doctor login.
- Clinical notes / medical records.

## 5. Personas
| Persona | Needs |
|---|---|
| Hospital Admin (primary) | Add doctors, assign patients, find records fast |
| Operations Manager | Dashboard analytics, trends |
| Viewer / Auditor | Read-only access |

## 6. User Stories
**Auth**
- As an admin, I log in securely so only authorized staff see data.

**Doctors**
- As an admin, I create a doctor (name, specialization, hospital, phone, email).
- As an admin, I search and filter doctors by specialization, hospital, status, and date.
- As an admin, I open a doctor and see their patients.
- As an admin, I add or remove patients from that doctor.

**Patients**
- As an admin, I see all patients in one page with search, filters, and pagination.
- As an admin, I edit or delete a patient.

**Dashboard**
- As a manager, I see total doctors/patients, patients per doctor, and trends over time.

## 7. Features & Priority
| Feature | Priority |
|---|---|
| Login / protected routes | P0 |
| Doctor CRUD + list/search/filter/paginate | P0 |
| Doctor → patients (add/remove) | P0 |
| Patients page (edit/delete/search/filter/paginate) | P0 |
| Dashboard charts | P0 |
| Meilisearch-backed search | P1 |
| RBAC (Super Admin/Admin/Viewer) | P1 |
| In-app notifications | P2 |
| Email notifications, CSV export | P2 |

## 8. UX Principles
Clear hierarchy, generous spacing, consistent components, instant feedback (skeletons, toasts), keyboard-friendly, mobile-first responsive layout. See `design.md`.

## 9. Success Metrics
- Lighthouse performance ≥ 90 on list pages.
- List/search API p95 < 300 ms.
- Zero unauthenticated data access in tests.
- All evaluation criteria in the project spec satisfied.

## 10. Release Plan
1. M1: Auth + layout shell
2. M2: Doctors module
3. M3: Patients module
4. M4: Dashboard analytics
5. M5: Search (Meilisearch), RBAC, polish
6. M6: README, screenshots, deployment

## 11. Risks
| Risk | Mitigation |
|---|---|
| Slow lists at scale | Compound indexes, projection, capped page size |
| Search drift between Mongo and Meili | Sync hooks + reindex script + Mongo fallback |
| Scope creep | Strict P0/P1/P2 prioritization |
