import { Test, type TestingModule } from '@nestjs/testing';
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

    it('propagates errors thrown by RisJourneysClient.findJourneyId', async () => {
      ris.findJourneyId.mockRejectedValue(
        new Error('NO_JOURNEY_FOUND:ICE 619 on 2026-05-29'),
      );

      await expect(
        service.getStops('ICE 619', '2026-05-29', 'Hamburg Hbf'),
      ).rejects.toThrow(/NO_JOURNEY_FOUND/);
    });
  });
});
