import { Component, input } from '@angular/core';
import { DBIcon } from '@db-ux/ngx-core-components';

type StepState = 'done' | 'current' | 'todo';

/** The four-step progress indicator shown at the top of the request flow. */
@Component({
  selector: 'app-journey-stepper',
  imports: [DBIcon],
  templateUrl: './journey-stepper.html',
  styleUrl: './journey-stepper.scss',
})
export class JourneyStepper {
  /** 1-based index of the active step. */
  readonly current = input.required<number>();

  protected readonly steps = [
    'Journey Data',
    'Journey',
    'Passenger Data',
    'Confirmation',
  ] as const;

  protected state(index: number): StepState {
    const step = index + 1;
    if (step < this.current()) return 'done';
    if (step === this.current()) return 'current';
    return 'todo';
  }
}
