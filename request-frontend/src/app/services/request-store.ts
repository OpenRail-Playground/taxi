import { computed, Injectable, signal } from '@angular/core';

import { JourneyStopsResponse, ValidatedBooking } from '../models/api.model';
import {
  BookingDetails,
  ContactDetails,
  DEMO_BOOKING,
  DEMO_CONTACT,
  DEMO_JOURNEY,
  DEMO_PASSENGERS,
  JourneyInfo,
  PassengerCounts,
  TaxiBooking,
} from '../models/request.model';

@Injectable({ providedIn: 'root' })
export class RequestStore {
  readonly booking = signal<BookingDetails>({ ...DEMO_BOOKING });
  readonly contact = signal<ContactDetails>({ ...DEMO_CONTACT });
  readonly passengers = signal<PassengerCounts>({ ...DEMO_PASSENGERS });
  readonly journey = signal<JourneyInfo>({ ...DEMO_JOURNEY });
  readonly taxiBooking = signal<TaxiBooking | null>(null);

  /** Total people travelling (excludes bicycle / wheelchair items). */
  readonly passengerTotal = computed(() => {
    const p = this.passengers();
    return p.adults + p.kids;
  });

  /** Create the placeholder taxi dispatch shown after submitting. */
  createTaxiBooking(): void {
    const serial = 10000 + Math.floor(Math.random() * 90000);
    this.taxiBooking.set({
      bookingNumber: `DB-${serial}-X`,
      pickupPoint: 'Exit B · Platform 7',
      estWaitMinutes: 3,
      driver: {
        name: 'Hans Müller',
        car: 'Mercedes E-Class · Silver',
        licensePlate: 'BI · DB 2746',
      },
    });
  }

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

  applyJourneyStops(response: JourneyStopsResponse): void {
    const { origin, destination, strandedAt } = response;

    this.journey.update(current => ({
      ...current,
      origin: {
        station: origin.name,
        departure: formatTime(origin.scheduledTime),
      },
      disruption: strandedAt
        ? {
            station: strandedAt.name,
            arrival: formatTime(strandedAt.scheduledTime),
            reason: 'No further train service',
          }
        : null,
      destination: {
        station: destination.name,
        plannedArrival: formatTime(destination.scheduledTime),
      },
      taxi: strandedAt
        ? { from: strandedAt.name, to: destination.name }
        : null,
    }));
  }
}

function formatTime(iso: string): string {
  const match = /T(\d{2}:\d{2})/.exec(iso);
  return match ? match[1] : iso;
}
