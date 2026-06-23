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
| [`request-backend/`](../request-backend/) | NestJS 11 on Express, pnpm | `3000` | Currently exposes only `GET /health` |
| [`shared/`](../shared/) | TypeScript types, pnpm | — | `HelpRequest`, `CreateHelpRequestDto`, `EligibilityResult` |
| [`request-docs/`](.) | Markdown | — | arc42 (this file) |

### Level 2 — request-backend internals

```
request-backend/src/
├── main.ts                bootstrap (NestFactory, CORS, port 3000)
├── app.module.ts          root module
├── health/                GET /health
└── persistence/           generic file-based repository (issue #6)
```

### Level 2 — request-frontend internals
_TBD — currently a single app shell using DB UX (`<db-page>`, `<db-header>`, `<db-brand>`, `<db-icon>`)._

---

## 6. Runtime View

_TBD — no real end-to-end flows implemented yet. Candidates to document once they exist:_

- Passenger submits a help request → eligibility check → voucher issued.
- Backend pools matching help requests → assigns shared taxi.
- Frontend polls / subscribes for voucher status.

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

### Other concerns
_TBD — security, logging, error handling, i18n, accessibility beyond DB UX defaults._

---

## 9. Architecture Decisions

Lightweight ADR list. Add a new row when a decision is load-bearing.

| # | Decision | Status | Rationale (one line) |
| --- | --- | --- | --- |
| 1 | Polyglot repo, no root package manager | accepted | Room for non-Node components later. |
| 2 | DB UX design system over a custom stack | accepted | DB-branded UI out of the box, accessibility built in. |
| 3 | File-based JSON persistence for the hackathon | accepted | No DB ops cost; swap out behind the `FileRepository` interface later. |
| 4 | Server-generated UUID v4 ids for persisted entities | accepted | Removes a whole class of id-validation bugs from consumers. |

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

---

## 12. Glossary

| Term | Meaning |
| --- | --- |
| Help request | A passenger's submission asking for assistance during a train disruption. |
| Eligibility | Whether the passenger qualifies for a replacement-transport voucher under DB's rules. |
| Voucher | A digital token entitling the passenger to a taxi ride at DB's expense. |
| Pooling | Combining multiple help requests with compatible routes into a shared taxi ride. |
| DB UX | DB's public design system, published under the `@db-ux/*` npm scope. |
