"""Typed access to config.toml.

Each TOML table maps to a frozen dataclass, so a typo in the file fails loudly at load time
instead of silently falling back to a default.
"""

from __future__ import annotations

import tomllib
from dataclasses import dataclass, fields
from pathlib import Path
from typing import Any

DEFAULT_CONFIG = Path(__file__).resolve().parents[2] / "config.toml"


def _build(cls, data: dict[str, Any]):
    """Instantiate dataclass `cls` from a dict, rejecting unknown or missing keys."""
    names = {f.name for f in fields(cls)}
    unknown = set(data) - names
    if unknown:
        raise ValueError(f"[{cls.__name__}] unknown setting(s): {', '.join(sorted(unknown))}")
    missing = names - set(data)
    if missing:
        raise ValueError(f"[{cls.__name__}] missing setting(s): {', '.join(sorted(missing))}")
    return cls(**data)


@dataclass(frozen=True)
class Paths:
    raw_dir: Path
    era5_glob: str
    viirs: str
    viirs_meta: str
    municipalities: str
    prefectures: str
    build_dir: Path
    app_data_dir: Path

    def raw(self, name: str) -> Path:
        return self.raw_dir / name


@dataclass(frozen=True)
class Grid:
    west: float
    north: float
    cell_deg: float
    pixels_per_cell: int

    @property
    def pixel_deg(self) -> float:
        return self.cell_deg / self.pixels_per_cell


@dataclass(frozen=True)
class Night:
    hours: int
    first_hour_local: int
    utc_offset_hours: int
    clear_cloud_below: float
    sun_altitude_max: float
    min_clear_hours: int
    rule: str

    @property
    def first_hour_utc(self) -> int:
        return self.first_hour_local - self.utc_offset_hours


@dataclass(frozen=True)
class Skyglow:
    radius_km: float
    exponent: float
    radiance_clip: float
    bands: list


@dataclass(frozen=True)
class Calibration:
    natural_sqm: float
    anchor_name: str
    anchor_lon: float
    anchor_lat: float
    anchor_sqm: float
    anchor_pixels: int


@dataclass(frozen=True)
class Bortle:
    edges: list
    dark_class_sqm: float


@dataclass(frozen=True)
class Cells:
    dome_min_km: float
    towns_listed: int
    trend_min_radiance: float


@dataclass(frozen=True)
class Overlays:
    mercator_rows: int
    trend_min_radiance: float
    trend_stable: float
    trend_fast: float


@dataclass(frozen=True)
class Grids:
    sqm_offset: float
    sqm_scale: float
    sqm_code_max: int
    radiance_max: float
    radiance_levels: int
    light_source_min_radiance: float


@dataclass(frozen=True)
class Names:
    fixes: dict


@dataclass(frozen=True)
class Gate:
    max_calibration_gap: float
    min_skill_ci_low: float
    skill_references: list


@dataclass(frozen=True)
class Validation:
    test_years: int
    tune_years: int
    trip_lengths: list
    window_grid: list
    blend_grid: list
    reliability_bins: int
    min_bin_count: int
    bootstrap_reps: int
    bootstrap_seed: int
    gate: Gate


@dataclass(frozen=True)
class Config:
    paths: Paths
    grid: Grid
    night: Night
    skyglow: Skyglow
    calibration: Calibration
    bortle: Bortle
    cells: Cells
    overlays: Overlays
    grids: Grids
    names: Names
    validation: Validation
    source: Path


def load_config(path: str | Path | None = None) -> Config:
    """Read config.toml (the one next to pyproject.toml by default). Relative paths resolve against it."""
    path = Path(path or DEFAULT_CONFIG).resolve()
    with open(path, "rb") as f:
        raw = tomllib.load(f)
    base = path.parent
    p = dict(raw["paths"])
    for key in ("raw_dir", "build_dir", "app_data_dir"):
        p[key] = (base / p[key]).resolve()
    v = dict(raw["validation"])
    v["gate"] = _build(Gate, v["gate"])
    sections = {
        "paths": _build(Paths, p),
        "grid": _build(Grid, raw["grid"]),
        "night": _build(Night, raw["night"]),
        "skyglow": _build(Skyglow, raw["skyglow"]),
        "calibration": _build(Calibration, raw["calibration"]),
        "bortle": _build(Bortle, raw["bortle"]),
        "cells": _build(Cells, raw["cells"]),
        "overlays": _build(Overlays, raw["overlays"]),
        "grids": _build(Grids, raw["grids"]),
        "names": _build(Names, raw["names"]),
        "validation": _build(Validation, v),
    }
    unknown = set(raw) - set(sections)
    if unknown:
        raise ValueError(f"unknown config section(s): {', '.join(sorted(unknown))}")
    cfg = Config(**sections, source=path)
    if cfg.night.rule not in ("run", "any"):
        raise ValueError("night.rule must be 'run' or 'any'")
    return cfg
