import * as crypto from 'node:crypto';
import { FileRepository } from './file-repository';
import { NotFoundError } from './errors';
import { assertValidId } from './validate-id';
import type { RedisClient } from './redis-client';

/**
 * Redis-backed implementation of {@link FileRepository}.
 *
 * Schema per entity namespace:
 *   - `<entity>:<id>`   — the entity, stored as JSON (the Upstash REST
 *     client JSON-encodes/decodes transparently).
 *   - `<entity>:_ids`   — a SET of all known ids in the namespace. Lets
 *     us implement `findAll()` without `SCAN`.
 *
 * Semantics match {@link JsonFileRepository}: server-generated UUID v4
 * ids, immutable id on update, NotFoundError on missing
 * update/delete, InvalidIdError via {@link assertValidId}.
 *
 * Caveats (same hackathon-grade trade-offs as the file backend):
 *   - Not transactional. A crash between `set` and `sadd` in create() can
 *     leave the entity stored but unlisted by `findAll()`. The
 *     `findById()` path still works for the orphan, and the `_ids` set
 *     is self-healing on delete.
 *   - No optimistic concurrency on update. Two concurrent updaters last
 *     write wins, identical to the file backend.
 */
export class RedisRepository<T extends { id: string }>
  implements FileRepository<T>
{
  constructor(
    private readonly entity: string,
    private readonly redis: RedisClient,
  ) {}

  private key(id: string): string {
    return `${this.entity}:${id}`;
  }

  private indexKey(): string {
    return `${this.entity}:_ids`;
  }

  async create(input: Omit<T, 'id'>): Promise<T> {
    const id = crypto.randomUUID();
    const entity = { ...input, id } as T;
    await this.redis.set(this.key(id), entity);
    await this.redis.sadd(this.indexKey(), id);
    return entity;
  }

  async findById(id: string): Promise<T | null> {
    assertValidId(id);
    const stored = await this.redis.get<T>(this.key(id));
    return stored ?? null;
  }

  async findAll(): Promise<T[]> {
    const ids = await this.redis.smembers(this.indexKey());
    if (ids.length === 0) return [];

    const sortedIds = [...ids].sort();
    const values = await this.redis.mget<(T | null)[]>(
      ...sortedIds.map((id) => this.key(id)),
    );
    return values.filter((v): v is T => v !== null);
  }

  async update(id: string, patch: Partial<Omit<T, 'id'>>): Promise<T> {
    assertValidId(id);
    const current = await this.findById(id);
    if (current === null) throw new NotFoundError(this.entity, id);

    const filteredPatch = Object.fromEntries(
      Object.entries(patch).filter(([, v]) => v !== undefined),
    ) as Partial<Omit<T, 'id'>>;

    const next = { ...current, ...filteredPatch, id: current.id } as T;
    await this.redis.set(this.key(id), next);
    return next;
  }

  async delete(id: string): Promise<void> {
    assertValidId(id);
    const removed = await this.redis.del(this.key(id));
    if (removed === 0) throw new NotFoundError(this.entity, id);
    await this.redis.srem(this.indexKey(), id);
  }
}
