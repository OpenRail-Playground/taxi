import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { CreateHelpRequestDto, HelpRequest } from '@taxi/shared';

import { FileRepository, fileRepositoryToken } from '../persistence/file-repository';
import { HelpRequestService } from './help-request.service';
import { HelpRequestVerifier } from './help-request.verifier';

interface MockRepo {
  create: jest.Mock;
  findById: jest.Mock;
}

interface MockVerifier {
  verify: jest.Mock;
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

describe('HelpRequestService', () => {
  let service: HelpRequestService;
  let mockRepo: MockRepo;
  let mockVerifier: MockVerifier;

  beforeEach(async () => {
    mockRepo = { create: jest.fn(), findById: jest.fn() };
    mockVerifier = { verify: jest.fn() };

    const module = await Test.createTestingModule({
      providers: [
        HelpRequestService,
        {
          provide: fileRepositoryToken('help-request'),
          useValue: mockRepo as unknown as FileRepository<HelpRequest>,
        },
        { provide: HelpRequestVerifier, useValue: mockVerifier },
      ],
    }).compile();

    service = module.get(HelpRequestService);
  });

  describe('create()', () => {
    it('verifies, persists, and returns the created entity with server-side fields', async () => {
      const input = buildInput();
      mockVerifier.verify.mockReturnValue(undefined);
      mockRepo.create.mockImplementation(
        async (draft: Omit<HelpRequest, 'id'>): Promise<HelpRequest> => ({
          ...draft,
          id: '0000-1111-2222-3333',
        }),
      );

      const result = await service.create(input);

      expect(mockVerifier.verify).toHaveBeenCalledTimes(1);
      expect(mockVerifier.verify).toHaveBeenCalledWith(input);

      expect(mockRepo.create).toHaveBeenCalledTimes(1);
      const draftArg = mockRepo.create.mock.calls[0]?.[0] as Omit<
        HelpRequest,
        'id'
      >;
      expect(draftArg.status).toBe('eligible');
      expect(draftArg.eligibility.eligible).toBe(true);
      expect(draftArg.eligibility.reason).toBe(
        'Booking verified against records.',
      );
      expect(draftArg.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
      expect(draftArg.auftragsnummer).toBe(input.auftragsnummer);
      expect(draftArg.lastName).toBe(input.lastName);
      expect(draftArg.journey).toEqual(input.journey);
      expect(draftArg.contact).toEqual(input.contact);
      expect(draftArg.passengers).toEqual(input.passengers);

      expect(result.id).toBe('0000-1111-2222-3333');
      expect(result.status).toBe('eligible');
    });

    it('propagates NotFoundException from the verifier without calling repo.create', async () => {
      const input = buildInput();
      mockVerifier.verify.mockImplementation(() => {
        throw new NotFoundException('booking not found');
      });

      await expect(service.create(input)).rejects.toThrow(NotFoundException);
      expect(mockRepo.create).not.toHaveBeenCalled();
    });

    it('propagates ForbiddenException from the verifier without calling repo.create', async () => {
      const input = buildInput();
      mockVerifier.verify.mockImplementation(() => {
        throw new ForbiddenException('details do not match');
      });

      await expect(service.create(input)).rejects.toThrow(ForbiddenException);
      expect(mockRepo.create).not.toHaveBeenCalled();
    });
  });

  describe('findById()', () => {
    it('returns the entity when the repository finds it', async () => {
      const stored: HelpRequest = {
        id: 'some-uuid',
        createdAt: '2026-05-29T12:00:00.000Z',
        status: 'eligible',
        eligibility: { eligible: true, reason: 'Booking verified against records.' },
        ...buildInput(),
      };
      mockRepo.findById.mockResolvedValue(stored);

      const result = await service.findById('some-uuid');

      expect(mockRepo.findById).toHaveBeenCalledWith('some-uuid');
      expect(result).toBe(stored);
    });

    it('returns null when the repository has no matching entity', async () => {
      mockRepo.findById.mockResolvedValue(null);

      const result = await service.findById('missing-id');

      expect(mockRepo.findById).toHaveBeenCalledWith('missing-id');
      expect(result).toBeNull();
    });
  });
});
