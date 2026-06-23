import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import {
  DBButton,
  DBNotification,
  DBSection,
  DBTag,
} from '@db-ux/ngx-core-components';

import { JourneyStepper } from '../../components/journey-stepper/journey-stepper';
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

  protected readonly journey = this.#store.journey;

  protected continue(): void {
    void this.#router.navigate(['/passenger-data']);
  }
}
