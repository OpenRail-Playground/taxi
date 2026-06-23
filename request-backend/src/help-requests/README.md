# Help Requests Module

NestJS module exposing `POST /help-requests` (create) and `GET /help-requests/:id` (refetch) for issue #11.

## Purpose

Accepts the full confirmation-screen payload, re-verifies the journey data against the booking spreadsheet, and persists the request under a server-generated UUID. The stored entity can be fetched back by ID.

## Endpoints

### POST /help-requests

Creates a new help request. The backend performs an anti-fraud re-check before persisting.

**Request body** (`CreateHelpRequestDto`):

```json
{
  "auftragsnummer": "258376672881",
  "lastName": "Mustermann",
  "journey": {
    "trainNumber": "ICE 619",
    "travelDate": "2026-05-29",
    "startStation": "Hamburg Hbf",
    "disruptionStation": "Mannheim Hbf",
    "finalDestination": "Basel SBB",
    "alternativeTransportRequired": true
  },
  "contact": {
    "name": "Max Mustermann",
    "phone": "+49 170 1234567",
    "email": "max@example.com"
  },
  "passengers": {
    "adults": 2,
    "kids": 1,
    "bicycles": 0,
    "wheelchairs": 0
  }
}
```

**Response codes:**

- `201 Created` — entity created; body is the full `HelpRequest` object with server-stamped `id`, `createdAt`, `status`, `eligibility`
- `400 Bad Request` — required field missing or wrong type
- `403 Forbidden` — journey details do not match the booking on record (anti-fraud re-check failed)
- `404 Not Found` — `auftragsnummer` is unknown in the booking data source
- `422 Unprocessable Entity` — passenger count field is negative or non-integer

**Example:**

```bash
curl -s -X POST http://localhost:3000/help-requests \
  -H 'Content-Type: application/json' \
  -d '{"auftragsnummer":"258376672881","lastName":"Mustermann","journey":{"trainNumber":"ICE 619","travelDate":"2026-05-29","startStation":"Hamburg Hbf","disruptionStation":"Mannheim Hbf","finalDestination":"Basel SBB","alternativeTransportRequired":true},"contact":{"name":"Max Mustermann","phone":"+49 170 1234567","email":"max@example.com"},"passengers":{"adults":2,"kids":1,"bicycles":0,"wheelchairs":0}}'
```

### GET /help-requests/:id

Fetches a previously created help request by its server-generated UUID.

**Response codes:**

- `200 OK` — body is the stored `HelpRequest` entity
- `400 Bad Request` — `id` contains invalid characters (must match `^[A-Za-z0-9_-]{1,128}$`)
- `404 Not Found` — no entity exists for this id

**Example:**

```bash
curl -s http://localhost:3000/help-requests/550e8400-e29b-41d4-a716-446655440000
```

## Anti-fraud re-check

Every `POST /help-requests` re-verifies the following fields against `BookingsRepository`:

| Field checked | Source on submission | Source in record |
| --- | --- | --- |
| Train number | `journey.trainNumber` | `record.trainNumber` |
| Travel date | `journey.travelDate` | `record.travelDate` |
| Final destination | `journey.finalDestination` | `record.destinationStation` |
| Passenger total | `passengers.adults + passengers.kids` | `record.passengerCount` |

`disruptionStation` is intentionally **not** verified. It is user-supplied information about where the journey broke down and has no counterpart in the booking record.

Any mismatch returns `403 Forbidden`. This signals data tampering rather than a generic conflict.

## Types

Request/response types live in [`@taxi/shared`](../../../shared/src/index.ts): `CreateHelpRequestDto`, `HelpRequest`, `HelpRequestStatus`, `EligibilityResult`.
