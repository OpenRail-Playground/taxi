import '../src/load-env';

import * as fs from 'node:fs';
import * as path from 'node:path';

import { Logger } from '@nestjs/common';

import { parseBookingsFromExcel } from '../src/bookings/bookings.repository';
import { BOOKINGS_HASH_KEY } from '../src/bookings/redis-bookings.repository';
import { buildRedisClient } from '../src/persistence/redis-client';

const BATCH_SIZE = 500;

async function main(): Promise<void> {
  const logger = new Logger('seed-bookings');

  const filePath =
    process.env.BOOKING_DATA_PATH ??
    path.resolve(
      process.cwd(),
      '..',
      '.local',
      'Bookingdata_UPLOAD_custom_auftragsnummer.xlsx',
    );

  if (!fs.existsSync(filePath)) {
    logger.error(`Booking data file not found at ${filePath}`);
    process.exit(1);
  }

  logger.log(`Reading bookings from ${filePath}`);
  const records = await parseBookingsFromExcel(filePath);
  logger.log(`Parsed ${records.length} bookings`);

  if (records.length === 0) {
    logger.warn('No bookings parsed. Nothing to seed.');
    return;
  }

  const redis = buildRedisClient();

  let written = 0;
  for (let i = 0; i < records.length; i += BATCH_SIZE) {
    const slice = records.slice(i, i + BATCH_SIZE);
    const fieldValues: Record<string, unknown> = {};
    for (const record of slice) {
      fieldValues[record.auftragsnummer] = record;
    }
    await redis.hset(BOOKINGS_HASH_KEY, fieldValues);
    written += slice.length;
    logger.log(`Seeded ${written} / ${records.length}`);
  }

  const total = await redis.hlen(BOOKINGS_HASH_KEY);
  logger.log(
    `Done. Redis hash "${BOOKINGS_HASH_KEY}" now holds ${total} bookings.`,
  );
}

main().catch((err) => {
  const logger = new Logger('seed-bookings');
  logger.error(err instanceof Error ? err.stack ?? err.message : String(err));
  process.exit(1);
});
