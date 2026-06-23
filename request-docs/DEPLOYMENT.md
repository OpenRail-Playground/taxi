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
                  ┌───────────┼───────────────────┐
                  │           │                   │
                  ▼           ▼                   ▼
            Upstash      DB RIS APIs       Excel (baked into image)
            Redis REST   (RIS v1+v2)       Bookingdata.xlsx
            (help-       (read-only)       (Render Secret File)
             requests)
```

Three external dependencies:

| Dependency | Why | Free? |
| --- | --- | --- |
| [Upstash Redis](https://upstash.com) | Persistence for help-requests (Render's free filesystem is ephemeral) | Yes, 10k commands/day |
| [DB API Marketplace](https://developers.deutschebahn.com) | RIS::Journeys v1+v2 for journey stops | Yes, subscribed via account |
| Booking spreadsheet | Local Excel (`Bookingdata_UPLOAD_custom_auftragsnummer.xlsx`) loaded at boot for `/bookings/validate` | Yes, ships in repo as a Render Secret File |

---

## Step 1 — Upstash Redis (5 min)

The free filesystem on Render is wiped on every restart. We use Upstash Redis instead for storing `HelpRequest` entities.

1. Sign up at [console.upstash.com](https://console.upstash.com) — GitHub OAuth, no credit card.
2. Create database:
   - **Name:** `taxi`
   - **Type:** Regional
   - **Region:** `eu-west-1` (Ireland) — closest to Render's Frankfurt region
   - **TLS:** enabled (default)
3. After creation, open the database → **REST API** tab. Copy two values:
   - `UPSTASH_REDIS_REST_URL` (looks like `https://xxx.upstash.io`)
   - `UPSTASH_REDIS_REST_TOKEN` (long base64 string)

Keep these handy — Render asks for them in Step 3.

**Verify locally** (optional):

```bash
export PERSISTENCE_BACKEND=redis
export UPSTASH_REDIS_REST_URL=https://xxx.upstash.io
export UPSTASH_REDIS_REST_TOKEN=<token>
cd request-backend
pnpm build
node dist/main.js
# In another terminal:
curl -s -X POST http://localhost:3000/help-requests ...   # should 201
```

Check the Upstash dashboard → **Data Browser**. You should see two keys: `help-request:<uuid>` and `help-request:_ids`.

---

## Step 2 — DB API Marketplace credentials

If you don't already have them, subscribe to **both** APIs on the [DB API Marketplace](https://developers.deutschebahn.com/db-api-marketplace):

