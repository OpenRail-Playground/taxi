import { FakeRedis } from './fake-redis';
import { RedisRepository } from './redis-repository';

describe('RedisRepository — create', () => {
  let repo: RedisRepository<{ id: string; name: string }>;
  let redis: FakeRedis;

  beforeEach(() => {
    redis = new FakeRedis();
    repo = new RedisRepository('widget', redis);
  });

  it('returns an object with a UUID v4 id', async () => {
    const result = await repo.create({ name: 'foo' });
    expect(result.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
  });

  it('stores the entity at key <entity>:<id>', async () => {
    const result = await repo.create({ name: 'bar' });
    const stored = await redis.get(`widget:${result.id}`);
    expect(stored).toEqual(result);
  });

  it('adds the id to the <entity>:_ids set', async () => {
    const result = await repo.create({ name: 'baz' });
    const ids = await redis.smembers('widget:_ids');
    expect(ids).toEqual([result.id]);
  });

  it('two parallel creates produce two distinct entries', async () => {
    const [a, b] = await Promise.all([
      repo.create({ name: 'p1' }),
      repo.create({ name: 'p2' }),
    ]);
    expect(a.id).not.toBe(b.id);
    const ids = await redis.smembers('widget:_ids');
    expect(ids.sort()).toEqual([a.id, b.id].sort());
  });
});

describe('RedisRepository — findById', () => {
  let repo: RedisRepository<{ id: string; name: string }>;
  let redis: FakeRedis;

  beforeEach(() => {
    redis = new FakeRedis();
    repo = new RedisRepository('item', redis);
  });

  it('returns null for an unknown but valid id', async () => {
    const result = await repo.findById('550e8400-e29b-41d4-a716-446655440000');
    expect(result).toBeNull();
  });

  it('returns the exact persisted object for a known id (deep equal)', async () => {
    const created = await repo.create({ name: 'hello' });
    const found = await repo.findById(created.id);
    expect(found).toEqual(created);
  });

  it('throws InvalidIdError for empty string', async () => {
    const { InvalidIdError } = await import('./errors');
    await expect(repo.findById('')).rejects.toThrow(InvalidIdError);
  });

  it('throws InvalidIdError for path traversal id', async () => {
    const { InvalidIdError } = await import('./errors');
    await expect(repo.findById('../etc/passwd')).rejects.toThrow(InvalidIdError);
  });
});

describe('RedisRepository — findAll', () => {
  let repo: RedisRepository<{ id: string; label: string }>;
  let redis: FakeRedis;

  beforeEach(() => {
    redis = new FakeRedis();
    repo = new RedisRepository('thing', redis);
  });

  it('returns [] when no entities exist', async () => {
    await expect(repo.findAll()).resolves.toEqual([]);
  });

  it('returns all created entities', async () => {
    const a = await repo.create({ label: 'a' });
    const b = await repo.create({ label: 'b' });
    const all = await repo.findAll();
    expect(all.map((e) => e.id).sort()).toEqual([a.id, b.id].sort());
  });

  it('returns entities sorted by id ascending', async () => {
    // Seed the set + kv directly so we control ids and assert order.
    await redis.set('thing:ccc', { id: 'ccc', label: 'C' });
    await redis.set('thing:aaa', { id: 'aaa', label: 'A' });
    await redis.set('thing:bbb', { id: 'bbb', label: 'B' });
    await redis.sadd('thing:_ids', 'ccc', 'aaa', 'bbb');

    const all = await repo.findAll();
    expect(all.map((e) => e.id)).toEqual(['aaa', 'bbb', 'ccc']);
  });

  it('skips ids whose value has been deleted out-of-band', async () => {
    const a = await repo.create({ label: 'a' });
    // Simulate inconsistency: the entity key is gone but the id lingers
    // in the set. findAll must NOT explode.
    await redis.del(`thing:${a.id}`);

    const all = await repo.findAll();
    expect(all).toEqual([]);
  });
});

describe('RedisRepository — update', () => {
  let repo: RedisRepository<{ id: string; name: string; count?: number }>;
  let redis: FakeRedis;

  beforeEach(() => {
    redis = new FakeRedis();
    repo = new RedisRepository('upd', redis);
  });

  it('throws NotFoundError for an unknown id', async () => {
    const { NotFoundError } = await import('./errors');
    await expect(
      repo.update('550e8400-e29b-41d4-a716-446655440000', { name: 'x' }),
    ).rejects.toThrow(NotFoundError);
  });

  it('returns the merged entity and persists it', async () => {
    const created = await repo.create({ name: 'original', count: 1 });
    const updated = await repo.update(created.id, { name: 'changed' });
    expect(updated).toEqual({ id: created.id, name: 'changed', count: 1 });
    const found = await repo.findById(created.id);
    expect(found).toEqual(updated);
  });

  it('id is immutable even if patch contains id', async () => {
    const created = await repo.create({ name: 'stable' });
    const updated = await repo.update(created.id, {
      name: 'renamed',
      ...(({ id: 'different-id' }) as any),
    });
    expect(updated.id).toBe(created.id);
    const found = await repo.findById(created.id);
    expect(found?.id).toBe(created.id);
  });

  it('undefined values in patch are treated as no-change', async () => {
    const created = await repo.create({ name: 'keep', count: 5 });
    const updated = await repo.update(created.id, {
      name: undefined as unknown as string,
      count: 10,
    });
    expect(updated.name).toBe('keep');
    expect(updated.count).toBe(10);
  });

  it('throws InvalidIdError for path-traversal id', async () => {
    const { InvalidIdError } = await import('./errors');
    await expect(repo.update('../etc/passwd', { name: 'x' })).rejects.toThrow(
      InvalidIdError,
    );
  });
});

describe('RedisRepository — delete', () => {
  let repo: RedisRepository<{ id: string; name: string }>;
  let redis: FakeRedis;

  beforeEach(() => {
    redis = new FakeRedis();
    repo = new RedisRepository('del', redis);
  });

  it('resolves and subsequent findById returns null', async () => {
    const created = await repo.create({ name: 'bye' });
    await expect(repo.delete(created.id)).resolves.toBeUndefined();
    await expect(repo.findById(created.id)).resolves.toBeNull();
  });

  it('removes the id from the <entity>:_ids set', async () => {
    const created = await repo.create({ name: 'gone' });
    await repo.delete(created.id);
    const ids = await redis.smembers('del:_ids');
    expect(ids).not.toContain(created.id);
  });

  it('throws NotFoundError for unknown id', async () => {
    const { NotFoundError } = await import('./errors');
    await expect(
      repo.delete('550e8400-e29b-41d4-a716-446655440000'),
    ).rejects.toThrow(NotFoundError);
  });

  it('throws InvalidIdError for path-traversal id', async () => {
    const { InvalidIdError } = await import('./errors');
    await expect(repo.delete('../etc/passwd')).rejects.toThrow(InvalidIdError);
  });

  it('does not affect other entities in the same entity namespace', async () => {
    const a = await repo.create({ name: 'keep' });
    const b = await repo.create({ name: 'remove' });
    await repo.delete(b.id);
    const all = await repo.findAll();
    expect(all.map((e) => e.id)).toContain(a.id);
    expect(all.map((e) => e.id)).not.toContain(b.id);
  });
});
