import requests

from pooling.types import CustomerJourney

ORS_MATRIX_URL = "https://api.openrouteservice.org/v2/matrix/driving-car"


def get_distance_matrix_and_destination_mapping(source_lon: float, source_lat: float,
                                                customer_journeys: list[CustomerJourney],
                                                api_token: str) -> list[list[float]]:
    destination_coordinates = set()
    destination_names = set()
    for journey in customer_journeys:
        coordinates = [journey["destination_lon"], journey["destination_lat"]]
        if destination_coordinates in destination_names:
            continue

        destination_coordinates.add(coordinates)
        destination_names.add(journey["destination_name"])

    locations = [[source_lon, source_lat] + [coordinates] for coordinates in destination_coordinates]

    headers = {
        "Authorization": f"Bearer {api_token}",
        "Content-Type": "application/json",
    }

    body = {
        "locations": locations,
        "metrics": ["distance"],
    }

    response = requests.post(ORS_MATRIX_URL, json=body, headers=headers)
    response.raise_for_status()

    data = response.json()
    return data["distances"]
