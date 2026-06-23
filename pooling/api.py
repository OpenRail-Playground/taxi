from __future__ import annotations

import csv
import os
from io import StringIO
from pathlib import Path

from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from pooling.matrix import get_distance_matrix_and_destination_mapping
from pooling.pooling import pool_taxi_rides
from pooling.types import CustomerJourney, TaxiPoolingStatus

app = FastAPI(title="Taxi Pooling API")

WEB_DIR = Path(__file__).resolve().parent / "web"
app.mount("/static", StaticFiles(directory=WEB_DIR), name="static")

_REQUIRED_COLUMNS = {
    "id",
    "source_lat",
    "source_lon",
    "destination_name",
    "destination_lat",
    "destination_lon",
}


def _parse_customer_journeys_from_csv(content: str) -> list[CustomerJourney]:
    reader = csv.DictReader(StringIO(content), delimiter=";")
    if reader.fieldnames is None:
        raise ValueError(
            "CSV doesn't contain valid header (id, source_lat, source_lon, destination_name, destination_lat, destination_lon)")

    missing_columns = _REQUIRED_COLUMNS - set(reader.fieldnames)
    if missing_columns:
        raise ValueError(f"Missing columns: {', '.join(sorted(missing_columns))}")

    customer_journeys: list[CustomerJourney] = []
    for row_number, row in enumerate(reader, start=2):
        try:
            customer_journeys.append(
                CustomerJourney(
                    id=row["id"].strip(),
                    source_lat=float(row["source_lat"]),
                    source_lon=float(row["source_lon"]),
                    destination_name=row["destination_name"].strip(),
                    destination_lat=float(row["destination_lat"]),
                    destination_lon=float(row["destination_lon"]),
                    status=TaxiPoolingStatus.WAITING,
                    pool_number=0,
                    intermediate_stops=[],
                    deny_reason=None,
                )
            )
        except (TypeError, ValueError) as exc:
            raise ValueError(f"Invalid data in row {row_number}: {exc}") from exc

    if not customer_journeys:
        raise ValueError("CSV doesn't contain any customer journeys")

    return customer_journeys


def _get_source_coordinates(customer_journeys: list[CustomerJourney]) -> tuple[float, float]:
    first_source = (customer_journeys[0]["source_lon"], customer_journeys[0]["source_lat"])

    if any(
            (journey["source_lon"], journey["source_lat"]) != first_source
            for journey in customer_journeys
    ):
        raise ValueError("All customer journeys must have the same source coordinates")

    return first_source


@app.api_route("/", methods=["GET", "HEAD"], include_in_schema=False)
async def index() -> FileResponse:
    return FileResponse(WEB_DIR / "index.html")


@app.post("/pool-taxis")
async def pool_taxis(file: UploadFile = File(...)) -> list[CustomerJourney]:
    try:
        content = (await file.read()).decode("utf-8-sig")
        customer_journeys = _parse_customer_journeys_from_csv(content)
        source_lon, source_lat = _get_source_coordinates(customer_journeys)
    except UnicodeDecodeError as exc:
        raise HTTPException(status_code=400, detail="CSV muss UTF-8 codiert sein") from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    try:
        distance_matrix, name_mapping = get_distance_matrix_and_destination_mapping(
            source_lon=source_lon,
            source_lat=source_lat,
            customer_journeys=customer_journeys,
            api_token=os.getenv("ORS_API_TOKEN", ""),
        )
    except Exception as exc:  # requests-Ausnahmen und API-Fehler als 502 durchreichen
        raise HTTPException(status_code=502, detail=f"Couldn't calculate distance matrix: {exc}") from exc

    pool_taxi_rides(customer_journeys, distance_matrix, name_mapping)
    return customer_journeys
