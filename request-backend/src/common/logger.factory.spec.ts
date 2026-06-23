import { ConsoleLogger } from '@nestjs/common';
import { createAppLogger } from './logger.factory';

describe('createAppLogger', () => {
  it('should return an instance of ConsoleLogger', () => {
    const logger = createAppLogger();
    expect(logger).toBeInstanceOf(ConsoleLogger);
  });

  it('should log JSON format with message, context, and level', () => {
    const logger = createAppLogger();
    const mockWrite = jest.spyOn(process.stdout, 'write').mockImplementation();

    logger.log('hello', 'CtxA');

    expect(mockWrite).toHaveBeenCalled();
    const calls = mockWrite.mock.calls;
    const output = calls.map((c) => c[0]).join('');

    expect(output).toContain('"message":"hello"');
    expect(output).toContain('"context":"CtxA"');
    expect(output).toContain('"level":"log"');

    mockWrite.mockRestore();
  });
});
