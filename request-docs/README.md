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
| Persistence | JSON file per entity (see [request-backend/src/persistence/README.md](../request-backend/src/persistence/README.md) once issue #6 lands); no database for the hackathon |
| Shared types | TypeScript types in [`shared/`](../shared/), consumed by both apps directly |
| Repo style | Polyglot, no root package manager — every component is independent |

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
_TBD — will be filled in once a real flow exists end-to-end._

---

## 4. Solution Strategy

- **Two web components, one shared contract.** An Angular customer app (`request-frontend/`) and a NestJS backend (`request-backend/`) talk over HTTP; the API shape lives in `shared/` as plain TypeScript types so both ends compile against the same source.
- **File-based persistence first.** The backend stores entities as one JSON file per id under `data/<entity>/<id>.json`, hidden behind a typed `FileRepository<T>` contract. Lets us iterate without a database during the hackathon, and swaps cleanly to a real store later.
- **DB UX out of the box.** Frontend uses the published `@db-ux/*` packages so DB-branded UI is consistent and accessible from day one.
- **Polyglot-ready repo layout.** No root package manager — each component manages its own dependencies, leaving room for non-Node components (e.g. a Python pooling service) later.

---

## 5. Building Block View

### Level 1 — system overview

```
taxi/
├── request-frontend/   Angular customer app (DB UX design system)
├── request-backend/    NestJS service: HelpRequest CRUD, eligibility, vouchers
├── shared/             TypeScript types shared between frontend and backend
└── request-docs/       This documentation
```

| Component | Stack | Port (dev) | Notes |
| --- | --- | --- | --- |
| [`request-frontend/`](../request-frontend/) | Angular 21, DB UX, pnpm | `4200` | Hot-reload dev server expected on `4200` |
| [`request-backend/`](../request-backend/) | NestJS 11 on Express, pnpm | `3000` | `GET /health`, `POST /bookings/validate`, `GET /bookings/:id/journey-stops` (issue #8) |
| [`shared/`](../shared/) | TypeScript types, pnpm | — | `HelpRequest`, `CreateHelpRequestDto`, `EligibilityResult` |
| [`request-docs/`](.) | Markdown | — | arc42 (this file) |

### Level 2 — request-backend internals

```
request-backend/src/
├── main.ts                bootstrap (NestFactory, CORS, port 3000)
├── app.module.ts          root module
├── health/                GET /health
├── bookings/              POST /bookings/validate + GET /bookings/:auftragsnummer/journey-stops
├── ris/                   RisJourneysClient + RisJourneysModule (DB RIS API integration)
└── persistence/           generic file-based repository (issue #6)
```

### Level 2 — request-frontend internals
_TBD — currently a single app shell using DB UX (`<db-page>`, `<db-header>`, `<db-brand>`, `<db-icon>`)._

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

---

## 7. Deployment View

_TBD — only local development today:_

- `pnpm dev` in `request-backend/` → http://localhost:3000
- `pnpm start` in `request-frontend/` → http://localhost:4200 (hot reload)

No CI, no container build, no hosting environment defined yet.

---

## 8. Crosscutting Concepts

### Shared API contract
The single source of truth for cross-component types is [`shared/src/index.ts`](../shared/src/index.ts). Both apps import from `@taxi/shared` directly (no build step — types resolve at TypeScript level). New API surface is added here first, reviewed jointly by frontend and backend.

### Persistence pattern
Backend persistence goes through a generic `FileRepository<T extends { id: string }>` contract (see issue #6 and `request-backend/src/persistence/`). Storage details (one JSON file per id, atomic writes, UUID v4 ids) are hidden behind the interface so services depend on "a repository", not on the filesystem.

### Design system
Frontend uses the [DB UX](https://www.npmjs.com/org/db-ux) public packages. Brand assets ship encrypted in the package and are decrypted at install time using credentials in `request-frontend/.env` (`ASSET_PASSWORD`, `ASSET_INIT_VECTOR`). Without these, the brand logo and icons won't render — the rest of the app still works.

### RIS API integration
The backend integrates with two flavours of the DB **RIS::Journeys** API to retrieve live journey stop data:

- **v1** (`https://apis.deutschebahn.com/db/apis/ris-journeys/v1`) — used for `/byrelation` lookups. Contains historical data, so it reliably resolves train numbers from past dates (required for hackathon demo data).
- **v2** (`https://apis.deutschebahn.com/db/apis/ris-journeys/v2`) — used for `/{journeyID}` detail. Returns all stop events with real-time cancellation status.

Both APIs require `Accept: application/vnd.de.db.ris+json` (not standard `application/json`) and a `DB-Client-ID` + `DB-Api-Key` header pair. v1 and v2 use **separate credential subscriptions** — four env vars total (`RIS_V1_CLIENT_ID`, `RIS_V1_API_KEY`, `RIS_V2_CLIENT_ID`, `RIS_V2_API_KEY`). See `request-backend/.env.example`.

Credentials are loaded from the environment at runtime — never committed. The `RisJourneysClient` service (in `request-backend/src/ris/`) wraps both calls behind typed methods.

### API keys and secrets
All secrets (RIS credentials, booking data path) are stored in `request-backend/.env` (gitignored). The committed `request-backend/.env.example` documents every required variable with empty values. Never commit `.env` or any file containing real credentials.

---

## 9. Architecture Decisions

Lightweight ADR list. Add a new row when a decision is load-bearing.

| # | Decision | Status | Rationale (one line) |
| --- | --- | --- | --- |
| 1 | Polyglot repo, no root package manager | accepted | Room for non-Node components later. |
| 2 | DB UX design system over a custom stack | accepted | DB-branded UI out of the box, accessibility built in. |
| 3 | File-based JSON persistence for the hackathon | accepted | No DB ops cost; swap out behind the `FileRepository` interface later. |
| 4 | Server-generated UUID v4 ids for persisted entities | accepted | Removes a whole class of id-validation bugs from consumers. |
| 5 | RIS v1 for journey lookup, v2 for stop detail | accepted | v1 contains historical data needed for demo date (2026-05-29); v2 has the richer per-stop cancellation model. |
| 6 | Separate RIS credential pairs per API version | accepted | v1 and v2 are distinct marketplace subscriptions with independent rate limits. |
| 7 | `node:fetch` (Node 24 built-in) as HTTP client | accepted | Zero new dependencies; Node 24 exposes fetch globally and `@types/node@24` covers the types. |
| 8 | Stateless journey-stops endpoint | accepted | No session management cost; client already holds the `auftragsnummer` from the validate step. |
| 9 | Destination truncation inclusive, case-insensitive | accepted | Passenger's destination station is the last meaningful stop; case-insensitive trim handles data inconsistencies between booking Excel and RIS name strings. |
| 10 | Cancelled stops returned in list, not filtered out | accepted | Frontend needs to show which stops are affected to justify the taxi offer. |

---

## 10. Quality Requirements

_TBD._

---

## 11. Risks and Technical Debt

_TBD. Known starting points to capture as the prototype grows:_

- No real eligibility source — currently the backend will need a stub.
- No taxi-provider integrations yet — pooling/booking is theoretical.
- File-based persistence is not crash-durable (no `fsync`) and assumes a single backend instance.
- DB UX asset decryption depends on Marketingportal credentials living in `.env` — onboarding cost for new contributors.
- RIS API dependency: journey-stops endpoint will fail gracefully (502) when RIS is unavailable, but there is no fallback data source.
- trainNumber parsing assumes "CATEGORY NUMBER" format with a space (e.g. "ICE 619"). Non-standard formats (e.g. "S1", "RE 1a") are rejected with 422.
- v1 journey disambiguation: when multiple journeys match the same category+number+date (e.g. split runs), the first match is used. A warning is logged but no smarter selection is implemented.

---

## 12. Glossary

| Term | Meaning |
| --- | --- |
| Help request | A passenger's submission asking for assistance during a train disruption. |
| Eligibility | Whether the passenger qualifies for a replacement-transport voucher under DB's rules. |
| Voucher | A digital token entitling the passenger to a taxi ride at DB's expense. |
| Pooling | Combining multiple help requests with compatible routes into a shared taxi ride. |
| DB UX | DB's public design system, published under the `@db-ux/*` npm scope. |
| Betriebspunkt | An operational stop point on a railway journey (German: operating point). Used in RIS API responses. |
| RIS | Rail Information System — DB's internal real-time train information platform. Exposed via `RIS::Journeys` API. |
| EVA number | A numeric station identifier used in the German rail network (e.g. `8000085` = Düsseldorf Hbf). |
| Auftragsnummer | DB booking/order number used to look up a passenger's ticket (12-digit numeric string). |
| Journey ID | Unique RIS identifier for a specific train run on a specific date, returned by `RIS::Journeys v1`. |
