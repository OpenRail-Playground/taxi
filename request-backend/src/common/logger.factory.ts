import { ConsoleLogger } from '@nestjs/common';

export function createAppLogger(): ConsoleLogger {
  return new ConsoleLogger({ json: true, colors: false });
}
