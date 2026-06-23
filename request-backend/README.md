# Taxi Request Backend

NestJS service (on Express) for creating and managing [`HelpRequest`](../shared/src/index.ts) entities, plus eligibility checks. Skeleton only — `/health` plus `/bookings/validate` are wired up so far.

## Prerequisites

- Node `>=24.16.0` (current LTS, see [.nvmrc](.nvmrc))
- [pnpm](https://pnpm.io/installation) `>=11.8`
- A local copy of the booking data spreadsheet (see [Booking data source](#booking-data-source) below). The file is gitignored; it must never be committed.

## Install & run

```bash
pnpm install
pnpm link ../shared     # one-off, links the @taxi/shared types
pnpm dev                # http://localhost:3000
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

## Validate booking (issue [#5](https://github.com/OpenRail-Playground/taxi/issues/5))

```bash
curl -s -X POST http://localhost:3000/bookings/validate \
  -H 'Content-Type: application/json' \
  -d '{"auftragsnummer":"258376672881","lastName":"Mustermann"}'
```

Behaviour:

- `200 OK` with `{ trainNumber, travelDate, destinationStation, passengerCount }` when the booking number exists in the local data source. The last name is accepted but not validated yet (forward-compat with the future DB backend integration).
- `404 Not Found` with the exact wording from issue [#5](https://github.com/OpenRail-Playground/taxi/issues/5) when the booking number is unknown.
- `400 Bad Request` when `auftragsnummer` or `lastName` is missing/empty.

Request/response types live in [`@taxi/shared`](../shared/src/index.ts) (`BookingValidationRequest`, `ValidatedBooking`) so the FE and BE share a single contract.

## Booking data source

The validation looks up the booking number in a local Excel file. The file is **never committed**; place it at:

```
<repo-root>/.local/Bookingdata_UPLOAD_custom_auftragsnummer.xlsx
```

The path is gitignored via the root `*.local` rule. Override via the `BOOKING_DATA_PATH` environment variable if you keep the file elsewhere:

```bash
BOOKING_DATA_PATH=/abs/path/to/Bookingdata.xlsx pnpm dev
```

If the file is missing, the service still boots but every `/bookings/validate` call returns 404.

## Layout

```
request-backend/
├── src/
│   ├── main.ts            # bootstrap
│   ├── app.module.ts      # root module
│   ├── health/            # health module (sample)
│   └── bookings/          # /bookings/validate (issue #5)
├── data/                  # file-based JSON storage (one folder per entity, gitignored)
├── nest-cli.json
├── package.json
└── tsconfig.json
```

Persistence is handled by the [`persistence` module](src/persistence/README.md) — a generic JSON-file-backed `FileRepository<T>` contract with atomic writes and no external dependencies.
