# Wireframes

Screen-by-screen layouts. Tokens, colors, and typography are in `design.md`. Breakpoints: **mobile < 768**, **tablet 768–1023**, **desktop ≥ 1024**. ASCII is schematic; spacing uses the 4-pt scale.

## 0. Global Shell (desktop)
```
┌────────┬──────────────────────────────────────────────────────────┐
│  ◉ DT  │  Page title                    🔍 Search ⌘K   🔔   (AR) ▾ │  ← top bar 64px
│        ├──────────────────────────────────────────────────────────┤
│ ▣ Dash │                                                          │
│ ⚕ Docs │   content (max-width 1280, padding 24–32)                │
│ ☺ Pats │                                                          │
│        │                                                          │
│ ────── │                                                          │
│ v1.0   │                                                          │
└────────┴──────────────────────────────────────────────────────────┘
 240px sidebar
```
- Sidebar: logo, 3 nav items (icon + label), active = `primary-soft` bg + `primary` text + left accent bar. Footer: version.
- Top bar: page title (left), global search trigger (opens command palette), notification bell (P2), user avatar menu (name, role badge, Logout).
- **Tablet:** sidebar collapses to 72px icon rail with tooltips.
- **Mobile:** sidebar hidden; top bar shows ☰ (opens slide-over drawer), logo, avatar. Content padding 16.

---

## 1. Login
```
┌──────────────────────────────────────────────┐
│                                              │
│              ◉  Doctor Tracker               │
│          Sign in to your account             │
│        ┌──────────────────────────┐          │
│        │ Email                    │          │
│        │ [ admin@example.com    ] │          │
│        │ Password                 │          │
│        │ [ ••••••••••         👁 ] │          │
│        │ (inline error text)      │          │
│        │ [        Sign in       ] │          │
│        └──────────────────────────┘          │
│        © Doctor Tracker                      │
└──────────────────────────────────────────────┘
```
- Centered card 400px (full-width minus 16 on mobile) on `bg`. Optional soft gradient/illustration on the left half for desktop (split layout ≥ 1024).
- States: loading (button spinner, fields disabled), invalid credentials (red banner above button), locked account message.
- Autofocus email; Enter submits.

---

## 2. Dashboard
```
┌ Dashboard ──────────────────────────────────── Range: [7d][30d][90d] ┐
│ ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌────────────┐          │
│ │ Doctors    │ │ Patients   │ │ New (30d)  │ │ Avg / doc  │          │
│ │ 50         │ │ 2,000      │ │ 214  ▲ 8%  │ │ 40         │          │
│ └────────────┘ └────────────┘ └────────────┘ └────────────┘          │
│ ┌──────────────────────────────────────┐ ┌────────────────────────┐ │
│ │ Patients over time (area/line)       │ │ Condition distribution │ │
│ │  ╱╲  ╱╲╱╲                            │ │      (donut)           │ │
│ │ ╱  ╲╱     ╲╱                         │ │   legend + % list      │ │
│ └──────────────────────────────────────┘ └────────────────────────┘ │
│ ┌──────────────────────────────────────┐ ┌────────────────────────┐ │
│ │ Top doctors by patients (h-bar)      │ │ Doctors by specialty   │ │
│ │ Dr A ████████████ 87                 │ │ (bar)                  │ │
│ │ Dr B ██████████ 71                   │ │                        │ │
│ └──────────────────────────────────────┘ └────────────────────────┘ │
└──────────────────────────────────────────────────────────────────────┘
```
- KPI row: 4 cards (grid 4 cols desktop, 2 cols tablet/mobile). Each: label (muted 12–14), value (24–32, 600), optional delta chip.
- Chart grid: 2 columns desktop (60/40 split on first row), 1 column mobile; each in a `ChartCard` (title, optional subtitle, tooltip, 280–320px height).
- Range selector (segmented control) affects the time series; filters stored in URL.
- States: skeleton cards/charts while loading; per-chart empty ("No data for this range") and error with Retry.
- A11y: each chart has a visually-hidden text summary; colors not the only encoding (labels/values).

---

## 3. Doctors List
```
┌ Doctors ─────────────────────────────────────────── [ + Add doctor ] ┐
│ [🔍 Search name, specialty, hospital…   ] [Specialty ▾][Hospital ▾]   │
│ [Status ▾] [Date range ▾]                     (chips) ✕ Clear filters │
│ ┌───────────────────────────────────────────────────────────────────┐ │
│ │ Doctor ↕        Specialty   Hospital   Phone   Patients↕ Created  ⋯│ │
│ │ (AR) Dr. Ayesha Cardiology  Square     +880…   14        Nov 1   ⋯│ │
│ │      ayesha@…                          [Active]                    │ │
│ │ …                                                                  │ │
│ └───────────────────────────────────────────────────────────────────┘ │
│ Showing 1–20 of 134          Rows [20 ▾]       ‹ 1 2 3 … 7 ›         │
└───────────────────────────────────────────────────────────────────────┘
```
- Row click → Doctor detail. Row actions menu (⋯): View, Edit, Deactivate/Activate, Delete (viewer sees View only).
- Status as colored `Badge` (active = success, inactive = muted).
- Active filters shown as removable chips; "Clear filters" appears when any are set.
- **Mobile:** filters collapse into a "Filters" button opening a bottom sheet; table becomes stacked cards (name + badge, specialty · hospital, phone, patients count, ⋯).
- States: skeleton rows (8), empty ("No doctors match your filters" + Clear / "No doctors yet" + Add doctor), error + Retry.

