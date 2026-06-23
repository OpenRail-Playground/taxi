# Taxi

Help passengers on disrupted train journeys.

<p align="center">
  <img alt="Hack4Rail Logo" src="img/hack4rail-logo.jpg" width="400"/>
</p>

This project was initiated during [Hack4Rail 2026](https://hack4rail.org/), a joint hackathon by SBB, ÖBB, and DB in partnership with the OpenRail Association.

See issue [#1](https://github.com/OpenRail-Playground/taxi/issues/1) for scope.

## Live

| Surface | URL | Notes |
|---|---|---|
| Frontend | https://taxi-frontend-loyq.onrender.com | Render Static Site, always-on |
| Backend  | https://taxi-backend-iq95.onrender.com  | Render Web Service, free tier — sleeps after 15 min idle (cold start ~30–60 s) |
| Health   | https://taxi-backend-iq95.onrender.com/health | Use this to wake the backend before a demo |

## Layout

The repo holds three top-level packages. There is intentionally **no root package manager**: each component manages its own dependencies because the repo will host multiple stacks (Node, Python, ...).

```
.
├── request-frontend/   # Angular customer app (DB UX design system)
├── request-backend/    # NestJS service for HelpRequest creation & management
└── shared/             # TypeScript types shared between frontend and backend
```

| Component | Stack | Port (dev) | Docs |
|---|---|---|---|
| [`request-frontend/`](request-frontend/) | Angular 21, DB UX, pnpm | `4200` | [request-frontend/README.md](request-frontend/README.md) |
| [`request-backend/`](request-backend/) | NestJS 11 on Express, pnpm | `3000` | [request-backend/README.md](request-backend/README.md) |
| [`shared/`](shared/) | TypeScript types, pnpm | — | — |

## Prerequisites

- Node `>=24.16.0` (current LTS, install via [nvm](https://github.com/nvm-sh/nvm))
- [pnpm](https://pnpm.io/installation) `>=11.8`

Frontend additionally needs DB-UX decryption secrets in `request-frontend/.env`. See [request-frontend/README.md](request-frontend/README.md#db-theme-decryption).

## Quickstart

Backend:

```bash
cd request-backend
pnpm install
pnpm dev            # http://localhost:3000/health
```

Frontend (in a second terminal):

```bash
cd request-frontend
pnpm install
pnpm start          # http://localhost:4200
```

## License

[Apache 2.0](LICENSE).
