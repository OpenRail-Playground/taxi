import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import type { CreateHelpRequestDto, HelpRequest } from '@taxi/shared';

import { HelpRequestController } from './help-request.controller';
import { HelpRequestService } from './help-request.service';

interface MockService {
  create: jest.Mock;
  findById: jest.Mock;
}

function buildBody(
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

function buildEntity(): HelpRequest {
  return {
    id: '550e8400-e29b-41d4-a716-446655440000',
    createdAt: '2026-05-29T12:00:00.000Z',
    status: 'eligible',
    eligibility: {
      eligible: true,
      reason: 'Booking verified against records.',
    },
    ...buildBody(),
  };
}

describe('HelpRequestController', () => {
  let controller: HelpRequestController;
  let mockService: MockService;

  beforeEach(async () => {
    mockService = { create: jest.fn(), findById: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [HelpRequestController],
      providers: [{ provide: HelpRequestService, useValue: mockService }],
    }).compile();

    controller = module.get(HelpRequestController);
  });

  describe('POST / (create)', () => {
    it('returns the entity verbatim on a valid payload (201 happy path)', async () => {
      const body = buildBody();
      const entity = buildEntity();
      mockService.create.mockResolvedValue(entity);

      const result = await controller.create(body);

      expect(result).toBe(entity);
      expect(mockService.create).toHaveBeenCalledTimes(1);
      expect(mockService.create).toHaveBeenCalledWith(body);
    });

    it('throws BadRequestException (400) when "auftragsnummer" is missing', async () => {
      const body = buildBody();
      const { auftragsnummer: _omit, ...rest } = body;
      void _omit;

      await expect(controller.create(rest)).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(mockService.create).not.toHaveBeenCalled();
    });

    it('throws BadRequestException (400) when "journey" is missing entirely', async () => {
      const body = buildBody();
      const { journey: _omit, ...rest } = body;
      void _omit;

      await expect(controller.create(rest)).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(mockService.create).not.toHaveBeenCalled();
    });

    it('throws BadRequestException (400) when "contact.email" is missing', async () => {
      const body = buildBody();
      const broken = {
        ...body,
        contact: { name: body.contact.name, phone: body.contact.phone },
      } as unknown as Partial<CreateHelpRequestDto>;

      await expect(controller.create(broken)).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(mockService.create).not.toHaveBeenCalled();
    });

    it('throws BadRequestException (400) when "journey.alternativeTransportRequired" is a string', async () => {
      const body = buildBody();
      const broken = {
        ...body,
        journey: {
          ...body.journey,
          alternativeTransportRequired: 'yes' as unknown as boolean,
        },
      };

      await expect(controller.create(broken)).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(mockService.create).not.toHaveBeenCalled();
    });

    it('throws UnprocessableEntityException (422) when "passengers.adults" is negative', async () => {
      const body = buildBody({
        passengers: { adults: -1, kids: 0, bicycles: 0, wheelchairs: 0 },
      });

      await expect(controller.create(body)).rejects.toBeInstanceOf(
        UnprocessableEntityException,
      );
      expect(mockService.create).not.toHaveBeenCalled();
    });

    it('throws UnprocessableEntityException (422) when "passengers.kids" is a non-integer float', async () => {
      const body = buildBody({
        passengers: { adults: 1, kids: 1.5, bicycles: 0, wheelchairs: 0 },
      });

      await expect(controller.create(body)).rejects.toBeInstanceOf(
        UnprocessableEntityException,
      );
      expect(mockService.create).not.toHaveBeenCalled();
    });

    it('propagates NotFoundException (404) from service.create', async () => {
      const body = buildBody();
      mockService.create.mockRejectedValue(
        new NotFoundException('Booking not found.'),
      );

      await expect(controller.create(body)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('propagates ForbiddenException (403) from service.create', async () => {
      const body = buildBody();
      mockService.create.mockRejectedValue(
        new ForbiddenException('Details do not match.'),
      );

      await expect(controller.create(body)).rejects.toBeInstanceOf(
        ForbiddenException,
      );
    });
  });

  describe('GET /:id (findById)', () => {
    it('returns the entity on a successful lookup', async () => {
      const entity = buildEntity();
      mockService.findById.mockResolvedValue(entity);

      const result = await controller.findById(entity.id);

      expect(result).toBe(entity);
      expect(mockService.findById).toHaveBeenCalledWith(entity.id);
    });

    it('throws NotFoundException (404) when the service returns null', async () => {
      mockService.findById.mockResolvedValue(null);

      await expect(controller.findById('missing-id')).rejects.toBeInstanceOf(
        NotFoundException,
      );
      await expect(controller.findById('missing-id')).rejects.toMatchObject({
        status: 404,
      });
    });

    it('throws BadRequestException (400) when the id contains invalid characters', async () => {
      await expect(controller.findById('not!an!id')).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(mockService.findById).not.toHaveBeenCalled();
    });
  });
});
