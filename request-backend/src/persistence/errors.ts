export class RepositoryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RepositoryError';
  }
}

export class NotFoundError extends RepositoryError {
  constructor(
    public readonly entity: string,
    public readonly id: string,
  ) {
    super(`${entity}/${id} not found`);
    this.name = 'NotFoundError';
  }
}

export class InvalidIdError extends RepositoryError {
  constructor(public readonly id: unknown) {
    super(`invalid id: ${JSON.stringify(id)}`);
    this.name = 'InvalidIdError';
  }
}
