import { UpstreamHttpError, UpstreamTimeoutError } from './upstream-errors';

describe('UpstreamHttpError', () => {
  it('should construct with url, status, and bodyExcerpt', () => {
    const err = new UpstreamHttpError('https://x', 503, 'oops body');
    expect(err.status).toBe(503);
    expect(err.name).toBe('UpstreamHttpError');
    expect(err.url).toBe('https://x');
    expect(err.bodyExcerpt).toBe('oops body');
    expect(err.message).toContain('503');
    expect(err.message).toContain('https://x');
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(UpstreamHttpError);
  });

  it('should preserve cause option', () => {
    const inner = new Error('xx');
    const err = new UpstreamHttpError('u', 500, '', { cause: inner });
    expect((err as any).cause).toBe(inner);
  });

  it('should handle transport failure with status 0', () => {
    const err = new UpstreamHttpError('u', 0, '');
    expect(err.status).toBe(0);
    expect(err.bodyExcerpt).toBe('');
  });
});

describe('UpstreamTimeoutError', () => {
  it('should construct with url and timeoutMs', () => {
    const err = new UpstreamTimeoutError('https://y', 8000);
    expect(err.timeoutMs).toBe(8000);
    expect(err.name).toBe('UpstreamTimeoutError');
    expect(err.message).toContain('8000ms');
    expect(err.message).toContain('https://y');
  });

  it('should preserve cause option', () => {
    const inner = new Error('yy');
    const err = new UpstreamTimeoutError('u', 5000, { cause: inner });
    expect((err as any).cause).toBe(inner);
  });
});
