from pooling.types import CustomerJourney, TaxiPoolingStatus

__MAX_PASSENGERS_PER_TAXI__ = 3

def pool_taxi_rides(customer_journeys: list[CustomerJourney],
                    distance_matrix: list[list[float]], name_mapping: list[str]) -> CustomerJourney:
    already_checked_destinations = []
    current_group = 0
    done = False
    while True:
        if done:
            break
        current_group += 1
        current_members_in_group = 0
        smallest_distance = None

        for destination_i in range(0, len(distance_matrix[0])):
            if len(already_checked_destinations) == len(distance_matrix):
                done = True
                break


            if destination_i not in already_checked_destinations and (not smallest_distance or distance_matrix[0][destination_i] < smallest_distance):
                smallest_distance = distance_matrix[0][destination_i]
                already_checked_destinations.append(destination_i)
                smallest_distance_i = destination_i
            else:
                continue


            passenger_amount_to_destination = sum(1 for journey in customer_journeys if journey["destination_name"] == name_mapping[smallest_distance_i] and journey["status"] != TaxiPoolingStatus.SCHEDULED)

            for journeys_i in range(0, len(customer_journeys)):
                if customer_journeys[journeys_i]["status"] == TaxiPoolingStatus.SCHEDULED:
                    continue

                if name_mapping[smallest_distance_i] != customer_journeys[journeys_i]["destination_name"]:
                    continue

                if current_members_in_group == __MAX_PASSENGERS_PER_TAXI__:
                    current_group += 1
                    current_members_in_group = 0

                customer_journeys[journeys_i]["status"] = TaxiPoolingStatus.SCHEDULED
                customer_journeys[journeys_i]["pool_number"] = current_group
                current_members_in_group += 1
                passenger_amount_to_destination -= 1

                if passenger_amount_to_destination == 0 and current_members_in_group == 0:
                    break

                destinations_without_waiting_customers = []
                already_checked_other_destinations = [smallest_distance_i]
                if passenger_amount_to_destination == 0 and current_members_in_group > 0:
                    while True:
                        if current_members_in_group == 3:
                            break

                        smallest_other_distance = None
                        smallest_other_distance_i = -1
                        for other_destination_i in range(0, len(distance_matrix[smallest_distance_i])):
                            if other_destination_i not in already_checked_other_destinations and (smallest_other_distance is None or distance_matrix[smallest_distance_i][other_destination_i] < smallest_other_distance) and other_destination_i not in destinations_without_waiting_customers:
                                already_checked_other_destinations.append(other_destination_i)
                                smallest_other_distance = distance_matrix[smallest_distance_i][other_destination_i]
                                smallest_other_distance_i = other_destination_i
                            else:
                                continue

                        if smallest_other_distance is None:
                            break

                        for journeys_j in range(0, len(customer_journeys)):
                            if name_mapping[smallest_other_distance_i] != customer_journeys[journeys_j]["destination_name"]:
                                continue

                            if customer_journeys[journeys_j]["status"] == TaxiPoolingStatus.SCHEDULED:
                                continue

                            if current_members_in_group == __MAX_PASSENGERS_PER_TAXI__:
                                break
                            customer_journeys[journeys_j]["status"] = TaxiPoolingStatus.SCHEDULED
                            customer_journeys[journeys_j]["pool_number"] = current_group
                            current_members_in_group += 1
                            passenger_amount_to_destination -= 1
