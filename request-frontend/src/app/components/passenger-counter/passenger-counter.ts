import { Component, input, output } from '@angular/core';
import { IconTypes } from '@db-ux/core-foundations';
import { DBButton, DBIcon } from '@db-ux/ngx-core-components';

/** A labelled stepper row (icon + label + minus / value / plus). */
@Component({
  selector: 'app-passenger-counter',
  imports: [DBButton, DBIcon],
  templateUrl: './passenger-counter.html',
  styleUrl: './passenger-counter.scss',
})
export class PassengerCounter {
  readonly label = input.required<string>();
  readonly icon = input.required<IconTypes>();
  readonly value = input.required<number>();
  readonly min = input(0);

  readonly valueChange = output<number>();

  protected decrease(): void {
    this.valueChange.emit(Math.max(this.min(), this.value() - 1));
  }

  protected increase(): void {
    this.valueChange.emit(this.value() + 1);
  }
}
