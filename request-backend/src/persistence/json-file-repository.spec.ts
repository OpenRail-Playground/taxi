import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { JsonFileRepository } from './json-file-repository';

describe('create', () => {
  let tmpDir: string;
  let repo: JsonFileRepository<{ id: string; name: string }>;

  beforeAll(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'taxi-repo-create-'));
  });

  afterAll(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  beforeEach(() => {
    repo = new JsonFileRepository('widget', tmpDir);
  });

  it('returns an object with a UUID v4 id', async () => {
    const result = await repo.create({ name: 'foo' });
    expect(result.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
  });

  it('creates a file at <dataRoot>/<entity>/<id>.json', async () => {
    const result = await repo.create({ name: 'bar' });
    const filePath = path.join(tmpDir, 'widget', `${result.id}.json`);
    const stat = await fs.stat(filePath);
    expect(stat.isFile()).toBe(true);
  });

  it('file content equals JSON.stringify(returned, null, 2) + newline', async () => {
    const result = await repo.create({ name: 'baz' });
    const filePath = path.join(tmpDir, 'widget', `${result.id}.json`);
    const content = await fs.readFile(filePath, 'utf8');
    expect(content).toBe(JSON.stringify(result, null, 2) + '\n');
  });

  it('leaves no *.tmp file in the entity folder', async () => {
    await repo.create({ name: 'qux' });
    const entries = await fs.readdir(path.join(tmpDir, 'widget'));
    const tmps = entries.filter((e) => e.endsWith('.tmp'));
    expect(tmps).toHaveLength(0);
  });

  it('two parallel creates produce two distinct files', async () => {
    const [a, b] = await Promise.all([
      repo.create({ name: 'p1' }),
      repo.create({ name: 'p2' }),
    ]);
    expect(a.id).not.toBe(b.id);
    const entries = await fs.readdir(path.join(tmpDir, 'widget'));
    expect(entries).toContain(`${a.id}.json`);
    expect(entries).toContain(`${b.id}.json`);
  });

  it('auto-creates the entity folder when it does not exist', async () => {
    const freshDir = await fs.mkdtemp(path.join(os.tmpdir(), 'taxi-repo-fresh-'));
    try {
      const freshRepo = new JsonFileRepository<{ id: string; val: number }>(
        'thing',
        freshDir,
      );
      const result = await freshRepo.create({ val: 1 });
      const filePath = path.join(freshDir, 'thing', `${result.id}.json`);
      await expect(fs.stat(filePath)).resolves.toBeDefined();
    } finally {
      await fs.rm(freshDir, { recursive: true, force: true });
    }
  });
});

