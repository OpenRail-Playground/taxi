import { Module } from '@nestjs/common';

import { buildRedisClient } from '../persistence/redis-client';
import { RisJourneysModule } from '../ris/ris-journeys.module';
import { BookingsController } from './bookings.controller';
import { BookingsRepository, ExcelBookingsRepository } from './bookings.repository';
import { JourneyStopsService } from './journey-stops.service';
import { RedisBookingsRepository } from './redis-bookings.repository';

@Module({
  imports: [RisJourneysModule],
  controllers: [BookingsController],
  providers: [
    {
      provide: BookingsRepository,
      useFactory: () => {
        const backend = process.env['PERSISTENCE_BACKEND'];
        if (backend === 'redis') {
          return new RedisBookingsRepository(buildRedisClient());
        }
        return new ExcelBookingsRepository();
      },
    },
    JourneyStopsService,
  ],
  exports: [BookingsRepository],
})
export class BookingsModule {}
