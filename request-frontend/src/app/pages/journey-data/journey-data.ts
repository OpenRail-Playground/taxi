import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import {
  DBButton,
  DBInput,
  DBNotification,
  DBSection,
} from '@db-ux/ngx-core-components';

import { JourneyStepper } from '../../components/journey-stepper/journey-stepper';
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

  protected readonly booking = this.#store.booking;

  protected updateOrderId(value: string | undefined): void {
    this.#store.updateBooking({ orderId: value ?? '' });
  }

  protected updateLastName(value: string | undefined): void {
    this.#store.updateBooking({ lastName: value ?? '' });
  }

  protected continue(): void {
    void this.#router.navigate(['/journey']);
  }
}
