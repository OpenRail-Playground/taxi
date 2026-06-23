/**
 * Shared types for the Taxi project.
 *
 * The frontend and backend both consume these types so the API surface
 * stays in sync. Anything exported from here is considered part of the
 * public contract between the two.
 */

export type HelpRequestStatus =
  | "new"
  | "eligible"
  | "ineligible"
  | "resolved"
  | "cancelled";

/**
 * A help request submitted by a customer on a disrupted journey.
 *
 * The current scope (see issue #1) is intentionally minimal. New fields
 * should be added cautiously and reviewed together by FE and BE.
 */
export interface HelpRequest {
  id: string;
  /** Identifier of the affected train run, e.g. "ICE 123". */
  trainNumber: string;
  /** Station the passenger is currently at or stranded near. */
  currentStation: string;
  /** Station the passenger is trying to reach. */
  destinationStation: string;
  /** Number of passengers travelling together. */
  passengerCount: number;
  /** Optional free-text description from the passenger. */
  description?: string;
  /** Optional contact info (e.g. phone or email) for follow-up. */
  contact?: string;
  /** Server-side status; clients should treat this as read-only. */
  status: HelpRequestStatus;
  /** ISO-8601 timestamp set by the backend on creation. */
  createdAt: string;
  /** Result of the eligibility check, populated by the backend. */
  eligibility: EligibilityResult;
}

/**
 * Payload accepted by `POST /help-requests`.
 *
 * Server-side fields (id, status, timestamps, eligibility) are not part
 * of the input; they are filled in by the backend.
 */
export type CreateHelpRequestDto = Pick<
  HelpRequest,
  | "trainNumber"
  | "currentStation"
  | "destinationStation"
  | "passengerCount"
  | "description"
  | "contact"
>;

export interface EligibilityResult {
  eligible: boolean;
  /** Human-readable explanation, suitable for showing to the passenger. */
  reason: string;
}

/**
 * Payload accepted by `POST /bookings/validate`.
 *
 * For the hackathon we only validate the booking number; the last name
 * is accepted for forward-compatibility with the DB backend integration
 * (see issue #5) but is not checked against the local data source.
 */
export interface BookingValidationRequest {
  /** Booking number (Auftragsnummer), 12-digit numeric string. */
  auftragsnummer: string;
  /** Last name of the main traveller (currently not validated server-side). */
  lastName: string;
}

/**
 * Successful response of `POST /bookings/validate`.
 *
 * Returned when the booking number is found in the data source. The
 * fields mirror the minimum journey data the FE shows on the next step.
 */
export interface ValidatedBooking {
  /** Identifier of the train run, e.g. "ICE 619". */
  trainNumber: string;
  /** ISO-8601 date (YYYY-MM-DD) of the journey. */
  travelDate: string;
  /** Station the passenger is travelling to. */
  destinationStation: string;
  passengerCount: number;
}

/**
 * A single stop on a journey, as returned by the RIS::Journeys API.
 * Stops after the passenger's destination are excluded.
 */
export interface JourneyStop {
  /** EVA station number, e.g. "8000085" */
  evaNumber: string;
  /** Human-readable station name, e.g. "Düsseldorf Hbf" */
  name: string;
  /** Scheduled departure time as ISO-8601 string, e.g. "2026-05-29T21:29:00+02:00" */
  scheduledTime: string;
  /** True when this stop is cancelled (train does not serve it) */
  cancelled: boolean;
}

/** Response shape for GET /bookings/:auftragsnummer/journey-stops */
export interface JourneyStopsResponse {
  stops: JourneyStop[];
}
