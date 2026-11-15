# Search (Meilisearch)

Meilisearch provides fast, typo-tolerant full-text search for doctors and patients. MongoDB remains the source of truth.

## 1. Why Meilisearch
- Sub-50 ms typo-tolerant, prefix search out of the box.
- Offloads text search from MongoDB (no unanchored regex scans).
- Combines search with filters, sorting, and pagination in one query.

## 2. Indexes
### `doctors`
| Setting | Value |
|---|---|
| primaryKey | `id` |
| searchableAttributes | `name`, `specialization`, `hospital`, `email`, `phone` |
| filterableAttributes | `specialization`, `hospital`, `status`, `createdAtTs` |
| sortableAttributes | `createdAtTs`, `name`, `patientCount` |
| displayedAttributes | `id`, `name`, `specialization`, `hospital`, `phone`, `email`, `status`, `patientCount`, `createdAt` |

### `patients`
| Setting | Value |
|---|---|
| primaryKey | `id` |
| searchableAttributes | `name`, `condition`, `phone`, `email`, `doctorName` |
| filterableAttributes | `condition`, `status`, `doctorId`, `gender`, `createdAtTs` |
| sortableAttributes | `createdAtTs`, `name`, `age` |

Dates are stored as Unix timestamps (`createdAtTs`) so range filters work: `createdAtTs >= X AND createdAtTs <= Y`.

## 3. Document Shape
```json
{ "id": "665f...", "name": "Dr. Ayesha Rahman", "specialization": "Cardiology",
  "hospital": "Square Hospital", "phone": "+8801...", "email": "ayesha@...",
  "status": "active", "patientCount": 14, "createdAtTs": 1731542400 }
```
No sensitive clinical notes are indexed.

## 4. Sync Strategy
1. **Write-through:** after Mongo create/update/delete succeeds, the service enqueues an index task (`addDocuments`, `deleteDocument`).
2. **Failure handling:** failed tasks are retried with exponential backoff; persisted in a small `search_outbox` collection so nothing is lost on crash.
3. **Denormalized fields:** when a doctor's name changes, patients' `doctorName` is re-indexed via a batch job.
4. **Full reindex:** `npm run reindex` streams collections in batches of 1000.
5. **Consistency:** eventual (usually < 1 s). Detail views always read from MongoDB.

## 5. API Integration
**GET /doctors?q=cardio&specialization=Cardiology&status=active&from=2026-01-01&to=2026-12-31&page=1&limit=20**
- If `q` present → query Meilisearch with filters + `offset/limit`, get ordered IDs and `estimatedTotalHits`, then hydrate via `Doctor.find({_id: {$in: ids}})` (preserve order) or return Meili `hits` directly for list rows.
- If `q` absent → pure MongoDB indexed query (filters + sort + pagination).

**GET /search?q=&type=doctors|patients|all** — multi-search across both indexes (top 5 each) for the command palette.

```ts
const res = await meili.index('doctors').search(q, {
  filter: ['status = active', `createdAtTs >= ${from}`],
  sort: ['createdAtTs:desc'],
  offset: (page - 1) * limit, limit,
  attributesToHighlight: ['name'],
});
```

## 6. Fallback
If Meilisearch is unreachable (timeout 800 ms), the API falls back to Mongo anchored prefix regex on `name` / `email` and sets `meta.searchEngine = "mongo-fallback"`. Logged and alerted.

## 7. Security
- Meilisearch is **never exposed to the browser**; only the Express server holds the key.
- Use a restricted **search API key** for queries and the master/admin key only for indexing jobs.
- Meilisearch runs in a private network or behind auth in production.

## 8. Config (.env)
```
MEILI_HOST=http://localhost:7700
MEILI_MASTER_KEY=change-me
MEILI_SEARCH_KEY=
MEILI_INDEX_PREFIX=dt_
```
Local dev: `docker run -p 7700:7700 -e MEILI_MASTER_KEY=change-me getmeili/meilisearch`.

## 9. Frontend UX
Debounced (300 ms) input, highlighted matches, "no results" state with clear-filters action, search term + filters persisted in the URL.

## 10. Testing
Typo tolerance (`cardilogy` → Cardiology), filter + query combos, pagination totals, reindex idempotency, fallback behavior with Meili stopped.
