#!/usr/bin/env python3
from __future__ import annotations

from dataclasses import dataclass
from pprint import pprint

from pooling.pooling import pool_taxi_rides
from pooling.types import CustomerJourney, TaxiPoolingStatus

SOURCE_LON = 1.5
SOURCE_LAT = 1.5
RUN_TIMEOUT_SECONDS = 3


@dataclass(frozen=True)
class DestinationSpec:
    name: str
    passengers: int
    source_distance_km: float
    lon: float
    lat: float


DESTINATIONS: list[DestinationSpec] = [
    DestinationSpec("Koenigs Wusterhausen", 8, 39.0, 1.80, 1.76),
    DestinationSpec("Luebben", 12, 85.0, 2.12, 2.14),
    DestinationSpec("Luckau-Uckro", 7, 100.0, 2.22, 2.28),
    DestinationSpec("Cottbus", 7, 131.0, 2.48, 2.50),
    DestinationSpec("Rostock", 1, 230.0, 3.05, 3.28),
]


def build_test_journeys() -> list[CustomerJourney]:
    journeys: list[CustomerJourney] = []
    current_id = 1

    for destination in DESTINATIONS:
        for _ in range(destination.passengers):
            journeys.append(
                CustomerJourney(
                    id=f"journey-{current_id:02d}",
                    source_lat=SOURCE_LAT,
                    source_lon=SOURCE_LON,
                    destination_name=destination.name,
                    destination_lat=destination.lat,
                    destination_lon=destination.lon,
                    status=TaxiPoolingStatus.WAITING,
                    pool_number=0,
                )
            )
            current_id += 1

    return journeys


def build_distance_matrix() -> tuple[list[list[float]], list[str]]:
    destination_names = [destination.name for destination in DESTINATIONS]

    matrix: list[list[float]] = [[destination.source_distance_km for destination in DESTINATIONS]]

    for row in DESTINATIONS:
        row_values: list[float] = []
        for col in DESTINATIONS:
            row_values.append(abs(row.source_distance_km - col.source_distance_km))
        matrix.append(row_values)

    return matrix, destination_names


def main() -> int:
    journeys = build_test_journeys()
    distance_matrix, name_mapping = build_distance_matrix()

    pool_taxi_rides(journeys, distance_matrix, name_mapping)
    pprint(journeys)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
