import { Injectable, Logger } from '@nestjs/common';
import { UpstreamHttpError, UpstreamTimeoutError } from './upstream-errors';

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
  private readonly TIMEOUT_MS = 8_000;

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
   * Shared upstream fetch with timeout (AbortController), typed error mapping,
   * and structured logging. Never logs request headers (API keys).
   */
  private async fetchJson<T>(
    url: string,
    headers: Record<string, string>,
    label: 'ris-v1' | 'ris-v2',
  ): Promise<T> {
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), this.TIMEOUT_MS);

    let res: Response;
    try {
      try {
        res = await fetch(url, { headers, signal: ac.signal });
      } catch (err) {
        const isAbort =
          (err instanceof Error && err.name === 'AbortError') ||
          (err as { code?: string } | null)?.code === 'ABORT_ERR' ||
          ac.signal.aborted;
        if (isAbort) {
          this.logger.error({
            msg: 'Upstream timeout',
            label,
            url,
            timeoutMs: this.TIMEOUT_MS,
          });
          throw new UpstreamTimeoutError(url, this.TIMEOUT_MS, { cause: err });
        }
        this.logger.error({
          msg: 'Upstream network error',
          label,
          url,
          error: err instanceof Error ? err.message : String(err),
        });
        throw new UpstreamHttpError(url, 0, '', { cause: err });
      }

      if (!res.ok) {
        let text = '';
        try {
          text = await res.text();
        } catch {
          text = '';
        }
        const bodyExcerpt = text.slice(0, 512);
        if (res.status >= 500) {
          this.logger.error({
            msg: 'Upstream non-2xx',
            label,
            url,
            status: res.status,
            bodyExcerpt,
          });
        } else if (res.status >= 400) {
          this.logger.warn({
            msg: 'Upstream non-2xx',
            label,
            url,
            status: res.status,
            bodyExcerpt,
          });
        }
        throw new UpstreamHttpError(url, res.status, bodyExcerpt);
      }

      try {
        return (await res.json()) as T;
      } catch (e) {
        this.logger.error({
          msg: 'Upstream JSON parse error',
          label,
          url,
          error: e instanceof Error ? e.message : String(e),
        });
        throw new UpstreamHttpError(url, res.status, '', { cause: e });
      }
    } finally {
      clearTimeout(timer);
    }
  }

  /**
   * Resolves a journeyID using RIS Journeys v1 /byrelation.
   * Returns the journeyID string or throws:
   *   - UpstreamHttpError / UpstreamTimeoutError on transport / non-2xx
   *   - `NO_JOURNEY_FOUND:` sentinel Error when zero matches (consumed by JourneyStopsService)
   */
  async findJourneyId(category: string, number: number, date: string): Promise<string> {
    const url = `https://apis.deutschebahn.com/db/apis/ris-journeys/v1/byrelation?number=${number}&category=${encodeURIComponent(category)}&date=${date}`;
    const body = await this.fetchJson<{
      journeys?: Array<{ journeyID: string; transport: { category: string; number: number } }>;
    }>(url, this.v1Headers, 'ris-v1');
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
   */
  async getJourneyEvents(journeyId: string): Promise<RisV2Event[]> {
    const url = `https://apis.deutschebahn.com/db/apis/ris-journeys/v2/${encodeURIComponent(journeyId)}`;
    const body = await this.fetchJson<{ events?: RisV2Event[] }>(url, this.v2Headers, 'ris-v2');
    return body.events ?? [];
  }
}
