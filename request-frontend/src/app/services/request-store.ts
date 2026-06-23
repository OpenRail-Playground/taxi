import { Injectable, signal } from '@angular/core';

import { JourneyStop, ValidatedBooking } from '../models/api.model';
import {
  BookingDetails,
  ContactDetails,
  DEMO_BOOKING,
  DEMO_CONTACT,
  DEMO_JOURNEY,
  DEMO_PASSENGERS,
  JourneyInfo,
  PassengerCounts,
} from '../models/request.model';

/**
 * Holds the in-progress help request so all steps share a single source of
 * truth. Seeded with demo data; the booking and journey are overwritten by
 * the backend once a booking is validated and its stops are fetched.
 */
@Injectable({ providedIn: 'root' })
export class RequestStore {
  readonly booking = signal<BookingDetails>({ ...DEMO_BOOKING });
  readonly contact = signal<ContactDetails>({ ...DEMO_CONTACT });
  readonly passengers = signal<PassengerCounts>({ ...DEMO_PASSENGERS });
  readonly journey = signal<JourneyInfo>({ ...DEMO_JOURNEY });

  updateBooking(patch: Partial<BookingDetails>): void {
    this.booking.update(current => ({ ...current, ...patch }));
  }

  updateContact(patch: Partial<ContactDetails>): void {
    this.contact.update(current => ({ ...current, ...patch }));
  }

  setPassenger(key: keyof PassengerCounts, value: number): void {
    this.passengers.update(current => ({
      ...current,
      [key]: Math.max(0, value),
    }));
  }

  /** Apply the result of `POST /bookings/validate`. */
  applyValidatedBooking(booking: ValidatedBooking): void {
    this.journey.update(current => ({
      ...current,
      trainNumber: booking.trainNumber,
      destination: {
        ...current.destination,
        station: booking.destinationStation,
      },
    }));
    this.passengers.update(current => ({
      ...current,
      adults: Math.max(1, booking.passengerCount),
    }));
  }

  /** Apply the result of `GET /bookings/:id/journey-stops`. */
  applyJourneyStops(stops: JourneyStop[]): void {
    const mapped = mapStopsToJourney(stops, this.journey());
    if (mapped) {
      this.journey.set(mapped);
    }
  }
}

/** Pull the local "HH:mm" out of an ISO timestamp, ignoring the offset. */
function formatTime(iso: string): string {
  const match = /T(\d{2}:\d{2})/.exec(iso);
  return match ? match[1] : iso;
}

/**
 * Collapse the full stop list into the origin / disruption / destination
 * shape the timeline renders. The disruption point is the last stop the
 * train still serves before the first cancelled one.
 */
function mapStopsToJourney(
  stops: JourneyStop[],
  base: JourneyInfo
): JourneyInfo | null {
  if (stops.length < 2) {
    return null;
  }

  const origin = stops[0];
  const destination = stops[stops.length - 1];
  const firstCancelled = stops.findIndex(stop => stop.cancelled);
  const disruptionIndex =
    firstCancelled > 0 ? firstCancelled - 1 : stops.length - 2;
  const disruption = stops[disruptionIndex];

  return {
    trainNumber: base.trainNumber,
    trainNote: base.trainNote,
    origin: {
      station: origin.name,
      departure: formatTime(origin.scheduledTime),
    },
    disruption: {
      station: disruption.name,
      arrival: formatTime(disruption.scheduledTime),
      reason: 'No further train service',
    },
    destination: {
      station: destination.name,
      plannedArrival: formatTime(destination.scheduledTime),
    },
    taxi: { from: disruption.name, to: destination.name },
  };
}
