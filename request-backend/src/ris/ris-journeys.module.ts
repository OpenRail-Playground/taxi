import { Module } from '@nestjs/common';

import { RisJourneysClient } from './ris-journeys.client';

@Module({
  providers: [RisJourneysClient],
  exports: [RisJourneysClient],
})
export class RisJourneysModule {}
