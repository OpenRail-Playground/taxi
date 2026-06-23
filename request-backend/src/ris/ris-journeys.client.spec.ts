import { RisJourneysClient } from './ris-journeys.client';

describe('RisJourneysClient', () => {
  let client: RisJourneysClient;

  beforeEach(() => {
    client = new RisJourneysClient();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('findJourneyId', () => {
    it('returns the journeyID string when v1 returns a matching journey', async () => {
      const body = {
        journeys: [
          {
            journeyID: 'journey-abc-123',
            transport: { category: 'ICE', number: 647 },
          },
        ],
      };
      jest.spyOn(globalThis, 'fetch').mockResolvedValue(
        new Response(JSON.stringify(body), {
          status: 200,
          headers: { 'Content-Type': 'application/vnd.de.db.ris+json' },
        }),
      );

      const result = await client.findJourneyId('ICE', 647, '2026-05-29');

      expect(result).toBe('journey-abc-123');
    });

    it('throws an error starting with NO_JOURNEY_FOUND: when v1 returns 0 matching journeys', async () => {
      jest.spyOn(globalThis, 'fetch').mockResolvedValue(
        new Response(JSON.stringify({ journeys: [] }), {
          status: 200,
          headers: { 'Content-Type': 'application/vnd.de.db.ris+json' },
        }),
      );

      await expect(client.findJourneyId('ICE', 9999, '2026-05-29')).rejects.toThrow(
        /^NO_JOURNEY_FOUND:/,
      );
    });

    it('throws an error when v1 returns non-2xx HTTP status', async () => {
      jest.spyOn(globalThis, 'fetch').mockResolvedValue(
        new Response('Internal Server Error', {
          status: 500,
        }),
      );

      await expect(client.findJourneyId('ICE', 647, '2026-05-29')).rejects.toThrow(
        /RIS v1 returned HTTP 500/,
      );
    });
  });

  describe('getJourneyEvents', () => {
    it('returns events array from v2 response', async () => {
      const body = {
        events: [
          {
            type: 'DEPARTURE',
            stopPlace: {
              evaNumber: '8000085',
              name: 'Köln Hbf',
              ifopt: 'de:05315:8000085',
            },
            timeSchedule: '2026-05-29T21:00:00+02:00',
            time: '2026-05-29T21:00:00+02:00',
            cancelled: false,
          },
        ],
      };
      jest.spyOn(globalThis, 'fetch').mockResolvedValue(
        new Response(JSON.stringify(body), {
          status: 200,
          headers: { 'Content-Type': 'application/vnd.de.db.ris+json' },
        }),
      );

      const events = await client.getJourneyEvents('journey-abc-123');

      expect(events).toHaveLength(1);
      expect(events[0].type).toBe('DEPARTURE');
      expect(events[0].stopPlace.evaNumber).toBe('8000085');
    });

    it('throws an error when v2 returns non-2xx HTTP status', async () => {
      jest.spyOn(globalThis, 'fetch').mockResolvedValue(
        new Response('Not Found', {
          status: 404,
        }),
      );

      await expect(client.getJourneyEvents('journey-missing')).rejects.toThrow(
        /RIS v2 returned HTTP 404/,
      );
    });
  });
});
