# Taxi Request Backend

NestJS service (on Express) for creating and managing [`HelpRequest`](../shared/src/index.ts) entities, plus eligibility checks. Skeleton only — only `/health` works for now.

## Prerequisites

- Node `>=24.16.0` (current LTS, see [.nvmrc](.nvmrc))
- [pnpm](https://pnpm.io/installation) `>=11.8`

## Install & run

```bash
pnpm install
pnpm dev            # http://localhost:3000
```

## Build

```bash
pnpm build          # outputs to dist/
pnpm start          # runs the built bundle
```

## Health check

```bash
curl -s http://localhost:3000/health
```

Returns `{ "status": "ok", "timestamp": "..." }`.

## Layout

```
request-backend/
├── src/
│   ├── main.ts            # bootstrap
│   ├── app.module.ts      # root module
│   └── health/            # health module (sample)
├── data/                  # file-based JSON storage (one folder per entity, gitignored)
├── nest-cli.json
├── package.json
└── tsconfig.json
```

Persistence is handled by the [`persistence` module](src/persistence/README.md) — a generic JSON-file-backed `FileRepository<T>` contract with atomic writes and no external dependencies.
