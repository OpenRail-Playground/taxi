import { Component, computed, inject } from '@angular/core';
import { Router } from '@angular/router';
import { IconTypes } from '@db-ux/core-foundations';
import {
  DBButton,
  DBCard,
  DBIcon,
  DBInfotext,
  DBNotification,
  DBSection,
  DBTag,
} from '@db-ux/ngx-core-components';

import { JourneyStepper } from '../../components/journey-stepper/journey-stepper';
import { RequestStore } from '../../services/request-store';

/** Step 4 — review every detail, then submit / edit / cancel. */
@Component({
  selector: 'app-confirmation',
  imports: [
    DBSection,
    DBCard,
    DBButton,
    DBTag,
    DBNotification,
    DBInfotext,
    DBIcon,
    JourneyStepper,
  ],
  templateUrl: './confirmation.html',
  styleUrl: './confirmation.scss',
})
export class Confirmation {
  readonly #store = inject(RequestStore);
  readonly #router = inject(Router);

  protected readonly contact = this.#store.contact;
  protected readonly journey = this.#store.journey;

  protected readonly passengerRows = computed(() => {
    const passengers = this.#store.passengers();
    const rows: { label: string; icon: IconTypes; value: number }[] = [
      { label: 'Adults', icon: 'person', value: passengers.adults },
      { label: 'Kids', icon: 'family_compartment', value: passengers.kids },
      { label: 'Bicycle', icon: 'bike', value: passengers.bicycle },
      {
        label: 'Wheelchair',
        icon: 'db_wheelchair',
        value: passengers.wheelchair,
      },
    ];
    // Hide categories that are zero to keep the summary compact.
    return rows.filter(row => row.value > 0);
  });

  protected submit(): void {
    // Real submission (POST /help-requests) would go here.
    this.#store.createTaxiBooking();
    void this.#router.navigate(['/searching']);
  }

  protected edit(): void {
    void this.#router.navigate(['/passenger-data']);
  }

  protected cancel(): void {
    void this.#router.navigate(['/passenger-data']);
  }
}
