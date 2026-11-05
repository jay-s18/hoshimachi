"""Map overlay images (Bortle and light trend), resampled to Web Mercator rows for Leaflet."""

from __future__ import annotations

import io

import numpy as np
from PIL import Image

from .config import Config
from .grids import sqm_codes

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
    """Source row for each output row so that output rows are evenly spaced in Web Mercator.

    Leaflet stretches the image linearly in Mercator between the bounds, so output row i covers the i-th of
    `mercator_rows` equal Mercator bands; it is sampled at the band's centre.
    """

    def merc(lat):
        return np.log(np.tan(np.pi / 4 + np.radians(lat) / 2))

    top, bottom = transform.f, transform.f + height * transform.e
    n = cfg.overlays.mercator_rows
    ys = merc(top) + (np.arange(n) + 0.5) * (merc(bottom) - merc(top)) / n
    lats = np.degrees(2 * np.arctan(np.exp(ys)) - np.pi / 2)
    return np.clip(((lats - transform.f) / transform.e).astype(int), 0, height - 1)


def _png(rgba: np.ndarray) -> bytes:
    buf = io.BytesIO()
    Image.fromarray(rgba).save(buf, format="PNG", optimize=True)
    return buf.getvalue()


def bortle_ramp_sqm(edges: list[float]) -> np.ndarray:
    """SQM at the middle of each Bortle class, darkest first: where each BORTLE_COLORS entry sits on the ramp.

    Classes 1 and 9 are open-ended, so their middles are placed half the neighbouring class's width beyond the edge.
    """
    e = np.asarray(edges, float)
    inner = (e[:-1] + e[1:]) / 2
    return np.concatenate([[e[0] + (e[0] - e[1]) / 2], inner, [e[-1] - (e[-2] - e[-1]) / 2]])


def bortle_png(cfg: Config, sqm: np.ndarray, land: np.ndarray, rows: np.ndarray) -> bytes:
    """Sky brightness on a continuous colour ramp, so the map shades smoothly instead of stepping between classes.

    Each class's colour sits at the middle of its SQM range, so a class edge is drawn halfway between two colours.
    Pixels are coloured from the same SQM codes the app reads (sky-brightness.u8), so the map and the pin panel agree,
    and with at most 255 codes the image is a small palette PNG; code 255 (sea) is transparent.
    """
    g = cfg.grids
    codes = sqm_codes(cfg, sqm, land)
    xs = bortle_ramp_sqm(cfg.bortle.edges)[::-1]  # ascending SQM for np.interp
    cols = np.array([_hex(c) for c in BORTLE_COLORS], float)[::-1]
    level_sqm = g.sqm_offset + np.arange(256) / g.sqm_scale
    palette = np.stack([np.interp(level_sqm, xs, cols[:, ch]) for ch in range(3)], axis=1).round().astype(np.uint8)
    out = np.ascontiguousarray(codes[rows])
    img = Image.frombytes("P", (out.shape[1], out.shape[0]), out.tobytes())
    img.putpalette(palette.ravel().tolist())
    buf = io.BytesIO()
    img.save(buf, format="PNG", optimize=True, transparency=255)
    return buf.getvalue()


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
