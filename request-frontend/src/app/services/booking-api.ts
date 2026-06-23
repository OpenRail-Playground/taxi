import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { map, Observable } from 'rxjs';

import { environment } from '../../environments/environment';
import {
  BookingValidationRequest,
  JourneyStop,
  JourneyStopsResponse,
  ValidatedBooking,
} from '../models/api.model';

/** Thin client for the request-backend REST API. */
@Injectable({ providedIn: 'root' })
export class BookingApi {
  readonly #http = inject(HttpClient);
  readonly #baseUrl = environment.backendUrl;

  /** POST /bookings/validate — look up a booking by order ID + last name. */
  validate(orderId: string, lastName: string): Observable<ValidatedBooking> {
    const body: BookingValidationRequest = {
      auftragsnummer: orderId.trim(),
      lastName: lastName.trim(),
    };
    return this.#http.post<ValidatedBooking>(
      `${this.#baseUrl}/bookings/validate`,
      body
    );
  }

  /** GET /bookings/:id/journey-stops — the disrupted journey timeline. */
  getJourneyStops(orderId: string): Observable<JourneyStop[]> {
    const id = encodeURIComponent(orderId.trim());
    return this.#http
      .get<JourneyStopsResponse>(
        `${this.#baseUrl}/bookings/${id}/journey-stops`
      )
      .pipe(map(response => response.stops));
  }
}
