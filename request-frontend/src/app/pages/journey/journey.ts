import { Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import {
  DBButton,
  DBNotification,
  DBSection,
  DBTag,
} from '@db-ux/ngx-core-components';

import { JourneyStepper } from '../../components/journey-stepper/journey-stepper';
import { BookingApi } from '../../services/booking-api';
import { RequestStore } from '../../services/request-store';

/** Step 2 — show the disrupted leg of the journey. */
@Component({
  selector: 'app-journey',
  imports: [DBSection, DBButton, DBTag, DBNotification, JourneyStepper],
  templateUrl: './journey.html',
  styleUrl: './journey.scss',
})
export class Journey {
  readonly #store = inject(RequestStore);
  readonly #router = inject(Router);
  readonly #api = inject(BookingApi);

  protected readonly journey = this.#store.journey;
  protected readonly loadingStops = signal(false);

  constructor() {
    const orderId = this.#store.booking().orderId.trim();
    if (orderId) {
      this.loadingStops.set(true);
      this.#api.getJourneyStops(orderId).subscribe({
        next: stops => {
          this.#store.applyJourneyStops(stops);
          this.loadingStops.set(false);
        },
        // Fall back to the already-loaded journey if RIS is unavailable.
        error: () => this.loadingStops.set(false),
      });
    }
  }

  protected continue(): void {
    void this.#router.navigate(['/passenger-data']);
  }
}
