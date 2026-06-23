from __future__ import annotations

import requests

from pooling.types import CustomerJourney

ORS_MATRIX_URL = "https://api.openrouteservice.org/v2/matrix/driving-car"
REQUEST_TIMEOUT_SECONDS = 30


def get_distance_matrix_and_destination_mapping(source_lon: float, source_lat: float,
                                                customer_journeys: list[CustomerJourney],
                                                api_token: str) -> tuple[list[list[float]], list[str]]:
    if not api_token.strip():
        raise ValueError("ORS_API_TOKEN is not configured")

    destination_coordinates_by_name: dict[str, list[float]] = {}
    for journey in customer_journeys:
        destination_name = journey["destination_name"]
        if destination_name in destination_coordinates_by_name:
            continue

        destination_coordinates_by_name[destination_name] = [
            journey["destination_lon"],
            journey["destination_lat"],
        ]

    destination_names = list(destination_coordinates_by_name.keys())
    destination_coordinates = [destination_coordinates_by_name[name] for name in destination_names]

    locations = [[source_lon, source_lat], *destination_coordinates]

    headers = {
        "Authorization": f"Bearer {api_token}",
        "Content-Type": "application/json",
    }

    body = {
        "locations": locations,
        "metrics": ["distance"],
    }

    response = requests.post(ORS_MATRIX_URL, json=body, headers=headers, timeout=REQUEST_TIMEOUT_SECONDS)
    response.raise_for_status()

    data = response.json()
    distances = data.get("distances")
    if not isinstance(distances, list) or len(distances) != len(destination_names) + 1:
        raise ValueError("Invalid distance matrix returned by OpenRouteService")

    distance_matrix_km: list[list[float]] = []
    for row in distances:
        if not isinstance(row, list) or len(row) != len(destination_names) + 1:
            raise ValueError("Invalid distance matrix row returned by OpenRouteService")

        distance_matrix_km.append([float(distance_in_meters) / 1000 for distance_in_meters in row[1:]])

    return distance_matrix_km, destination_names
