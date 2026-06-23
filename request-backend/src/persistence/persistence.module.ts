import { DynamicModule, Module } from '@nestjs/common';
import * as path from 'node:path';
import { JsonFileRepository } from './json-file-repository';
import { fileRepositoryToken } from './file-repository';

export interface FileRepositoryFeatureOptions {
  entity: string;
  dir?: string;
}

@Module({})
export class PersistenceModule {
  static forFeature(options: FileRepositoryFeatureOptions): DynamicModule {
    const token = fileRepositoryToken(options.entity);
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
