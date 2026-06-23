import requests

from pooling.types import CustomerJourney

ORS_MATRIX_URL = "https://api.openrouteservice.org/v2/matrix/driving-car"


def get_distance_matrix(origin_lon: float, origin_lat: float, customer_journeys: set[CustomerJourney],
                        api_token: str) -> list[list[float]]:
    locations = [[origin_lon, origin_lat]] + [[journey["destination_lon"], journey["destination_lat"]] for journey in
                                              customer_journeys]

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
