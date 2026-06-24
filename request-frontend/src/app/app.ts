import { Location } from '@angular/common';
import { Component, inject } from '@angular/core';
import { Router, RouterOutlet } from '@angular/router';
import { DBButton, DBIcon, DBLink, DBPage } from '@db-ux/ngx-core-components';

/** Ordered screens; the back button walks this rather than browser history. */
const FLOW = [
  '/',
  '/journey-data',
  '/journey',
  '/passenger-data',
  '/confirmation',
  '/searching',
  '/success',
];

@Component({
  selector: 'app-root',
  templateUrl: './app.html',
  styleUrl: './app.scss',
  imports: [RouterOutlet, DBPage, DBButton, DBLink, DBIcon],
})
export class AppComponent {
  readonly #router = inject(Router);
  readonly #location = inject(Location);

  /** Go to the previous screen in the flow (falls back to browser history). */
  protected back(): void {
    const current = this.#router.url.split(/[?#]/)[0];
    const index = FLOW.indexOf(current);
    if (index > 0) {
      void this.#router.navigate([FLOW[index - 1]]);
    } else {
      this.#location.back();
    }
  }
}
