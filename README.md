# Taxi

Help passengers on disrupted train journeys.

<p align="center">
  <img alt="Hack4Rail Logo" src="img/hack4rail-logo.jpg" width="400"/>
</p>

This project was initiated during [Hack4Rail 2026](https://hack4rail.org/), a joint hackathon by SBB, ÖBB, and DB in partnership with the OpenRail Association.

See issue [#1](https://github.com/OpenRail-Playground/taxi/issues/1) for scope of customer facing components.

## Live

| Surface  | URL                            | Notes                                                                          |
|----------|--------------------------------|--------------------------------------------------------------------------------|
| Frontend | https://dbringer.de            | Render Static Site, always-on                                                  |
| Backend  | https://api.dbringer.de        | Render Web Service, free tier — sleeps after 15 min idle (cold start ~30–60 s) |
| Health   | https://api.dbringer.de/health | Use this to wake the backend before a demo                                     |
| Pooling  | :(                             | Not live yet                                                                   |

## Layout

The repo holds four top-level packages. There is intentionally **no root package manager**: each component manages its own dependencies because the repo will host multiple stacks (Node, Python, ...).

```
.
├── request-frontend/   # Angular customer app (DB UX design system)
├── request-backend/    # NestJS service for HelpRequest creation & management
├── shared/             # TypeScript types shared between frontend and backend
└── pooling/            # Python service for pooling customers on taxi rides
```

| Component                                | Stack                     | Port (dev) | Docs                                                     |
|------------------------------------------|---------------------------|-----------|----------------------------------------------------------|
| [`request-frontend/`](request-frontend/) | Angular 21, DB UX, pnpm   | `4200`    | [request-frontend/README.md](request-frontend/README.md) |
| [`request-backend/`](request-backend/)   | NestJS 11 on Express, pnpm | `3000`    | [request-backend/README.md](request-backend/README.md)   |
| [`shared/`](shared/)                     | TypeScript types, pnpm    | —         | —                                                        |
| [`pooling/`](pooling/)                   | Python                    | `8001`     | [pooling/README.md](pooling/README.md)           |

## Prerequisites

- Node `>=24.16.0` (current LTS, install via [nvm](https://github.com/nvm-sh/nvm))
- [pnpm](https://pnpm.io/installation) `>=11.8`
- Python `>=3.14`

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

Pooling service (in a third terminal):

```bash
pip install -r requirements.txt
python -m uvicorn pooling.api:app --host 127.0.0.1 --port 8001 # http://localhost:8001
```

## License

[Apache 2.0](LICENSE).