- [RIS::Journeys (v1)](https://developers.deutschebahn.com/db-api-marketplace/apis/product/ris-journeys-transporteure) — for journey ID lookup
- [RIS::Journeys (v2)](https://developers.deutschebahn.com/db-api-marketplace/apis/product/ris-journeys-transporteure) — for per-stop detail

The two versions are separate subscriptions with independent credentials. You'll get four values total:

- `RIS_V1_CLIENT_ID`, `RIS_V1_API_KEY`
- `RIS_V2_CLIENT_ID`, `RIS_V2_API_KEY`

---

## Step 3 — Deploy to Render via Blueprint (15 min)

Render reads the [`render.yaml`](../render.yaml) at the repo root and provisions both services automatically.

### 3a. Connect the repo

1. Sign up at [render.com](https://render.com) — GitHub OAuth, no credit card.
2. **New +** → **Blueprint** → select the `taxi` repository.
3. Render detects `render.yaml` and previews two services: `taxi-backend` and `taxi-frontend`.
4. Click **Apply**. Render creates both services in `Pending` state — they will fail their first build because env vars are not set yet. This is expected.

### 3b. Set backend secrets

Open the `taxi-backend` service → **Environment**:

| Key | Value |
| --- | --- |
| `UPSTASH_REDIS_REST_URL` | from Step 1 |
| `UPSTASH_REDIS_REST_TOKEN` | from Step 1 |
| `RIS_V1_CLIENT_ID` | from Step 2 |
| `RIS_V1_API_KEY` | from Step 2 |
| `RIS_V2_CLIENT_ID` | from Step 2 |
| `RIS_V2_API_KEY` | from Step 2 |

Save. Render queues a redeploy automatically.

### 3c. Upload the booking Excel as a Secret File

The `Bookingdata_UPLOAD_custom_auftragsnummer.xlsx` file is gitignored on purpose — it must never live in the repo. Render's **Secret Files** feature mounts it into the container at boot.

Still on `taxi-backend` → **Environment** → scroll to **Secret Files** → **Add Secret File**:

| Field | Value |
| --- | --- |
| Filename | `Bookingdata.xlsx` |
| Contents | upload your local `.local/Bookingdata_UPLOAD_custom_auftragsnummer.xlsx` |

The file lands at `/etc/secrets/Bookingdata.xlsx`. The `BOOKING_DATA_PATH` env var in `render.yaml` already points there.

Save. Render redeploys.

### 3d. Set frontend env vars

Once the backend deploys successfully, Render assigns it a public URL like `https://taxi-backend-xxxx.onrender.com`. Copy it.

Open the `taxi-frontend` service → **Environment**:

| Key | Value |
| --- | --- |
| `BACKEND_URL` | `https://taxi-backend-xxxx.onrender.com` (no trailing slash) |
| `ASSET_PASSWORD` | from your local `request-frontend/.env` |
| `ASSET_INIT_VECTOR` | from your local `request-frontend/.env` |

The `ASSET_*` vars decrypt the DB-UX theme assets at install time. Without them the brand logo won't render but the rest of the app still works.

Save. Render redeploys.

### 3e. Verify

After both services finish building (~5 min each on free tier):

```bash
# Health
curl https://taxi-backend-xxxx.onrender.com/health
# → {"status":"ok","timestamp":"..."}

# Bookings validate (proves the Excel file mounted)
curl -s -X POST https://taxi-backend-xxxx.onrender.com/bookings/validate \
  -H 'Content-Type: application/json' \
  -d '{"auftragsnummer":"258376672881","lastName":"Mustermann"}'
# → {"trainNumber":"ICE 619","travelDate":"2026-05-29",...}

# Help-request create (proves Upstash is wired)
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

### Updating the Excel file

Render Secret Files don't auto-rebuild on edit. After uploading a new version:

1. **Manual Deploy** → **Clear build cache & deploy** on the backend service.
2. Wait ~5 min for the redeploy.

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
| `/bookings/validate` always returns 404 | Excel Secret File missing or filename mismatch | Check `BOOKING_DATA_PATH` matches the Secret File path. Look for `Loaded 0 bookings` (good path) vs no log line (file missing) in startup logs. |
| `/bookings/:id/journey-stops` returns 502 | RIS credentials missing or v1/v2 swapped | The two subscriptions are independent. Confirm v1 keys are in `RIS_V1_*` and v2 keys are in `RIS_V2_*`. |
| Frontend shows broken logo | `ASSET_PASSWORD` / `ASSET_INIT_VECTOR` not set during build | Set them on `taxi-frontend` → Environment, redeploy. The rest of the app works regardless. |
| Frontend XHR fails with CORS error | Backend rejected the origin | `app.enableCors({ origin: true })` accepts any origin. Check the browser console for the actual fetch URL — if it still points at `localhost:3000`, the build-time substitution failed; check `BACKEND_URL` is set on the frontend service and the build log shows `--define BACKEND_URL=...`. |
| First request after idle takes 30+ seconds | Backend was asleep | See "Sleep on idle" above. Add a cron ping or upgrade to Render Starter ($7/mo) for always-on. |
| `Loaded ~$Bookingdata...xlsx` errors in logs | The temp `~$` Excel lockfile got uploaded by mistake | Re-upload the Secret File. The macOS Office lockfile starts with `~$` and is not a valid xlsx. |

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
