import {
  BadGatewayException,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';

import { BookingsController } from './bookings.controller';
import { BookingsRepository } from './bookings.repository';
import { JourneyStopsService } from './journey-stops.service';

describe('BookingsController (GET /:auftragsnummer/journey-stops)', () => {
  let controller: BookingsController;
  let bookings: { findByAuftragsnummer: jest.Mock };
  let journeyStops: { getStops: jest.Mock };

  const booking = {
    trainNumber: 'ICE 619',
    travelDate: '2026-05-29',
    destinationStation: 'Düsseldorf Hbf',
    passengerCount: 1,
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    bookings = { findByAuftragsnummer: jest.fn() };
    journeyStops = { getStops: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [BookingsController],
      providers: [
        { provide: BookingsRepository, useValue: bookings },
        { provide: JourneyStopsService, useValue: journeyStops },
      ],
    }).compile();

    controller = module.get(BookingsController);
  });

  it('returns 200 with { stops } for a known booking', async () => {
    bookings.findByAuftragsnummer.mockReturnValue(booking);
    const stops = [
      {
        evaNumber: '1',
        name: 'Köln Hbf',
        scheduledTime: '2026-05-29T20:00:00+02:00',
        cancelled: false,
      },
    ];
    journeyStops.getStops.mockResolvedValue(stops);

    const result = await controller.getJourneyStops('258376672881');

    expect(result).toEqual({ stops });
    expect(bookings.findByAuftragsnummer).toHaveBeenCalledWith('258376672881');
    expect(journeyStops.getStops).toHaveBeenCalledWith(
      booking.trainNumber,
      booking.travelDate,
      booking.destinationStation,
    );
  });

  it('throws NotFoundException (404) when booking is not found', async () => {
    bookings.findByAuftragsnummer.mockReturnValue(undefined);

    await expect(
      controller.getJourneyStops('does-not-exist'),
    ).rejects.toBeInstanceOf(NotFoundException);
    await expect(
      controller.getJourneyStops('does-not-exist'),
    ).rejects.toMatchObject({ status: 404 });
    expect(journeyStops.getStops).not.toHaveBeenCalled();
  });

  it('throws UnprocessableEntityException (422) on UNPARSEABLE_TRAIN_NUMBER', async () => {
    bookings.findByAuftragsnummer.mockReturnValue(booking);
    journeyStops.getStops.mockRejectedValue(
      new Error('UNPARSEABLE_TRAIN_NUMBER:ICE'),
    );

    const promise = controller.getJourneyStops('258376672881');
    await expect(promise).rejects.toBeInstanceOf(UnprocessableEntityException);
    await expect(
      controller.getJourneyStops('258376672881'),
    ).rejects.toMatchObject({ status: 422 });
  });

  it('throws NotFoundException (404) on NO_JOURNEY_FOUND', async () => {
    bookings.findByAuftragsnummer.mockReturnValue(booking);
    journeyStops.getStops.mockRejectedValue(
      new Error('NO_JOURNEY_FOUND:ICE 619'),
    );

    await expect(
      controller.getJourneyStops('258376672881'),
    ).rejects.toBeInstanceOf(NotFoundException);
    await expect(
      controller.getJourneyStops('258376672881'),
    ).rejects.toMatchObject({ status: 404 });
  });

  it('throws BadGatewayException (502) on any other error', async () => {
    bookings.findByAuftragsnummer.mockReturnValue(booking);
    journeyStops.getStops.mockRejectedValue(new Error('network timeout'));

    await expect(
      controller.getJourneyStops('258376672881'),
    ).rejects.toBeInstanceOf(BadGatewayException);
    await expect(
      controller.getJourneyStops('258376672881'),
    ).rejects.toMatchObject({ status: 502 });
  });
});
