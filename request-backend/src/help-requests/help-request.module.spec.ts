import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { Test, type TestingModule } from '@nestjs/testing';
import type { CreateHelpRequestDto } from '@taxi/shared';

import { BookingsRepository } from '../bookings/bookings.repository';
import { HelpRequestController } from './help-request.controller';
import { HelpRequestModule } from './help-request.module';
import { HelpRequestService } from './help-request.service';

const VALID_DTO: CreateHelpRequestDto = {
  auftragsnummer: '258376672881',
  lastName: 'Mustermann',
  journey: {
    trainNumber: 'ICE 619',
    travelDate: '2026-05-29',
    startStation: 'Hamburg Hbf',
    disruptionStation: 'Mannheim Hbf',
    finalDestination: 'Basel SBB',
    alternativeTransportRequired: false,
  },
  contact: {
    name: 'Max Mustermann',
    phone: '+49 170',
    email: 'max@test.com',
  },
  passengers: {
    adults: 2,
    kids: 1,
    bicycles: 0,
    wheelchairs: 0,
  },
};

describe('HelpRequestModule (DI wiring)', () => {
  let tmpDir: string;
  let module: TestingModule;
  const previousDataDir = process.env['DATA_DIR'];

  beforeAll(async () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'help-req-'));
    process.env['DATA_DIR'] = tmpDir;

    module = await Test.createTestingModule({
      imports: [HelpRequestModule],
    })
      .overrideProvider(BookingsRepository)
      .useValue({
        findByAuftragsnummer: jest.fn().mockReturnValue({
          auftragsnummer: '258376672881',
          trainNumber: 'ICE 619',
          travelDate: '2026-05-29',
          destinationStation: 'Basel SBB',
          passengerCount: 3,
        }),
      })
      .compile();
  });

  afterAll(async () => {
    if (module) {
      await module.close();
    }
    if (previousDataDir === undefined) {
      delete process.env['DATA_DIR'];
    } else {
      process.env['DATA_DIR'] = previousDataDir;
    }
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('resolves HelpRequestController from the module', () => {
    const controller = module.get(HelpRequestController);
    expect(controller).toBeDefined();
    expect(controller).toBeInstanceOf(HelpRequestController);
  });

  it('resolves HelpRequestService from the module', () => {
    const service = module.get(HelpRequestService);
    expect(service).toBeDefined();
    expect(service).toBeInstanceOf(HelpRequestService);
  });

  it('round-trips a valid DTO: controller.create → controller.findById returns the same entity', async () => {
    const controller = module.get(HelpRequestController);

    const created = await controller.create(VALID_DTO);
    expect(created.id).toEqual(expect.any(String));

    const found = await controller.findById(created.id);
    expect(found).toEqual(created);
  });
});
