import requests
import pandas as pd

from pooling.types import CustomerJourney

ORS_MATRIX_URL = "https://api.openrouteservice.org/v2/matrix/driving-car"


def get_distance_matrix_and_destination_mapping(source_lon: float, source_lat: float,
                                                customer_journeys: list[CustomerJourney],
                                                api_token: str) -> pd.DataFrame:
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

    response = requests.post(ORS_MATRIX_URL, json=body, headers=headers)
    response.raise_for_status()

    data = response.json()
    distances = data["distances"]

    destination_names_df = pd.DataFrame(columns=destination_names)

    for row_index, row_values in enumerate(distances):
        if row_index >= len(destination_names):
            break
        destination_names_df.loc[destination_names[row_index]] = row_values

    return destination_names_df