describe('findById', () => {
  let tmpDir: string;
  let repo: JsonFileRepository<{ id: string; name: string }>;

  beforeAll(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'taxi-repo-findbyid-'));
  });

  afterAll(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  beforeEach(() => {
    repo = new JsonFileRepository('item', tmpDir);
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

describe('findAll', () => {
  let tmpDir: string;
  let repo: JsonFileRepository<{ id: string; label: string }>;

  beforeAll(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'taxi-repo-findall-'));
  });

  afterAll(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  beforeEach(() => {
    repo = new JsonFileRepository('thing', tmpDir);
  });

  it('returns [] when the entity folder does not exist', async () => {
    const freshDir = await fs.mkdtemp(path.join(os.tmpdir(), 'taxi-repo-fa-empty-'));
    try {
      const r = new JsonFileRepository<{ id: string }>('ghost', freshDir);
      await expect(r.findAll()).resolves.toEqual([]);
    } finally {
      await fs.rm(freshDir, { recursive: true, force: true });
    }
  });

  it('returns all created entities', async () => {
    const a = await repo.create({ label: 'a' });
    const b = await repo.create({ label: 'b' });
    const all = await repo.findAll();
    expect(all.map((e) => e.id).sort()).toEqual([a.id, b.id].sort());
  });

  it('order is filename lexicographic ascending', async () => {
    const freshDir = await fs.mkdtemp(path.join(os.tmpdir(), 'taxi-repo-fa-order-'));
    try {
      // Seed with known filenames to control order
      const entityDir = path.join(freshDir, 'sorted');
      await fs.mkdir(entityDir, { recursive: true });
      const ids = ['aaa', 'bbb', 'ccc'];
      for (const id of ids) {
        await fs.writeFile(
          path.join(entityDir, `${id}.json`),
          JSON.stringify({ id, label: id }, null, 2) + '\n',
          'utf8',
        );
      }
      const r = new JsonFileRepository<{ id: string; label: string }>('sorted', freshDir);
      const all = await r.findAll();
      expect(all.map((e) => e.id)).toEqual(['aaa', 'bbb', 'ccc']);
    } finally {
      await fs.rm(freshDir, { recursive: true, force: true });
    }
  });

  it('skips non-json files and calls logger.warn once per skip', async () => {
    const freshDir = await fs.mkdtemp(path.join(os.tmpdir(), 'taxi-repo-fa-skip-'));
    try {
      const entityDir = path.join(freshDir, 'mixed');
      await fs.mkdir(entityDir, { recursive: true });
      await fs.writeFile(
        path.join(entityDir, 'keep-me.json'),
        JSON.stringify({ id: 'keep-me', label: 'x' }, null, 2) + '\n',
        'utf8',
      );
      await fs.writeFile(path.join(entityDir, 'README.md'), '# ignore', 'utf8');
      await fs.writeFile(path.join(entityDir, 'foo.tmp'), 'tmp', 'utf8');

      const warnSpy = jest.fn();
      const r = new JsonFileRepository<{ id: string; label: string }>(
        'mixed',
        freshDir,
        { warn: warnSpy },
      );
      const all = await r.findAll();
      expect(all).toHaveLength(1);
      expect(all[0].id).toBe('keep-me');
      expect(warnSpy).toHaveBeenCalledTimes(2);
    } finally {
      await fs.rm(freshDir, { recursive: true, force: true });
    }
  });

  it('throws RepositoryError when a .json file contains malformed JSON', async () => {
    const freshDir = await fs.mkdtemp(path.join(os.tmpdir(), 'taxi-repo-fa-bad-'));
    try {
      const entityDir = path.join(freshDir, 'broken');
      await fs.mkdir(entityDir, { recursive: true });
      await fs.writeFile(
        path.join(entityDir, 'bad.json'),
        '{not json',
        'utf8',
      );
      const { RepositoryError } = await import('./errors');
      const r = new JsonFileRepository<{ id: string }>('broken', freshDir);
      await expect(r.findAll()).rejects.toThrow(RepositoryError);
    } finally {
      await fs.rm(freshDir, { recursive: true, force: true });
    }
  });

  it('skips manually seeded *.tmp files (they do not end with .json)', async () => {
    const freshDir = await fs.mkdtemp(path.join(os.tmpdir(), 'taxi-repo-fa-tmp-'));
    try {
      const entityDir = path.join(freshDir, 'tmps');
      await fs.mkdir(entityDir, { recursive: true });
      await fs.writeFile(
        path.join(entityDir, 'real.json'),
        JSON.stringify({ id: 'real', v: 1 }, null, 2) + '\n',
        'utf8',
      );
      await fs.writeFile(
        path.join(entityDir, 'real.abc.tmp'),
        'leftover',
        'utf8',
      );
      const warnSpy = jest.fn();
      const r = new JsonFileRepository<{ id: string; v: number }>(
        'tmps',
        freshDir,
        { warn: warnSpy },
      );
      const all = await r.findAll();
      expect(all).toHaveLength(1);
      expect(all[0].id).toBe('real');
    } finally {
      await fs.rm(freshDir, { recursive: true, force: true });
    }
  });
});

describe('update', () => {
  let tmpDir: string;
  let repo: JsonFileRepository<{ id: string; name: string; count?: number }>;

  beforeAll(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'taxi-repo-update-'));
  });

  afterAll(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  beforeEach(() => {
    repo = new JsonFileRepository('upd', tmpDir);
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

  it('shallow merge: nested objects are replaced not deep-merged', async () => {
    type Nested = { id: string; nested: { a: number; b?: number } };
    const freshDir = await fs.mkdtemp(path.join(os.tmpdir(), 'taxi-repo-upd-nested-'));
    try {
      const r = new JsonFileRepository<Nested>('nested', freshDir);
      const created = await r.create({ nested: { a: 1, b: 2 } });
      const updated = await r.update(created.id, { nested: { a: 9 } });
      expect(updated.nested).toEqual({ a: 9 });
    } finally {
      await fs.rm(freshDir, { recursive: true, force: true });
    }
  });

  it('undefined values in patch are treated as no-change', async () => {
    const created = await repo.create({ name: 'keep', count: 5 });
    const updated = await repo.update(created.id, {
      name: undefined as any,
      count: 10,
    });
    expect(updated.name).toBe('keep');
    expect(updated.count).toBe(10);
  });

  it('update writes atomically — no *.tmp leftover', async () => {
    const created = await repo.create({ name: 'atomic' });
    await repo.update(created.id, { name: 'atomic-updated' });
    const entries = await fs.readdir(path.join(tmpDir, 'upd'));
    const tmps = entries.filter((e) => e.endsWith('.tmp'));
    expect(tmps).toHaveLength(0);
  });

  it('throws InvalidIdError for path-traversal id', async () => {
    const { InvalidIdError } = await import('./errors');
    await expect(
      repo.update('../etc/passwd', { name: 'x' }),
    ).rejects.toThrow(InvalidIdError);
  });
});

describe('delete', () => {
  let tmpDir: string;
  let repo: JsonFileRepository<{ id: string; name: string }>;

  beforeAll(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'taxi-repo-delete-'));
  });

  afterAll(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  beforeEach(() => {
    repo = new JsonFileRepository('del', tmpDir);
  });

  it('resolves and subsequent findById returns null', async () => {
    const created = await repo.create({ name: 'bye' });
    await expect(repo.delete(created.id)).resolves.toBeUndefined();
    await expect(repo.findById(created.id)).resolves.toBeNull();
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

  it('does not affect other entities in the same folder', async () => {
    const a = await repo.create({ name: 'keep' });
    const b = await repo.create({ name: 'remove' });
    await repo.delete(b.id);
    const all = await repo.findAll();
    expect(all.map((e) => e.id)).toContain(a.id);
    expect(all.map((e) => e.id)).not.toContain(b.id);
  });
});
