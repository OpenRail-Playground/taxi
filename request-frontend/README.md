# Taxi Request Frontend

Angular customer-facing app for creating [`HelpRequest`](../shared/src/index.ts) entries. Skeleton only — no business logic yet.

This is the first of potentially several frontends in this repo (hence the `request-` prefix).

Bootstrapped from the public [DB UX core-web](https://github.com/db-ux-design-system/core-web) packages on npm.

## Prerequisites

- Node `>=24.16.0` (current LTS, see [.nvmrc](.nvmrc))
- [pnpm](https://pnpm.io/installation) `>=11.8`

## DB Theme decryption

`@db-ux/db-theme` ships brand assets encrypted. They are decrypted automatically by the package's `postinstall` script, but it needs two env vars at install time. See the [package README on npm](https://www.npmjs.com/package/@db-ux/db-theme) for how to obtain them.

Create `request-frontend/.env` (already gitignored):

```bash
ASSET_PASSWORD=...
ASSET_INIT_VECTOR=...
```

`pnpm install` picks these up automatically. If your shell does not auto-load `.env`, source it before installing:

```bash
set -a && source .env && set +a
pnpm install
```

The DB-theme install scripts are on the [`allowBuilds`](pnpm-workspace.yaml) list so pnpm will run them.

## Install & run

```bash
pnpm install
pnpm start          # http://localhost:4200
```

## Build

```bash
pnpm build          # outputs to dist/
```

## Lint & test

```bash
pnpm lint
pnpm lint:styles
pnpm test
```

## Layout

```
request-frontend/
├── src/
│   ├── app/          # Angular app shell (standalone components)
│   ├── environments/ # environment.ts / environment.prod.ts
│   ├── index.html
│   ├── main.ts
│   └── styles.scss   # DB UX whitelabel + theme imports
├── public/           # static assets copied to build output
├── angular.json
├── package.json
├── pnpm-workspace.yaml
└── tsconfig*.json
```
