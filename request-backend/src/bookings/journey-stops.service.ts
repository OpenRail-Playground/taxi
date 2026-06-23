import {
  BadGatewayException,
  GatewayTimeoutException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { JourneyStopPoint, JourneyStopsResponse } from '@taxi/shared';
import { RisJourneysClient, type RisV2Event } from '../ris/ris-journeys.client';
import { UpstreamHttpError, UpstreamTimeoutError } from '../ris/upstream-errors';

interface MergedStop {
  evaNumber: string;
  name: string;
  scheduledArrival: string | null;
  scheduledDeparture: string | null;
  arrivalCancelled: boolean;
  departureCancelled: boolean;
}

@Injectable()
export class JourneyStopsService {
  constructor(private readonly ris: RisJourneysClient) {}

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
  ): Promise<JourneyStopsResponse> {
    const { category, number } = this.parseTrainNumber(trainNumber);
    try {
      const journeyId = await this.ris.findJourneyId(category, number, travelDate);
      const events = await this.ris.getJourneyEvents(journeyId);
      const stops = this.mergeEventsByStop(events);
      return this.buildResponse(stops, destinationStation, trainNumber, travelDate);
    } catch (err) {
      if (err instanceof UpstreamTimeoutError) {
        throw new GatewayTimeoutException(
          'RIS API timed out. Try again later.',
          { cause: err },
        );
      }
      if (err instanceof UpstreamHttpError) {
        throw new BadGatewayException(
          'RIS API unavailable. Try again later.',
          { cause: err },
        );
      }
      if (err instanceof NotFoundException) {
        throw err;
      }
      if (err instanceof Error && err.message.startsWith('NO_JOURNEY_FOUND:')) {
        throw new NotFoundException(
          `No journey found for ${trainNumber} on ${travelDate}.`,
        );
      }
      throw new BadGatewayException(
        'RIS API unavailable. Try again later.',
        { cause: err instanceof Error ? err : new Error(String(err)) },
      );
    }
  }

  private mergeEventsByStop(events: RisV2Event[]): MergedStop[] {
    const order: string[] = [];
    const byEva = new Map<string, MergedStop>();
    for (const e of events) {
      let stop = byEva.get(e.stopPlace.evaNumber);
      if (!stop) {
        stop = {
          evaNumber: e.stopPlace.evaNumber,
          name: e.stopPlace.name,
          scheduledArrival: null,
          scheduledDeparture: null,
          arrivalCancelled: false,
          departureCancelled: false,
        };
        byEva.set(e.stopPlace.evaNumber, stop);
        order.push(e.stopPlace.evaNumber);
      }
      if (e.type === 'ARRIVAL') {
        stop.scheduledArrival = e.timeSchedule;
        stop.arrivalCancelled = e.cancelled ?? false;
      } else {
        stop.scheduledDeparture = e.timeSchedule;
        stop.departureCancelled = e.cancelled ?? false;
      }
    }
    return order.map((eva) => byEva.get(eva)!);
  }

  private buildResponse(
    stops: MergedStop[],
    destinationStation: string,
    trainNumber: string,
    travelDate: string,
  ): JourneyStopsResponse {
    if (stops.length < 2) {
      throw new NotFoundException(
        `No journey found for ${trainNumber} on ${travelDate}.`,
      );
    }

    const origin = stops[0];
    if (origin.departureCancelled || origin.scheduledDeparture === null) {
      throw new NotFoundException(
        `No journey found for ${trainNumber} on ${travelDate}.`,
      );
    }

    const destNorm = destinationStation.trim().toLowerCase();
    const destOnRouteIdx = stops.findIndex(
      (s) => s.name.trim().toLowerCase() === destNorm,
    );

    const destIdx = destOnRouteIdx > 0 ? destOnRouteIdx : stops.length - 1;
    const destination = stops[destIdx];
    if (destIdx === 0) {
      throw new NotFoundException(
        `No journey found for ${trainNumber} on ${travelDate}.`,
      );
    }
    if (destination.scheduledArrival === null) {
      throw new NotFoundException(
        `No journey found for ${trainNumber} on ${travelDate}.`,
      );
    }

    let lastReachedIdx = 0;
    for (let i = 1; i <= destIdx; i++) {
      if (!stops[i].arrivalCancelled) {
        lastReachedIdx = i;
      }
    }
    if (lastReachedIdx === 0) {
      throw new NotFoundException(
        `No journey found for ${trainNumber} on ${travelDate}.`,
      );
    }

    const originPoint: JourneyStopPoint = {
      evaNumber: origin.evaNumber,
      name: origin.name,
      scheduledTime: origin.scheduledDeparture,
    };
    const destinationPoint: JourneyStopPoint = {
      evaNumber: destination.evaNumber,
      name: destination.name,
      scheduledTime: destination.scheduledArrival,
    };

    if (lastReachedIdx === destIdx) {
      return { origin: originPoint, destination: destinationPoint, strandedAt: null };
    }

    const stranded = stops[lastReachedIdx];
    const strandedPoint: JourneyStopPoint = {
      evaNumber: stranded.evaNumber,
      name: stranded.name,
      scheduledTime: stranded.scheduledArrival ?? stranded.scheduledDeparture!,
    };
    return {
      origin: originPoint,
      destination: destinationPoint,
      strandedAt: strandedPoint,
    };
  }
}
