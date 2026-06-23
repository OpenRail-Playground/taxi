import { Injectable, Logger } from '@nestjs/common';
import type { BookingRecord } from './booking.types';
import { BookingsRepository, normalizeAuftragsnummer } from './bookings.repository';
import type { RedisClient } from '../persistence/redis-client';

export const BOOKINGS_HASH_KEY = 'bookings';

@Injectable()
export class RedisBookingsRepository extends BookingsRepository {
  private readonly logger = new Logger(RedisBookingsRepository.name);

  constructor(private readonly redis: RedisClient) {
    super();
  }

  async findByAuftragsnummer(
    auftragsnummer: string,
  ): Promise<BookingRecord | undefined> {
    const id = normalizeAuftragsnummer(auftragsnummer);
    if (!id) return undefined;
    const record = await this.redis.hget<BookingRecord>(BOOKINGS_HASH_KEY, id);
    return record ?? undefined;
  }

  async size(): Promise<number> {
    return this.redis.hlen(BOOKINGS_HASH_KEY);
  }
}
