import { Component, computed, inject } from '@angular/core';
import {
  DBBrand,
  DBButton,
  DBCard,
  DBIcon,
  DBInfotext,
  DBSection,
} from '@db-ux/ngx-core-components';

import { RequestStore } from '../../services/request-store';

interface QrGrid {
  size: number;
  cells: { x: number; y: number }[];
}

/** Final screen — a taxi has been assigned; shows driver + voucher. */
@Component({
  selector: 'app-success',
  imports: [DBSection, DBCard, DBButton, DBIcon, DBInfotext, DBBrand],
  templateUrl: './success.html',
  styleUrl: './success.scss',
})
export class Success {
  readonly #store = inject(RequestStore);

  protected readonly journey = this.#store.journey;
  protected readonly taxiBooking = this.#store.taxiBooking;
  protected readonly passengerTotal = this.#store.passengerTotal;

  /** Today's date, formatted like "23 Jun 2026". */
  protected readonly today = new Date().toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });

  /** Decorative QR-style module grid, seeded from the voucher id. */
  protected readonly qr = computed<QrGrid>(() =>
    buildQrGrid(this.taxiBooking()?.bookingNumber ?? 'DB-TAXI')
  );

  constructor() {
    if (!this.#store.taxiBooking()) {
      this.#store.createTaxiBooking();
    }
  }
}

/**
 * Builds a QR-looking 21×21 module grid (3 finder patterns + pseudo-random
 * data modules seeded from `seed`). Decorative only — not a real encoder.
 */
function buildQrGrid(seed: string): QrGrid {
  const size = 21;
  const filled: boolean[][] = Array.from({ length: size }, () =>
    Array<boolean>(size).fill(false)
  );

  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  const rand = (): number => {
    h += 0x6d2b79f5;
    let t = h;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      filled[y][x] = rand() > 0.5;
    }
  }

  const drawFinder = (ox: number, oy: number): void => {
    for (let y = -1; y <= 7; y++) {
      for (let x = -1; x <= 7; x++) {
        const gx = ox + x;
        const gy = oy + y;
        if (gx < 0 || gy < 0 || gx >= size || gy >= size) continue;
        const quietRing = x === -1 || x === 7 || y === -1 || y === 7;
        const border =
          (x >= 0 && x <= 6 && (y === 0 || y === 6)) ||
          (y >= 0 && y <= 6 && (x === 0 || x === 6));
        const core = x >= 2 && x <= 4 && y >= 2 && y <= 4;
        filled[gy][gx] = quietRing ? false : border || core;
      }
    }
  };
  drawFinder(0, 0);
  drawFinder(size - 7, 0);
  drawFinder(0, size - 7);

  const cells: { x: number; y: number }[] = [];
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (filled[y][x]) cells.push({ x, y });
    }
  }
  return { size, cells };
}
