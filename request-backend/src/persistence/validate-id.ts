import { InvalidIdError } from './errors';

export const ID_REGEX = /^[A-Za-z0-9_-]{1,128}$/;

export function assertValidId(id: unknown): asserts id is string {
  if (typeof id !== 'string' || !ID_REGEX.test(id)) {
    throw new InvalidIdError(id);
  }
}
