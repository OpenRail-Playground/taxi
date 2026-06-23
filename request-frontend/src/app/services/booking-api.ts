import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../environments/environment';
import {
  BookingValidationRequest,
  JourneyStopsResponse,
  ValidatedBooking,
} from '../models/api.model';

@Injectable({ providedIn: 'root' })
export class BookingApi {
  readonly #http = inject(HttpClient);
  readonly #baseUrl = environment.backendUrl;

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

  getJourneyStops(orderId: string): Observable<JourneyStopsResponse> {
    const id = encodeURIComponent(orderId.trim());
    return this.#http.get<JourneyStopsResponse>(
      `${this.#baseUrl}/bookings/${id}/journey-stops`
    );
  }
}
