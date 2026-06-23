import { Component, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import {
  DBBrand,
  DBButton,
  DBIcon,
  DBLink,
  DBPage,
} from '@db-ux/ngx-core-components';
import { filter, map } from 'rxjs';

type HeaderMode = 'home' | 'step' | 'plain';

/**
 * Ordered steps of the request flow. The back button walks this sequence
 * instead of relying on browser history, so it works the same even after a
 * refresh or when a step is opened directly.
 */
const FLOW = ['/journey-data', '/journey', '/passenger-data', '/confirmation'];

@Component({
  selector: 'app-root',
  templateUrl: './app.html',
  styleUrl: './app.scss',
  imports: [RouterOutlet, DBPage, DBBrand, DBButton, DBLink, DBIcon],
})
export class AppComponent {
  readonly #router = inject(Router);

  /**
   * The first steps show the brand + a help link; deeper steps show a back
   * button and a centered brand. Driven by each route's `headerMode` data.
   */
  protected readonly headerMode = toSignal(
    this.#router.events.pipe(
      filter((event): event is NavigationEnd => event instanceof NavigationEnd),
      map(() => {
        let route = this.#router.routerState.root;
        while (route.firstChild) {
          route = route.firstChild;
        }
        return (route.snapshot.data['headerMode'] ?? 'step') as HeaderMode;
      })
    ),
    { initialValue: 'home' as HeaderMode }
  );

  /** Navigate to the previous step in the flow. */
  protected back(): void {
    const current = this.#router.url.split(/[?#]/)[0];
    const index = FLOW.indexOf(current);
    void this.#router.navigate([index > 0 ? FLOW[index - 1] : FLOW[0]]);
  }
}