### 3a. Add/Edit Doctor (drawer on desktop, full-screen sheet on mobile)
```
┌ Add doctor ─────────────── ✕ ┐
│ Name *          [          ] │
│ Specialization* [        ▾ ] │
│ Hospital *      [          ] │
│ Phone *         [+880…     ] │
│ Email *         [          ] │
│                              │
│        [ Cancel ] [ Create ] │
└──────────────────────────────┘
```
- 2 columns for short fields on desktop wide drawer (≥ 640px); single column otherwise. Inline errors on blur; server 409 shows under Email. Submit disabled while pending.

---

## 4. Doctor Detail
```
┌ ‹ Doctors / Dr. Ayesha Rahman ────────────────────────────────────────┐
│ ┌───────────────────────────────────────────────────────────────────┐ │
│ │ (AR)  Dr. Ayesha Rahman  [Active]          [ Edit ] [ ⋯ ]         │ │
│ │       Cardiology · Square Hospital                                 │ │
│ │       📞 +8801712345678   ✉ ayesha@example.com   Joined Nov 1, 2026│ │
│ │       ┌────────┐ ┌────────┐ ┌────────┐                            │ │
│ │       │ 14 pts │ │ 3 crit │ │ 9 act  │   (mini stats)             │ │
│ └───────────────────────────────────────────────────────────────────┘ │
│ Patients (14)           [🔍 Search] [Condition ▾][Status ▾] [+ Add]   │
│ ┌───────────────────────────────────────────────────────────────────┐ │
│ │ Name        Age Gender Condition   Status     Added      Actions  │ │
│ │ Rahim Uddin 42  M      Diabetes    [Active]   Nov 2      🗑       │ │
│ └───────────────────────────────────────────────────────────────────┘ │
│                                                 ‹ 1 2 ›               │
└───────────────────────────────────────────────────────────────────────┘
```
- Breadcrumb back to Doctors. Header card collapses to stacked layout on mobile.
- **Add patient** opens a drawer: Name*, Age*, Gender*, Condition*, Status*, Phone, Notes. Disabled with tooltip if doctor is inactive.
- **Delete patient** → `ConfirmDialog` ("Remove Rahim Uddin? This deletes the patient record.") with destructive button; optimistic removal with rollback toast on failure.
- Empty state: illustration + "No patients yet" + [Add first patient].

---

## 5. Patients List
```
┌ Patients ─────────────────────────────────────────────────────────────┐
│ [🔍 Search name, condition…] [Condition ▾][Status ▾][Doctor ▾][Date ▾]│
│ ┌───────────────────────────────────────────────────────────────────┐ │
│ │ Patient↕     Age Condition  Doctor        Status    Added↕   ⋯    │ │
│ │ Rahim Uddin  42  Diabetes   Dr. Ayesha    [Active]  Nov 2    ✎ 🗑 │ │
│ └───────────────────────────────────────────────────────────────────┘ │
│ Showing 1–20 of 2,000        Rows [20 ▾]       ‹ 1 2 3 … 100 ›       │
└───────────────────────────────────────────────────────────────────────┘
```
- Doctor filter is an async searchable select. Status badges: active (primary), recovered (success), discharged (muted), critical (danger).
- **Edit** opens a right drawer pre-filled (same form as add + Doctor select to reassign). **Delete** uses `ConfirmDialog`.
- Mobile: card list; filters in bottom sheet.
- Same loading/empty/error patterns as Doctors.

---

## 6. Command Palette (global search)
```
        ┌──────────────────────────────────────────┐
        │ 🔍  cardio                          Esc  │
        ├──────────────────────────────────────────┤
        │ DOCTORS                                  │
        │ ▸ Dr. Ayesha Rahman — Cardiology         │
        │   Dr. Imran Hossain — Cardiology         │
        │ PATIENTS                                 │
        │   Rahim Uddin — Heart Disease            │
        ├──────────────────────────────────────────┤
        │ ↑↓ navigate   ↵ open   esc close         │
        └──────────────────────────────────────────┘
```
- Opens with `Ctrl/Cmd+K` or `/`. Debounced 300 ms; matches highlighted; max 5 per group; empty state "No results for …".

---

## 7. Shared Patterns
| Pattern | Spec |
|---|---|
| Confirm dialog | Centered modal 420px, title, one-line consequence, [Cancel] [Delete] (danger), focus on Cancel |
| Toast | Bottom-right (top on mobile), 4s, success/error variants, `aria-live` |
| Empty state | Simple illustration/icon, headline, 1-line help, primary CTA |
| Error state | Icon, "Something went wrong", message, [Retry] |
| Skeleton | Match final layout (cards, rows, charts), subtle shimmer; honor `prefers-reduced-motion` |
| 403 page | "You don't have access to this page" + back to Dashboard |
| 404 page | "Page not found" + links to Dashboard / Doctors |

## 8. Responsive Checklist
- 360px: no horizontal scroll, tap targets ≥ 44px, tables → cards, filters → bottom sheet.
- 768px: icon rail sidebar, 2-column KPI grid, tables visible with horizontal scroll fallback.
- 1280px+: full sidebar, 4-col KPIs, 2-col chart grid.
