# Taxi Request Backend

NestJS service (on Express) for creating and managing [`HelpRequest`](../shared/src/index.ts) entities, plus eligibility checks. Endpoints wired up: `/health`, `/bookings/validate`, and `/bookings/:auftragsnummer/journey-stops`.

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

## Journey stops (issue [#8](https://github.com/OpenRail-Playground/taxi/issues/8))

```bash
curl -s http://localhost:3000/bookings/258376699013/journey-stops
```

Behaviour:

- `200 OK` with `{ origin, destination, strandedAt }` — three named stops with `evaNumber`, `name`, and `scheduledTime` (ISO-8601). `origin.scheduledTime` is the scheduled departure; `destination.scheduledTime` and `strandedAt.scheduledTime` are scheduled arrivals. `strandedAt` is the last stop the train still reaches before disruption, or `null` when the train serves the booked destination as planned.
- `404 Not Found` when the booking number is unknown, when RIS finds no matching journey for the train and date, when the destination is not on the journey, or when the train never leaves its origin (whole journey cancelled) — the passenger never strands, so there is nothing to render.
- `422 Unprocessable Entity` when the stored `trainNumber` cannot be parsed into a category + number.
- `502 Bad Gateway` when the RIS API is unreachable or returns an unexpected error.

Requires four environment variables (see `.env.example`): `RIS_V1_CLIENT_ID`, `RIS_V1_API_KEY`, `RIS_V2_CLIENT_ID`, `RIS_V2_API_KEY`.

Response types live in [`@taxi/shared`](../shared/src/index.ts) (`JourneyStopPoint`, `JourneyStopsResponse`).

## Create / fetch help request (issue [#11](https://github.com/OpenRail-Playground/taxi/issues/11))

```bash
# Create a help request
curl -s -X POST http://localhost:3000/help-requests \
  -H 'Content-Type: application/json' \
  -d '{"auftragsnummer":"258376672881","lastName":"Mustermann","journey":{"trainNumber":"ICE 619","travelDate":"2026-05-29","startStation":"Hamburg Hbf","disruptionStation":"Mannheim Hbf","finalDestination":"Basel SBB","alternativeTransportRequired":true},"contact":{"name":"Max Mustermann","phone":"+49 170","email":"max@example.com"},"passengers":{"adults":2,"kids":1,"bicycles":0,"wheelchairs":0}}'

# Fetch it back by id
curl -s http://localhost:3000/help-requests/<id-from-above>
```

Behaviour:

- `201 Created` with full `HelpRequest` body (including server-stamped `id`, `createdAt`, `status`, `eligibility`) on success.
- `403 Forbidden` if any of `trainNumber`, `travelDate`, `finalDestination`, or total passengers (`adults+kids`) mismatches the booking record (anti-fraud re-check). `disruptionStation` is exempt — users edit it after the disruption.
- `404 Not Found` when the `auftragsnummer` is unknown.
- `400 Bad Request` for missing or wrong-type fields; `422 Unprocessable Entity` for negative/non-integer passenger counts.
- `GET /help-requests/:id` returns `200 OK` with the stored entity, `404 Not Found` when missing, `400 Bad Request` for an invalid id.

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
│   ├── ris/               # RisJourneysClient — two-step RIS v1+v2 fetch (issue #8)
│   └── bookings/          # /bookings/validate (issue #5), /bookings/:id/journey-stops (issue #8)
├── data/                  # file-based JSON storage (one folder per entity, gitignored)
├── nest-cli.json
├── package.json
└── tsconfig.json
```

Persistence is handled by the [`persistence` module](src/persistence/README.md) — a generic JSON-file-backed `FileRepository<T>` contract with atomic writes and no external dependencies.
