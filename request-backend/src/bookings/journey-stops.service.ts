import { Injectable } from '@nestjs/common';
import type { JourneyStop } from '@taxi/shared';
import { RisJourneysClient } from '../ris/ris-journeys.client';

@Injectable()
export class JourneyStopsService {
  constructor(private readonly ris: RisJourneysClient) {}

  /**
   * Parses "ICE 619" → { category: "ICE", number: 619 }.
   * Throws if the format is unrecognisable.
   */
  parseTrainNumber(trainNumber: string): { category: string; number: number } {
    const lastSpace = trainNumber.lastIndexOf(' ');
    if (lastSpace < 1) {
      throw new Error(`UNPARSEABLE_TRAIN_NUMBER:${trainNumber}`);
    }
    const category = trainNumber.slice(0, lastSpace).trim();
    const num = parseInt(trainNumber.slice(lastSpace + 1).trim(), 10);
    if (!Number.isFinite(num)) {
      throw new Error(`UNPARSEABLE_TRAIN_NUMBER:${trainNumber}`);
    }
    return { category, number: num };
  }

  async getStops(
    trainNumber: string,
    travelDate: string,
    destinationStation: string,
  ): Promise<JourneyStop[]> {
    const { category, number } = this.parseTrainNumber(trainNumber);
    const journeyId = await this.ris.findJourneyId(category, number, travelDate);
    const events = await this.ris.getJourneyEvents(journeyId);

    // Keep only DEPARTURE events, deduplicate by evaNumber (first occurrence wins)
    const seen = new Set<string>();
    const departures: JourneyStop[] = [];
    for (const e of events) {
      if (e.type !== 'DEPARTURE') continue;
      if (seen.has(e.stopPlace.evaNumber)) continue;
      seen.add(e.stopPlace.evaNumber);
      departures.push({
        evaNumber: e.stopPlace.evaNumber,
        name: e.stopPlace.name,
        scheduledTime: e.timeSchedule,
        cancelled: e.cancelled ?? false,
      });
    }

    // Truncate at destination (inclusive, case-insensitive trim)
    const destNorm = destinationStation.trim().toLowerCase();
    const destIdx = departures.findIndex(
      (s) => s.name.trim().toLowerCase() === destNorm,
    );
    return destIdx === -1 ? departures : departures.slice(0, destIdx + 1);
  }
}
