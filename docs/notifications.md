# Notifications

Priority: **P2** (optional enhancement). Core app works without it; design is included so it can be added cleanly.

## 1. Channels
| Channel | Phase | Notes |
|---|---|---|
| Toast (client-side) | P0 | Immediate feedback for user's own actions |
| In-app notifications | P2 | Stored in MongoDB, shown in bell dropdown |
| Email | P2 | SMTP via Nodemailer, for security events and digests |

## 2. Events
| Event | Recipients | Channel |
|---|---|---|
| Doctor created | Admins | In-app |
| Patient added to doctor | Admins | In-app |
| Patient marked `critical` | Admins | In-app (+ email optional) |
| Doctor deleted / deactivated | Admins | In-app |
| New login from new device | The user | Email |
| Account locked | The user + Super Admin | Email |
| Weekly summary | Super Admin / Admin | Email (opt-in) |

## 3. Data Model
See `notifications` in `DATABASE.md`:
`{ userId, type, title, message, entity:{kind,id}, readAt, createdAt }`.
TTL: auto-delete after 90 days.

## 4. API
| Method | Path | Purpose |
|---|---|---|
| GET | /notifications?unread=true&page= | List |
| GET | /notifications/unread-count | Badge count |
| PATCH | /notifications/:id/read | Mark one read |
| POST | /notifications/read-all | Mark all read |

## 5. Delivery
- Server emits domain events (`doctor.created`, `patient.added`, …) through an internal event emitter.
- Notification service subscribes, creates records for target users, and enqueues email jobs.
- Client polls `unread-count` every 60 s (TanStack Query `refetchInterval`); upgrade path to SSE/WebSocket if needed.
- Email sending is fire-and-forget with retries; failures never block the API response.

## 6. UI
Bell icon with unread badge in top bar → dropdown (latest 10, mark all read, "View all" page). Items link to the related entity.

## 7. Preferences (future)
Per-user toggles per event type and channel.

## 8. Security & Privacy
- Notification text must not contain sensitive patient details (use names/IDs only, no clinical notes).
- Users can only read their own notifications (`userId` check on every query).
- Email templates avoid including patient condition details.
