import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import {
  DBButton,
  DBCard,
  DBIcon,
  DBLink,
  DBNotification,
  DBSection,
} from '@db-ux/ngx-core-components';

import { JourneyScene } from '../../components/journey-scene/journey-scene';
import { RequestStore } from '../../services/request-store';

/** Post-submission state — searching for a nearby taxi. */
@Component({
  selector: 'app-searching',
  imports: [
    DBSection,
    DBCard,
    DBButton,
    DBIcon,
    DBLink,
    DBNotification,
    JourneyScene,
  ],
  templateUrl: './searching.html',
  styleUrl: './searching.scss',
})
export class Searching {
  readonly #store = inject(RequestStore);
  readonly #router = inject(Router);

  protected readonly passengers = this.#store.passengers;
  protected readonly taxiBooking = this.#store.taxiBooking;

  constructor() {
    // Generate the placeholder dispatch if we arrived here directly.
    if (!this.#store.taxiBooking()) {
      this.#store.createTaxiBooking();
    }
  }

  /** A click anywhere on the screen advances to the assigned-driver screen. */
  protected goToSuccess(): void {
    void this.#router.navigate(['/success']);
  }
}
