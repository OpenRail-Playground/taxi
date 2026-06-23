export interface RedisClient {
  get<T = unknown>(key: string): Promise<T | null>;
  set(key: string, value: unknown): Promise<unknown>;
  del(...keys: string[]): Promise<number>;
  sadd(key: string, member: string, ...members: string[]): Promise<number>;
  srem(key: string, member: string, ...members: string[]): Promise<number>;
  smembers(key: string): Promise<string[]>;
  mget<TData extends unknown[] = unknown[]>(...keys: string[]): Promise<TData>;
  hget<T = unknown>(key: string, field: string): Promise<T | null>;
  hset(key: string, fieldValues: Record<string, unknown>): Promise<number>;
  hlen(key: string): Promise<number>;
}

export function buildRedisClient(): RedisClient {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { Redis } = require('@upstash/redis') as typeof import('@upstash/redis');
  return Redis.fromEnv() as unknown as RedisClient;
}
