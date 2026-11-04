"""Summary statistics shown in the app's About dialog."""

from __future__ import annotations

import numpy as np
import pandas as pd


def summary_stats(nights: np.ndarray, dates: pd.DatetimeIndex, cells: list[dict]) -> dict:
    """nights: (nights, cells) bool good-night flags.

    darknessCloudCorrelation: Pearson r across regions between darkest-spot SQM and the share of
        good nights. Negative = darker regions tend to be cloudier.
    clearNightShareHalves: national good-night share in the first and second half of the record,
        a quick check for drift.
    goodNightShareByMonth: national good-night share per calendar month.
    """
    sqm = np.array([c["sqm"] for c in cells])
    share = nights.mean(axis=0)
    years = sorted(set(dates.year))
    half = len(years) // 2
    halves = [years[:half], years[half:]]
    by_month = [float(nights[dates.month == m].mean()) for m in range(1, 13)]
    return {
        "darknessCloudCorrelation": round(float(np.corrcoef(sqm, share)[0, 1]), 3),
        "clearNightShareHalves": [
            {"years": h, "share": round(float(nights[np.isin(dates.year, h)].mean()), 4)} for h in halves if h
        ],
        "goodNightShareByMonth": [round(v, 4) for v in by_month],
    }
