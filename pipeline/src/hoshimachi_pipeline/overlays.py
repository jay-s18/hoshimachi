"""Map overlay images (Bortle and light trend), resampled to Web Mercator rows for Leaflet."""

from __future__ import annotations

import io

import numpy as np
from PIL import Image

from .config import Config

# Warm "glow" ramp, Bortle 1 (darkest) .. 9 (city); must match BORTLE_COLORS in app/js/config.js.
BORTLE_COLORS = ["#1b1714", "#2e1c16", "#4a221a", "#6e2b1c", "#98401e", "#c0621f", "#dd8d2e", "#eebd62", "#f8eccb"]
# Light trend (RGBA): stable grey, dimming blue, brightening orange, brightening fast pale orange.
TREND_STABLE = (110, 104, 96, 150)
TREND_DIMMING = (88, 136, 200, 220)
TREND_BRIGHTENING = (196, 112, 40, 235)
TREND_FAST = (255, 182, 92, 255)


def _hex(c: str) -> tuple[int, int, int]:
    return tuple(int(c[i : i + 2], 16) for i in (1, 3, 5))


def mercator_rows(cfg: Config, transform, height: int) -> np.ndarray:
    """Source row for each output row so that output rows are evenly spaced in Web Mercator."""

    def merc(lat):
        return np.log(np.tan(np.pi / 4 + np.radians(lat) / 2))

    top, bottom = transform.f, transform.f + height * transform.e
    ys = np.linspace(merc(top), merc(bottom), cfg.overlays.mercator_rows)
    lats = np.degrees(2 * np.arctan(np.exp(ys)) - np.pi / 2)
    return np.clip(((lats - transform.f) / transform.e).astype(int), 0, height - 1)


def _png(rgba: np.ndarray) -> bytes:
    buf = io.BytesIO()
    Image.fromarray(rgba).save(buf, format="PNG", optimize=True)
    return buf.getvalue()


def bortle_png(cfg: Config, classes: np.ndarray, land: np.ndarray, rows: np.ndarray) -> bytes:
    img = np.zeros((*classes.shape, 4), np.uint8)
    for k, colour in enumerate(BORTLE_COLORS, 1):
        img[classes == k] = (*_hex(colour), 255)
    img[~land] = 0
    return _png(img[rows])


def trend_png(cfg: Config, radiance: np.ndarray, slope: np.ndarray, land: np.ndarray, rows: np.ndarray) -> bytes:
    o = cfg.overlays
    lit = land & (radiance > o.trend_min_radiance)
    rel = np.where(lit, slope / np.maximum(radiance, o.trend_min_radiance), 0)  # fractional change per year
    img = np.zeros((*radiance.shape, 4), np.uint8)
    img[lit & (np.abs(rel) <= o.trend_stable)] = TREND_STABLE
    img[lit & (rel < -o.trend_stable)] = TREND_DIMMING
    img[lit & (rel > o.trend_stable)] = TREND_BRIGHTENING
    img[lit & (rel > o.trend_fast)] = TREND_FAST
    return _png(img[rows])


def overlay_bounds(transform, shape: tuple[int, int]) -> list[list[float]]:
    """[[south, west], [north, east]] for Leaflet's imageOverlay."""
    h, w = shape
    return [[transform.f + h * transform.e, transform.c], [transform.f, transform.c + w * transform.a]]
