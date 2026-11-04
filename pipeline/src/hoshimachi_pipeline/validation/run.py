"""Out-of-sample validation with a rolling protocol, and the publication gate.

With full years Y0..YN in the record:
  test  = the last `test_years` years            (touched once, at the end)
  tune  = the `tune_years` years before the test (settings are chosen here)
  train = everything before the tune years       (fit while tuning)
After tuning, the model is refit on everything before the test years and scored once.

The chosen window and blend are what the app uses, so every data update re-earns its settings.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass

import numpy as np
import pandas as pd

from ..config import Config
from .estimator import (
    CalendarIndex,
    baseline_national_month,
    baseline_region_all_year,
    baseline_region_month,
    neighbour_matrix,
    replay_predict,
)
from .metrics import block_bootstrap_skill, brier, reliability, skill
from .nights import dark_hours, decode_bits, good_nights, good_trips

log = logging.getLogger(__name__)
BASELINES = ("region_all_year", "national_month", "region_month")


@dataclass(frozen=True)
class Split:
    tune_train: list[int]
    tune: list[int]
    final_train: list[int]
    test: list[int]

    @classmethod
    def rolling(cls, years: list[int], tune_n: int, test_n: int) -> Split:
        if len(years) < tune_n + test_n + 2:
            raise ValueError(f"need at least {tune_n + test_n + 2} years of data to validate, have {len(years)}")
        test = years[-test_n:]
        tune = years[-test_n - tune_n : -test_n]
        return cls(years[: -test_n - tune_n], tune, years[:-test_n], test)


def good_night_matrix(cfg: Config, masks: np.ndarray, dates: pd.DatetimeIndex, cells: list[dict]) -> np.ndarray:
    """(nights, cells) bool for the default good-night definition, at each cell's centre."""
    n = cfg.night
    lat = np.array([c["lat"] for c in cells])
    lon = np.array([c["lon"] for c in cells])
    clear = decode_bits(masks, n.hours)
    dark = dark_hours(dates, lat, lon, n.first_hour_utc, n.hours, n.sun_altitude_max)
    return good_nights(clear, dark, n.min_clear_hours, n.rule)


def _start_rows(dates: pd.DatetimeIndex, years: list[int], k: int, step: int) -> np.ndarray:
    """Row indices of trip starts whose whole trip lies inside `years`."""
    n = len(dates) - k + 1
    ok = np.isin(dates[:n].year, years) & np.isin(dates[k - 1 : n + k - 1].year, years)
    return np.flatnonzero(ok)[::step]


def _predictions(trips, dates, cal, train_years, rows, window, blends, A, k):
    """{blend: (len(rows), cells)} for one window, computing the raw replay once."""
    raw = np.stack([replay_predict(trips, dates, cal, train_years, dates[i], window, 0.0, A, k) for i in rows])
    return {b: raw if b == 0 else (1 - b) * raw + b * (raw @ A.T) for b in blends}


