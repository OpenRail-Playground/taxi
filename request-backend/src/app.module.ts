import { Module } from '@nestjs/common';

import { BookingsModule } from './bookings/bookings.module';
import { HealthModule } from './health/health.module';

@Module({
  imports: [HealthModule, BookingsModule],
})
export class AppModule {}
