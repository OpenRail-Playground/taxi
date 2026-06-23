import { FakeRedis } from '../persistence/fake-redis';
import type { BookingRecord } from './booking.types';
import { RedisBookingsRepository, BOOKINGS_HASH_KEY } from './redis-bookings.repository';

const SAMPLE: BookingRecord = {
  auftragsnummer: '258376672881',
  trainNumber: 'ICE 619',
  travelDate: '2026-05-29',
  destinationStation: 'Siegburg/Bonn',
  passengerCount: 1,
};

describe('RedisBookingsRepository', () => {
  let redis: FakeRedis;
  let repo: RedisBookingsRepository;

  beforeEach(async () => {
    redis = new FakeRedis();
    await redis.hset(BOOKINGS_HASH_KEY, { [SAMPLE.auftragsnummer]: SAMPLE });
    repo = new RedisBookingsRepository(redis);
  });

  it('returns the booking record for a known auftragsnummer', async () => {
    const found = await repo.findByAuftragsnummer(SAMPLE.auftragsnummer);
    expect(found).toEqual(SAMPLE);
  });

  it('trims whitespace before lookup', async () => {
    const found = await repo.findByAuftragsnummer('  258376672881  ');
    expect(found).toEqual(SAMPLE);
  });

  it('returns undefined for an unknown auftragsnummer', async () => {
    const found = await repo.findByAuftragsnummer('999999999999');
    expect(found).toBeUndefined();
  });

  it('returns undefined for an empty input rather than calling Redis', async () => {
    const spy = jest.spyOn(redis, 'hget');
    const found = await repo.findByAuftragsnummer('   ');
    expect(found).toBeUndefined();
    expect(spy).not.toHaveBeenCalled();
  });

  it('size() reports the number of seeded bookings', async () => {
    expect(await repo.size()).toBe(1);
    await redis.hset(BOOKINGS_HASH_KEY, {
      '258376699013': { ...SAMPLE, auftragsnummer: '258376699013' },
    });
    expect(await repo.size()).toBe(2);
  });

  it('numeric auftragsnummer is normalized to string before lookup', async () => {
    const found = await repo.findByAuftragsnummer(
      258376672881 as unknown as string,
    );
    expect(found).toEqual(SAMPLE);
  });
});
