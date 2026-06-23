import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { CreateHelpRequestDto } from '@taxi/shared';

import { BookingsRepository } from '../bookings/bookings.repository';
import type { BookingRecord } from '../bookings/booking.types';
import { HelpRequestVerifier } from './help-request.verifier';

interface MockBookingsRepository {
  findByAuftragsnummer: jest.Mock<BookingRecord | undefined, [string]>;
}

const NOT_FOUND_MESSAGE =
  'We could not find a journey for this booking number. Please check your details and try again.';
const FORBIDDEN_MESSAGE =
  'Submitted journey details do not match the booking on record.';

function buildRecord(overrides: Partial<BookingRecord> = {}): BookingRecord {
  return {
    auftragsnummer: '258376672881',
    trainNumber: 'ICE 619',
    travelDate: '2026-05-29',
    destinationStation: 'Basel SBB',
    passengerCount: 3,
    ...overrides,
  };
}

function buildInput(
  overrides: Partial<CreateHelpRequestDto> = {},
): CreateHelpRequestDto {
  return {
    auftragsnummer: '258376672881',
    lastName: 'Mustermann',
    journey: {
      trainNumber: 'ICE 619',
      travelDate: '2026-05-29',
      startStation: 'Hamburg Hbf',
      disruptionStation: 'Mannheim Hbf',
      finalDestination: 'Basel SBB',
      alternativeTransportRequired: true,
    },
    contact: {
      name: 'Max Mustermann',
      phone: '+49 170 1234567',
      email: 'max@example.com',
    },
    passengers: {
      adults: 2,
      kids: 1,
      bicycles: 0,
      wheelchairs: 0,
    },
    ...overrides,
  };
}

describe('HelpRequestVerifier', () => {
  let verifier: HelpRequestVerifier;
  let mockRepo: MockBookingsRepository;

  beforeEach(async () => {
    mockRepo = { findByAuftragsnummer: jest.fn() };
    const module = await Test.createTestingModule({
      providers: [
        HelpRequestVerifier,
        { provide: BookingsRepository, useValue: mockRepo },
      ],
    }).compile();
    verifier = module.get(HelpRequestVerifier);
  });

  it('does not throw when the submitted journey matches the booking record', () => {
    mockRepo.findByAuftragsnummer.mockReturnValue(buildRecord());

    expect(() => verifier.verify(buildInput())).not.toThrow();
    expect(mockRepo.findByAuftragsnummer).toHaveBeenCalledWith('258376672881');
  });

  it('throws NotFoundException with the exact message when the booking does not exist', () => {
    mockRepo.findByAuftragsnummer.mockReturnValue(undefined);

    expect(() => verifier.verify(buildInput())).toThrow(NotFoundException);
    expect(() => verifier.verify(buildInput())).toThrow(NOT_FOUND_MESSAGE);
  });

  it('throws ForbiddenException when the train number does not match', () => {
    mockRepo.findByAuftragsnummer.mockReturnValue(
      buildRecord({ trainNumber: 'ICE 999' }),
    );

    expect(() => verifier.verify(buildInput())).toThrow(ForbiddenException);
    expect(() => verifier.verify(buildInput())).toThrow(FORBIDDEN_MESSAGE);
  });

  it('throws ForbiddenException when the travel date does not match', () => {
    mockRepo.findByAuftragsnummer.mockReturnValue(
      buildRecord({ travelDate: '2026-06-01' }),
    );

    expect(() => verifier.verify(buildInput())).toThrow(ForbiddenException);
  });

  it('throws ForbiddenException when the final destination does not match record.destinationStation', () => {
    mockRepo.findByAuftragsnummer.mockReturnValue(
      buildRecord({ destinationStation: 'Zürich HB' }),
    );

    expect(() => verifier.verify(buildInput())).toThrow(ForbiddenException);
  });

  it('throws ForbiddenException when adults + kids does not equal record.passengerCount', () => {
    mockRepo.findByAuftragsnummer.mockReturnValue(
      buildRecord({ passengerCount: 5 }),
    );

    expect(() =>
      verifier.verify(
        buildInput({
          passengers: { adults: 2, kids: 1, bicycles: 0, wheelchairs: 0 },
        }),
      ),
    ).toThrow(ForbiddenException);
  });

  it('does NOT throw when only the disruptionStation differs (user-editable carve-out)', () => {
    mockRepo.findByAuftragsnummer.mockReturnValue(buildRecord());

    const input = buildInput({
      journey: {
        trainNumber: 'ICE 619',
        travelDate: '2026-05-29',
        startStation: 'Hamburg Hbf',
        disruptionStation: 'Some completely different station',
        finalDestination: 'Basel SBB',
        alternativeTransportRequired: false,
      },
    });

    expect(() => verifier.verify(input)).not.toThrow();
  });
});
