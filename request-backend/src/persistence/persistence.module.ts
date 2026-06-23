import { DynamicModule, Logger, Module } from '@nestjs/common';
import * as path from 'node:path';
import { JsonFileRepository } from './json-file-repository';
import { fileRepositoryToken } from './file-repository';
import { RedisRepository } from './redis-repository';
import type { RedisClient } from './redis-client';

export interface FileRepositoryFeatureOptions {
  entity: string;
  /** File-backend only. Ignored when PERSISTENCE_BACKEND=redis. */
  dir?: string;
}

const REDIS_CLIENT_TOKEN = 'PERSISTENCE_REDIS_CLIENT';

type ResolvedBackend = 'json' | 'redis';

function resolveBackend(): ResolvedBackend {
  const raw = process.env['PERSISTENCE_BACKEND'];
  if (!raw || raw === 'json') return 'json';
  if (raw === 'redis') return 'redis';
  throw new Error(
    `Unsupported PERSISTENCE_BACKEND=${raw}. Expected 'json' or 'redis'.`,
  );
}

/**
 * Lazy-load the Upstash SDK so the json default path never imports it.
 * `Redis.fromEnv()` reads UPSTASH_REDIS_REST_URL and
 * UPSTASH_REDIS_REST_TOKEN; missing-env errors surface as boot failures,
 * which is the correct behavior.
 */
function buildRedisClient(): RedisClient {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { Redis } = require('@upstash/redis') as typeof import('@upstash/redis');
  return Redis.fromEnv() as unknown as RedisClient;
}

@Module({})
export class PersistenceModule {
  static forFeature(options: FileRepositoryFeatureOptions): DynamicModule {
    const token = fileRepositoryToken(options.entity);
    const backend = resolveBackend();

    if (backend === 'redis') {
      return {
        module: PersistenceModule,
        providers: [
          {
            provide: REDIS_CLIENT_TOKEN,
            useFactory: () => {
              new Logger('PersistenceModule').log(
                `Using Redis backend for entity "${options.entity}"`,
              );
              return buildRedisClient();
            },
          },
          {
            provide: token,
            useFactory: (redis: RedisClient) =>
              new RedisRepository(options.entity, redis),
            inject: [REDIS_CLIENT_TOKEN],
          },
        ],
        exports: [token],
      };
    }

    const resolvedDir = path.resolve(
      process.cwd(),
      options.dir ?? process.env['DATA_DIR'] ?? './data',
    );
    return {
      module: PersistenceModule,
      providers: [
        {
          provide: token,
          useFactory: () => new JsonFileRepository(options.entity, resolvedDir),
        },
      ],
      exports: [token],
    };
  }
}
