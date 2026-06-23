from types import CustomerJourney, TaxiPoolingStatus

__MAX_PASSENGERS_PER_TAXI__ = 3

def pool_taxi_rides(customer_journeys: list[CustomerJourney],
                    distance_matrix: list[list[float]], name_mapping: list[str]) -> CustomerJourney:
    already_checked_destinations = []
    smallest_distance = None
    smallest_distance_i = -1
    current_group = 0
    while True:
        current_group += 1
        current_members_in_group = 0

        for destination_i in range(0, len(distance_matrix[0])):
            if len(already_checked_destinations) == len(distance_matrix):
                break

            if not smallest_distance or distance_matrix[0][destination_i] < smallest_distance:
                if destination_i not in already_checked_destinations:
                    smallest_distance = distance_matrix[0][destination_i]
                    already_checked_destinations.append(destination_i)
                    smallest_distance_i = destination_i

            passenger_amount_to_destination = sum(1 for journey in customer_journeys if journey["destination_name"] == name_mapping[smallest_distance_i])

            for journeys_i in range(0, len(customer_journeys)):
                if name_mapping[smallest_distance_i] != customer_journeys[journeys_i]["destination_name"]:
                    continue

                if passenger_amount_to_destination > __MAX_PASSENGERS_PER_TAXI__:
                    if current_members_in_group == __MAX_PASSENGERS_PER_TAXI__:
                        current_group += 1
                        current_members_in_group = 0

                    customer_journeys[journeys_i]["status"] = TaxiPoolingStatus.SCHEDULED
                    customer_journeys[journeys_i]["pool_number"] = current_group
                    current_members_in_group += 1
                    continue

                if passenger_amount_to_destination == 0:
                    continue


                destinations_without_waiting_customers = []
                while True:
                    if current_members_in_group == 0:
                        break

                    already_checked_other_destinations = [smallest_distance_i]
                    smallest_other_distance = None
                    smallest_other_distance_i = -1
                    for other_destination_i in range(0, len(distance_matrix[smallest_distance_i])):
                        if other_destination_i not in already_checked_other_destinations and distance_matrix[smallest_distance_i][other_destination_i] < smallest_other_distance and other_destination_i not in destinations_without_waiting_customers:
                            already_checked_other_destinations.append(other_destination_i)
                            smallest_other_distance = distance_matrix[smallest_distance_i][other_destination_i]
                            smallest_other_distance_i = other_destination_i

                    for journeys_j in range(0, len(customer_journeys)):
                        if name_mapping[smallest_other_distance_i] != customer_journeys[journeys_j]["destination_name"]:
                            continue

                        if current_members_in_group == __MAX_PASSENGERS_PER_TAXI__:
                            current_group += 1
                            current_members_in_group = 0
                            break
                        customer_journeys[journeys_j]["pool_number"] = current_group
                        customer_journeys[journeys_i]["pool_number"] = current_group
                        current_members_in_group += 1
