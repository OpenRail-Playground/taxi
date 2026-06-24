from pooling.types import CustomerJourney, TaxiPoolingDenyReason, TaxiPoolingStatus

__MAX_PASSENGERS_PER_TAXI__ = 4
__MAX_POOL_DISTANCE_PER_PERSON_KM__ = 50.0
__MAX_ROUTE_DISTANCE_KM__ = __MAX_POOL_DISTANCE_PER_PERSON_KM__ * __MAX_PASSENGERS_PER_TAXI__
__MAX_DETOUR_FACTOR__ = 1.5


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


def _find_nearest_waiting_destination_index(
        customer_journeys: list[CustomerJourney],
        distance_matrix: list[list[float]],
        name_mapping: list[str],
) -> int | None:
    waiting_destination_indices = {
        destination_index
        for destination_index, destination_name in enumerate(name_mapping)
        if _get_waiting_customers(customer_journeys, destination_name)
    }
    if not waiting_destination_indices:
        return None

    excluded_destination_indices = {
        destination_index
        for destination_index in range(len(name_mapping))
        if destination_index not in waiting_destination_indices
    }
    return _find_nearest_destination_index(distance_matrix[0], excluded_destination_indices)


def _assign_to_group(customer_journeys: list[CustomerJourney], journey_index: int, group_number: int) -> None:
    customer_journeys[journey_index]["status"] = TaxiPoolingStatus.SCHEDULED
    customer_journeys[journey_index]["pool_number"] = group_number
    customer_journeys[journey_index]["intermediate_stops"] = []
    customer_journeys[journey_index]["travel_distance_km"] = None
    customer_journeys[journey_index]["deny_reason"] = None


def _deny_destination(customer_journeys: list[CustomerJourney], destination_name: str) -> None:
    for journey in customer_journeys:
        if journey["destination_name"] != destination_name:
            continue

        if journey["status"] == TaxiPoolingStatus.SCHEDULED:
            continue

        journey["status"] = TaxiPoolingStatus.DENIED
        journey["pool_number"] = 0
        journey["intermediate_stops"] = []
        journey["travel_distance_km"] = None
        journey["deny_reason"] = TaxiPoolingDenyReason.MAX_ROUTE_DISTANCE_EXCEEDED


def _deny_group(
        customer_journeys: list[CustomerJourney],
        journey_indices: list[int],
        reason: TaxiPoolingDenyReason,
) -> None:
    for journey_index in journey_indices:
        customer_journeys[journey_index]["status"] = TaxiPoolingStatus.DENIED
        customer_journeys[journey_index]["pool_number"] = 0
        customer_journeys[journey_index]["intermediate_stops"] = []
        customer_journeys[journey_index]["travel_distance_km"] = None
        customer_journeys[journey_index]["deny_reason"] = reason


def _reset_group_to_waiting(customer_journeys: list[CustomerJourney], journey_indices: list[int]) -> None:
    for journey_index in journey_indices:
        customer_journeys[journey_index]["status"] = TaxiPoolingStatus.WAITING
        customer_journeys[journey_index]["pool_number"] = 0
        customer_journeys[journey_index]["intermediate_stops"] = []
        customer_journeys[journey_index]["travel_distance_km"] = None
        customer_journeys[journey_index]["deny_reason"] = None


def _renumber_scheduled_groups_contiguously(customer_journeys: list[CustomerJourney]) -> None:
    old_to_new_group: dict[int, int] = {}
    next_group_number = 1

    for journey in customer_journeys:
        if journey["status"] != TaxiPoolingStatus.SCHEDULED:
            continue

        old_group = journey["pool_number"]
        if old_group <= 0:
            continue

        if old_group not in old_to_new_group:
            old_to_new_group[old_group] = next_group_number
            next_group_number += 1

        journey["pool_number"] = old_to_new_group[old_group]


def _update_group_intermediate_stops(
        customer_journeys: list[CustomerJourney],
        journey_indices: list[int],
        route_destination_indices: list[int],
        name_mapping: list[str],
) -> None:
    route_destination_names = [name_mapping[destination_index] for destination_index in route_destination_indices]
    first_position_by_destination: dict[str, int] = {}

    for position, destination_name in enumerate(route_destination_names):
        if destination_name not in first_position_by_destination:
            first_position_by_destination[destination_name] = position

    for journey_index in journey_indices:
        destination_name = customer_journeys[journey_index]["destination_name"]
        destination_position = first_position_by_destination.get(destination_name)
        if destination_position is None:
            customer_journeys[journey_index]["intermediate_stops"] = []
            continue

        customer_journeys[journey_index]["intermediate_stops"] = route_destination_names[:destination_position]


