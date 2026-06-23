import { Module } from '@nestjs/common';

import { BookingsModule } from './bookings/bookings.module';
import { HealthModule } from './health/health.module';
import { HelpRequestModule } from './help-requests/help-request.module';

@Module({
  imports: [HealthModule, BookingsModule, HelpRequestModule],
})
export class AppModule {}
