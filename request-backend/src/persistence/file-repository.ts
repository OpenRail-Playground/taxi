export interface FileRepository<T extends { id: string }> {
  create(input: Omit<T, 'id'>): Promise<T>;
  findById(id: string): Promise<T | null>;
  findAll(): Promise<T[]>;
  update(id: string, patch: Partial<Omit<T, 'id'>>): Promise<T>;
  delete(id: string): Promise<void>;
}

export const fileRepositoryToken = (entity: string): string =>
  `FILE_REPOSITORY:${entity}`;