def _get_cumulative_distance_by_destination(
        distance_matrix: list[list[float]],
        route_destination_indices: list[int],
        name_mapping: list[str],
) -> dict[str, float]:
    if not route_destination_indices:
        return {}

    cumulative_distance_by_destination: dict[str, float] = {}
    cumulative_distance_km = distance_matrix[0][route_destination_indices[0]]
    first_destination_name = name_mapping[route_destination_indices[0]]
    cumulative_distance_by_destination[first_destination_name] = cumulative_distance_km

    for previous_destination_index, next_destination_index in zip(
            route_destination_indices,
            route_destination_indices[1:],
    ):
        cumulative_distance_km += _get_destination_distances(distance_matrix, previous_destination_index)[
            next_destination_index]
        destination_name = name_mapping[next_destination_index]
        if destination_name not in cumulative_distance_by_destination:
            cumulative_distance_by_destination[destination_name] = cumulative_distance_km

    return cumulative_distance_by_destination


def _get_active_route_destination_indices(
        customer_journeys: list[CustomerJourney],
        journey_indices: list[int],
        route_destination_indices: list[int],
        name_mapping: list[str],
) -> list[int]:
    active_destination_names: set[str] = set()
    for journey_index in journey_indices:
        if customer_journeys[journey_index]["status"] != TaxiPoolingStatus.SCHEDULED:
            continue
        destination_name = customer_journeys[journey_index]["destination_name"]
        active_destination_names.add(destination_name)

    return [
        destination_index
        for destination_index in route_destination_indices
        if name_mapping[destination_index] in active_destination_names
    ]


def _get_detour_exceeding_journey_indices(
        customer_journeys: list[CustomerJourney],
        journey_indices: list[int],
        distance_matrix: list[list[float]],
        route_destination_indices: list[int],
        name_mapping: list[str],
) -> list[int]:
    cumulative_distance_by_destination = _get_cumulative_distance_by_destination(
        distance_matrix,
        route_destination_indices,
        name_mapping,
    )
    destination_index_by_name = {
        destination_name: destination_index
        for destination_index, destination_name in enumerate(name_mapping)
    }
    exceeding_journey_indices: list[int] = []

    for journey_index in journey_indices:
        journey = customer_journeys[journey_index]
        if journey["status"] != TaxiPoolingStatus.SCHEDULED:
            continue

        destination_name = journey["destination_name"]
        direct_distance_km = distance_matrix[0][destination_index_by_name[destination_name]]
        actual_distance_km = cumulative_distance_by_destination.get(destination_name)
        if actual_distance_km is None:
            continue

        max_allowed_distance_km = direct_distance_km * __MAX_DETOUR_FACTOR__
        if actual_distance_km > max_allowed_distance_km:
            exceeding_journey_indices.append(journey_index)

    return exceeding_journey_indices


def _update_group_travel_distances(
        customer_journeys: list[CustomerJourney],
        journey_indices: list[int],
        distance_matrix: list[list[float]],
        route_destination_indices: list[int],
        name_mapping: list[str],
) -> None:
    if not journey_indices or not route_destination_indices:
        return

    cumulative_distance_by_destination = _get_cumulative_distance_by_destination(
        distance_matrix,
        route_destination_indices,
        name_mapping,
    )

    for journey_index in journey_indices:
        if customer_journeys[journey_index]["status"] != TaxiPoolingStatus.SCHEDULED:
            customer_journeys[journey_index]["travel_distance_km"] = None
            continue

        destination_name = customer_journeys[journey_index]["destination_name"]
        customer_journeys[journey_index]["travel_distance_km"] = cumulative_distance_by_destination.get(
            destination_name)


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
        total_distance_km += _get_destination_distances(distance_matrix, previous_destination_index)[
            next_destination_index]

    return total_distance_km


