# Taxi — Architecture (arc42, lightweight)

> Lightweight [arc42](https://arc42.org/) documentation for the Taxi project. Only filled in with what we already know — sections marked _TBD_ are placeholders for the team to grow as the prototype evolves.

The full challenge brief: [Digitalization of Taxi Vouchers and Passenger Pooling in Disruption Cases](https://hack4rail.org/challenges/digitalization-of-taxi-vouchers-and-passenger-pooling-in-disruption-cases/) (Hack4Rail 2026, challenge owners Michelle Stahl & Lutz Ritzel, DB).

---

## 1. Introduction and Goals

When trains are disrupted, passengers today are handed paper taxi vouchers — costly, slow, and clumsy. Taxi aims to be a self-service web platform that:

- verifies a passenger's eligibility for replacement transport,
- issues a digital taxi voucher,
- pools passengers heading the same way into shared rides,
- talks to multiple taxi providers via API to pick the best option.

The current repository is a prototype scaffold built during Hack4Rail 2026.

### Top quality goals
_TBD._

### Stakeholders
_TBD._

---

## 2. Architecture Constraints

| Constraint | Notes |
| --- | --- |
| License | [Apache 2.0](../LICENSE) |
| Origin | Hack4Rail 2026, OpenRail Association playground |
| Runtime | Node.js `>=24.16.0` (current LTS) |
| Package manager | [pnpm](https://pnpm.io/) `>=11.8`, one workspace per component |
| Frontend stack | Angular 21 standalone components |
| Frontend design | [DB UX design system](https://www.npmjs.com/org/db-ux) (public packages, asset decryption gated by Marketingportal credentials) |
| Backend stack | NestJS 11 on Express, strict TypeScript |
| Persistence | Pluggable via `PERSISTENCE_BACKEND` env var: `json` (one JSON file per id, local dev default) or `redis` (Upstash Redis REST, production). Both implementations live behind a `FileRepository<T>` contract. See [request-backend/src/persistence/README.md](../request-backend/src/persistence/README.md). |
| Reference data | Bookings spreadsheet: read from Excel in `json` mode; in `redis` mode, the same data lives as a Redis hash seeded once via [`pnpm seed:bookings`](../request-backend/scripts/seed-bookings.ts). |
| Shared types | TypeScript types in [`shared/`](../shared/), consumed by both apps directly |
| Repo style | Polyglot, no root package manager — every component is independent |
| Hosting | Render free tier (backend Web Service + frontend Static Site) + Upstash Redis free tier. See [DEPLOYMENT.md](DEPLOYMENT.md). |

---

## 3. Context and Scope

### Business context

```
+-----------+    help request     +---------------+    voucher / booking    +-----------------+
| Passenger | ------------------> | Taxi platform | ----------------------> | Taxi providers  |
+-----------+ <------------------ |  (this repo)  | <---------------------- |   (external)    |
              voucher / pooling   +---------------+   confirmation           +-----------------+
                                          ^
                                          |  eligibility data (DB systems)
                                          v
                                  +---------------+
                                  |  DB backends  |
                                  |  (external)   |
                                  +---------------+
```

External actors and systems we expect:

- **Passenger** — uses the web app on a phone, submits a help request.
- **Taxi providers** — external services we will call to book or issue vouchers. _Not integrated yet._
- **DB eligibility / disruption systems** — source of truth for whether a passenger is eligible. _Not integrated yet — currently stubbed in the backend._

### Technical context

Inbound HTTP surface (from browser):

- `POST /help-requests` — passenger submits the confirmation-screen payload; returns 201 + the created entity
- `GET /help-requests/:id` — retrieve a previously submitted HelpRequest by server-assigned id

The BE persists submitted HelpRequest entities and re-verifies them against the booking spreadsheet.

---

## 4. Solution Strategy

- **Two web components, one shared contract.** An Angular customer app (`request-frontend/`) and a NestJS backend (`request-backend/`) talk over HTTP; the API shape lives in `shared/` as plain TypeScript types so both ends compile against the same source.
- **Pluggable persistence behind a typed contract.** All entity storage goes through `FileRepository<T extends { id: string }>`. The `PERSISTENCE_BACKEND` env var selects the implementation: `json` (one JSON file per id, atomic temp-file rename, for local dev) or `redis` (Upstash REST, for serverless / ephemeral-filesystem hosts). Services depend on the interface, not the storage.
- **Bookings reference data follows the same fork.** In `json` mode the backend loads the Excel spreadsheet at boot into an in-memory `Map`. In `redis` mode the spreadsheet is seeded once into a Redis hash (`bookings`) by [`scripts/seed-bookings.ts`](../request-backend/scripts/seed-bookings.ts) and looked up at runtime via `HGET`. The Excel file never enters the deployed artifact.
- **DB UX out of the box.** Frontend uses the published `@db-ux/*` packages so DB-branded UI is consistent and accessible from day one.
- **Polyglot-ready repo layout.** No root package manager — each component manages its own dependencies, leaving room for non-Node components (e.g. a Python pooling service) later.
- **Anti-fraud re-check on every help-request submission.** FE submits the full confirmation-screen payload → BE re-verifies journey identity against `BookingsRepository` → persists via the active `FileRepository` → returns the entity with server-stamped id, createdAt, status, eligibility.
- **Free-tier production deploy.** Render Web Service + Static Site for the two apps, Upstash Redis for state. Configured as a Render Blueprint ([`render.yaml`](../render.yaml)) so the repo deploys with a single dashboard apply. Frontend backend URL is injected at build time via Angular's esbuild `--define` so no source files are mutated by the deploy.

---

## 5. Building Block View

### Level 1 — system overview

```
taxi/
├── request-frontend/   Angular customer app (DB UX design system)
├── request-backend/    NestJS service: HelpRequest CRUD, eligibility, vouchers
├── shared/             TypeScript types shared between frontend and backend
├── request-docs/       Architecture + deployment documentation
└── render.yaml         Render Blueprint (BE Web Service + FE Static Site)
```

| Component | Stack | Port (dev) | Notes |
| --- | --- | --- | --- |
| [`request-frontend/`](../request-frontend/) | Angular 21, DB UX, pnpm | `4200` | Hot-reload dev server expected on `4200` |
| [`request-backend/`](../request-backend/) | NestJS 11 on Express, pnpm | `3000` | `GET /health`, `POST /bookings/validate`, `GET /bookings/:id/journey-stops`, `POST /help-requests`, `GET /help-requests/:id` |
| [`shared/`](../shared/) | TypeScript types, pnpm | — | `HelpRequest`, `CreateHelpRequestDto`, `EligibilityResult` |
| [`request-docs/`](.) | Markdown | — | This file + [DEPLOYMENT.md](DEPLOYMENT.md) |

### Level 2 — request-backend internals

```
request-backend/src/
├── main.ts                bootstrap (NestFactory, CORS, port 3000)
├── load-env.ts            process.loadEnvFile() side effect imported first
├── app.module.ts          root module
├── health/                GET /health
├── bookings/              POST /bookings/validate + GET /bookings/:auftragsnummer/journey-stops
│                          - bookings.repository.ts        abstract BookingsRepository + ExcelBookingsRepository (json mode)
│                          - redis-bookings.repository.ts  RedisBookingsRepository (redis mode, HGET-backed)
├── help-requests/         HelpRequestModule: POST /help-requests, GET /help-requests/:id
├── ris/                   RisJourneysClient + RisJourneysModule (DB RIS API integration)
└── persistence/           FileRepository<T> contract + JsonFileRepository + RedisRepository + module switch
```

Build scripts (`request-backend/scripts/`):

- `seed-bookings.ts` — one-shot Node script. Reads the local xlsx, pipelines `HSET bookings <id> <json>` to Upstash in 500-row batches. Idempotent. Wired as `pnpm seed:bookings`.

| Module | Providers | Depends on |
| --- | --- | --- |
| `HelpRequestModule` | `HelpRequestController`, `HelpRequestService`, `HelpRequestVerifier` | `PersistenceModule.forFeature({ entity: 'help-request' })`, `BookingsModule` |
| `BookingsModule` | `BookingsController`, `BookingsRepository` (impl chosen at provider construction by `PERSISTENCE_BACKEND`), `JourneyStopsService` | `RisJourneysModule` |
| `PersistenceModule` | `FileRepository<T>` per entity (JSON or Redis impl chosen at provider construction by `PERSISTENCE_BACKEND`) | — |

### Level 2 — request-frontend internals
_TBD — currently a single app shell using DB UX (`<db-page>`, `<db-header>`, `<db-brand>`, `<db-icon>`). Backend URL is provided via a build-time esbuild `define` over `BACKEND_URL` (see [`angular.json`](../request-frontend/angular.json) and [`environment.ts`](../request-frontend/src/environments/environment.ts))._

---

## 6. Runtime View

### Journey stops flow (issue #8)

```
Passenger (frontend)
  → POST /bookings/validate { auftragsnummer, lastName }
  ← 200 { trainNumber, travelDate, destinationStation, passengerCount }

  → GET /bookings/:auftragsnummer/journey-stops
  ← 200 { stops: [ { evaNumber, name, scheduledTime, cancelled }, ... ] }
        (stops truncated at passenger's destinationStation, inclusive)
```

Backend two-step RIS call:
1. `RIS::Journeys v1 GET /byrelation?number={N}&category={CAT}&date={DATE}` — resolves a `journeyID` from the train number and travel date. Uses historical data, so it works for past dates.
2. `RIS::Journeys v2 GET /{journeyID}` — fetches all stop events for that journey. Returns inline `cancelled` boolean per stop.

Both calls require `Accept: application/vnd.de.db.ris+json` and separate `DB-Client-ID` / `DB-Api-Key` credential pairs (v1 and v2 use different subscriptions — see `request-backend/.env.example`).

**Hackathon test data:** booking `258376699013`, train `ICE 647`, date `2026-05-29`. Journey has 15 stops with 12 cancelled from Düsseldorf Flughafen onward. The passenger's destination (Düsseldorf Hbf) is the 2nd stop and is not cancelled.

_Other runtime flows (eligibility, voucher issuance, pooling) are TBD._

### Help-request flows (issue #11)

```
(a) Create flow:
    FE --(POST /help-requests)--> HelpRequestController
    HelpRequestController --> HelpRequestVerifier.verify(input)      [throws 404/403 on mismatch]
                                ↳ BookingsRepository.findByAuftragsnummer()
                                  ↳ Excel Map (json mode)  OR  HGET bookings:<id> (redis mode)
    HelpRequestController --> HelpRequestService.create()
    HelpRequestService --> FileRepository.create()                   [201 + entity]
                            ↳ writeAtomically(<id>.json) (json mode)
                              OR  SET help-request:<id> + SADD help-request:_ids (redis mode)

(b) Refetch flow:
    FE --(GET /help-requests/:id)--> HelpRequestController.findById()
    HelpRequestController --> HelpRequestService.findById()
    HelpRequestService --> FileRepository.findById()                 [200/404]
                            ↳ readFile(<id>.json) (json mode)
                              OR  GET help-request:<id> (redis mode)
```

---

## 7. Deployment View

### Local development

- `pnpm dev` in `request-backend/` → http://localhost:3000 (defaults to `PERSISTENCE_BACKEND=json`, loads Excel from `<repo>/.local/`)
- `pnpm start` in `request-frontend/` → http://localhost:4200 (hot reload; `BACKEND_URL` defaults to `http://localhost:3000` via the build-time `define` in `angular.json`)

### Production (Render + Upstash, free tier, $0/month)

```
Browser
  │
  ▼
┌────────────────────────────────┐
│ taxi-frontend.onrender.com     │   Render Static Site (CDN, always-on)
│ Angular SPA, BACKEND_URL       │
│ baked in at build time         │
└──────────────┬─────────────────┘
               │  XHR
               ▼
┌────────────────────────────────┐
│ taxi-backend.onrender.com      │   Render Web Service (free, sleeps 15 min idle)
│ NestJS, PERSISTENCE_BACKEND=   │
│ redis                          │
└──────────────┬─────────────────┘
               │
        ┌──────┴─────────────────────────────┐
        ▼                                    ▼
┌──────────────────────┐          ┌─────────────────────────┐
│ Upstash Redis (eu-w1)│          │ DB API Marketplace      │
│ - bookings hash      │          │ RIS::Journeys v1 + v2   │
│ - help-request:<id>  │          │ (read-only)             │
│ - help-request:_ids  │          │                         │
└──────────────────────┘          └─────────────────────────┘
```

Provisioned declaratively from [`render.yaml`](../render.yaml). End-to-end walkthrough (Upstash setup, seed script, Render Blueprint apply, env vars, verification curls, troubleshooting) lives in [`DEPLOYMENT.md`](DEPLOYMENT.md).

Key non-obvious bits:

- The booking Excel **never enters the deployed artifact**. It stays on the developer's machine; `pnpm seed:bookings` reads it locally and pipelines `HSET bookings <id> <json>` into Upstash. Re-run when the data changes.
- The frontend backend URL is **injected at build time** via Angular's esbuild `define` (`ng build --define BACKEND_URL="\"…\""`). No source mutation, fully type-checked through `declare const BACKEND_URL: string` in [`environment.ts`](../request-frontend/src/environments/environment.ts).
- The free Render Web Service **sleeps after 15 min of inactivity**, ~30-60 s cold start. Mitigate for live demos with a cron-ping on `/health` or upgrade to Render Starter ($7/month) for always-on.

---

## 8. Crosscutting Concepts

### Shared API contract
The single source of truth for cross-component types is [`shared/src/index.ts`](../shared/src/index.ts). Both apps import from `@taxi/shared` directly (no build step — types resolve at TypeScript level). New API surface is added here first, reviewed jointly by frontend and backend.

### Persistence pattern
Backend persistence goes through a generic `FileRepository<T extends { id: string }>` contract (see [`request-backend/src/persistence/`](../request-backend/src/persistence/)). Storage details — JSON file per id with atomic writes for local dev, or Upstash Redis SET+kv for serverless — are hidden behind the interface so services depend on "a repository", not on the storage. The active implementation is chosen at provider construction time via the `PERSISTENCE_BACKEND` env var (`json` default, `redis` for serverless / ephemeral-filesystem hosts).

### Bookings reference data
The bookings spreadsheet follows the same fork as entity persistence. In `json` mode `ExcelBookingsRepository` loads the xlsx into an in-memory `Map` at boot. In `redis` mode `RedisBookingsRepository` looks up each booking via `HGET bookings <auftragsnummer>`; the hash is seeded once from the local xlsx by [`scripts/seed-bookings.ts`](../request-backend/scripts/seed-bookings.ts). Both implementations expose the same async `findByAuftragsnummer(id): Promise<BookingRecord | undefined>` contract, so the verifier and controllers are agnostic to which is active.

### Design system
Frontend uses the [DB UX](https://www.npmjs.com/org/db-ux) public packages. Brand assets ship encrypted in the package and are decrypted at install time using credentials in `request-frontend/.env` (`ASSET_PASSWORD`, `ASSET_INIT_VECTOR`). Without these, the brand logo and icons won't render — the rest of the app still works.

### RIS API integration
The backend integrates with two flavours of the DB **RIS::Journeys** API to retrieve live journey stop data:

- **v1** (`https://apis.deutschebahn.com/db/apis/ris-journeys/v1`) — used for `/byrelation` lookups. Contains historical data, so it reliably resolves train numbers from past dates (required for hackathon demo data).
- **v2** (`https://apis.deutschebahn.com/db/apis/ris-journeys/v2`) — used for `/{journeyID}` detail. Returns all stop events with real-time cancellation status.

Both APIs require `Accept: application/vnd.de.db.ris+json` (not standard `application/json`) and a `DB-Client-ID` + `DB-Api-Key` header pair. v1 and v2 use **separate credential subscriptions** — four env vars total (`RIS_V1_CLIENT_ID`, `RIS_V1_API_KEY`, `RIS_V2_CLIENT_ID`, `RIS_V2_API_KEY`). See `request-backend/.env.example`.

Credentials are loaded from the environment at runtime — never committed. The `RisJourneysClient` service (in `request-backend/src/ris/`) wraps both calls behind typed methods.

### API keys and secrets
All secrets (RIS credentials, Upstash REST URL+token, DB-UX asset decryption) are stored in component-local `.env` files (gitignored). The committed `.env.example` files document every required variable with empty values. Never commit `.env` or any file containing real credentials. On Render the same secrets are pasted into the service's Environment page (all marked `sync: false` in `render.yaml` so the dashboard prompts for them on first apply).

### Anti-fraud re-verification
Every `POST /help-requests` re-checks `trainNumber`, `travelDate`, `finalDestination` (mapped to `record.destinationStation`), and `adults+kids` (mapped to `record.passengerCount`) against `BookingsRepository`; a mismatch returns 403 Forbidden. `disruptionStation` is user-editable after the disruption occurs and is intentionally exempt from the check.

---

## 9. Architecture Decisions

Lightweight ADR list. Add a new row when a decision is load-bearing.

| # | Decision | Status | Rationale (one line) |
| --- | --- | --- | --- |
| 1 | Polyglot repo, no root package manager | accepted | Room for non-Node components later. |
| 2 | DB UX design system over a custom stack | accepted | DB-branded UI out of the box, accessibility built in. |
| 3 | Pluggable persistence (`FileRepository<T>` contract; `json` for local dev, `redis` for serverless) | accepted | No DB ops cost for local dev; unblocks $0 free-tier serverless deploys (Render, Vercel) where the filesystem is ephemeral. Both implementations live behind the same interface so services don't know which is active. |
| 4 | Server-generated UUID v4 ids for persisted entities | accepted | Removes a whole class of id-validation bugs from consumers. |
| 5 | RIS v1 for journey lookup, v2 for stop detail | accepted | v1 contains historical data needed for demo date (2026-05-29); v2 has the richer per-stop cancellation model. |
| 6 | Separate RIS credential pairs per API version | accepted | v1 and v2 are distinct marketplace subscriptions with independent rate limits. |
| 7 | `node:fetch` (Node 24 built-in) as HTTP client | accepted | Zero new dependencies; Node 24 exposes fetch globally and `@types/node@24` covers the types. |
| 8 | Stateless journey-stops endpoint | accepted | No session management cost; client already holds the `auftragsnummer` from the validate step. |
| 9 | Destination truncation inclusive, case-insensitive | accepted | Passenger's destination station is the last meaningful stop; case-insensitive trim handles data inconsistencies between booking Excel and RIS name strings. |
| 10 | Cancelled stops returned in list, not filtered out | accepted | Frontend needs to show which stops are affected to justify the taxi offer. |
| 11 | Bookings reference data follows the same `PERSISTENCE_BACKEND` fork as entities (Excel `Map` for json, Redis hash for redis) | accepted | Render's Secret Files rejected the 1.3 MB xlsx with opaque errors and capped at 1 MB anyway. Seeding once into Upstash via `pnpm seed:bookings` removes the file from the deploy entirely and keeps `findByAuftragsnummer` at O(1). |
| 12 | Frontend `BACKEND_URL` injected at build time via Angular's esbuild `--define` | accepted | Idiomatic for `@angular/build:application`. Avoids the legacy `fileReplacements`+duplicate-environment.prod.ts pattern (which mutated source files on the build host) and the `sed`-based alternative. Build output contains a string literal; zero runtime cost; type-checked via `declare const`. |
| 13 | Deploy as a Render Blueprint (BE Web Service + FE Static Site) backed by Upstash | accepted | Free tier on both, no credit card. Single `render.yaml` provisions both services; secrets stay out of the repo as `sync: false`. Trade-off accepted: 15-min idle sleep on the free Web Service. |
| ADR-005 | Strict equality re-check on POST /help-requests, returning 403 on tampering; disruptionStation exempt | accepted | disruptionStation is user-editable after disruption and is not part of the booking record. |

---

## 10. Quality Requirements

_TBD._

---

## 11. Risks and Technical Debt

_Known issues to address as the prototype grows:_

- No real eligibility source — the backend currently stubs eligibility as a hard-coded `eligible: true` once the booking re-check passes.
- No taxi-provider integrations yet — pooling/booking is theoretical.
- JSON-file persistence (local dev) is not crash-durable (no `fsync`) and is single-instance only. Redis persistence (production) has no transactional guarantees: a crash between `SET <entity>:<id>` and `SADD <entity>:_ids` can leave an entity stored but unlisted by `findAll()`. Acceptable for hackathon use.
- DB UX asset decryption depends on Marketingportal credentials living in `.env` — onboarding cost for new contributors.
- RIS API dependency: journey-stops endpoint will fail gracefully (502/504) when RIS is unavailable, but there is no fallback data source.
- trainNumber parsing assumes "CATEGORY NUMBER" format with a space (e.g. "ICE 619"). Non-standard formats (e.g. "S1", "RE 1a") are rejected with 422.
- v1 journey disambiguation: when multiple journeys match the same category+number+date (e.g. split runs), the first match is used. A warning is logged but no smarter selection is implemented.
- Bookings reference data in production is a manual `pnpm seed:bookings` step. The deployed backend will not pick up xlsx changes until the seed is re-run.
- Free Render Web Service sleeps after 15 min of inactivity → 30-60s cold start. Mitigated by an optional cron-ping or by upgrading to Render Starter ($7/month).
- Upstash free tier caps at 10k commands/day. A noisy demo (or a misbehaving cron-ping loop) can exhaust it.

---

## 12. Glossary

| Term | Meaning |
| --- | --- |
| Help request | A passenger's submission asking for assistance during a train disruption. |
| HelpRequest | A passenger's assistance request submitted via the confirmation screen, containing journey, contact, and passenger details. The server-persisted entity with id, createdAt, status, and eligibility fields. |
| Eligibility | Whether the passenger qualifies for a replacement-transport voucher under DB's rules. |
| Voucher | A digital token entitling the passenger to a taxi ride at DB's expense. |
| Pooling | Combining multiple help requests with compatible routes into a shared taxi ride. |
| DB UX | DB's public design system, published under the `@db-ux/*` npm scope. |
| Betriebspunkt | An operational stop point on a railway journey (German: operating point). Used in RIS API responses. |
| RIS | Rail Information System — DB's internal real-time train information platform. Exposed via `RIS::Journeys` API. |
| EVA number | A numeric station identifier used in the German rail network (e.g. `8000085` = Düsseldorf Hbf). |
| Auftragsnummer | DB booking/order number used to look up a passenger's ticket (12-digit numeric string). |
| Journey ID | Unique RIS identifier for a specific train run on a specific date, returned by `RIS::Journeys v1`. |
| `PERSISTENCE_BACKEND` | Env var selecting the backend implementation at runtime: `json` (local dev default) or `redis` (production). Drives both `FileRepository<T>` (help-requests) and `BookingsRepository` (reference data). |
| `BACKEND_URL` | Build-time constant injected into the frontend bundle via Angular's esbuild `define`. Defaults to `http://localhost:3000`; overridden by `ng build --define BACKEND_URL="\"…\""` during the Render build. |
| Upstash | Serverless Redis provider with a REST API and a perpetual free tier (10k commands/day). Used here for help-request persistence and the bookings reference hash. |
| Render Blueprint | A `render.yaml` file at the repo root that declaratively provisions Render services. Render reads it on first connect and on every push to the watched branch. |
