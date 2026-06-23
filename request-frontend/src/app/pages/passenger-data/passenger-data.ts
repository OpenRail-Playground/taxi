import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import {
  DBButton,
  DBDivider,
  DBInfotext,
  DBInput,
  DBSection,
} from '@db-ux/ngx-core-components';

import { JourneyStepper } from '../../components/journey-stepper/journey-stepper';
import { PassengerCounter } from '../../components/passenger-counter/passenger-counter';
import { PassengerCounts } from '../../models/request.model';
import { RequestStore } from '../../services/request-store';

/** Step 3 — contact details and number of passengers. */
@Component({
  selector: 'app-passenger-data',
  imports: [
    DBSection,
    DBInput,
    DBButton,
    DBDivider,
    DBInfotext,
    JourneyStepper,
    PassengerCounter,
  ],
  templateUrl: './passenger-data.html',
  styleUrl: './passenger-data.scss',
})
export class PassengerData {
  readonly #store = inject(RequestStore);
  readonly #router = inject(Router);

  protected readonly contact = this.#store.contact;
  protected readonly passengers = this.#store.passengers;

  protected updatePhone(value: string | undefined): void {
    this.#store.updateContact({ phone: value ?? '' });
  }

  protected updateEmail(value: string | undefined): void {
    this.#store.updateContact({ email: value ?? '' });
  }

  protected setCount(key: keyof PassengerCounts, value: number): void {
    this.#store.setPassenger(key, value);
  }

  protected continue(): void {
    void this.#router.navigate(['/confirmation']);
  }
}
