import { Injectable, Logger } from '@nestjs/common';

export interface RisV2StopPlace {
  evaNumber: string;
  name: string;
  ifopt: string;
}

export interface RisV2Event {
  type: 'ARRIVAL' | 'DEPARTURE';
  stopPlace: RisV2StopPlace;
  timeSchedule: string;
  time: string;
  cancelled?: boolean;
  additional?: boolean;
}

@Injectable()
export class RisJourneysClient {
  private readonly logger = new Logger(RisJourneysClient.name);

  private get v1Headers(): Record<string, string> {
    return {
      'Accept': 'application/vnd.de.db.ris+json',
      'DB-Client-ID': process.env['RIS_V1_CLIENT_ID'] ?? '',
      'DB-Api-Key': process.env['RIS_V1_API_KEY'] ?? '',
    };
  }

  private get v2Headers(): Record<string, string> {
    return {
      'Accept': 'application/vnd.de.db.ris+json',
      'DB-Client-ID': process.env['RIS_V2_CLIENT_ID'] ?? '',
      'DB-Api-Key': process.env['RIS_V2_API_KEY'] ?? '',
    };
  }

  /**
   * Resolves a journeyID using RIS Journeys v1 /byrelation.
   * Returns the journeyID string or throws an error (0 results or RIS error).
   */
  async findJourneyId(category: string, number: number, date: string): Promise<string> {
    const url = `https://apis.deutschebahn.com/db/apis/ris-journeys/v1/byrelation?number=${number}&category=${encodeURIComponent(category)}&date=${date}`;
    let res: Response;
    try {
      res = await fetch(url, { headers: this.v1Headers });
    } catch (err) {
      throw new Error(`RIS v1 network error: ${String(err)}`, { cause: err });
    }
    if (!res.ok) {
      throw new Error(`RIS v1 returned HTTP ${res.status}`);
    }
    const body = (await res.json()) as {
      journeys?: Array<{ journeyID: string; transport: { category: string; number: number } }>;
    };
    const matches = (body.journeys ?? []).filter(
      (j) => j.transport.category === category && j.transport.number === number,
    );
    if (matches.length === 0) {
      throw new Error(`NO_JOURNEY_FOUND:${category} ${number} on ${date}`);
    }
    if (matches.length > 1) {
      this.logger.warn(`Multiple journeys matched ${category} ${number} on ${date}, using first`);
    }
    return matches[0].journeyID;
  }

  /**
   * Fetches all events for a journeyID using RIS Journeys v2.
   * Returns raw event array or throws an error.
   */
  async getJourneyEvents(journeyId: string): Promise<RisV2Event[]> {
    const url = `https://apis.deutschebahn.com/db/apis/ris-journeys/v2/${encodeURIComponent(journeyId)}`;
    let res: Response;
    try {
      res = await fetch(url, { headers: this.v2Headers });
    } catch (err) {
      throw new Error(`RIS v2 network error: ${String(err)}`, { cause: err });
    }
    if (!res.ok) {
      throw new Error(`RIS v2 returned HTTP ${res.status}`);
    }
    const body = (await res.json()) as { events?: RisV2Event[] };
    return body.events ?? [];
  }
}
