import * as fs from 'node:fs';
import * as path from 'node:path';

import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import * as ExcelJS from 'exceljs';

import type { BookingRecord } from './booking.types';

const DEFAULT_DATA_PATH = path.resolve(
  process.cwd(),
  '..',
  '.local',
  'Bookingdata_UPLOAD_custom_auftragsnummer.xlsx',
);

const SHEET_NAME = 'Result';

const COL_AUFTRAGSNUMMER = 1;
const COL_ANZAHL_REISENDE = 2;
const COL_ZIELORT = 5;
const COL_ZUGNUMMER = 7;
const COL_REISETAG = 8;

@Injectable()
export class BookingsRepository implements OnModuleInit {
  private readonly logger = new Logger(BookingsRepository.name);
  private readonly index = new Map<string, BookingRecord>();

  async onModuleInit(): Promise<void> {
    const filePath = process.env.BOOKING_DATA_PATH ?? DEFAULT_DATA_PATH;
    if (!fs.existsSync(filePath)) {
      this.logger.warn(
        `Booking data file not found at ${filePath}. /bookings/validate will always return 404.`,
      );
      return;
    }

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(filePath);
    const sheet = workbook.getWorksheet(SHEET_NAME);
    if (!sheet) {
      throw new Error(
        `Booking data file ${filePath} is missing the "${SHEET_NAME}" sheet.`,
      );
    }

    let loaded = 0;
    sheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
      if (rowNumber === 1) {
        return;
      }
      const auftragsnummer = normalizeAuftragsnummer(
        row.getCell(COL_AUFTRAGSNUMMER).value,
      );
      const trainNumber = String(row.getCell(COL_ZUGNUMMER).value ?? '').trim();
      const destinationStation = String(
        row.getCell(COL_ZIELORT).value ?? '',
      ).trim();
      const travelDate = normalizeDate(row.getCell(COL_REISETAG).value);
      const passengerCount = normalizePassengerCount(
        row.getCell(COL_ANZAHL_REISENDE).value,
      );

      if (!auftragsnummer || !trainNumber || !destinationStation || !travelDate) {
        return;
      }

      this.index.set(auftragsnummer, {
        auftragsnummer,
        trainNumber,
        travelDate,
        destinationStation,
        passengerCount,
      });
      loaded += 1;
    });

    this.logger.log(
      `Loaded ${loaded} bookings from ${filePath} (sheet "${SHEET_NAME}").`,
    );
  }

  findByAuftragsnummer(auftragsnummer: string): BookingRecord | undefined {
    return this.index.get(normalizeAuftragsnummer(auftragsnummer));
  }

  size(): number {
    return this.index.size;
  }
}

function normalizeAuftragsnummer(value: unknown): string {
  if (value === null || value === undefined) {
    return '';
  }
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value.toFixed(0) : '';
  }
  return String(value).trim();
}

function normalizeDate(value: unknown): string {
  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }
  if (typeof value === 'string' && value.length > 0) {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toISOString().slice(0, 10);
    }
    return value.trim();
  }
  return '';
}

function normalizePassengerCount(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Math.max(1, Math.round(value));
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed) : 1;
}
