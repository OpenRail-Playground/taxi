import {
  BadGatewayException,
  GatewayTimeoutException,
  NotFoundException,
} from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import { UpstreamHttpError, UpstreamTimeoutError } from '../ris/upstream-errors';
import { RisJourneysClient } from '../ris/ris-journeys.client';
import { JourneyStopsService } from './journey-stops.service';

interface FakeEvent {
  type: 'ARRIVAL' | 'DEPARTURE';
  evaNumber: string;
  name: string;
  timeSchedule: string;
  cancelled?: boolean;
}

function ev(e: FakeEvent) {
  return {
    type: e.type,
    stopPlace: { evaNumber: e.evaNumber, name: e.name, ifopt: e.evaNumber },
    timeSchedule: e.timeSchedule,
    time: e.timeSchedule,
    cancelled: e.cancelled,
  };
}

describe('JourneyStopsService', () => {
  let service: JourneyStopsService;
  let ris: { findJourneyId: jest.Mock; getJourneyEvents: jest.Mock };

  beforeEach(async () => {
    jest.clearAllMocks();
    ris = {
      findJourneyId: jest.fn(),
      getJourneyEvents: jest.fn(),
    };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        JourneyStopsService,
        { provide: RisJourneysClient, useValue: ris },
      ],
    }).compile();
    service = module.get(JourneyStopsService);
  });

  describe('parseTrainNumber', () => {
    it('parses "ICE 619" into { category: "ICE", number: 619 }', () => {
      expect(service.parseTrainNumber('ICE 619')).toEqual({
        category: 'ICE',
        number: 619,
      });
    });

    it('parses "S 1" into { category: "S", number: 1 }', () => {
      expect(service.parseTrainNumber('S 1')).toEqual({
        category: 'S',
        number: 1,
      });
    });

    it('throws UNPARSEABLE_TRAIN_NUMBER for missing space', () => {
      expect(() => service.parseTrainNumber('ICE')).toThrow(
        /UNPARSEABLE_TRAIN_NUMBER/,
      );
    });

    it('throws UNPARSEABLE_TRAIN_NUMBER for non-numeric tail', () => {
      expect(() => service.parseTrainNumber('ICE abc')).toThrow(
        /UNPARSEABLE_TRAIN_NUMBER/,
      );
    });
  });

  describe('getStops', () => {
    it('returns strandedAt:null for an undisrupted journey, truncated at destination', async () => {
      ris.findJourneyId.mockResolvedValue('jid-1');
      ris.getJourneyEvents.mockResolvedValue([
        ev({ type: 'DEPARTURE', evaNumber: '1', name: 'Köln Hbf',       timeSchedule: '2026-05-29T20:00:00+02:00' }),
        ev({ type: 'ARRIVAL',   evaNumber: '2', name: 'Düsseldorf Hbf', timeSchedule: '2026-05-29T20:25:00+02:00' }),
        ev({ type: 'DEPARTURE', evaNumber: '2', name: 'Düsseldorf Hbf', timeSchedule: '2026-05-29T20:30:00+02:00' }),
        ev({ type: 'ARRIVAL',   evaNumber: '3', name: 'Essen Hbf',      timeSchedule: '2026-05-29T21:00:00+02:00' }),
      ]);

      const result = await service.getStops('ICE 619', '2026-05-29', 'Düsseldorf Hbf');

      expect(result).toEqual({
        origin: { evaNumber: '1', name: 'Köln Hbf',       scheduledTime: '2026-05-29T20:00:00+02:00' },
        destination: { evaNumber: '2', name: 'Düsseldorf Hbf', scheduledTime: '2026-05-29T20:25:00+02:00' },
        strandedAt: null,
      });
    });

    it('reports strandedAt at the last stop the train still reaches', async () => {
      ris.findJourneyId.mockResolvedValue('jid-ice842');
      ris.getJourneyEvents.mockResolvedValue([
        ev({ type: 'DEPARTURE', evaNumber: '1', name: 'Berlin Ostbahnhof', timeSchedule: '2026-05-29T19:32:00+02:00' }),
        ev({ type: 'ARRIVAL',   evaNumber: '2', name: 'Hannover Hbf',      timeSchedule: '2026-05-29T21:28:00+02:00' }),
        ev({ type: 'DEPARTURE', evaNumber: '2', name: 'Hannover Hbf',      timeSchedule: '2026-05-29T21:31:00+02:00', cancelled: true }),
        ev({ type: 'ARRIVAL',   evaNumber: '3', name: 'Bielefeld Hbf',     timeSchedule: '2026-05-29T22:20:00+02:00', cancelled: true }),
        ev({ type: 'DEPARTURE', evaNumber: '3', name: 'Bielefeld Hbf',     timeSchedule: '2026-05-29T22:22:00+02:00', cancelled: true }),
        ev({ type: 'ARRIVAL',   evaNumber: '4', name: 'Hamm(Westf)Hbf',    timeSchedule: '2026-05-29T22:49:00+02:00', cancelled: true }),
      ]);

      const result = await service.getStops('ICE 842', '2026-05-29', 'Hamm(Westf)Hbf');

      expect(result.origin.name).toBe('Berlin Ostbahnhof');
      expect(result.destination).toEqual({
        evaNumber: '4',
        name: 'Hamm(Westf)Hbf',
        scheduledTime: '2026-05-29T22:49:00+02:00',
      });
      expect(result.strandedAt).toEqual({
        evaNumber: '2',
        name: 'Hannover Hbf',
        scheduledTime: '2026-05-29T21:28:00+02:00',
      });
    });

    it('falls back to train terminus when booking destination is off-route', async () => {
      ris.findJourneyId.mockResolvedValue('jid-1542');
      ris.getJourneyEvents.mockResolvedValue([
        ev({ type: 'DEPARTURE', evaNumber: '1', name: 'Berlin Hbf',   timeSchedule: '2026-05-29T17:13:00+02:00' }),
        ev({ type: 'ARRIVAL',   evaNumber: '2', name: 'Hannover Hbf', timeSchedule: '2026-05-29T18:50:00+02:00' }),
        ev({ type: 'DEPARTURE', evaNumber: '2', name: 'Hannover Hbf', timeSchedule: '2026-05-29T18:52:00+02:00' }),
        ev({ type: 'ARRIVAL',   evaNumber: '3', name: 'Herford',      timeSchedule: '2026-05-29T19:38:00+02:00', cancelled: true }),
        ev({ type: 'DEPARTURE', evaNumber: '3', name: 'Herford',      timeSchedule: '2026-05-29T19:39:00+02:00', cancelled: true }),
        ev({ type: 'ARRIVAL',   evaNumber: '4', name: 'Köln Hbf',     timeSchedule: '2026-05-29T22:10:00+02:00', cancelled: true }),
      ]);

      const result = await service.getStops('ICE 1542', '2026-05-29', 'Bonn Hbf');

      expect(result.origin.name).toBe('Berlin Hbf');
      expect(result.destination).toEqual({
        evaNumber: '4',
        name: 'Köln Hbf',
        scheduledTime: '2026-05-29T22:10:00+02:00',
      });
      expect(result.strandedAt).toEqual({
        evaNumber: '2',
        name: 'Hannover Hbf',
        scheduledTime: '2026-05-29T18:50:00+02:00',
      });
    });

    it('returns 404 when the journey is fully cancelled from origin (origin departure cancelled)', async () => {
      ris.findJourneyId.mockResolvedValue('jid-cancel-origin');
      ris.getJourneyEvents.mockResolvedValue([
        ev({ type: 'DEPARTURE', evaNumber: '1', name: 'Köln Hbf',       timeSchedule: '2026-05-29T20:00:00+02:00', cancelled: true }),
        ev({ type: 'ARRIVAL',   evaNumber: '2', name: 'Düsseldorf Hbf', timeSchedule: '2026-05-29T20:25:00+02:00', cancelled: true }),
      ]);

      await expect(
        service.getStops('ICE 619', '2026-05-29', 'Düsseldorf Hbf'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('returns 404 when no intermediate stop is reachable (whole tail cancelled)', async () => {
      ris.findJourneyId.mockResolvedValue('jid-tail-cancel');
      ris.getJourneyEvents.mockResolvedValue([
        ev({ type: 'DEPARTURE', evaNumber: '1', name: 'Köln Hbf',       timeSchedule: '2026-05-29T20:00:00+02:00' }),
        ev({ type: 'ARRIVAL',   evaNumber: '2', name: 'Düsseldorf Hbf', timeSchedule: '2026-05-29T20:25:00+02:00', cancelled: true }),
      ]);

      await expect(
        service.getStops('ICE 619', '2026-05-29', 'Düsseldorf Hbf'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('treats off-route booking destination as terminus when the whole train is cancelled', async () => {
      ris.findJourneyId.mockResolvedValue('jid-cancel-offroute');
      ris.getJourneyEvents.mockResolvedValue([
        ev({ type: 'DEPARTURE', evaNumber: '1', name: 'Berlin Hbf',  timeSchedule: '2026-05-29T17:13:00+02:00' }),
        ev({ type: 'ARRIVAL',   evaNumber: '2', name: 'Köln Hbf',    timeSchedule: '2026-05-29T22:10:00+02:00', cancelled: true }),
      ]);

      await expect(
        service.getStops('ICE 1542', '2026-05-29', 'Bonn Hbf'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('maps NO_JOURNEY_FOUND sentinel → NotFoundException', async () => {
      ris.findJourneyId.mockRejectedValue(
        new Error('NO_JOURNEY_FOUND:ICE 619 on 2026-05-29'),
      );

      await expect(
        service.getStops('ICE 619', '2026-05-29', 'Hamburg Hbf'),
      ).rejects.toMatchObject({ status: 404, name: 'NotFoundException' });
    });

    it('maps UpstreamHttpError → BadGatewayException with cause', async () => {
      const upstream = new UpstreamHttpError('https://x', 500, 'oops');
      ris.findJourneyId.mockRejectedValue(upstream);

      await expect(
        service.getStops('ICE 619', '2026-05-29', 'Köln Hbf'),
      ).rejects.toMatchObject({ status: 502, name: 'BadGatewayException' });

      try {
        await service.getStops('ICE 619', '2026-05-29', 'Köln Hbf');
      } catch (err) {
        const ex = err as BadGatewayException & { cause: unknown };
        expect(ex.cause).toBeInstanceOf(UpstreamHttpError);
        expect((ex.cause as UpstreamHttpError).status).toBe(500);
      }
    });

    it('maps UpstreamTimeoutError → GatewayTimeoutException with cause', async () => {
      const upstream = new UpstreamTimeoutError('https://x', 8000);
      ris.findJourneyId.mockRejectedValue(upstream);

      await expect(
        service.getStops('ICE 619', '2026-05-29', 'Köln Hbf'),
      ).rejects.toMatchObject({ status: 504, name: 'GatewayTimeoutException' });

      try {
        await service.getStops('ICE 619', '2026-05-29', 'Köln Hbf');
      } catch (err) {
        const ex = err as GatewayTimeoutException & { cause: unknown };
        expect(ex.cause).toBeInstanceOf(UpstreamTimeoutError);
        expect((ex.cause as UpstreamTimeoutError).timeoutMs).toBe(8000);
      }
    });

    it('parseTrainNumber unparseable propagates bare Error before try/catch', async () => {
      await expect(
        service.getStops('???', '2026-05-29', 'Köln Hbf'),
      ).rejects.toThrow(/UNPARSEABLE_TRAIN_NUMBER/);

      try {
        await service.getStops('???', '2026-05-29', 'Köln Hbf');
      } catch (err) {
        expect(err).toBeInstanceOf(Error);
        expect((err as Error & { status?: number }).status).toBeUndefined();
      }
    });
  });
});
