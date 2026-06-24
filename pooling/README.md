# Pooling Service: Assumptions and Scope

This document summarizes the core assumptions, boundaries, and functional scope of the pooling service in `pooling/`.

## Goal

The service groups incoming ride requests into taxi pools and decides for each request whether a shared ride can be scheduled or must be denied with a reason.

## Functional assumptions

- All ride requests in one run share the same pickup point (`source_lat`, `source_lon`).
- Each request represents at least one passenger; optionally, `pax` can split one row into multiple single-passenger journeys.
- Each request has exactly one destination (`destination_name`, `destination_lat`, `destination_lon`).
- Distances are calculated as driving distances via OpenRouteService (ORS), not straight-line distance.
- The distance matrix is processed in kilometers.

## Algorithm guardrails (current parameters)

- Maximum group size per taxi: `4` (`__MAX_PASSENGERS_PER_TAXI__`).
- Maximum allowed pool distance per person: `50 km`.
- Resulting absolute route limit for a single destination: `200 km` (`4 * 50 km`).
- Maximum allowed detour factor per passenger: `1.5` compared to direct distance.

## Result states per ride request

- `SCHEDULED`: request was assigned to a pool.
- `DENIED`: request was rejected.
- `WAITING`: intermediate state during pool construction.

Additionally, the following fields are populated per request:

- `pool_number`: group number for scheduled rides.
- `intermediate_stops`: preceding stops before the passenger's own destination.
- `travel_distance_km`: actual traveled distance until the passenger's destination.
- `deny_reason` for rejected rides (e.g. `MAX_ROUTE_DISTANCE_EXCEEDED`, `POOL_DISTANCE_EXCEEDED`).

## Scope (in scope)

- Read ride data from CSV (including optional `pax` expansion).
- Build a distance matrix via ORS.
- Heuristically group rides by destination proximity and capacity.
- Enforce hard constraints (route limit, pool-distance limit, detour factor).
- Return an enriched list of ride requests with planning status.

## Out of scope (intentionally excluded)

- Time planning / ETA windows and departure times.
- Global optimization for costs, fleet availability, or vehicle rotation.
- Dynamic real-time replanning during ongoing trips.
- Multi-source scenarios (multiple pickup points within one run).
- Pricing logic, billing, or payment processing.

## Technical constraints

- Without a configured `ORS_API_TOKEN`, no distance matrix can be calculated.
- ORS integration errors are propagated to API callers as technical failures.
- Input is validated; incomplete or invalid CSV data returns `400` errors.

## Non-goals / quality boundaries

- No guarantee of globally optimal pooling assignments (heuristic approach).
- No consideration of live traffic, disruptions, or individual rider preferences.
- No persistence of planning results in this module.

## Intended audience

This README is a quick reference for:

- developers extending the pooling algorithm,
- API integrators who need to understand inputs/outputs,
- stakeholders evaluating the functional boundaries and limits of the service.

