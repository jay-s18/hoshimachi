"""Good nights: clear hours that are also astronomically dark.

Sun altitude uses the NOAA low-precision solar position (accurate to a few arc-minutes). The moon is
not part of validation: it is known exactly for any date, so it does not need predicting from history.
"""

from __future__ import annotations

import numpy as np
import pandas as pd


def decode_bits(masks: np.ndarray, hours: int) -> np.ndarray:
    """(...) uint16 -> (..., hours) bool: clear flag for each hour of the night."""
    return ((masks[..., None] >> np.arange(hours)) & 1).astype(bool)


def sun_altitude(t_utc: pd.DatetimeIndex, lat: np.ndarray, lon: np.ndarray) -> np.ndarray:
    """Altitude in degrees for every time (axis 0) x location (remaining axes)."""
    doy = t_utc.dayofyear.values.reshape(-1, *([1] * lat.ndim))
    hour = (t_utc.hour.values + t_utc.minute.values / 60).reshape(-1, *([1] * lat.ndim))
    g = 2 * np.pi / 365 * (doy - 1 + (hour - 12) / 24)
    decl = (
        0.006918
        - 0.399912 * np.cos(g)
        + 0.070257 * np.sin(g)
        - 0.006758 * np.cos(2 * g)
        + 0.000907 * np.sin(2 * g)
        - 0.002697 * np.cos(3 * g)
        + 0.00148 * np.sin(3 * g)
    )
    eqt = 229.18 * (
        0.000075 + 0.001868 * np.cos(g) - 0.032077 * np.sin(g) - 0.014615 * np.cos(2 * g) - 0.040849 * np.sin(2 * g)
    )
    true_solar_min = hour * 60 + eqt + 4 * lon
    ha = np.radians(true_solar_min / 4 - 180)
    la = np.radians(lat)
    return np.degrees(np.arcsin(np.sin(la) * np.sin(decl) + np.cos(la) * np.cos(decl) * np.cos(ha)))


def dark_hours(
    dates: pd.DatetimeIndex, lat: np.ndarray, lon: np.ndarray, first_hour_utc: int, n_hours: int, threshold: float
) -> np.ndarray:
    """(nights, cells, hours) bool: sun below `threshold` at each hourly snapshot of each night."""
    out = np.zeros((len(dates), lat.size, n_hours), bool)
    for k in range(n_hours):
        t = dates + pd.Timedelta(hours=first_hour_utc + k)
        out[:, :, k] = sun_altitude(t, lat.ravel(), lon.ravel()) < threshold
    return out


def longest_run(flags: np.ndarray) -> np.ndarray:
    """Longest run of True along the last axis."""
    run = np.zeros(flags.shape[:-1], np.int16)
    best = np.zeros_like(run)
    for k in range(flags.shape[-1]):
        run = np.where(flags[..., k], run + 1, 0)
        best = np.maximum(best, run)
    return best


def good_nights(clear: np.ndarray, dark: np.ndarray, min_hours: int, rule: str = "run") -> np.ndarray:
    """(nights, cells) bool. clear, dark: (nights, cells, hours) bool."""
    ok = clear & dark
    if rule == "run":
        return longest_run(ok) >= min_hours
    if rule == "any":
        return ok.sum(-1) >= min_hours
    raise ValueError("rule must be 'run' or 'any'")


def good_trips(nights: np.ndarray, k: int) -> np.ndarray:
    """(nights-k+1, cells) bool: a k-night trip starting on night i has at least one good night."""
    n = nights.shape[0] - k + 1
    out = nights[:n].copy()
    for j in range(1, k):
        out |= nights[j : n + j]
    return out
