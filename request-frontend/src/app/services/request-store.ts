import { Injectable, signal } from '@angular/core';

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
 * Holds the in-progress help request so the Passenger Data and Confirmation
 * screens share a single source of truth. Seeded with the demo journey.
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
}
