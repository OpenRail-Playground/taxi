import { Logger } from '@nestjs/common';
import { RisJourneysClient } from './ris-journeys.client';
import { UpstreamHttpError, UpstreamTimeoutError } from './upstream-errors';

describe('RisJourneysClient', () => {
  let client: RisJourneysClient;

  beforeEach(() => {
    client = new RisJourneysClient();
  });

  afterEach(() => {
    jest.restoreAllMocks();
    jest.useRealTimers();
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
  });

  describe('upstream error handling', () => {
    it('findJourneyId: throws UpstreamHttpError and logs error on 5xx', async () => {
      jest.spyOn(globalThis, 'fetch').mockResolvedValue(
        new Response('upstream go boom', { status: 500 }),
      );
      const errorSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => {});

      await expect(client.findJourneyId('ICE', 619, '2026-05-29')).rejects.toBeInstanceOf(
        UpstreamHttpError,
      );

      // Re-trigger to inspect properties; reset spy state in between.
      errorSpy.mockClear();
      jest.spyOn(globalThis, 'fetch').mockResolvedValue(
        new Response('upstream go boom', { status: 500 }),
      );
      let caught: unknown;
      try {
        await client.findJourneyId('ICE', 619, '2026-05-29');
      } catch (e) {
        caught = e;
      }
      expect(caught).toBeInstanceOf(UpstreamHttpError);
      const err = caught as UpstreamHttpError;
      expect(err.status).toBe(500);
      expect(err.bodyExcerpt).toContain('upstream go boom');
      expect(errorSpy).toHaveBeenCalledWith(
        expect.objectContaining({ status: 500, label: 'ris-v1' }),
      );
    });

    it('findJourneyId: throws UpstreamHttpError and logs warn (not error) on 401', async () => {
      jest.spyOn(globalThis, 'fetch').mockResolvedValue(
        new Response('Unauthorized', { status: 401 }),
      );
      const warnSpy = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => {});
      const errorSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => {});

      let caught: unknown;
      try {
        await client.findJourneyId('ICE', 619, '2026-05-29');
      } catch (e) {
        caught = e;
      }
      expect(caught).toBeInstanceOf(UpstreamHttpError);
      const err = caught as UpstreamHttpError;
      expect(err.status).toBe(401);
      expect(err.bodyExcerpt).toBe('Unauthorized');
      expect(warnSpy).toHaveBeenCalledWith(
        expect.objectContaining({ status: 401, label: 'ris-v1' }),
      );
      expect(errorSpy).not.toHaveBeenCalled();
    });

    it('findJourneyId: throws UpstreamTimeoutError when fetch aborts after 8s', async () => {
      jest.useFakeTimers();
      jest.spyOn(globalThis, 'fetch').mockImplementation(
        ((_url: string | URL | Request, init?: RequestInit) =>
          new Promise((_, reject) => {
            init?.signal?.addEventListener('abort', () => {
              reject(Object.assign(new Error('aborted'), { name: 'AbortError' }));
            });
          })) as typeof fetch,
      );
      const errorSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => {});

      const promise = client.findJourneyId('ICE', 619, '2026-05-29');
      jest.advanceTimersByTime(8001);

      let caught: unknown;
      try {
        await promise;
      } catch (e) {
        caught = e;
      }
      expect(caught).toBeInstanceOf(UpstreamTimeoutError);
      const err = caught as UpstreamTimeoutError;
      expect(err.timeoutMs).toBe(8000);
      expect(errorSpy).toHaveBeenCalledWith(
        expect.objectContaining({ msg: 'Upstream timeout', label: 'ris-v1', timeoutMs: 8000 }),
      );
    });

    it('getJourneyEvents: throws UpstreamHttpError and logs error on 503', async () => {
      jest.spyOn(globalThis, 'fetch').mockResolvedValue(
        new Response('service unavailable', { status: 503 }),
      );
      const errorSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => {});

      let caught: unknown;
      try {
        await client.getJourneyEvents('journey-abc-123');
      } catch (e) {
        caught = e;
      }
      expect(caught).toBeInstanceOf(UpstreamHttpError);
      const err = caught as UpstreamHttpError;
      expect(err.status).toBe(503);
      expect(err.bodyExcerpt).toContain('service unavailable');
      expect(errorSpy).toHaveBeenCalledWith(
        expect.objectContaining({ status: 503, label: 'ris-v2' }),
      );
    });

    it('getJourneyEvents: throws UpstreamHttpError and logs warn (not error) on 404', async () => {
      jest.spyOn(globalThis, 'fetch').mockResolvedValue(
        new Response('not found', { status: 404 }),
      );
      const warnSpy = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => {});
      const errorSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => {});

      let caught: unknown;
      try {
        await client.getJourneyEvents('journey-missing');
      } catch (e) {
        caught = e;
      }
      expect(caught).toBeInstanceOf(UpstreamHttpError);
      const err = caught as UpstreamHttpError;
      expect(err.status).toBe(404);
      expect(warnSpy).toHaveBeenCalledWith(
        expect.objectContaining({ status: 404, label: 'ris-v2' }),
      );
      expect(errorSpy).not.toHaveBeenCalled();
    });

    it('getJourneyEvents: throws UpstreamTimeoutError when fetch aborts after 8s', async () => {
      jest.useFakeTimers();
      jest.spyOn(globalThis, 'fetch').mockImplementation(
        ((_url: string | URL | Request, init?: RequestInit) =>
          new Promise((_, reject) => {
            init?.signal?.addEventListener('abort', () => {
              reject(Object.assign(new Error('aborted'), { name: 'AbortError' }));
            });
          })) as typeof fetch,
      );
      const errorSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => {});

      const promise = client.getJourneyEvents('journey-abc-123');
      jest.advanceTimersByTime(8001);

      let caught: unknown;
      try {
        await promise;
      } catch (e) {
        caught = e;
      }
      expect(caught).toBeInstanceOf(UpstreamTimeoutError);
      const err = caught as UpstreamTimeoutError;
      expect(err.timeoutMs).toBe(8000);
      expect(errorSpy).toHaveBeenCalledWith(
        expect.objectContaining({ msg: 'Upstream timeout', label: 'ris-v2', timeoutMs: 8000 }),
      );
    });
  });
});
