import {
  BadRequestException,
  Body,
  Controller,
  HttpCode,
  NotFoundException,
  Post,
} from '@nestjs/common';

import type {
  BookingValidationRequestDto,
  ValidatedBookingDto,
} from './booking.types';
import { BookingsRepository } from './bookings.repository';

const BOOKING_NOT_FOUND_MESSAGE =
  'We could not find a journey for this combination of booking number and last name. Please check your details and try again.';

@Controller('bookings')
export class BookingsController {
  constructor(private readonly bookings: BookingsRepository) {}

  @Post('validate')
  @HttpCode(200)
  validate(@Body() body: Partial<BookingValidationRequestDto>): ValidatedBookingDto {
    const auftragsnummer =
      typeof body?.auftragsnummer === 'string' ? body.auftragsnummer.trim() : '';
    const lastName =
      typeof body?.lastName === 'string' ? body.lastName.trim() : '';

    if (!auftragsnummer || !lastName) {
      throw new BadRequestException(
        '"auftragsnummer" and "lastName" are required.',
      );
    }

    const record = this.bookings.findByAuftragsnummer(auftragsnummer);
    if (!record) {
      throw new NotFoundException(BOOKING_NOT_FOUND_MESSAGE);
    }

    return {
      trainNumber: record.trainNumber,
      travelDate: record.travelDate,
      destinationStation: record.destinationStation,
      passengerCount: record.passengerCount,
    };
  }
}
