import { Module } from '@nestjs/common';

import { BookingsModule } from '../bookings/bookings.module';
import { PersistenceModule } from '../persistence/persistence.module';
import { HelpRequestController } from './help-request.controller';
import { HelpRequestService } from './help-request.service';
import { HelpRequestVerifier } from './help-request.verifier';

@Module({
  imports: [
    PersistenceModule.forFeature({ entity: 'help-request' }),
    BookingsModule,
  ],
  controllers: [HelpRequestController],
  providers: [HelpRequestService, HelpRequestVerifier],
})
export class HelpRequestModule {}
