import { Component, input } from '@angular/core';
import {
  DBCard,
  DBIcon,
  DBNotification,
  DBTag,
} from '@db-ux/ngx-core-components';

import { JourneyInfo } from '../../models/request.model';

/**
 * The "Journey Information" card: a origin → disruption → destination timeline
 * with the train number and the required-taxi leg. Shared by the Journey and
 * Confirmation screens so they stay visually identical.
 */
@Component({
  selector: 'app-journey-information',
  imports: [DBCard, DBIcon, DBTag, DBNotification],
  templateUrl: './journey-information.html',
  styleUrl: './journey-information.scss',
})
export class JourneyInformation {
  readonly journey = input.required<JourneyInfo>();
}