def _deny_group_if_pool_distance_exceeds_limit(
        customer_journeys: list[CustomerJourney],
        journey_indices: list[int],
        distance_matrix: list[list[float]],
        route_destination_indices: list[int],
        denied_journey_indices: list[int] | None = None,
) -> None:
    if not journey_indices:
        return

    total_pool_distance_km = _calculate_pool_route_distance_km(distance_matrix, route_destination_indices)
    num_passengers = len(journey_indices)
    max_pool_distance_km = __MAX_POOL_DISTANCE_PER_PERSON_KM__ * num_passengers

    if total_pool_distance_km > max_pool_distance_km:
        denied_indices = journey_indices if denied_journey_indices is None else denied_journey_indices
        _deny_group(customer_journeys, denied_indices, TaxiPoolingDenyReason.POOL_DISTANCE_EXCEEDED)

        denied_index_set = set(denied_indices)
        rescheduled_indices = [
            journey_index for journey_index in journey_indices if journey_index not in denied_index_set
        ]
        _reset_group_to_waiting(customer_journeys, rescheduled_indices)


def _finalize_group(
        customer_journeys: list[CustomerJourney],
        group_journey_indices: list[int],
        current_destination_journey_indices: list[int],
        distance_matrix: list[list[float]],
        route_destination_indices: list[int],
        name_mapping: list[str],
) -> None:
    while group_journey_indices:
        active_route_destination_indices = _get_active_route_destination_indices(
            customer_journeys,
            group_journey_indices,
            route_destination_indices,
            name_mapping,
        )
        if not active_route_destination_indices:
            return

        _update_group_intermediate_stops(
            customer_journeys,
            group_journey_indices,
            active_route_destination_indices,
            name_mapping,
        )

        detour_exceeding_journey_indices = _get_detour_exceeding_journey_indices(
            customer_journeys,
            group_journey_indices,
            distance_matrix,
            active_route_destination_indices,
            name_mapping,
        )
        if detour_exceeding_journey_indices:
            _reset_group_to_waiting(customer_journeys, detour_exceeding_journey_indices)
            detour_exceeding_index_set = set(detour_exceeding_journey_indices)
            group_journey_indices[:] = [
                journey_index
                for journey_index in group_journey_indices
                if journey_index not in detour_exceeding_index_set
            ]
            current_destination_journey_indices[:] = [
                journey_index
                for journey_index in current_destination_journey_indices
                if journey_index not in detour_exceeding_index_set
            ]
            continue

        _deny_group_if_pool_distance_exceeds_limit(
            customer_journeys,
            group_journey_indices,
            distance_matrix,
            active_route_destination_indices,
            current_destination_journey_indices,
        )

        _update_group_travel_distances(
            customer_journeys,
            group_journey_indices,
            distance_matrix,
            active_route_destination_indices,
            name_mapping,
        )
        return


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

    current_group = 0

    while True:
        nearest_destination_index = _find_nearest_waiting_destination_index(
            customer_journeys,
            distance_matrix,
            name_mapping,
        )
        if nearest_destination_index is None:
            break

        destination_name = name_mapping[nearest_destination_index]
        waiting_customers = _get_waiting_customers(customer_journeys, destination_name)

        if not waiting_customers:
            continue

        current_members_in_group = 0
        current_group_journey_indices: list[int] = []
        current_destination_journey_indices: list[int] = []
        current_route_destination_indices: list[int] = []

        for journey_index in waiting_customers:
            if current_members_in_group == __MAX_PASSENGERS_PER_TAXI__:
                _finalize_group(
                    customer_journeys,
                    current_group_journey_indices,
                    current_destination_journey_indices,
                    distance_matrix,
                    current_route_destination_indices,
                    name_mapping,
                )
                current_members_in_group = 0
                current_group_journey_indices = []
                current_destination_journey_indices = []
                current_route_destination_indices = []

            if current_members_in_group == 0:
                current_group += 1

            _assign_to_group(customer_journeys, journey_index, current_group)
            current_group_journey_indices.append(journey_index)
            current_destination_journey_indices.append(journey_index)
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

        _finalize_group(
            customer_journeys,
            current_group_journey_indices,
            current_destination_journey_indices,
            distance_matrix,
            current_route_destination_indices,
            name_mapping,
        )

    _renumber_scheduled_groups_contiguously(customer_journeys)
