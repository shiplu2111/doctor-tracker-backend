# Deployment Guide — Doctor Tracker

This guide details how to deploy **Doctor Tracker** across modern hosting platforms for production.

---

## 1. Architecture Overview

```
                      ┌──────────────────────┐
                      │  Next.js Frontend    │
                      │  (Vercel / Cloud)    │
                      └──────────┬───────────┘
                                 │ HTTPS / Cookies
                                 ▼
                      ┌──────────────────────┐
                      │  Express API Server  │
                      │  (Render / Railway)  │
                      └────┬────────────┬────┘
                           │            │
            ┌──────────────▼─────┐  ┌───▼──────────────────┐
            │   MongoDB Atlas    │  │   Meilisearch Cloud  │
            │  (Database Cluster)│  │   (or Private Node)  │
            └────────────────────┘  └──────────────────────┘
```

---

## 2. Infrastructure Setup

### A. MongoDB Atlas (Database)
1. Create a free M0 cluster (or dedicated M10+).
2. Create a database user with `readWrite` permissions on `doctor_tracker`.
3. In **Network Access**, add the public IP addresses of your Express server (or allow `0.0.0.0/0` with strong password authentication).
4. Copy the connection string:
   ```
   mongodb+srv://<user>:<password>@cluster0.xxxxx.mongodb.net/doctor_tracker?retryWrites=true&w=majority
   ```

### B. Meilisearch (Search Engine)
1. **Option 1 (Meilisearch Cloud):** Create a project at [cloud.meilisearch.com](https://cloud.meilisearch.com) and obtain the `URL` and `Master Key`.
2. **Option 2 (Docker / VPS):**
   ```bash
   docker run -d --name meilisearch \
     -p 7700:7700 \
     -e MEILI_MASTER_KEY=your-production-master-key \
     -v meili_data:/meili_data \
     getmeili/meilisearch:v1.7
   ```
   *Note: Ensure port 7700 is protected and only accessible by your backend API.*

---

## 3. Server Deployment (Render / Railway / VPS)

### Production Dockerfile (`server/Dockerfile`)
```dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json tsconfig.json ./
RUN npm ci
COPY src ./src
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY package*.json ./
RUN npm ci --omit=dev
COPY --from=builder /app/dist ./dist
EXPOSE 4000
CMD ["node", "dist/server.js"]
```

### Server Environment Variables
| Variable | Value | Notes |
|---|---|---|
| `NODE_ENV` | `production` | Enables strict production error handling & logging |
| `PORT` | `4000` | Port assigned by hosting provider |
| `MONGODB_URI` | `mongodb+srv://...` | MongoDB Atlas URI |
| `CLIENT_ORIGIN` | `https://your-app.vercel.app` | Exact domain of the client (no trailing slash) |
| `COOKIE_DOMAIN` | `.yourcompany.com` or empty | Leave empty if client and server are on separate domains |
| `COOKIE_SECURE` | `true` | Required for HTTPS |
| `JWT_ACCESS_SECRET` | `64-char-random-string` | Secret key for access tokens |
| `JWT_REFRESH_SECRET` | `64-char-random-string` | Secret key for refresh tokens |
| `MEILI_HOST` | `https://ms-xxxx.meilisearch.io` | Meilisearch host URL |
| `MEILI_MASTER_KEY` | `your-meili-master-key` | Meilisearch master key |
| `SEED_ADMIN_EMAIL` | `admin@yourcompany.com` | Production admin email |
| `SEED_ADMIN_PASSWORD` | `StrongAdminPassword123!` | Strong initial password |

### Post-Deploy Database Initialization
Run seed and reindex scripts via the platform CLI or a one-off task:
```bash
npm run seed:admin
npm run seed:demo
npm run reindex
```

---

## 4. Client Deployment (Vercel)

1. Connect your GitHub repository to Vercel.
2. Set the **Root Directory** to `client`.
3. Set the **Framework Preset** to `Next.js`.
4. Configure Environment Variables:
   - `NEXT_PUBLIC_API_URL`: `https://api.yourcompany.com/api/v1`
   - `NEXT_PUBLIC_APP_URL`: `https://your-app.vercel.app`
   - `SESSION_COOKIE_NAME`: `dt_access`
5. Click **Deploy**.

---

## 5. Security & Cross-Origin Configuration (CORS & Cookies)

When deploying client and API on different domains (e.g. `doctor-tracker.vercel.app` and `doctor-tracker-api.onrender.com`):
1. **Cookies:**
   - Must have `SameSite=None` and `Secure=true` in `server/src/modules/auth/auth.controller.ts` for cross-site cookie transmission.
   - If using custom subdomains (e.g., `app.doctortracker.com` and `api.doctortracker.com`), set `SameSite=Lax` and `COOKIE_DOMAIN=.doctortracker.com`.
2. **CORS:**
   - `CLIENT_ORIGIN` on the server must exactly match the frontend URL including protocol.
   - Server must allow headers: `Content-Type`, `Authorization`, `X-Requested-With`.
   - `credentials: true` must be enabled on both frontend fetch calls and backend CORS middleware.

---

## 6. Pre-Release Verification Checklist

- [ ] `GET /health` returns 200 `{ status: "ok" }` on the production API.
- [ ] Attempting unauthenticated access to `GET /api/v1/doctors` returns 401.
- [ ] Admin login succeeds and sets `dt_access` and `dt_refresh` cookies.
- [ ] Navigating between Dashboard, Doctors, and Patients loads data correctly.
- [ ] Full-text search and typo tolerance work via Meilisearch.
- [ ] Responsive UI functions on mobile (360px) and desktop (1440px).
- [ ] No secrets or stack traces leak in API responses or browser console.
