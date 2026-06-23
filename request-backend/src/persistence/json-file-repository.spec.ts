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
