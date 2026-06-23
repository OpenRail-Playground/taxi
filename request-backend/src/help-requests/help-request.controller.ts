import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  NotFoundException,
  Param,
  Post,
  UnprocessableEntityException,
} from '@nestjs/common';
import type { CreateHelpRequestDto, HelpRequest } from '@taxi/shared';

import { InvalidIdError } from '../persistence/errors';
import { assertValidId } from '../persistence/validate-id';
import { HelpRequestService } from './help-request.service';

const NOT_FOUND_MESSAGE = 'Help request not found.';

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}

/**
 * REST controller for HelpRequest creation and lookup (issue #11).
 *
 * Validation is performed manually inside each handler — there is no
 * global ValidationPipe and no class-validator decorators on the DTOs.
 * This mirrors the style established by {@link BookingsController}.
 */
@Controller('help-requests')
export class HelpRequestController {
  constructor(private readonly service: HelpRequestService) {}

  @Post()
  @HttpCode(201)
  async create(
    @Body() body: Partial<CreateHelpRequestDto>,
  ): Promise<HelpRequest> {
    if (!body || typeof body !== 'object') {
      throw new BadRequestException('Request body is required.');
    }

    if (!isNonEmptyString(body.auftragsnummer)) {
      throw new BadRequestException(
        '"auftragsnummer" must be a non-empty string.',
      );
    }
    if (!isNonEmptyString(body.lastName)) {
      throw new BadRequestException('"lastName" must be a non-empty string.');
    }

    const journey = body.journey;
    if (!journey || typeof journey !== 'object') {
      throw new BadRequestException('"journey" is required.');
    }
    if (!isNonEmptyString(journey.trainNumber)) {
      throw new BadRequestException(
        '"journey.trainNumber" must be a non-empty string.',
      );
    }
    if (!isNonEmptyString(journey.travelDate)) {
      throw new BadRequestException(
        '"journey.travelDate" must be a non-empty string.',
      );
    }
    if (!isNonEmptyString(journey.startStation)) {
      throw new BadRequestException(
        '"journey.startStation" must be a non-empty string.',
      );
    }
    if (!isNonEmptyString(journey.disruptionStation)) {
      throw new BadRequestException(
        '"journey.disruptionStation" must be a non-empty string.',
      );
    }
    if (!isNonEmptyString(journey.finalDestination)) {
      throw new BadRequestException(
        '"journey.finalDestination" must be a non-empty string.',
      );
    }
    if (typeof journey.alternativeTransportRequired !== 'boolean') {
      throw new BadRequestException(
        '"journey.alternativeTransportRequired" must be a boolean.',
      );
    }

    const contact = body.contact;
    if (!contact || typeof contact !== 'object') {
      throw new BadRequestException('"contact" is required.');
    }
    if (!isNonEmptyString(contact.name)) {
      throw new BadRequestException(
        '"contact.name" must be a non-empty string.',
      );
    }
    if (!isNonEmptyString(contact.phone)) {
      throw new BadRequestException(
        '"contact.phone" must be a non-empty string.',
      );
    }
    if (!isNonEmptyString(contact.email)) {
      throw new BadRequestException(
        '"contact.email" must be a non-empty string.',
      );
    }

    const passengers = body.passengers;
    if (!passengers || typeof passengers !== 'object') {
      throw new BadRequestException('"passengers" is required.');
    }
    this.validatePassengerCount(passengers.adults, 'adults');
    this.validatePassengerCount(passengers.kids, 'kids');
    this.validatePassengerCount(passengers.bicycles, 'bicycles');
    this.validatePassengerCount(passengers.wheelchairs, 'wheelchairs');

    const validated: CreateHelpRequestDto = {
      auftragsnummer: body.auftragsnummer,
      lastName: body.lastName,
      journey: {
        trainNumber: journey.trainNumber,
        travelDate: journey.travelDate,
        startStation: journey.startStation,
        disruptionStation: journey.disruptionStation,
        finalDestination: journey.finalDestination,
        alternativeTransportRequired: journey.alternativeTransportRequired,
      },
      contact: {
        name: contact.name,
        phone: contact.phone,
        email: contact.email,
      },
      passengers: {
        adults: passengers.adults,
        kids: passengers.kids,
        bicycles: passengers.bicycles,
        wheelchairs: passengers.wheelchairs,
      },
    };

    return await this.service.create(validated);
  }

  @Get(':id')
  async findById(@Param('id') id: string): Promise<HelpRequest> {
    try {
      assertValidId(id);
    } catch (err: unknown) {
      if (err instanceof InvalidIdError) {
        throw new BadRequestException(err.message);
      }
      throw err;
    }

    const entity = await this.service.findById(id);
    if (entity === null) {
      throw new NotFoundException(NOT_FOUND_MESSAGE);
    }
    return entity;
  }

  /**
   * Validates a single passenger-count field.
   *
   * - Missing field or wrong type → 400 Bad Request
   * - Non-integer numeric value (e.g. 1.5) → 422 Unprocessable Entity
   * - Negative integer → 422 Unprocessable Entity
   */
  private validatePassengerCount(value: unknown, field: string): void {
    if (typeof value !== 'number' || Number.isNaN(value)) {
      throw new BadRequestException(
        `"passengers.${field}" must be a number.`,
      );
    }
    if (!Number.isInteger(value)) {
      throw new UnprocessableEntityException(
        `"passengers.${field}" must be an integer.`,
      );
    }
    if (value < 0) {
      throw new UnprocessableEntityException(
        `"passengers.${field}" must be greater than or equal to 0.`,
      );
    }
  }
}
