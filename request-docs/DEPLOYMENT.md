# Deployment

Production deployment of the Taxi prototype.

**Primary path:** Render (backend + frontend) + Upstash Redis (persistence). All three are free tier, no credit card required.

**Total monthly cost:** $0.

**Total setup time:** ~30 minutes the first time, ~2 minutes for subsequent deploys (git push triggers an auto-rebuild).

---

## Architecture

```
Browser
  │
  │  https://taxi-frontend.onrender.com   (Render Static Site, CDN, always-on)
  ▼
┌──────────────────┐
│ Angular SPA      │ ── XHR ──┐
│ request-frontend │          │
└──────────────────┘          │
                              ▼  https://taxi-backend.onrender.com
                    ┌────────────────────────┐
                    │ NestJS                 │
                    │ request-backend        │
                    │ (Render Web Service,   │
                    │  free, sleeps 15min)   │
                    └─────────┬──────────────┘
                              │
                  ┌───────────┴───────────────────┐
                  │                               │
                  ▼                               ▼
            Upstash Redis                  DB RIS APIs
            - help-request:<id>            (RIS v1 + v2, read-only)
            - help-request:_ids set
            - bookings hash (seeded once
              from local xlsx)
```

Two external dependencies:

| Dependency | Why | Free? |
| --- | --- | --- |
| [Upstash Redis](https://upstash.com) | All persistent state: help-requests + the bookings reference data | Yes, 10k commands/day |
| [DB API Marketplace](https://developers.deutschebahn.com) | RIS::Journeys v1+v2 for journey stops | Yes, subscribed via account |

The booking spreadsheet (`Bookingdata_UPLOAD_custom_auftragsnummer.xlsx`) lives only on the developer's machine. It is **seeded once** into Upstash via `pnpm seed:bookings` and never leaves the team's hands.

---

## Step 1 — Upstash Redis (5 min)

Render's free filesystem is wiped on every restart, so all state lives in Upstash.

1. Sign up at [console.upstash.com](https://console.upstash.com) — GitHub OAuth, no credit card.
2. Create database:
   - **Name:** `taxi`
   - **Type:** Regional
   - **Region:** `eu-west-1` (Ireland) — closest to Render's Frankfurt region
   - **TLS:** enabled (default)
3. After creation, open the database → **REST API** tab. Copy two values into `request-backend/.env`:

   ```bash
   PERSISTENCE_BACKEND=redis
   UPSTASH_REDIS_REST_URL=https://xxx.upstash.io
   UPSTASH_REDIS_REST_TOKEN=<token>
   ```

## Step 2 — Seed the bookings hash (1 min)

The `bookings` Redis hash is populated once from your local Excel file. The seed script reads the xlsx, parses every row, and pipelines `HSET bookings <auftragsnummer> <json>` to Upstash in batches of 500.

```bash
cd request-backend
pnpm seed:bookings
```

Expected output (last few lines):

```
[seed-bookings] Seeded 31546 / 31546
[seed-bookings] Done. Redis hash "bookings" now holds 31545 bookings.
```

This is **idempotent** — re-running just overwrites the same fields with the same data. Run it again whenever the xlsx changes.

The Excel file never enters the repo, never enters Render, never enters any deployed artifact.

## Step 3 — DB API Marketplace credentials

If you don't already have them, subscribe to **both** APIs on the [DB API Marketplace](https://developers.deutschebahn.com/db-api-marketplace):

- [RIS::Journeys (v1)](https://developers.deutschebahn.com/db-api-marketplace/apis/product/ris-journeys-transporteure) — for journey ID lookup
- [RIS::Journeys (v2)](https://developers.deutschebahn.com/db-api-marketplace/apis/product/ris-journeys-transporteure) — for per-stop detail

The two versions are separate subscriptions with independent credentials. You'll get four values total:

- `RIS_V1_CLIENT_ID`, `RIS_V1_API_KEY`
- `RIS_V2_CLIENT_ID`, `RIS_V2_API_KEY`

---

## Step 4 — Deploy to Render via Blueprint (15 min)

Render reads the [`render.yaml`](../render.yaml) at the repo root and provisions both services automatically.

### 4a. Connect the repo

1. Sign up at [render.com](https://render.com) — GitHub OAuth, no credit card.
2. **New +** → **Blueprint** → select the `taxi` repository.
3. Render detects `render.yaml` and previews two services: `taxi-backend` and `taxi-frontend`.
4. **Branch:** select `green` (or whichever branch holds the deploy commits).
5. Click **Apply**. Render creates both services in `Pending` state — they will fail their first build because env vars are not set yet. This is expected.

### 4b. Set backend secrets

Open the `taxi-backend` service → **Environment**:

| Key | Value |
| --- | --- |
| `UPSTASH_REDIS_REST_URL` | from Step 1 |
| `UPSTASH_REDIS_REST_TOKEN` | from Step 1 |
| `RIS_V1_CLIENT_ID` | from Step 3 |
| `RIS_V1_API_KEY` | from Step 3 |
| `RIS_V2_CLIENT_ID` | from Step 3 |
| `RIS_V2_API_KEY` | from Step 3 |

Save. Render queues a redeploy automatically.

### 4c. Set frontend env vars

Once the backend deploys successfully, Render assigns it a public URL like `https://taxi-backend-xxxx.onrender.com`. Copy it.

Open the `taxi-frontend` service → **Environment**:

| Key | Value |
| --- | --- |
| `BACKEND_URL` | `https://taxi-backend-xxxx.onrender.com` (no trailing slash) |
| `ASSET_PASSWORD` | from your local `request-frontend/.env` |
| `ASSET_INIT_VECTOR` | from your local `request-frontend/.env` |

The `ASSET_*` vars decrypt the DB-UX theme assets at install time. Without them the brand logo won't render but the rest of the app still works.

Save. Render redeploys.

### 4d. Verify

After both services finish building (~5 min each on free tier):

```bash
# Health
curl https://taxi-backend-xxxx.onrender.com/health
# → {"status":"ok","timestamp":"..."}

# Bookings validate (proves the bookings hash was seeded)
curl -s -X POST https://taxi-backend-xxxx.onrender.com/bookings/validate \
  -H 'Content-Type: application/json' \
  -d '{"auftragsnummer":"258376672881","lastName":"Mustermann"}'
# → {"trainNumber":"ICE 619","travelDate":"2026-05-29",...}

# Help-request create (proves help-request persistence is wired)
curl -s -X POST https://taxi-backend-xxxx.onrender.com/help-requests \
  -H 'Content-Type: application/json' \
  -d '{...full DTO...}'
# → 201 + entity with server-generated id

# Frontend
open https://taxi-frontend-yyyy.onrender.com
```

In the Upstash console → **Data Browser** you should see the help-request key appear.

---

## Operational notes

### Sleep on idle

The backend free Web Service spins down after 15 minutes of inactivity. **The first request after sleep takes 30–60 seconds** while the container cold-starts and reloads the 1.3 MB Excel file into memory.

Mitigation for live demos:

- Hit `https://taxi-backend-xxxx.onrender.com/health` 30 seconds before the presentation.
- Or set up a free cron-ping from [cron-job.org](https://cron-job.org) hitting `/health` every 10 minutes. Costs nothing; keeps the service warm.

The frontend Static Site is on a CDN and never sleeps.

### CORS

`request-backend/src/main.ts` runs `app.enableCors({ origin: true, credentials: true })` — any origin is accepted, so the deployed frontend works without further config. For production hardening, replace `origin: true` with an explicit allowlist of your frontend URLs.

### Logs

Render → service → **Logs** tab. The backend uses structured JSON logging (`ConsoleLogger({ json: true })`); each line is one event with `level`, `message`, `requestId`, etc.

### Updating the bookings hash

When the source xlsx changes, re-run the seed locally:

```bash
cd request-backend
pnpm seed:bookings
```

The script overwrites the same fields in the `bookings` hash in place. No Render redeploy needed — the next request reads the updated data immediately.

### Pushing code updates

Render watches the branch named in `render.yaml` (defaults to `main`). Push to that branch → Render auto-rebuilds both services in parallel. ~3 min backend, ~2 min frontend.

---

## Alternative deploy targets

The `render.yaml` is opinionated about Render. If you prefer other platforms:

| Target | Status | Notes |
| --- | --- | --- |
| **Render (this doc)** | Recommended | Free, no CC, one dashboard |
| **Render BE + Vercel FE** | Works | Vercel's CDN is marginally faster for the Angular bundle; two dashboards |
| **Fly.io BE + Render FE** | Works | Fly is paid (~$3/month) but avoids the 15-min cold start. Requires CC. |
| **Self-hosted (Oracle Always-Free VM)** | Works | Perpetual free 4-OCPU ARM VM. Requires Linux sysadmin (systemd, nginx, certbot). |

For Render BE + Vercel FE: deploy the `request-backend/` part of `render.yaml` as-is, then deploy `request-frontend/` to Vercel with **Build Command** `pnpm install && pnpm exec ng build --define BACKEND_URL="\"$BACKEND_URL\""` and **Output Directory** `dist/frontend/browser`.

---

## Troubleshooting

| Symptom | Cause | Fix |
| --- | --- | --- |
| Backend `/health` works, `/help-requests` returns 500 | Upstash env vars wrong | Re-check `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN`. Look for `getaddrinfo ENOTFOUND` in logs. |
| `/bookings/validate` always returns 404 | Bookings hash was never seeded, or wrong Upstash database | Run `pnpm seed:bookings` locally pointing at the deployed Upstash. Verify via the Upstash Data Browser: there should be a `bookings` hash with ~31k fields. |
| `/bookings/:id/journey-stops` returns 502 | RIS credentials missing or v1/v2 swapped | The two subscriptions are independent. Confirm v1 keys are in `RIS_V1_*` and v2 keys are in `RIS_V2_*`. |
| Frontend shows broken logo | `ASSET_PASSWORD` / `ASSET_INIT_VECTOR` not set during build | Set them on `taxi-frontend` → Environment, redeploy. The rest of the app works regardless. |
| Frontend XHR fails with CORS error | Backend rejected the origin | `app.enableCors({ origin: true })` accepts any origin. Check the browser console for the actual fetch URL — if it still points at `localhost:3000`, the build-time substitution failed; check `BACKEND_URL` is set on the frontend service and the build log shows `--define BACKEND_URL=...`. |
| First request after idle takes 30+ seconds | Backend was asleep | See "Sleep on idle" above. Add a cron ping or upgrade to Render Starter ($7/mo) for always-on. |
| `pnpm seed:bookings` reads `~$Bookingdata...xlsx` | macOS Office leaves a `~$` lockfile when the xlsx is open | Close Excel before running the seed, or set `BOOKING_DATA_PATH` to the real filename. |

---

## Cost ceiling

Free-tier headroom on this stack:

| Component | Free limit | When you outgrow it |
| --- | --- | --- |
| Render Web Service (BE) | 750 hours/month (always-on equivalent) | n/a for single service |
| Render Static Site (FE) | 100 GB bandwidth/month | thousands of demo views |
| Upstash Redis | 10k commands/day | ~2.5k create+read cycles/day |
| RIS APIs | Marketplace quotas | check your subscription tier |

If you blow past Upstash's 10k/day, the next tier is $0.20 per 100k commands — pay-as-you-go, no minimum.
