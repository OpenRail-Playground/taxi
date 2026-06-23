# Persistence Module

Generic, framework-agnostic file-backed entity storage for the `request-backend` service.

## Purpose

Provides a reusable `FileRepository<T>` contract backed by one JSON file per entity, hidden behind a typed interface. Services consume a repository, not a folder of files.

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

// In any NestJS module (not AppModule itself in this release):
@Module({
  imports: [PersistenceModule.forFeature({ entity: 'help-request' })],
  // ...
})
export class HelpRequestModule {}
```

Inject via the token:

```ts
import { Inject } from '@nestjs/common';
import { fileRepositoryToken, FileRepository } from './persistence/file-repository';

constructor(
  @Inject(fileRepositoryToken('help-request'))
  private readonly repo: FileRepository<HelpRequest>,
) {}
```

## Where files land

Files are stored at `<dir>/<entity>/<id>.json`.

Directory precedence:
1. `forFeature({ dir })` — explicit override
2. `process.env.DATA_DIR` — environment variable
3. `./data` — default (resolved relative to `process.cwd()`)

`request-backend/.gitignore` already ignores `/data`. The repo root `.gitignore` also ignores `/data` as a safety net when running from the repo root.

## ID contract

IDs are server-generated UUID v4 strings. Consumers never supply an `id` to `create()`. IDs must match `^[A-Za-z0-9_-]{1,128}$` — any violation throws `InvalidIdError`.

## Error model

| Error | When |
| --- | --- |
| `InvalidIdError` | Any method receives a malformed id |
| `NotFoundError` | `update()` or `delete()` targets a missing id |
| `RepositoryError` | Base class; also thrown for malformed JSON on disk |

## Known limitations / caveats

- **No `fsync`**: writes are not crash-durable. A process kill between `writeFile` and `rename` may leave a `.tmp` file; the final file will be absent or stale. Acceptable for hackathon use.
- **Single-instance only**: no cross-process locking. Running multiple Node instances against the same `data/` directory will produce race conditions.
- **No schema validation**: the repository stores and retrieves whatever the caller passes. Field validation is the caller's responsibility.
- **Atomic only within the same filesystem**: `fs.rename` is atomic only intra-filesystem. The temp file is always written to the same directory as the target, which guarantees same-filesystem rename on typical setups.
