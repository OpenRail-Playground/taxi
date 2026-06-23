import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import type { CreateHelpRequestDto } from '@taxi/shared';

import { BookingsRepository } from '../bookings/bookings.repository';

const NOT_FOUND_MESSAGE =
  'We could not find a journey for this booking number. Please check your details and try again.';

const MISMATCH_MESSAGE =
  'Submitted journey details do not match the booking on record.';

/**
 * Server-side anti-fraud re-check for help-request submissions.
 *
 * Re-validates the journey details the client posts against the booking
 * row stored in {@link BookingsRepository}. The client has already seen
 * these fields on the eligibility step, so any mismatch here is treated
 * as tampering rather than a user error.
 *
 * Fields verified: `trainNumber`, `travelDate`, `finalDestination`
 * (maps to `record.destinationStation`), and the total head count
 * (`adults + kids` against `record.passengerCount`).
 *
 * The station where the disruption happened is intentionally NOT
 * verified — it is user-supplied free-form input describing where the
 * journey broke down and has no equivalent in the booking record.
 */
@Injectable()
export class HelpRequestVerifier {
  constructor(private readonly bookings: BookingsRepository) {}

  verify(input: CreateHelpRequestDto): void {
    const record = this.bookings.findByAuftragsnummer(input.auftragsnummer);
    if (!record) {
      throw new NotFoundException(NOT_FOUND_MESSAGE);
    }

    const submittedPassengerTotal =
      input.passengers.adults + input.passengers.kids;

    const matches =
      record.trainNumber === input.journey.trainNumber &&
      record.travelDate === input.journey.travelDate &&
      record.destinationStation === input.journey.finalDestination &&
      record.passengerCount === submittedPassengerTotal;

    if (!matches) {
      throw new ForbiddenException(MISMATCH_MESSAGE);
    }
  }
}
