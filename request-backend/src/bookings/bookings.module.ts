import { Module } from '@nestjs/common';

import { RisJourneysModule } from '../ris/ris-journeys.module';
import { BookingsController } from './bookings.controller';
import { BookingsRepository } from './bookings.repository';
import { JourneyStopsService } from './journey-stops.service';

@Module({
  imports: [RisJourneysModule],
  controllers: [BookingsController],
  providers: [BookingsRepository, JourneyStopsService],
})
export class BookingsModule {}
