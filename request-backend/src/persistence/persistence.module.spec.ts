import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { Test } from '@nestjs/testing';
import { PersistenceModule } from './persistence.module';
import { fileRepositoryToken } from './file-repository';
import { JsonFileRepository } from './json-file-repository';
import { RedisRepository } from './redis-repository';

describe('PersistenceModule.forFeature', () => {
  let tmpDir: string;

  beforeAll(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'taxi-module-'));
  });

  afterAll(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it('resolves and the token provides a JsonFileRepository', async () => {
    const module = await Test.createTestingModule({
      imports: [PersistenceModule.forFeature({ entity: 'demo', dir: tmpDir })],
    }).compile();
    const repo = module.get(fileRepositoryToken('demo'));
    expect(repo).toBeInstanceOf(JsonFileRepository);
    await module.close();
  });

  it('end-to-end: create then findById via resolved provider', async () => {
    const module = await Test.createTestingModule({
      imports: [PersistenceModule.forFeature({ entity: 'e2e', dir: tmpDir })],
    }).compile();
    const repo = module.get<JsonFileRepository<{ id: string; val: number }>>(
      fileRepositoryToken('e2e'),
    );
    const created = await repo.create({ val: 42 });
    const found = await repo.findById(created.id);
    expect(found).toEqual(created);
    expect(fs.stat(path.join(tmpDir, 'e2e', `${created.id}.json`))).resolves.toBeDefined();
    await module.close();
  });

  it('forFeature dir takes precedence over process.env.DATA_DIR', async () => {
    const envDir = await fs.mkdtemp(path.join(os.tmpdir(), 'taxi-envdir-'));
    const optDir = await fs.mkdtemp(path.join(os.tmpdir(), 'taxi-optdir-'));
    try {
      process.env['DATA_DIR'] = envDir;
      const module = await Test.createTestingModule({
        imports: [
          PersistenceModule.forFeature({ entity: 'prec', dir: optDir }),
        ],
      }).compile();
      const repo = module.get<JsonFileRepository<{ id: string }>>(
        fileRepositoryToken('prec'),
      );
      const created = await repo.create({});
      // File must land under optDir, not envDir
      await expect(
        fs.stat(path.join(optDir, 'prec', `${created.id}.json`)),
      ).resolves.toBeDefined();
      await expect(
        fs.stat(path.join(envDir, 'prec', `${created.id}.json`)),
      ).rejects.toThrow();
      await module.close();
    } finally {
      delete process.env['DATA_DIR'];
      await fs.rm(envDir, { recursive: true, force: true });
      await fs.rm(optDir, { recursive: true, force: true });
    }
  });

  it('two forFeature registrations with different entities produce distinct tokens and repos', async () => {
    const module = await Test.createTestingModule({
      imports: [
        PersistenceModule.forFeature({ entity: 'alpha', dir: tmpDir }),
        PersistenceModule.forFeature({ entity: 'beta', dir: tmpDir }),
      ],
    }).compile();
    const alphaRepo = module.get(fileRepositoryToken('alpha'));
    const betaRepo = module.get(fileRepositoryToken('beta'));
    expect(alphaRepo).not.toBe(betaRepo);
    await module.close();
  });
});

describe('PersistenceModule.forFeature (PERSISTENCE_BACKEND=redis)', () => {
  const previousBackend = process.env['PERSISTENCE_BACKEND'];
  const previousUrl = process.env['UPSTASH_REDIS_REST_URL'];
  const previousToken = process.env['UPSTASH_REDIS_REST_TOKEN'];

  beforeAll(() => {
    process.env['PERSISTENCE_BACKEND'] = 'redis';
    process.env['UPSTASH_REDIS_REST_URL'] = 'https://example.upstash.io';
    process.env['UPSTASH_REDIS_REST_TOKEN'] = 'fake-token';
  });

  afterAll(() => {
    if (previousBackend === undefined) delete process.env['PERSISTENCE_BACKEND'];
    else process.env['PERSISTENCE_BACKEND'] = previousBackend;
    if (previousUrl === undefined) delete process.env['UPSTASH_REDIS_REST_URL'];
    else process.env['UPSTASH_REDIS_REST_URL'] = previousUrl;
    if (previousToken === undefined) delete process.env['UPSTASH_REDIS_REST_TOKEN'];
    else process.env['UPSTASH_REDIS_REST_TOKEN'] = previousToken;
  });

  it('resolves the token to a RedisRepository', async () => {
    const module = await Test.createTestingModule({
      imports: [PersistenceModule.forFeature({ entity: 'demo-redis' })],
    }).compile();
    const repo = module.get(fileRepositoryToken('demo-redis'));
    expect(repo).toBeInstanceOf(RedisRepository);
    await module.close();
  });
});

describe('PersistenceModule.forFeature (invalid backend)', () => {
  const previousBackend = process.env['PERSISTENCE_BACKEND'];

  afterEach(() => {
    if (previousBackend === undefined) delete process.env['PERSISTENCE_BACKEND'];
    else process.env['PERSISTENCE_BACKEND'] = previousBackend;
  });

  it('throws on unknown PERSISTENCE_BACKEND value', () => {
    process.env['PERSISTENCE_BACKEND'] = 'mysql';
    expect(() => PersistenceModule.forFeature({ entity: 'x' })).toThrow(
      /Unsupported PERSISTENCE_BACKEND=mysql/,
    );
  });
});
