import { Module } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';

import { BookingsModule } from './bookings/bookings.module';
import { AllExceptionsFilter } from './common/all-exceptions.filter';
import { HealthModule } from './health/health.module';
import { HelpRequestModule } from './help-requests/help-request.module';

@Module({
  imports: [HealthModule, BookingsModule, HelpRequestModule],
  providers: [{ provide: APP_FILTER, useClass: AllExceptionsFilter }],
})
export class AppModule {}
