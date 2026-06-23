import * as crypto from 'node:crypto';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { Logger } from '@nestjs/common';
import { FileRepository } from './file-repository';
import { NotFoundError, RepositoryError } from './errors';
import { assertValidId } from './validate-id';

export class JsonFileRepository<T extends { id: string }>
  implements FileRepository<T>
{
  private readonly logger: { warn(msg: string): void };

  constructor(
    private readonly entity: string,
    private readonly dir: string,
    logger?: { warn(msg: string): void },
  ) {
    this.logger = logger ?? new Logger('JsonFileRepository');
  }

  private entityDir(): string {
    return path.join(this.dir, this.entity);
  }

  private filePath(id: string): string {
    return path.join(this.entityDir(), `${id}.json`);
  }

  private async writeAtomically(filePath: string, value: T): Promise<void> {
    const tmpPath = `${filePath}.${crypto.randomUUID()}.tmp`;
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    try {
      await fs.writeFile(tmpPath, JSON.stringify(value, null, 2) + '\n', 'utf8');
      await fs.rename(tmpPath, filePath);
    } catch (err) {
      try {
        await fs.unlink(tmpPath);
      } catch {
        // swallow ENOENT
      }
      throw err;
    }
  }

  async create(input: Omit<T, 'id'>): Promise<T> {
    const id = crypto.randomUUID();
    const entity = { ...input, id } as T;
    await this.writeAtomically(this.filePath(id), entity);
    return entity;
  }

  async findById(id: string): Promise<T | null> {
    assertValidId(id);
    try {
      const content = await fs.readFile(this.filePath(id), 'utf8');
      return JSON.parse(content) as T;
    } catch (err: unknown) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') return null;
      throw new RepositoryError(
        `Failed to read ${this.entity}/${id}: ${String(err)}`,
      );
    }
  }

  async findAll(): Promise<T[]> {
    let entries: string[];
    try {
      entries = await fs.readdir(this.entityDir());
    } catch (err: unknown) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') return [];
      throw err;
    }

    const jsonFiles = entries
      .filter((e) => {
        if (!e.endsWith('.json')) {
          this.logger.warn(`Skipping non-JSON file: ${e}`);
          return false;
        }
        return true;
      })
      .sort();

    const results: T[] = [];
    for (const file of jsonFiles) {
      const content = await fs.readFile(
        path.join(this.entityDir(), file),
        'utf8',
      );
      let parsed: T;
      try {
        parsed = JSON.parse(content) as T;
      } catch {
        throw new RepositoryError(
          `Malformed JSON in ${this.entity}/${file}`,
        );
      }
      if (!parsed || typeof parsed.id !== 'string') {
        this.logger.warn(`Skipping entry without id field: ${file}`);
        continue;
      }
      results.push(parsed);
    }
    return results;
  }

  async update(id: string, patch: Partial<Omit<T, 'id'>>): Promise<T> {
    assertValidId(id);
    const current = await this.findById(id);
    if (current === null) throw new NotFoundError(this.entity, id);

    const filteredPatch = Object.fromEntries(
      Object.entries(patch).filter(([, v]) => v !== undefined),
    ) as Partial<Omit<T, 'id'>>;

    const next = { ...current, ...filteredPatch, id: current.id } as T;
    await this.writeAtomically(this.filePath(id), next);
    return next;
  }

  async delete(id: string): Promise<void> {
    assertValidId(id);
    try {
      await fs.unlink(this.filePath(id));
    } catch (err: unknown) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT')
        throw new NotFoundError(this.entity, id);
      throw new RepositoryError(
        `Failed to delete ${this.entity}/${id}: ${String(err)}`,
      );
    }
  }
}
