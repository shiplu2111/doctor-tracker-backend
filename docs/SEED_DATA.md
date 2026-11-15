# Seed Data

Purpose: give the app realistic data so pagination, filters, search, and dashboard charts look meaningful in the demo and screenshots. **All data is synthetic. Never use real people.**

## 1. Commands
```bash
cd server
npm run seed:admin                 # admin user from .env (idempotent)
npm run seed:demo                  # demo doctors + patients
npm run seed:demo -- --reset       # wipe doctors/patients first (never users), then reseed
npm run seed:demo -- --doctors 50 --patients 2000 --seed 42
npm run reindex                    # rebuild Meilisearch after seeding
```
Requirements:
- Deterministic with `--seed` (use a seeded RNG such as `@faker-js/faker` `faker.seed(n)`).
- Idempotent: running without `--reset` must not duplicate data (skip if doctors already exist, or upsert by email).
- Refuse to run when `NODE_ENV=production` unless `--force` is passed.
- Use `insertMany` in batches of 500; set `patientCount` correctly at the end (single aggregation + `bulkWrite`).
- Spread `createdAt` over the **last 180 days** (see §4) so date charts have shape.

## 2. Volumes
| Entity | Default |
|---|---|
| Users | 1 admin + 1 viewer (`viewer@example.com`, password from `SEED_VIEWER_PASSWORD` or same as admin) |
| Doctors | 50 (≈ 45 active, 5 inactive) |
| Patients | 2000 |

## 3. Distributions
**Specializations (weights):** Cardiology 12, General Medicine 14, Pediatrics 10, Orthopedics 8, Neurology 7, Dermatology 8, Gynecology 9, ENT 6, Psychiatry 6, Oncology 5, Ophthalmology 5, Urology 4, Endocrinology 6.

**Hospitals (10):** Dhaka Central Hospital, Lakeview Medical Center, Green Crescent Hospital, Sunrise Clinic, Metro Care Hospital, Riverside General, City Health Institute, Evergreen Medical, Harmony Hospital, Unity Specialized Hospital. (Fictional names.)

**Doctor fields**
- `name`: `Dr. ` + faker full name (mix of Bengali and international names is fine).
- `phone`: `+8801` + 9 random digits (`017/018/019/016/015` prefixes).
- `email`: `firstname.lastname<n>@doctortracker.test` (unique, lowercase).

**Patients per doctor:** skewed (long tail) so "patients per doctor" chart is interesting — e.g., draw doctor weight from a Pareto/log-normal; top 5 doctors ≈ 25–35% of patients; a few doctors with 0–3 patients; inactive doctors keep their historical patients.

**Conditions (weights):** Hypertension 14, Diabetes 14, Asthma 8, Fever/Flu 12, Back Pain 8, Migraine 6, Arthritis 6, Anxiety 6, Skin Allergy 7, Heart Disease 5, Thyroid Disorder 5, Fracture 4, Cancer 3, Kidney Stone 2.

**Status (weights):** active 55, recovered 25, discharged 12, critical 8.

**Patient fields**
- `age`: 1–90, roughly normal around 38.
- `gender`: male 48 / female 48 / other 4.
- `phone`: ~80% present; `email`: ~30% present (`@patients.test`); `notes`: ~20% short generic note ("Follow-up in 2 weeks"). No realistic clinical details.

## 4. Date Distribution
- Doctors: created over the last 180 days, with a few clusters (hiring waves).
- Patients: created over the last 180 days with an upward trend (more recent days have more) and weekday > weekend. Ensure the **last 30 days** have enough volume (≥ 200 patients) for the "new this month" KPI and the 7d/30d/90d chart ranges.
- `updatedAt` ≥ `createdAt`.
- A patient's `createdAt` must be ≥ its doctor's `createdAt`.

## 5. Edge Cases to Include (for QA and screenshots)
- 1 doctor with 0 patients (empty state).
- 1 doctor with 150+ patients (pagination).
- 2 doctors sharing the same hospital and specialization (filters).
- Names that test search: `Dr. Ayesha Rahman`, `Dr. Aisha Rahman` (typo tolerance), a name with an apostrophe or accent.
- 3 patients with `critical` status created today (notification/dashboard demo).
- 1 inactive doctor with patients (reassign flow).

## 6. Performance Dataset (optional)
`npm run seed:perf` → 5,000 doctors / 200,000 patients, used only to verify `explain()` plans and list p95 < 300 ms. Never run on the live demo DB.

## 7. Post-Seed Verification
- [ ] `Doctor.countDocuments()` = 50, `Patient.countDocuments()` = 2000
- [ ] Sum of `doctors.patientCount` equals total patients
- [ ] No duplicate doctor emails
- [ ] Dashboard summary shows non-zero values for all KPIs and all charts render
- [ ] `npm run reindex` completes; searching `cardio` returns results
