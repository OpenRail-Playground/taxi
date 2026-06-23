import type { BookingValidationRequest, ValidatedBooking } from '@taxi/shared';

export type BookingValidationRequestDto = BookingValidationRequest;
export type ValidatedBookingDto = ValidatedBooking;

export interface BookingRecord {
  auftragsnummer: string;
  trainNumber: string;
  travelDate: string;
  destinationStation: string;
  passengerCount: number;
}
