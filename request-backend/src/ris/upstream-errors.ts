/**
 * Upstream returned a non-2xx HTTP response, OR a transport-level failure
 * (DNS, ECONNREFUSED, etc.). `status === 0` denotes transport failures.
 */
export class UpstreamHttpError extends Error {
  constructor(
    public readonly url: string,
    public readonly status: number,
    public readonly bodyExcerpt: string,
    options?: { cause?: unknown },
  ) {
    super(`Upstream ${url} returned HTTP ${status}`, options);
    this.name = 'UpstreamHttpError';
  }
}

/**
 * Upstream did not respond within the configured timeout.
 */
export class UpstreamTimeoutError extends Error {
  constructor(
    public readonly url: string,
    public readonly timeoutMs: number,
    options?: { cause?: unknown },
  ) {
    super(`Upstream ${url} timed out after ${timeoutMs}ms`, options);
    this.name = 'UpstreamTimeoutError';
  }
}
