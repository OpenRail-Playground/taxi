import type { RedisClient } from './redis-client';

/**
 * Deterministic in-memory fake honoring the same return contracts as
 * @upstash/redis. Used by RedisRepository tests so they need no network.
 *
 * Behaviors mirrored:
 *  - get returns null when missing
 *  - set returns 'OK' (we accept unknown; just need a resolved promise)
 *  - del returns the count of keys actually removed
 *  - sadd/srem return the count of NEW members added / removed
 *  - smembers returns a snapshot array (order not guaranteed)
 *  - mget returns null for missing keys, preserving index order
 *
 * Values are stored as parsed objects (not JSON strings). Upstash's
 * REST client does the same — it transparently JSON-encodes on the
 * way out and parses on the way in. Tests + production therefore see
 * the same shape.
 */
export class FakeRedis implements RedisClient {
  private kv = new Map<string, unknown>();
  private sets = new Map<string, Set<string>>();

  async get<T = unknown>(key: string): Promise<T | null> {
    const v = this.kv.get(key);
    return v === undefined ? null : (v as T);
  }

  async set(key: string, value: unknown): Promise<unknown> {
    this.kv.set(key, value);
    return 'OK';
  }

  async del(...keys: string[]): Promise<number> {
    let removed = 0;
    for (const k of keys) {
      if (this.kv.delete(k)) removed += 1;
    }
    return removed;
  }

  async sadd(
    key: string,
    member: string,
    ...members: string[]
  ): Promise<number> {
    const set = this.sets.get(key) ?? new Set<string>();
    let added = 0;
    for (const m of [member, ...members]) {
      if (!set.has(m)) {
        set.add(m);
        added += 1;
      }
    }
    this.sets.set(key, set);
    return added;
  }

  async srem(
    key: string,
    member: string,
    ...members: string[]
  ): Promise<number> {
    const set = this.sets.get(key);
    if (!set) return 0;
    let removed = 0;
    for (const m of [member, ...members]) {
      if (set.delete(m)) removed += 1;
    }
    if (set.size === 0) this.sets.delete(key);
    return removed;
  }

  async smembers(key: string): Promise<string[]> {
    const set = this.sets.get(key);
    return set ? [...set] : [];
  }

  async mget<TData extends unknown[] = unknown[]>(
    ...keys: string[]
  ): Promise<TData> {
    return keys.map((k) => {
      const v = this.kv.get(k);
      return v === undefined ? null : v;
    }) as TData;
  }
}
