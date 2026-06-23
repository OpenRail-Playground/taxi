import { assertValidId, ID_REGEX } from './validate-id';
import { InvalidIdError } from './errors';

describe('assertValidId', () => {
  it('rejects empty string', () => {
    expect(() => assertValidId('')).toThrow(InvalidIdError);
  });
  it('rejects whitespace-only string', () => {
    expect(() => assertValidId(' ')).toThrow(InvalidIdError);
  });
  it('rejects path traversal ../etc/passwd', () => {
    expect(() => assertValidId('../etc/passwd')).toThrow(InvalidIdError);
  });
  it('rejects slash-containing id a/b', () => {
    expect(() => assertValidId('a/b')).toThrow(InvalidIdError);
  });
  it('rejects dot-containing id a.b', () => {
    expect(() => assertValidId('a.b')).toThrow(InvalidIdError);
  });
  it('rejects backslash-containing id a\\b', () => {
    expect(() => assertValidId('a\\b')).toThrow(InvalidIdError);
  });
  it('rejects 129-character string', () => {
    expect(() => assertValidId('a'.repeat(129))).toThrow(InvalidIdError);
  });
  it('rejects non-string (number)', () => {
    expect(() => assertValidId(42 as any)).toThrow(InvalidIdError);
  });
  it('accepts a valid UUID v4', () => {
    expect(() =>
      assertValidId('550e8400-e29b-41d4-a716-446655440000'),
    ).not.toThrow();
  });
  it('accepts help-request-1', () => {
    expect(() => assertValidId('help-request-1')).not.toThrow();
  });
  it('exposes ID_REGEX matching 128 chars but not 129', () => {
    expect(ID_REGEX.test('a'.repeat(128))).toBe(true);
    expect(ID_REGEX.test('a'.repeat(129))).toBe(false);
  });
});
