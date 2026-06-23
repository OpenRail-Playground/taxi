import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { createAppLogger } from './common/logger.factory';

// Load RIS keys (and any other vars) from a local .env file if present.
// Uses Node's built-in env-file loader so no extra dependency is needed.
try {
  process.loadEnvFile();
} catch {
  // No .env file — fall back to the ambient environment.
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    bufferLogs: true,
    logger: createAppLogger(),
  });
  app.enableCors({ origin: true, credentials: true });
  const port = process.env.PORT ? Number(process.env.PORT) : 3000;
  await app.listen(port);
  console.log(`Taxi backend listening on http://localhost:${port}`);
}

void bootstrap();
