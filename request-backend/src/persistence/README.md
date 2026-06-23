# Persistence Module

Generic, framework-agnostic entity storage for the `request-backend` service. Ships two interchangeable backends behind one `FileRepository<T>` contract: a JSON-file repository (default, for local dev / VMs) and an Upstash Redis repository (for serverless / ephemeral filesystems).

## Purpose

Services consume a repository, not a folder of files. Swapping backends is one env var.

## Public API

```ts
export interface FileRepository<T extends { id: string }> {
  create(input: Omit<T, 'id'>): Promise<T>;
  findById(id: string): Promise<T | null>;
  findAll(): Promise<T[]>;
  update(id: string, patch: Partial<Omit<T, 'id'>>): Promise<T>;
  delete(id: string): Promise<void>;
}
```

## Registering an entity

```ts
import { PersistenceModule } from './persistence/persistence.module';

@Module({
  imports: [PersistenceModule.forFeature({ entity: 'widget' })],
})
export class WidgetModule {}
```

Inject via the token:

```ts
import { Inject } from '@nestjs/common';
import { fileRepositoryToken, FileRepository } from './persistence/file-repository';

type Widget = { id: string; name: string };

constructor(
  @Inject(fileRepositoryToken('widget'))
  private readonly repo: FileRepository<Widget>,
) {}
```

## Choosing a backend

| `PERSISTENCE_BACKEND` | Implementation | When to use |
| --- | --- | --- |
| unset / `json` | `JsonFileRepository` | Local dev. Long-running VMs / Fly machines with a mounted volume. |
| `redis` | `RedisRepository` | Serverless (Vercel, Lambda, Cloudflare). Render / Railway / Koyeb free tiers (ephemeral FS). |

Any other value throws on boot.

### JSON backend (default)

Files land at `<dir>/<entity>/<id>.json`. Directory precedence:

1. `forFeature({ dir })` — explicit override
2. `process.env.DATA_DIR` — environment variable
3. `./data` — default (resolved relative to `process.cwd()`)

`request-backend/.gitignore` already ignores `/data`.

### Redis backend

Set:

```bash
PERSISTENCE_BACKEND=redis
UPSTASH_REDIS_REST_URL=https://<your-db>.upstash.io
UPSTASH_REDIS_REST_TOKEN=<your-token>
```

Storage layout:

- `<entity>:<id>` — the entity, JSON-encoded by the Upstash client.
- `<entity>:_ids` — a Redis SET of all known ids, used by `findAll()` so we never `SCAN`.

The Upstash REST client transparently JSON-encodes on the way out and parses on the way in, so the entity shape matches what callers see from the JSON backend.

## ID contract

IDs are server-generated UUID v4 strings. Consumers never supply an `id` to `create()`. IDs must match `^[A-Za-z0-9_-]{1,128}$` — any violation throws `InvalidIdError`.

## Error model

| Error | When |
| --- | --- |
| `InvalidIdError` | Any method receives a malformed id |
| `NotFoundError` | `update()` or `delete()` targets a missing id |
| `RepositoryError` | Base class; also thrown for malformed JSON on disk (JSON backend) |

## Known limitations / caveats

Shared by both backends:

- **Single-writer guarantees only**. No optimistic concurrency on `update()`; last write wins. Two concurrent updaters can lose one of the writes. Acceptable for hackathon use.
- **No schema validation**. The repository stores whatever the caller passes. Field validation is the caller's responsibility.

JSON-specific:

- **No `fsync`**: writes are not crash-durable. A process kill between `writeFile` and `rename` may leave a `.tmp` file; the final file will be absent or stale.
- **Single-instance only**: no cross-process locking. Running multiple Node instances against the same `data/` directory will produce race conditions.
- **Atomic only within the same filesystem**: `fs.rename` is atomic only intra-filesystem. The temp file is always written to the same directory as the target.

Redis-specific:

- **Not transactional**. A crash between `set` and `sadd` in `create()` can leave the entity stored but missing from `findAll()`. `findById()` still works for the orphan; `delete()` self-heals the set.
- **Cost model is per-request**. Upstash free tier (10k commands/day) covers ~2.5k creates + reads per day.
