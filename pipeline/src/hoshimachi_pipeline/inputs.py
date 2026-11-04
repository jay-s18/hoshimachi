"""Reading and checking the raw inputs.

ERA5 cloud masks may arrive as any number of GeoTIFFs (one per year from the automated export,
or multi-year files from the manual one). They are merged by night, and the result must be one
unbroken run of nights covering whole calendar years; anything else stops the build.
"""

from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path

import geopandas as gpd
import numpy as np
import pandas as pd
import rasterio
from rasterio.features import rasterize

from .config import Config


class InputError(RuntimeError):
    """An input file is missing or inconsistent."""


@dataclass
class CloudRecord:
    masks: np.ndarray  # (nights, rows, cols) uint16; bit k = hour (first_hour_local + k) was clear
    dates: pd.DatetimeIndex  # local evening date of each night
    transform: rasterio.Affine

    @property
    def years(self) -> list[int]:
        return sorted(set(self.dates.year))


@dataclass
class LightData:
    radiance: np.ndarray  # (rows, cols) float64, clipped, NaN -> 0
    slope: np.ndarray  # (rows, cols) float64, radiance change per year
    transform: rasterio.Affine
    profile: dict
    first_year: int | None
    last_year: int | None


def _require(path: Path) -> Path:
    if not path.exists():
        raise InputError(f"missing input: {path}")
    return path


def load_clouds(cfg: Config) -> CloudRecord:
    files = sorted(cfg.paths.raw_dir.glob(cfg.paths.era5_glob))
    if not files:
        raise InputError(f"no files match {cfg.paths.raw_dir / cfg.paths.era5_glob}")
    by_date: dict[pd.Timestamp, np.ndarray] = {}
    transform = None
    for f in files:
        with rasterio.open(f) as src:
            if transform is None:
                transform = src.transform
            elif src.transform != transform:
                raise InputError(f"{f.name}: grid differs from {files[0].name}")
            if any(not d or not d.startswith("d") for d in src.descriptions):
                raise InputError(f"{f.name}: bands must be named dYYYYMMDD")
            data = src.read()
            for name, band in zip(src.descriptions, data, strict=True):
                day = pd.Timestamp(name[1:])
                if day in by_date and not np.array_equal(by_date[day], band):
                    raise InputError(f"{f.name}: night {day.date()} conflicts with another file")
                by_date[day] = band
    dates = pd.DatetimeIndex(sorted(by_date))
    gaps = np.flatnonzero(np.diff(dates.values).astype("timedelta64[D]").astype(int) != 1)
    if len(gaps):
        first = dates[gaps[0]].date()
        raise InputError(f"cloud record has {len(gaps)} gap(s); first after {first}")
    if (dates[0].month, dates[0].day) != (1, 1) or (dates[-1].month, dates[-1].day) != (12, 31):
        raise InputError(f"cloud record must cover whole years; got {dates[0].date()} to {dates[-1].date()}")
    g = cfg.grid
    if abs(transform.c - g.west) > 1e-9 or abs(transform.f - g.north) > 1e-9 or abs(transform.a - g.cell_deg) > 1e-9:
        raise InputError("cloud grid does not match [grid] in config.toml")
    masks = np.stack([by_date[d] for d in dates]).astype(np.uint16)
    if masks.max() >= 1 << cfg.night.hours:
        raise InputError(f"mask values exceed {cfg.night.hours} bits")
    return CloudRecord(masks, dates, transform)


def load_lights(cfg: Config) -> LightData:
    path = _require(cfg.paths.raw(cfg.paths.viirs))
    with rasterio.open(path) as src:
        rad = np.nan_to_num(src.read(1).astype(np.float64))
        slope = np.nan_to_num(src.read(2).astype(np.float64))
        transform, profile = src.transform, src.profile
    g = cfg.grid
    if abs(transform.c - g.west) > 1e-9 or abs(transform.f - g.north) > 1e-9 or abs(transform.a - g.pixel_deg) > 1e-12:
        raise InputError("night-light grid does not match [grid] in config.toml")
    meta_path = cfg.paths.raw(cfg.paths.viirs_meta)
    meta = json.loads(meta_path.read_text()) if meta_path.exists() else {}
    return LightData(
        radiance=np.clip(rad, 0, cfg.skyglow.radiance_clip),
        slope=slope,
        transform=transform,
        profile=profile,
        first_year=meta.get("firstYear"),
        last_year=meta.get("lastYear"),
    )


def load_municipalities(cfg: Config) -> gpd.GeoDataFrame:
    return gpd.read_file(_require(cfg.paths.raw(cfg.paths.municipalities))).reset_index(drop=True)


def load_prefectures(cfg: Config) -> dict:
    """Prefecture outlines as GeoJSON, coordinates rounded to ~100 m and properties dropped (size)."""
    prefs = json.loads(_require(cfg.paths.raw(cfg.paths.prefectures)).read_text())

    def rnd(o):
        if isinstance(o, list):
            return [rnd(x) for x in o]
        return round(o, 3) if isinstance(o, float) else o

    for f in prefs["features"]:
        f["geometry"]["coordinates"] = rnd(f["geometry"]["coordinates"])
        f["properties"] = {}
    return prefs


def municipality_index(muni: gpd.GeoDataFrame, shape: tuple[int, int], transform) -> np.ndarray:
    """(rows, cols) int32: 1 + row of `muni` covering each pixel, 0 = none (sea)."""
    shapes = ((geom, i + 1) for i, geom in enumerate(muni.geometry))
    return rasterize(shapes, out_shape=shape, transform=transform, all_touched=True, dtype="int32")
