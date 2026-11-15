# UI/UX Design Guide

## 1. Principles
Clean, modern, calm. Clear hierarchy, generous whitespace, consistent components, fast feedback. Data first, chrome second.

## 2. Design Tokens
**Color (light)**
| Token | Value | Use |
|---|---|---|
| primary | #2563EB | actions, links, active nav |
| primary-soft | #EFF6FF | selected rows, highlights |
| success | #16A34A | active/recovered |
| warning | #D97706 | pending/attention |
| danger | #DC2626 | delete, critical |
| bg | #F8FAFC | app background |
| surface | #FFFFFF | cards, tables |
| border | #E2E8F0 | dividers |
| text | #0F172A / muted #64748B | |

Dark mode: same tokens remapped (bg #0B1220, surface #111827). Support via CSS variables.

**Typography:** Inter. Scale: 12 / 14 / 16 / 20 / 24 / 32. Headings 600 weight, body 400.
**Spacing:** 4-pt scale (4, 8, 12, 16, 24, 32, 48). **Radius:** 8 (inputs), 12 (cards). **Shadow:** subtle, 1–2 levels only.

## 3. Layout
- **Desktop (≥1024):** fixed left sidebar (240px) + top bar + content (max-width 1280).
- **Tablet (768–1023):** collapsible sidebar (icons).
- **Mobile (<768):** top bar + slide-over drawer nav; tables become stacked cards.

Sidebar items: Dashboard, Doctors, Patients. Footer: user menu (profile, logout).

## 4. Screens
1. **Login** — centered card, email/password, inline errors, loading state.
2. **Dashboard** — KPI cards (Total Doctors, Total Patients, New this month, Avg patients/doctor); charts: patients per doctor (bar), patients over time (area/line with range selector 7d/30d/90d), condition distribution (donut), doctors by specialization (bar).
3. **Doctors list** — search bar, filter chips/popover (specialization, hospital, status, date range), table (name, specialization, hospital, phone, email, patients, created), pagination, "Add doctor" button.
4. **Doctor detail** — header card (info + actions), patients table with "Add patient" and delete actions.
5. **Patients list** — same pattern with condition/status/doctor/date filters, inline edit via drawer/modal.
6. **Forms** — modal or drawer, field-level validation, disabled submit while pending.

## 5. Components (reusable)
`Button, Input, Select, DatePicker, DateRangePicker, Badge, Card, Modal, Drawer, ConfirmDialog, DataTable, Pagination, SearchInput (debounced), FilterBar, StatCard, ChartCard, EmptyState, Skeleton, Toast, Avatar, PageHeader, Breadcrumbs`.

## 6. States (required for every data view)
Loading (skeleton), empty (illustration + CTA), error (retry), success (toast), destructive confirm (type/click confirm).

## 7. Interaction Details
- Search debounce 300 ms; filters reflected in URL.
- Optimistic UI for delete with rollback on failure.
- Smooth page transitions, 150–200 ms micro-animations; respect `prefers-reduced-motion`.
- Keyboard: focus rings, Esc closes modals, `/` focuses search.

## 8. Accessibility
Contrast ≥ 4.5:1, labeled inputs, aria-live toasts, semantic tables, focus trapping in dialogs, charts with text summaries/tooltips.

## 9. Tooling
Tailwind CSS + shadcn/ui (Radix), lucide-react icons, Recharts for charts, react-hook-form + zod, TanStack Table/Query.
