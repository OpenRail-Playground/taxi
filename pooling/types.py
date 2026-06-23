from enum import StrEnum
from typing import TypedDict


class TaxiPoolingStatus(StrEnum):
    WAITING = "WAITING"
    CURRENTLY_POOLING = "CURRENTLY_POOLING"
    SCHEDULED = "SCHEDULED"
    DENIED = "DENIED"
    STILL_WAITING = "STILL_WAITING"


class TaxiPoolingDenyReason(StrEnum):
    MAX_ROUTE_DISTANCE_EXCEEDED = "MAX_ROUTE_DISTANCE_EXCEEDED"
    POOL_DISTANCE_EXCEEDED = "POOL_DISTANCE_EXCEEDED"


class CustomerJourney(TypedDict):
    id: str
    source_lat: float
    source_lon: float
    destination_name: str
    destination_lat: float
    destination_lon: float
    status: TaxiPoolingStatus
    pool_number: int
    intermediate_stops: list[str]
    deny_reason: TaxiPoolingDenyReason | None
