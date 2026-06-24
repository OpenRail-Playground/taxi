/**
 * View-models for the customer request flow.
 *
 * These describe what the *screens* need to render. They are intentionally
 * richer than the `@taxi/shared` API contract (which is the minimal payload
 * sent to the backend) so the UI can show the full journey context.
 */

export interface ContactDetails {
  name: string;
  phone: string;
  email: string;
}

export interface PassengerCounts {
  adults: number;
  kids: number;
  bicycle: number;
  wheelchair: number;
}

/** Booking lookup entered on the first step (Journey Data). */
export interface BookingDetails {
  /** 12-digit order ID from the ticket. */
  orderId: string;
  lastName: string;
}

/**
 * Taxi dispatch details shown after a request is submitted.
 *
 * There is no backend taxi-dispatch endpoint yet, so this is placeholder
 * data generated client-side (the passenger count comes from the store).
 */
export interface TaxiBooking {
  bookingNumber: string;
  pickupPoint: string;
  estWaitMinutes: number;
  driver: { name: string; car: string; licensePlate: string };
}

export interface JourneyInfo {
  /** Affected train run, e.g. "ICE 202". */
  trainNumber: string;
  /** Short note about the train, shown on the Journey step. */
  trainNote: string;
  origin: { station: string; departure: string };
  /** Stranding stop. Null when the train runs as planned. */
  disruption: { station: string; arrival: string; reason: string } | null;
  destination: { station: string; plannedArrival: string };
  /** Leg that has to be covered by taxi. Null when no disruption. */
  taxi: { from: string; to: string } | null;
}

/** Demo data mirroring the mockups (Hamburg → Köln, disrupted at Bielefeld). */
export const DEMO_CONTACT: ContactDetails = {
  name: 'Max Mustermann',
  phone: '+49 171 123 45 67',
  email: 'susi.berger@test.ch',
};

export const DEMO_PASSENGERS: PassengerCounts = {
  adults: 1,
  kids: 0,
  bicycle: 0,
  wheelchair: 0,
};

export const DEMO_BOOKING: BookingDetails = {
  orderId: '',
  lastName: '',
};

export const DEMO_JOURNEY: JourneyInfo = {
  trainNumber: 'ICE 202',
  trainNote: 'This is the last train of the day.',
  origin: { station: 'Hamburg Hbf', departure: '23:58' },
  disruption: {
    station: 'Bielefeld Hbf',
    arrival: '01:17',
    reason: 'No further train service',
  },
  destination: { station: 'Köln Hbf', plannedArrival: '02:45' },
  taxi: { from: 'Bielefeld Hbf', to: 'Köln Hbf' },
};
