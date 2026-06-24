import { HttpErrorResponse } from '@angular/common/http';
import {
  Component,
  effect,
  ElementRef,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { Router } from '@angular/router';
import {
  DBButton,
  DBInput,
  DBNotification,
  DBSection,
} from '@db-ux/ngx-core-components';

import { JourneyStepper } from '../../components/journey-stepper/journey-stepper';
import { BookingApi } from '../../services/booking-api';
import { RequestStore } from '../../services/request-store';

/** Step 1 — look up the booking by order ID and traveller name. */
@Component({
  selector: 'app-journey-data',
  imports: [DBSection, DBInput, DBButton, DBNotification, JourneyStepper],
  templateUrl: './journey-data.html',
  styleUrl: './journey-data.scss',
})
export class JourneyData {
  readonly #store = inject(RequestStore);
  readonly #router = inject(Router);
  readonly #api = inject(BookingApi);

  protected readonly booking = this.#store.booking;
  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);

  protected readonly errorBox = viewChild<ElementRef<HTMLElement>>('errorBox');

  constructor() {
    // When an error appears, scroll it into view so mobile users see it
    // even if they had scrolled down to tap "Continue".
    effect(() => {
      if (this.error() === null) return;
      queueMicrotask(() => {
        this.errorBox()?.nativeElement.scrollIntoView({
          behavior: 'smooth',
          block: 'center',
        });
      });
    });
  }

  protected updateOrderId(value: string | undefined): void {
    this.#store.updateBooking({ orderId: value ?? '' });
    this.error.set(null);
  }

  protected updateLastName(value: string | undefined): void {
    this.#store.updateBooking({ lastName: value ?? '' });
    this.error.set(null);
  }

  protected continue(): void {
    const { orderId, lastName } = this.booking();
    if (!orderId.trim() || !lastName.trim()) {
      this.error.set('Please enter your order ID and last name.');
      return;
    }

    this.loading.set(true);
    this.error.set(null);
    this.#api.validate(orderId, lastName).subscribe({
      next: validated => {
        this.#store.applyValidatedBooking(validated);
        this.loading.set(false);
        void this.#router.navigate(['/journey']);
      },
      error: (err: HttpErrorResponse) => {
        this.loading.set(false);
        this.error.set(messageFor(err));
      },
    });
  }
}

function messageFor(err: HttpErrorResponse): string {
  const serverMessage = (err.error as { message?: string } | null)?.message;
  switch (err.status) {
    case 0:
      return 'Could not reach the server. Please make sure the backend is running and try again.';
    case 400:
      return 'Please enter a valid 12-digit order ID and last name.';
    case 404:
      return (
        serverMessage ??
        'We could not find a journey for this booking. Please check your details and try again.'
      );
    default:
      return 'Something went wrong while checking your booking. Please try again.';
  }
}