def validate(cfg: Config, nights: np.ndarray, dates: pd.DatetimeIndex, cells: list[dict], step: int = 1) -> dict:
    """Tune, test and gate. Returns a JSON-serialisable report."""
    v = cfg.validation
    split = Split.rolling(sorted(set(dates.year)), v.tune_years, v.test_years)
    log.info("validation split: train %s, tune %s, test %s", split.tune_train, split.tune, split.test)
    A = neighbour_matrix(np.array([[c["r"], c["c"]] for c in cells]))
    cal = CalendarIndex(dates)
    trips = {k: good_trips(nights, k) for k in v.trip_lengths}

    # 1. choose one (window, blend) for all trip lengths on the tune years
    grid = []
    for k in v.trip_lengths:
        rows = _start_rows(dates, split.tune, k, step)
        y = trips[k][rows].astype(float)
        for w in v.window_grid:
            for b, p in _predictions(trips[k], dates, cal, split.tune_train, rows, w, v.blend_grid, A, k).items():
                grid.append({"trip_nights": k, "window_days": w, "blend": b, "brier": brier(p, y)})
    grid = pd.DataFrame(grid)
    mean_brier = grid.groupby(["window_days", "blend"])["brier"].mean()
    best_w, best_b = mean_brier.idxmin()
    log.info("chosen: window ±%d days, neighbour weight %.2f", best_w, best_b)

    # 2. refit before the test years and score once
    results = []
    for k in v.trip_lengths:
        rows = _start_rows(dates, split.test, k, step)
        d = dates[rows]
        y = trips[k][rows].astype(float)
        p_model = _predictions(trips[k], dates, cal, split.final_train, rows, best_w, [best_b], A, k)[best_b]
        refs = {
            "region_all_year": np.broadcast_to(
                baseline_region_all_year(trips[k], dates, split.final_train, k), y.shape
            ),
            "national_month": np.broadcast_to(
                baseline_national_month(trips[k], dates, split.final_train, k)[d.month - 1][:, None], y.shape
            ),
            "region_month": baseline_region_month(trips[k], dates, split.final_train, k)[d.month - 1],
        }
        weeks = np.broadcast_to((np.asarray((d - pd.Timestamp(split.test[0], 1, 1)).days) // 7)[:, None], y.shape)
        se_model = (p_model - y) ** 2
        rel = reliability(p_model.ravel(), y.ravel(), v.reliability_bins, v.min_bin_count)
        r = {
            "nights": k,
            "startDates": len(rows),
            "predictions": int(y.size),
            "observedRate": float(y.mean()),
            "brier": float(se_model.mean()),
            "maxCalibrationGap": max(abs(b["predicted"] - b["observed"]) for b in rel),
            "reliability": rel,
            "skill": {},
        }
        for name in BASELINES:
            se_ref = (refs[name] - y) ** 2
            lo, hi = block_bootstrap_skill(
                se_model.ravel(), se_ref.ravel(), weeks.ravel(), v.bootstrap_reps, v.bootstrap_seed
            )
            r["skill"][_camel(name)] = {"value": skill(se_model.mean(), se_ref.mean()), "lo": lo, "hi": hi}
        results.append(r)
        log.info(
            "test %d-night: gap %.1f pts, skill vs season-only %.3f, vs season-blind %.3f",
            k,
            r["maxCalibrationGap"] * 100,
            r["skill"]["nationalMonth"]["value"],
            r["skill"]["regionAllYear"]["value"],
        )

    report = {
        "tuneYears": split.tune,
        "testYears": split.test,
        "trainYears": [split.tune_train[0], split.final_train[-1]],
        "chosen": {"windowDays": int(best_w), "neighbourWeight": float(best_b)},
        "predictionsPerTripLength": int(np.mean([r["predictions"] for r in results])),
        "step": step,
        "results": results,
        "tuningGrid": grid.to_dict(orient="records"),
    }
    report["gate"] = gate(cfg, results)
    return report


def gate(cfg: Config, results: list[dict]) -> dict:
    """Pass/fail checks that guard publication of a data update."""
    g = cfg.validation.gate
    failures = []
    for r in results:
        if r["maxCalibrationGap"] > g.max_calibration_gap:
            failures.append(
                f"{r['nights']}-night trips: calibration gap {r['maxCalibrationGap'] * 100:.1f} pts "
                f"> {g.max_calibration_gap * 100:.1f}"
            )
        for ref in g.skill_references:
            s = r["skill"][_camel(ref)]
            if s["lo"] <= g.min_skill_ci_low:
                failures.append(
                    f"{r['nights']}-night trips: skill vs {ref} not clearly positive (95% low {s['lo']:.3f})"
                )
    return {"passed": not failures, "failures": failures}


def _camel(s: str) -> str:
    head, *rest = s.split("_")
    return head + "".join(w.title() for w in rest)
