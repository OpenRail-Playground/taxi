import {
  ArgumentsHost,
  BadGatewayException,
  BadRequestException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';

import { AllExceptionsFilter } from './all-exceptions.filter';

interface MockAdapter {
  reply: jest.Mock;
  getRequestUrl: jest.Mock;
}

interface MockReq {
  url: string;
  method: string;
  headers: Record<string, string>;
}

interface BuiltHost {
  host: ArgumentsHost;
  req: MockReq;
  res: Record<string, unknown>;
}

function buildAdapterHost(adapter: MockAdapter): HttpAdapterHost {
  return { httpAdapter: adapter } as unknown as HttpAdapterHost;
}

function buildHost(req: MockReq): BuiltHost {
  const res: Record<string, unknown> = {};
  const host = {
    switchToHttp: () => ({
      getRequest: () => req,
      getResponse: () => res,
    }),
  } as unknown as ArgumentsHost;
  return { host, req, res };
}

function buildAdapter(url = '/x'): MockAdapter {
  return {
    reply: jest.fn(),
    getRequestUrl: jest.fn(() => url),
  };
}

describe('AllExceptionsFilter', () => {
  let errorSpy: jest.SpyInstance;
  let warnSpy: jest.SpyInstance;
  let logSpy: jest.SpyInstance;

  beforeEach(() => {
    errorSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation();
    warnSpy = jest.spyOn(Logger.prototype, 'warn').mockImplementation();
    logSpy = jest.spyOn(Logger.prototype, 'log').mockImplementation();
  });

  afterEach(() => {
    errorSpy.mockRestore();
    warnSpy.mockRestore();
    logSpy.mockRestore();
  });

  it('A. logs 5xx with cause chain via Logger.error and replies with structured body', () => {
    const adapter = buildAdapter('/x');
    const filter = new AllExceptionsFilter(buildAdapterHost(adapter));
    const { host, res } = buildHost({ url: '/x', method: 'GET', headers: {} });

    const exception = new BadGatewayException('boom', {
      cause: new Error('upstream 503'),
    });

    filter.catch(exception, host);

    expect(adapter.reply).toHaveBeenCalledTimes(1);
    const replyCall = adapter.reply.mock.calls[0];
    expect(replyCall[0]).toBe(res);
    expect(replyCall[2]).toBe(502);
    const body = replyCall[1] as Record<string, unknown>;
    expect(body.statusCode).toBe(502);
    expect(body.message).toBe('boom');
    expect(body.path).toBe('/x');
    expect(typeof body.requestId).toBe('string');
    expect((body.requestId as string).length).toBeGreaterThan(0);

    expect(errorSpy).toHaveBeenCalled();
    expect(errorSpy.mock.calls[0][0]).toEqual(
      expect.objectContaining({
        requestId: body.requestId,
        statusCode: 502,
        causes: expect.arrayContaining([
          expect.objectContaining({ name: 'Error', message: 'upstream 503' }),
        ]),
      }),
    );
  });

  it('B. logs 4xx via Logger.warn (not Logger.error)', () => {
    const adapter = buildAdapter('/x');
    const filter = new AllExceptionsFilter(buildAdapterHost(adapter));
    const { host } = buildHost({ url: '/x', method: 'GET', headers: {} });

    filter.catch(new NotFoundException('not here'), host);

    expect(warnSpy).toHaveBeenCalled();
    expect(errorSpy).not.toHaveBeenCalled();

    const replyCall = adapter.reply.mock.calls[0];
    const body = replyCall[1] as Record<string, unknown>;
    expect(body.statusCode).toBe(404);
    expect(typeof body.requestId).toBe('string');
    expect((body.requestId as string).length).toBeGreaterThan(0);
  });

  it('C. propagates incoming x-request-id header into body and log payload', () => {
    const adapter = buildAdapter('/x');
    const filter = new AllExceptionsFilter(buildAdapterHost(adapter));
    const { host } = buildHost({
      url: '/x',
      method: 'POST',
      headers: { 'x-request-id': 'provided-id-1' },
    });

    filter.catch(new BadRequestException('bad'), host);

    const replyCall = adapter.reply.mock.calls[0];
    const body = replyCall[1] as Record<string, unknown>;
    expect(body.requestId).toBe('provided-id-1');

    expect(warnSpy).toHaveBeenCalled();
    expect(warnSpy.mock.calls[0][0]).toEqual(
      expect.objectContaining({ requestId: 'provided-id-1' }),
    );
  });

  it('D. handles non-HttpException as 500 with generic message and Logger.error', () => {
    const adapter = buildAdapter('/x');
    const filter = new AllExceptionsFilter(buildAdapterHost(adapter));
    const { host } = buildHost({ url: '/x', method: 'GET', headers: {} });

    filter.catch(new Error('weird'), host);

    expect(errorSpy).toHaveBeenCalled();

    const replyCall = adapter.reply.mock.calls[0];
    expect(replyCall[2]).toBe(500);
    const body = replyCall[1] as Record<string, unknown>;
    expect(body.statusCode).toBe(500);
    expect(body.message).toBe('Internal server error');
  });

  it('E. unwraps nested cause chain up to depth 2 in order [middle, inner]', () => {
    const adapter = buildAdapter('/x');
    const filter = new AllExceptionsFilter(buildAdapterHost(adapter));
    const { host } = buildHost({ url: '/x', method: 'GET', headers: {} });

    const inner = new Error('innermost');
    const middle = new Error('mid', { cause: inner });
    const top = new BadGatewayException('top', { cause: middle });

    filter.catch(top, host);

    expect(errorSpy).toHaveBeenCalled();
    const payload = errorSpy.mock.calls[0][0] as { causes: unknown[] };
    expect(payload.causes).toHaveLength(2);
    expect(payload.causes[0]).toEqual(
      expect.objectContaining({ name: 'Error', message: 'mid' }),
    );
    expect(payload.causes[1]).toEqual(
      expect.objectContaining({ name: 'Error', message: 'innermost' }),
    );
  });
});
