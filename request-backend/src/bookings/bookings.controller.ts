import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  NotFoundException,
  Param,
  Post,
} from '@nestjs/common';
import type { JourneyStopsResponse } from '@taxi/shared';

import type {
  BookingValidationRequestDto,
  ValidatedBookingDto,
} from './booking.types';
import { BookingsRepository } from './bookings.repository';
import { JourneyStopsService } from './journey-stops.service';

const BOOKING_NOT_FOUND_MESSAGE =
  'We could not find a journey for this combination of booking number and last name. Please check your details and try again.';

@Controller('bookings')
export class BookingsController {
  constructor(
    private readonly bookings: BookingsRepository,
    private readonly journeyStops: JourneyStopsService,
  ) {}

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

  @Get(':auftragsnummer/journey-stops')
  async getJourneyStops(
    @Param('auftragsnummer') auftragsnummer: string,
  ): Promise<JourneyStopsResponse> {
    const record = this.bookings.findByAuftragsnummer(auftragsnummer);
    if (!record) {
      throw new NotFoundException(`Booking ${auftragsnummer} not found.`);
    }
    const stops = await this.journeyStops.getStops(
      record.trainNumber,
      record.travelDate,
      record.destinationStation,
    );
    return { stops };
  }
}
