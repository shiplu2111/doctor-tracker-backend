# Software Requirements Specification — Doctor Tracker

Version 1.0

## 1. Introduction

### 1.1 Purpose
Doctor Tracker is a secure administrative web application for managing doctors and their patients, with an analytics dashboard. This SRS defines the functional and non-functional requirements.

### 1.2 Scope
Authenticated administrators can manage doctors, manage patients (globally and per doctor), search/filter/paginate records, and view analytics. Out of scope: patient-facing portal, billing, appointments, EMR/clinical records.

### 1.3 Definitions
| Term | Meaning |
|---|---|
| Admin | Authenticated portal user with management rights |
| Doctor | Medical practitioner record managed in the system |
| Patient | Person assigned to exactly one doctor |
| RBAC | Role-based access control |

### 1.4 Tech Stack
- Client: Next.js (separate application)
- Server: Node.js + Express (standalone REST API)
- Database: MongoDB
- Search: Meilisearch
- Communication: REST over HTTPS, JSON

## 2. Overall Description
- Single-organization admin portal; no public pages except login.
- Users: Super Admin, Admin, Viewer (see `rbac.md`).
- Constraint: all routes (UI and API) require authentication.

## 3. Functional Requirements

### 3.1 Authentication
- FR-AUTH-1: Users log in with email + password.
- FR-AUTH-2: Unauthenticated access to any route redirects to login (UI) or returns 401 (API).
- FR-AUTH-3: Sessions use short-lived access token + rotating refresh token (see `auth.md`).
- FR-AUTH-4: Users can log out; refresh token is revoked.

### 3.2 Doctor Management
- FR-DOC-1: Create doctor with name, specialization, hospital, phone, email.
- FR-DOC-2: List doctors with pagination.
- FR-DOC-3: Search doctors by name, specialization, hospital, email, phone.
- FR-DOC-4: Filter by specialization, hospital, status, created date range.
- FR-DOC-5: View a doctor's detail page including their patients.
- FR-DOC-6: Add a patient under a doctor.
- FR-DOC-7: Remove a patient from a doctor's list (deletes the patient record).
- FR-DOC-8: Edit and delete doctors (delete blocked or reassigns if patients exist — see `doctor-onboarding.md`).

### 3.3 Patient Management
- FR-PAT-1: Dedicated page listing all patients.
- FR-PAT-2: Edit patient information.
- FR-PAT-3: Delete patients.
- FR-PAT-4: Pagination, search, and filters (created date range, condition, doctor, status).

### 3.4 Dashboard
- FR-DASH-1: Total doctors and total patients.
- FR-DASH-2: Patients per doctor (top N chart).
- FR-DASH-3: Date-based statistics (new patients/doctors over time, daily/weekly/monthly).
- FR-DASH-4: Condition distribution chart.
- FR-DASH-5: All aggregations computed server-side in MongoDB.

### 3.5 Navigation
- FR-NAV-1: Primary navigation between Dashboard, Doctors, Patients.

## 4. Non-Functional Requirements

### 4.1 Performance
- List/search endpoints p95 < 300 ms at 100k doctors / 1M patients (indexed).
- Dashboard summary p95 < 500 ms (aggregation with indexes, short cache).
- Pagination is mandatory; max page size 100.

### 4.2 Security
See `SECURITY.md`. Passwords hashed (argon2/bcrypt), HTTPS only, input validation on all endpoints, rate limiting on auth.

### 4.3 Usability
- Modern, responsive UI (mobile ≥ 360px, tablet, desktop).
- Loading, empty, and error states for every data view.
- WCAG 2.1 AA target for contrast and keyboard navigation.

### 4.4 Scalability
- Stateless API (horizontal scaling).
- Cursor or skip/limit pagination with supporting indexes.
- Search offloaded to Meilisearch.

### 4.5 Maintainability
- Clean folder structure, reusable components, shared validation schemas, centralized error handling.

### 4.6 Reliability
- Consistent error format; graceful degradation of search (Mongo fallback).

## 5. External Interfaces
- REST API under `/api/v1`.
- Meilisearch HTTP API (server-side only).
- Optional SMTP for email notifications (see `notifications.md`).

## 6. Data Requirements
See `DATABASE.md`.

## 7. Acceptance Criteria (summary)
1. Non-authenticated user cannot view any data.
2. Admin can create a doctor and add/delete patients under them.
3. Lists support search + filter + pagination together.
4. Dashboard shows totals, patients per doctor, and date-based charts.
5. README contains pitch, setup guide, `.env.example`, architecture, 2 technical decisions, and desktop + mobile screenshots.
