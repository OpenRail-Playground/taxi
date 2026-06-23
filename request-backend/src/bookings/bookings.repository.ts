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

export abstract class BookingsRepository {
  abstract findByAuftragsnummer(
    auftragsnummer: string,
  ): Promise<BookingRecord | undefined>;
  abstract size(): Promise<number>;
}

@Injectable()
export class ExcelBookingsRepository
  extends BookingsRepository
  implements OnModuleInit
{
  private readonly logger = new Logger(ExcelBookingsRepository.name);
  private readonly index = new Map<string, BookingRecord>();

  async onModuleInit(): Promise<void> {
    const filePath = process.env.BOOKING_DATA_PATH ?? DEFAULT_DATA_PATH;
    if (!fs.existsSync(filePath)) {
      this.logger.warn(
        `Booking data file not found at ${filePath}. /bookings/validate will always return 404.`,
      );
      return;
    }

    const records = await parseBookingsFromExcel(filePath);
    for (const record of records) {
      this.index.set(record.auftragsnummer, record);
    }

    this.logger.log(
      `Loaded ${records.length} bookings from ${filePath} (sheet "${SHEET_NAME}").`,
    );
  }

  async findByAuftragsnummer(
    auftragsnummer: string,
  ): Promise<BookingRecord | undefined> {
    return this.index.get(normalizeAuftragsnummer(auftragsnummer));
  }

  async size(): Promise<number> {
    return this.index.size;
  }
}

export async function parseBookingsFromExcel(
  filePath: string,
): Promise<BookingRecord[]> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);
  const sheet = workbook.getWorksheet(SHEET_NAME);
  if (!sheet) {
    throw new Error(
      `Booking data file ${filePath} is missing the "${SHEET_NAME}" sheet.`,
    );
  }

  const records: BookingRecord[] = [];
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

    records.push({
      auftragsnummer,
      trainNumber,
      travelDate,
      destinationStation,
      passengerCount,
    });
  });

  return records;
}

export function normalizeAuftragsnummer(value: unknown): string {
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
