/**
 * Backend REST contract.
 *
 * Mirrors the relevant types from `@taxi/shared` (see shared/src/index.ts).
 * The frontend keeps its own copy so its build does not depend on the
 * backend package — keep these in sync with the shared contract.
 */

/** Body of `POST /bookings/validate`. */
export interface BookingValidationRequest {
  /** Booking number (Auftragsnummer), 12-digit numeric string. */
  auftragsnummer: string;
  lastName: string;
}

/** Successful response of `POST /bookings/validate`. */
export interface ValidatedBooking {
  trainNumber: string;
  /** ISO-8601 date (YYYY-MM-DD). */
  travelDate: string;
  destinationStation: string;
  passengerCount: number;
}

/** A single stop on the journey, from `GET /bookings/:id/journey-stops`. */
export interface JourneyStop {
  evaNumber: string;
  name: string;
  /** ISO-8601 timestamp, e.g. "2026-05-29T21:29:00+02:00". */
  scheduledTime: string;
  cancelled: boolean;
}

export interface JourneyStopsResponse {
  stops: JourneyStop[];
}
