# Contribution guidelines

Thanks for your interest. Issues and pull requests are welcome. Be kind.

By submitting a contribution you agree that it falls under the repository's [Apache 2.0](LICENSE) license and that you have the right to submit it.

## Repository layout

This is a polyglot repo with no root package manager. Each component manages its own dependencies:

- [`request-frontend/`](request-frontend/) — Angular app, pnpm. See [`request-frontend/README.md`](request-frontend/README.md).
- [`request-backend/`](request-backend/) — NestJS app, pnpm. See [`request-backend/README.md`](request-backend/README.md).
- [`shared/`](shared/) — TypeScript types shared between frontend and backend, pnpm.
- [`pooling/`](pooling/) — Python app, pip.

## Development setup

1. Install Node `>=24.16.0` (current LTS) and [pnpm](https://pnpm.io/installation) `>=11.8`.
2. Add the DB-UX decryption secrets to `request-frontend/.env` (see [`request-frontend/README.md`](request-frontend/README.md#db-theme-decryption)).
3. Run `pnpm install` in each component you plan to work on.
4. Install Python `>=3.14` and pip
5. run `pip install -r requirements.txt`

## Coding conventions

- TypeScript everywhere on the Node side.
- The frontend follows the [Angular Styleguide](https://angular.dev/style-guide) with `prefer-standalone` components and signal-based state.
- All package managers are pinned via `packageManager` in each `package.json`. Use `pnpm`, not `npm` or `yarn`.

## Running checks

Inside each component:

```bash
pnpm lint
pnpm build
pnpm test
```
