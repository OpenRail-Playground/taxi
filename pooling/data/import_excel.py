#!/usr/bin/env python3
from __future__ import annotations

import argparse
from pathlib import Path

import pandas as pd


def load_csv_to_dataframe(csv_file: Path) -> pd.DataFrame:
    if not csv_file.exists():
        raise FileNotFoundError(f"Input file not found: {csv_file}")

    return pd.read_csv(csv_file, encoding="latin-1", sep=None, engine="python")


def _parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Load a CSV file into a DataFrame.")
    parser.add_argument(
        "--csv-file",
        dest="csv_file",
        type=Path,
        required=True,
        help="Path to the .csv file",
    )
    return parser.parse_args()


def main() -> int:
    args = _parse_args()
    dataframe = load_csv_to_dataframe(args.csv_file.resolve())
    print(f"Loaded DataFrame with shape: {dataframe.shape}")
    print(dataframe.head())
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
