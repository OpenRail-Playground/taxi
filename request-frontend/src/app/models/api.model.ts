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

/** One point on the disrupted journey, from `GET /bookings/:id/journey-stops`. */
export interface JourneyStopPoint {
  evaNumber: string;
  name: string;
  /** ISO-8601 timestamp; scheduled departure at origin, scheduled arrival elsewhere. */
  scheduledTime: string;
}

export interface JourneyStopsResponse {
  origin: JourneyStopPoint;
  destination: JourneyStopPoint;
  /** Last stop the train still reaches before disruption; null when undisrupted. */
  strandedAt: JourneyStopPoint | null;
}
