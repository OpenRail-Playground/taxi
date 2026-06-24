import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import {
  DBButton,
  DBInfotext,
  DBLink,
  DBNotification,
  DBSection,
} from '@db-ux/ngx-core-components';

import { JourneyScene } from '../../components/journey-scene/journey-scene';

/** Landing screen — entry point that starts the replacement-taxi request. */
@Component({
  selector: 'app-welcome',
  imports: [
    DBSection,
    DBButton,
    DBNotification,
    DBInfotext,
    DBLink,
    JourneyScene,
  ],
  templateUrl: './welcome.html',
  styleUrl: './welcome.scss',
})
export class Welcome {
  readonly #router = inject(Router);

  protected start(): void {
    void this.#router.navigate(['/journey-data']);
  }
}
