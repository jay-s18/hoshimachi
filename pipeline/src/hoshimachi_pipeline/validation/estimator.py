"""The odds estimator under test, and the baselines it is compared with.

Replay estimator (what the app does): for a trip starting on calendar date (m, d), pool every
training-year trip that started within +/- `window` days of (m, d); the raw odds are the share
that had at least one good night. Then shrink toward adjacent cells:

    p = (1 - blend) * p_raw(cell) + blend * mean(p_raw over adjacent land cells)
"""

from __future__ import annotations

import numpy as np
import pandas as pd


class CalendarIndex:
    """Maps (year, month, day) to a row of the nightly arrays. 29 Feb in non-leap years -> 28 Feb."""

    def __init__(self, dates: pd.DatetimeIndex):
        self.pos = {d: i for i, d in enumerate(dates)}

    def __call__(self, year: int, month: int, day: int) -> int | None:
        if month == 2 and day == 29 and not (year % 4 == 0 and (year % 100 != 0 or year % 400 == 0)):
            day = 28
        return self.pos.get(pd.Timestamp(year, month, day))


def replay_rows(
    cal: CalendarIndex, train_years: list[int], month: int, day: int, window: int, n_rows: int
) -> np.ndarray:
    rows = []
    for y in train_years:
        base = cal(y, month, day)
        if base is None:
            continue
        rows += [base + s for s in range(-window, window + 1)]
    rows = np.array(rows)
    return rows[(rows >= 0) & (rows < n_rows)]


def replay_predict(
    trips: np.ndarray,
    dates: pd.DatetimeIndex,
    cal: CalendarIndex,
    train_years: list[int],
    target: pd.Timestamp,
    window: int,
    blend: float,
    A: np.ndarray,
    k: int = 1,
) -> np.ndarray:
    """Predicted odds for every cell for a trip starting on `target`.

    trips : (starts, cells) bool, good-trip flags for each historical start date.
    Only historical trips that start AND end in a training year are used, so nothing from a held-out
    year leaks in, even when a +/- window or a multi-night trip crosses New Year.
    """
    rows = replay_rows(cal, train_years, target.month, target.day, window, trips.shape[0])
    rows = rows[np.isin(dates[rows].year, train_years) & np.isin(dates[rows + k - 1].year, train_years)]
    raw = trips[rows].mean(0)
    return raw if blend == 0 else (1 - blend) * raw + blend * (A @ raw)


# ---- Baselines -------------------------------------------------------------------------------


def _train_mask(trips, dates, train_years, k):
    n = trips.shape[0]
    return np.isin(dates[:n].year, train_years) & np.isin(dates[k - 1 : n + k - 1].year, train_years)


def baseline_region_all_year(trips, dates, train_years, k=1):
    """Same region, ignoring the season: the cell's training-period success rate."""
    m = _train_mask(trips, dates, train_years, k)
    return trips[m].mean(0)


def baseline_national_month(trips, dates, train_years, k=1):
    """Season only, ignoring the region: national mean for that calendar month. -> (12,)"""
    d = dates[: trips.shape[0]]
    m = _train_mask(trips, dates, train_years, k)
    return np.array([trips[m & (d.month == mo)].mean() for mo in range(1, 13)])


def baseline_region_month(trips, dates, train_years, k=1):
    """Region and calendar month (no sliding window, no shrinkage). -> (12, cells)"""
    d = dates[: trips.shape[0]]
    m = _train_mask(trips, dates, train_years, k)
    return np.stack([trips[m & (d.month == mo)].mean(0) for mo in range(1, 13)])


def neighbour_matrix(rc: np.ndarray) -> np.ndarray:
    """Row-normalised averaging matrix over the up-to-8 adjacent cells.

    rc : (cells, 2) grid row/column of each cell, in the same order as the other arrays.
    Matches neighbours() in app/js/data.js. An isolated cell averages itself.
    """
    index = {(int(r), int(c)): i for i, (r, c) in enumerate(rc)}
    A = np.zeros((len(rc), len(rc)))
    for i, (r, c) in enumerate(rc):
        for dr in (-1, 0, 1):
            for dc in (-1, 0, 1):
                j = index.get((int(r) + dr, int(c) + dc))
                if (dr or dc) and j is not None:
                    A[i, j] = 1.0
        s = A[i].sum()
        if s:
            A[i] /= s
        else:
            A[i, i] = 1.0
    return A
