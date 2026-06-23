#!/usr/bin/env python3
from __future__ import annotations

from pathlib import Path

import pandas as pd


def load_csv_to_dataframe(csv_file: Path) -> pd.DataFrame:
    if not csv_file.exists():
        raise FileNotFoundError(f"Input file not found: {csv_file}")

    return pd.read_csv(csv_file, encoding="latin-1", sep=None, engine="python")
