import requests
import pandas as pd

from pooling_types import CustomerJourney

ORS_MATRIX_URL = "https://api.openrouteservice.org/v2/matrix/driving-car"


def get_distance_matrix_and_destination_mapping(
    source_lon: float,
    source_lat: float,
    customer_journeys: list[CustomerJourney],
    api_token: str,
) -> list[list[float]]:
    destination_coordinates = []
    destination_names = ["Bielefeld"]
    destination_name_set = {"Bielefeld"}
    for journey in customer_journeys:
        coordinates = (journey["destination_lon"], journey["destination_lat"])
        if journey["destination_name"] in destination_name_set:
            continue

        destination_coordinates.append(coordinates)
        destination_names.append(journey["destination_name"])
        destination_name_set.add(journey["destination_name"])

    locations = [[source_lon, source_lat]] + [
        [destination_lon, destination_lat]
        for destination_lon, destination_lat in destination_coordinates
    ]

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

    # print(destination_names_df)

    return destination_names_df
