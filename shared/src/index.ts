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
 * Shape matches the issue-#11 confirmation-screen payload. Server-side fields
 * (id, createdAt, status, eligibility) are filled by the backend on creation.
 */
export interface HelpRequest {
  /** Server-generated UUID v4. */
  id: string;
  /** ISO-8601 timestamp set by the backend on creation. */
  createdAt: string;
  /** Server-side status; clients treat as read-only. */
  status: HelpRequestStatus;
  /** Result of the eligibility re-check, populated by the backend. */
  eligibility: EligibilityResult;

  /** Booking number (Auftragsnummer), 12-digit numeric string. */
  auftragsnummer: string;
  /** Last name of the main traveller, as entered by the user. Not validated server-side yet. */
  lastName: string;

  /** Journey identity (verified equal to the spreadsheet row). */
  journey: {
    /** e.g. "ICE 672". Verified. */
    trainNumber: string;
    /** ISO-8601 date YYYY-MM-DD. Verified. */
    travelDate: string;
    /** Origin station of the booked journey. */
    startStation: string;
    /** Station where the journey is disrupted (user-editable; NOT verified). */
    disruptionStation: string;
    /** Final destination of the booked journey. Verified. */
    finalDestination: string;
    /** Whether the traveller needs alternative transport from the disruption station. */
    alternativeTransportRequired: boolean;
  };

  contact: {
    /** Full name of the contact person. */
    name: string;
    /** Phone number, free-form string. */
    phone: string;
    /** E-mail address, free-form string. */
    email: string;
  };

  passengers: {
    /** Number of adult travellers (>=0, integer). */
    adults: number;
    /** Number of child travellers (>=0, integer). */
    kids: number;
    /** Number of bicycles to transport (>=0, integer). */
    bicycles: number;
    /** Number of wheelchairs to transport (>=0, integer). */
    wheelchairs: number;
  };
}

/**
 * Payload accepted by `POST /help-requests`.
 * Server-side fields (id, status, createdAt, eligibility) are filled by the backend.
 */
export type CreateHelpRequestDto = Pick<
  HelpRequest,
  'auftragsnummer' | 'lastName' | 'journey' | 'contact' | 'passengers'
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
