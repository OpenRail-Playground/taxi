import {
  BadGatewayException,
  GatewayTimeoutException,
  NotFoundException,
} from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import { UpstreamHttpError, UpstreamTimeoutError } from '../ris/upstream-errors';
import { RisJourneysClient } from '../ris/ris-journeys.client';
import { JourneyStopsService } from './journey-stops.service';

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
    it('truncates stops inclusively at the destination', async () => {
      ris.findJourneyId.mockResolvedValue('jid-1');
      ris.getJourneyEvents.mockResolvedValue([
        {
          type: 'DEPARTURE',
          stopPlace: { evaNumber: '1', name: 'Köln Hbf', ifopt: 'a' },
          timeSchedule: '2026-05-29T20:00:00+02:00',
          time: '2026-05-29T20:00:00+02:00',
        },
        {
          type: 'DEPARTURE',
          stopPlace: { evaNumber: '2', name: 'Düsseldorf Hbf', ifopt: 'b' },
          timeSchedule: '2026-05-29T20:30:00+02:00',
          time: '2026-05-29T20:30:00+02:00',
        },
        {
          type: 'DEPARTURE',
          stopPlace: { evaNumber: '3', name: 'Essen Hbf', ifopt: 'c' },
          timeSchedule: '2026-05-29T21:00:00+02:00',
          time: '2026-05-29T21:00:00+02:00',
        },
      ]);

      const stops = await service.getStops(
        'ICE 619',
        '2026-05-29',
        'Düsseldorf Hbf',
      );

      expect(stops).toHaveLength(2);
      expect(stops[0].evaNumber).toBe('1');
      expect(stops[1].evaNumber).toBe('2');
    });

    it('returns all stops when the destination is not found', async () => {
      ris.findJourneyId.mockResolvedValue('jid-2');
      ris.getJourneyEvents.mockResolvedValue([
        {
          type: 'DEPARTURE',
          stopPlace: { evaNumber: '1', name: 'Köln Hbf', ifopt: 'a' },
          timeSchedule: '2026-05-29T20:00:00+02:00',
          time: '2026-05-29T20:00:00+02:00',
        },
        {
          type: 'DEPARTURE',
          stopPlace: { evaNumber: '2', name: 'Essen Hbf', ifopt: 'b' },
          timeSchedule: '2026-05-29T20:30:00+02:00',
          time: '2026-05-29T20:30:00+02:00',
        },
      ]);

      const stops = await service.getStops(
        'ICE 619',
        '2026-05-29',
        'Hamburg Hbf',
      );

      expect(stops).toHaveLength(2);
    });

    it('deduplicates by evaNumber and skips ARRIVAL events', async () => {
      ris.findJourneyId.mockResolvedValue('jid-3');
      ris.getJourneyEvents.mockResolvedValue([
        {
          type: 'ARRIVAL',
          stopPlace: { evaNumber: '1', name: 'Köln Hbf', ifopt: 'a' },
          timeSchedule: '2026-05-29T19:55:00+02:00',
          time: '2026-05-29T19:55:00+02:00',
        },
        {
          type: 'DEPARTURE',
          stopPlace: { evaNumber: '1', name: 'Köln Hbf', ifopt: 'a' },
          timeSchedule: '2026-05-29T20:00:00+02:00',
          time: '2026-05-29T20:00:00+02:00',
        },
      ]);

      const stops = await service.getStops(
        'ICE 619',
        '2026-05-29',
        'Hamburg Hbf',
      );

      expect(stops).toHaveLength(1);
      expect(stops[0].evaNumber).toBe('1');
      expect(stops[0].scheduledTime).toBe('2026-05-29T20:00:00+02:00');
    });

    it('sets cancelled: true when the event is cancelled', async () => {
      ris.findJourneyId.mockResolvedValue('jid-4');
      ris.getJourneyEvents.mockResolvedValue([
        {
          type: 'DEPARTURE',
          stopPlace: { evaNumber: '1', name: 'Köln Hbf', ifopt: 'a' },
          timeSchedule: '2026-05-29T20:00:00+02:00',
          time: '2026-05-29T20:00:00+02:00',
          cancelled: true,
        },
      ]);

      const stops = await service.getStops(
        'ICE 619',
        '2026-05-29',
        'Hamburg Hbf',
      );

      expect(stops).toHaveLength(1);
      expect(stops[0].cancelled).toBe(true);
    });

    it('maps NO_JOURNEY_FOUND sentinel → NotFoundException', async () => {
      ris.findJourneyId.mockRejectedValue(
        new Error('NO_JOURNEY_FOUND:ICE 619 on 2026-05-29'),
      );

      await expect(
        service.getStops('ICE 619', '2026-05-29', 'Hamburg Hbf'),
      ).rejects.toMatchObject({ status: 404, name: 'NotFoundException' });

      try {
        await service.getStops('ICE 619', '2026-05-29', 'Hamburg Hbf');
      } catch (err) {
        const ex = err as NotFoundException;
        expect(ex.message).toContain('ICE 619');
        expect(ex.message).toContain('2026-05-29');
      }
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
