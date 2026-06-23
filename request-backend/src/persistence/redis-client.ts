/**
 * Narrow Redis client contract used by {@link RedisRepository}.
 *
 * Intentionally a subset of @upstash/redis so:
 *   - the repository compiles even before the dep is installed in this
 *     workspace,
 *   - tests can supply a deterministic in-memory fake instead of a real
 *     network client.
 */
export interface RedisClient {
  get<T = unknown>(key: string): Promise<T | null>;
  set(key: string, value: unknown): Promise<unknown>;
  del(...keys: string[]): Promise<number>;
  sadd(key: string, member: string, ...members: string[]): Promise<number>;
  srem(key: string, member: string, ...members: string[]): Promise<number>;
  smembers(key: string): Promise<string[]>;
  mget<TData extends unknown[] = unknown[]>(
    ...keys: string[]
  ): Promise<TData>;
}
