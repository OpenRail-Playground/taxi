import type { RedisClient } from './redis-client';

export class FakeRedis implements RedisClient {
  private kv = new Map<string, unknown>();
  private sets = new Map<string, Set<string>>();
  private hashes = new Map<string, Map<string, unknown>>();

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

  async hget<T = unknown>(key: string, field: string): Promise<T | null> {
    const hash = this.hashes.get(key);
    if (!hash) return null;
    const v = hash.get(field);
    return v === undefined ? null : (v as T);
  }

  async hset(
    key: string,
    fieldValues: Record<string, unknown>,
  ): Promise<number> {
    const hash = this.hashes.get(key) ?? new Map<string, unknown>();
    let added = 0;
    for (const [field, value] of Object.entries(fieldValues)) {
      if (!hash.has(field)) added += 1;
      hash.set(field, value);
    }
    this.hashes.set(key, hash);
    return added;
  }

  async hlen(key: string): Promise<number> {
    return this.hashes.get(key)?.size ?? 0;
  }
}
