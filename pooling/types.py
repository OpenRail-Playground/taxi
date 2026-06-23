from enum import StrEnum
from typing import TypedDict


class TaxiPoolingStatus(StrEnum):
    WAITING = "WAITING"
    CURRENTLY_POOLING = "CURRENTLY_POOLING"
    SCHEDULED = "SCHEDULED"
    DENIED = "DENIED"


class CustomerJourney(TypedDict):
    id: str
    source_lat: float
    source_lon: float
    destination_name: str
    destination_lat: float
    destination_lon: float
    status: TaxiPoolingStatus
