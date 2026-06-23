from pooling.types import CustomerJourney, TaxiPoolingStatus

__MAX_PASSENGERS_PER_TAXI__ = 3
__MAX_ROUTE_DISTANCE_KM__ = 150.0
__MAX_POOL_DISTANCE_PER_PERSON_KM__ = 50.0


def _get_destination_distances(distance_matrix: list[list[float]], destination_index: int) -> list[float]:
    return distance_matrix[destination_index + 1]


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
        if journey["status"] not in {TaxiPoolingStatus.SCHEDULED, TaxiPoolingStatus.DENIED}
        and journey["destination_name"] == destination_name
    ]


def _assign_to_group(customer_journeys: list[CustomerJourney], journey_index: int, group_number: int) -> None:
    customer_journeys[journey_index]["status"] = TaxiPoolingStatus.SCHEDULED
    customer_journeys[journey_index]["pool_number"] = group_number


def _deny_destination(customer_journeys: list[CustomerJourney], destination_name: str) -> None:
    for journey in customer_journeys:
        if journey["destination_name"] != destination_name:
            continue

        if journey["status"] == TaxiPoolingStatus.SCHEDULED:
            continue

        journey["status"] = TaxiPoolingStatus.DENIED
        journey["pool_number"] = 0


def _deny_group(customer_journeys: list[CustomerJourney], journey_indices: list[int]) -> None:
    for journey_index in journey_indices:
        customer_journeys[journey_index]["status"] = TaxiPoolingStatus.DENIED
        customer_journeys[journey_index]["pool_number"] = 0


def _append_destination_to_route_if_needed(route_destination_indices: list[int], destination_index: int) -> None:
    if route_destination_indices and route_destination_indices[-1] == destination_index:
        return

    route_destination_indices.append(destination_index)


def _calculate_pool_route_distance_km(
    distance_matrix: list[list[float]],
    route_destination_indices: list[int],
) -> float:
    if not route_destination_indices:
        return 0.0

    total_distance_km = distance_matrix[0][route_destination_indices[0]]

    for previous_destination_index, next_destination_index in zip(
        route_destination_indices,
        route_destination_indices[1:],
    ):
        total_distance_km += _get_destination_distances(distance_matrix, previous_destination_index)[next_destination_index]

    return total_distance_km


def _deny_group_if_pool_distance_exceeds_limit(
    customer_journeys: list[CustomerJourney],
    journey_indices: list[int],
    distance_matrix: list[list[float]],
    route_destination_indices: list[int],
) -> None:
    if not journey_indices:
        return

    total_pool_distance_km = _calculate_pool_route_distance_km(distance_matrix, route_destination_indices)
    num_passengers = len(journey_indices)
    max_pool_distance_km = __MAX_POOL_DISTANCE_PER_PERSON_KM__ * num_passengers

    if total_pool_distance_km > max_pool_distance_km:
        _deny_group(customer_journeys, journey_indices)


def _deny_routes_exceeding_max_distance(
    customer_journeys: list[CustomerJourney],
    distance_matrix: list[list[float]],
    name_mapping: list[str],
) -> None:
    for destination_index, destination_name in enumerate(name_mapping):
        source_distance_km = distance_matrix[0][destination_index]
        if source_distance_km > __MAX_ROUTE_DISTANCE_KM__:
            _deny_destination(customer_journeys, destination_name)


def _fill_group_with_nearest_destinations(customer_journeys: list[CustomerJourney], distance_matrix: list[list[float]],
                                          name_mapping: list[str], anchor_destination_index: int, current_group: int,
                                          current_members_in_group: int, group_journey_indices: list[int],
                                          route_destination_indices: list[int]) -> None:
    excluded_other_destinations = {anchor_destination_index}
    anchor_distances = _get_destination_distances(distance_matrix, anchor_destination_index)

    while current_members_in_group < __MAX_PASSENGERS_PER_TAXI__:
        nearest_other_destination_index = _find_nearest_destination_index(anchor_distances, excluded_other_destinations)
        if nearest_other_destination_index is None:
            break

        excluded_other_destinations.add(nearest_other_destination_index)
        other_destination_name = name_mapping[nearest_other_destination_index]
        waiting_indices = _get_waiting_customers(customer_journeys, other_destination_name)

        for journey_index in waiting_indices:
            if current_members_in_group == __MAX_PASSENGERS_PER_TAXI__:
                break
            _assign_to_group(customer_journeys, journey_index, current_group)
            group_journey_indices.append(journey_index)
            _append_destination_to_route_if_needed(route_destination_indices, nearest_other_destination_index)
            current_members_in_group += 1




def pool_taxi_rides(customer_journeys: list[CustomerJourney],
                    distance_matrix: list[list[float]], name_mapping: list[str]) -> None:
    _deny_routes_exceeding_max_distance(customer_journeys, distance_matrix, name_mapping)

    already_checked_destinations: set[int] = set()
    current_group = 0
    total_destinations = len(name_mapping)

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
        current_group_journey_indices: list[int] = []
        current_route_destination_indices: list[int] = []

        for journey_index in waiting_customers:
            if current_members_in_group == __MAX_PASSENGERS_PER_TAXI__:
                _deny_group_if_pool_distance_exceeds_limit(
                    customer_journeys,
                    current_group_journey_indices,
                    distance_matrix,
                    current_route_destination_indices,
                )
                current_group += 1
                current_members_in_group = 0
                current_group_journey_indices = []
                current_route_destination_indices = []

            _assign_to_group(customer_journeys, journey_index, current_group)
            current_group_journey_indices.append(journey_index)
            _append_destination_to_route_if_needed(current_route_destination_indices, nearest_destination_index)
            current_members_in_group += 1

        if 0 < current_members_in_group < __MAX_PASSENGERS_PER_TAXI__:
            _fill_group_with_nearest_destinations(
                customer_journeys,
                distance_matrix,
                name_mapping,
                nearest_destination_index,
                current_group,
                current_members_in_group,
                current_group_journey_indices,
                current_route_destination_indices,
            )

        _deny_group_if_pool_distance_exceeds_limit(
            customer_journeys,
            current_group_journey_indices,
            distance_matrix,
            current_route_destination_indices,
        )
