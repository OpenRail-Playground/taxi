from pooling.types import CustomerJourney, TaxiPoolingStatus

__MAX_PASSENGERS_PER_TAXI__ = 3


def _find_nearest_destination_index(distances: list[float], excluded: set[int]) -> int | None:
    nearest_index = None
    nearest_distance = None

    for destination_index, distance in enumerate(distances):
        if destination_index in excluded:
            continue

        if nearest_distance is None or distance < nearest_distance:
            nearest_distance = distance
            nearest_index = destination_index

    return nearest_index


def _get_waiting_customers(customer_journeys: list[CustomerJourney], destination_name: str) -> list[int]:
    return [
        index
        for index, journey in enumerate(customer_journeys)
        if journey["status"] != TaxiPoolingStatus.SCHEDULED and journey["destination_name"] == destination_name
    ]


def _assign_to_group(customer_journeys: list[CustomerJourney], journey_index: int, group_number: int) -> None:
    customer_journeys[journey_index]["status"] = TaxiPoolingStatus.SCHEDULED
    customer_journeys[journey_index]["pool_number"] = group_number


def _fill_group_with_nearest_destinations(customer_journeys: list[CustomerJourney], distance_matrix: list[list[float]],
                                          name_mapping: list[str], anchor_destination_index: int, current_group: int,
                                          current_members_in_group: int) -> int:
    excluded_other_destinations = {anchor_destination_index}

    while current_members_in_group < __MAX_PASSENGERS_PER_TAXI__:
        nearest_other_destination_index = _find_nearest_destination_index(
            distance_matrix[anchor_destination_index], excluded_other_destinations
        )
        if nearest_other_destination_index is None:
            break

        excluded_other_destinations.add(nearest_other_destination_index)
        other_destination_name = name_mapping[nearest_other_destination_index]
        waiting_indices = _get_waiting_customers(customer_journeys, other_destination_name)

        for journey_index in waiting_indices:
            if current_members_in_group == __MAX_PASSENGERS_PER_TAXI__:
                break
            _assign_to_group(customer_journeys, journey_index, current_group)
            current_members_in_group += 1

    return current_members_in_group


def pool_taxi_rides(customer_journeys: list[CustomerJourney],
                    distance_matrix: list[list[float]], name_mapping: list[str]) -> None:
    already_checked_destinations: set[int] = set()
    current_group = 0
    total_destinations = len(distance_matrix)

    while len(already_checked_destinations) < total_destinations:
        nearest_destination_index = _find_nearest_destination_index(distance_matrix[0], already_checked_destinations)
        if nearest_destination_index is None:
            break

        already_checked_destinations.add(nearest_destination_index)
        destination_name = name_mapping[nearest_destination_index]
        waiting_customers = _get_waiting_customers(customer_journeys, destination_name)

        if not waiting_customers:
            continue

        current_group += 1
        current_members_in_group = 0

        for journey_index in waiting_customers:
            if current_members_in_group == __MAX_PASSENGERS_PER_TAXI__:
                current_group += 1
                current_members_in_group = 0

            _assign_to_group(customer_journeys, journey_index, current_group)
            current_members_in_group += 1

        if 0 < current_members_in_group < __MAX_PASSENGERS_PER_TAXI__:
            _fill_group_with_nearest_destinations(customer_journeys, distance_matrix, name_mapping,
                                                  nearest_destination_index, current_group, current_members_in_group)
