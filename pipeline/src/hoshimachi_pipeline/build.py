"""The full build: raw inputs -> validated, published app data."""

from __future__ import annotations

import hashlib
import json
import logging
from dataclasses import asdict
from pathlib import Path

import numpy as np

from . import inputs, overlays
from .cells import build_cells
from .config import Config
from .grids import light_sources, radiance_codes, sqm_codes, trend_codes
from .names import Namer
from .publish import publish
from .sky import calibrate, skyglow
from .stats import summary_stats
from .validation.run import good_night_matrix, validate

log = logging.getLogger(__name__)


class GateFailed(RuntimeError):
    """The refreshed model failed validation; nothing was published."""


def _file_digest(path: Path) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def _cached_skyglow(cfg: Config, lights: inputs.LightData) -> np.ndarray:
    """The skyglow convolution is the slowest step; cache it by input file and settings."""
    key = hashlib.sha256(
        (_file_digest(cfg.paths.raw(cfg.paths.viirs)) + json.dumps(asdict(cfg.skyglow), sort_keys=True)).encode()
    ).hexdigest()[:16]
    path = cfg.paths.build_dir / f"skyglow-{key}.npy"
    if path.exists():
        log.info("skyglow: cached %s", path.name)
        return np.load(path)
    log.info("skyglow: convolving (about a minute)")
    glow = skyglow(cfg, lights.radiance, lights.transform)
    path.parent.mkdir(parents=True, exist_ok=True)
    for old in path.parent.glob("skyglow-*.npy"):
        old.unlink()
    glow = glow.astype(np.float32)  # same precision whether cached or not, so builds are reproducible
    np.save(path, glow)
    return glow


def run_build(cfg: Config, *, step: int = 1, force: bool = False, skip_validation: bool = False) -> dict:
    """Build everything, validate, and publish to cfg.paths.app_data_dir. Returns the manifest."""
    cfg.paths.build_dir.mkdir(parents=True, exist_ok=True)

    clouds = inputs.load_clouds(cfg)
    years = clouds.years
    log.info("clouds: %d nights, %d–%d", len(clouds.dates), years[0], years[-1])
    lights = inputs.load_lights(cfg)
    muni = inputs.load_municipalities(cfg)
    namer = Namer(muni, cfg.names.fixes)
    midx = inputs.municipality_index(muni, lights.radiance.shape, lights.transform)
    land = midx > 0

    glow = _cached_skyglow(cfg, lights)
    sqm, g0 = calibrate(cfg, glow.astype(np.float64), lights.transform)
    sqm = sqm.astype(np.float32)
    log.info("calibration: G0 = %.4g (anchor %s = %.2f)", g0, cfg.calibration.anchor_name, cfg.calibration.anchor_sqm)

    cells, masks = build_cells(cfg, clouds, lights, sqm, midx, namer)
    log.info("cells: %d land regions", len(cells))

    nights = good_night_matrix(cfg, masks, clouds.dates, cells)
    stats = summary_stats(nights, clouds.dates, cells)

    report = None
    model = {"windowDays": 30, "neighbourWeight": 0.25}  # used only with --skip-validation (development)
    if not skip_validation:
        report = validate(cfg, nights, clouds.dates, cells, step=step)
        (cfg.paths.build_dir / "validation_report.json").write_text(json.dumps(report, indent=2))
        if not report["gate"]["passed"]:
            msg = "validation gate failed:\n  " + "\n  ".join(report["gate"]["failures"])
            if not force:
                raise GateFailed(msg + "\nNothing was published. Use --force to publish anyway.")
            log.warning("%s\nPublishing anyway (--force).", msg)
        model = report["chosen"]
    else:
        log.warning("validation skipped: using development defaults %s", model)

    rows = overlays.mercator_rows(cfg, lights.transform, lights.radiance.shape[0])
    g = cfg.grids
    h, w = lights.radiance.shape
    manifest_fields = {
        "period": {
            "firstNight": clouds.dates[0].strftime("%Y-%m-%d"),
            "lastNight": clouds.dates[-1].strftime("%Y-%m-%d"),
            "nights": len(clouds.dates),
            "years": years,
        },
        "night": {
            "hours": cfg.night.hours,
            "firstHourLocal": cfg.night.first_hour_local,
            "utcOffsetHours": cfg.night.utc_offset_hours,
            "clearCloudBelow": cfg.night.clear_cloud_below,
        },
        "model": model,
        "lightTrend": {"firstYear": lights.first_year, "lastYear": lights.last_year} if lights.first_year else None,
        "calibration": {"anchor": cfg.calibration.anchor_name, "anchorSqm": cfg.calibration.anchor_sqm, "g0": g0},
        "overlayBounds": overlays.overlay_bounds(lights.transform, (h, w)),
        "pixelGrid": {
            "west": cfg.grid.west,
            "north": cfg.grid.north,
            "step": cfg.grid.pixel_deg,
            "rows": h,
            "cols": w,
            "sqmOffset": g.sqm_offset,
            "sqmScale": g.sqm_scale,
            "radianceMax": g.radiance_max,
            "radianceLevels": g.radiance_levels,
            "trendOffset": g.trend_offset,
        },
        "validation": _validation_summary(report),
        "stats": stats,
    }
    payloads = {
        "cells": cells,
        "prefectures": inputs.load_prefectures(cfg),
        "lightSources": light_sources(cfg, lights.radiance, midx, lights.transform, namer),
        "nightMasks": masks.astype("<u2").tobytes(),
        "skyBrightness": sqm_codes(cfg, sqm, land).tobytes(),
        "radiance": radiance_codes(cfg, lights.radiance).tobytes(),
        "lightTrend": trend_codes(cfg, lights.radiance, lights.slope, land).tobytes(),
        "bortleOverlay": overlays.bortle_png(cfg, sqm, land, rows),
        "trendOverlay": overlays.trend_png(cfg, lights.radiance, lights.slope, land, rows),
    }
    manifest = publish(cfg.paths.app_data_dir, payloads, manifest_fields)
    log.info("published to %s", cfg.paths.app_data_dir)
    return manifest


def _validation_summary(report: dict | None) -> dict | None:
    """The part of the validation report the app shows (no tuning grid or reliability bins)."""
    if report is None:
        return None
    keep = ("nights", "predictions", "maxCalibrationGap", "skill")
    return {
        "tuneYears": report["tuneYears"],
        "testYears": report["testYears"],
        "predictionsPerTripLength": report["predictionsPerTripLength"],
        "step": report["step"],
        "gatePassed": report["gate"]["passed"],
        "results": [{k: r[k] for k in keep} for r in report["results"]],
    }
