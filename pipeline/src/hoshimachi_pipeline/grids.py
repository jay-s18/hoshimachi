"""Byte-per-pixel grids for spot readings in the browser, and the named light sources."""

from __future__ import annotations

import numpy as np

from .config import Config
from .names import Namer


def sqm_codes(cfg: Config, sqm: np.ndarray, land: np.ndarray) -> np.ndarray:
    """uint8 per pixel: (sqm - offset) * scale, 255 over the sea. Decoded in app/js/sky.js."""
    g = cfg.grids
    q = np.clip(np.round((sqm - g.sqm_offset) * g.sqm_scale), 0, g.sqm_code_max)
    return np.where(land, q, 255).astype(np.uint8)


def radiance_codes(cfg: Config, radiance: np.ndarray) -> np.ndarray:
    """uint8 per pixel: log-scaled radiance. Decoded by RADLUT in app/js/data.js."""
    g = cfg.grids
    q = np.round(np.log1p(np.clip(radiance, 0, g.radiance_max)) / np.log1p(g.radiance_max) * g.radiance_levels)
    return q.astype(np.uint8)


def trend_codes(cfg: Config, radiance: np.ndarray, slope: np.ndarray, land: np.ndarray) -> np.ndarray:
    """uint8 per pixel: night-light trend in % per decade, round(10 × 100 × slope / radiance) + trend_offset,
    clipped to 0..254 (±127 %). 255 where the overlay shows no trend: sea, or radiance at or below
    [overlays] trend_min_radiance. Same pixels and formula as the trend overlay, so the two agree. Decoded in
    app/js/sky.js."""
    lit = land & (radiance > cfg.overlays.trend_min_radiance)
    pct = np.where(lit, slope / np.maximum(radiance, cfg.overlays.trend_min_radiance) * 1000, 0)
    q = np.clip(np.round(pct) + cfg.grids.trend_offset, 0, 254)
    return np.where(lit, q, 255).astype(np.uint8)


def light_sources(cfg: Config, radiance: np.ndarray, midx: np.ndarray, transform, namer: Namer) -> list[list]:
    """Municipalities ranked by total radiance: [lat, lon, "English (日本語)", total], centre radiance-weighted."""
    h, w = radiance.shape
    total = np.bincount(midx.ravel(), weights=radiance.ravel())
    lat = (transform.f + (np.arange(h) + 0.5) * transform.e)[:, None]
    lon = (transform.c + (np.arange(w) + 0.5) * transform.a)[None, :]
    w_lat = np.bincount(midx.ravel(), weights=(radiance * lat).ravel())
    w_lon = np.bincount(midx.ravel(), weights=(radiance * lon).ravel())
    out = []
    for i in np.argsort(-total):
        if i == 0 or total[i] < cfg.grids.light_source_min_radiance:
            continue
        name = namer.label(int(i) - 1)
        out.append(
            [
                round(float(w_lat[i] / total[i]), 3),
                round(float(w_lon[i] / total[i]), 3),
                f"{name['en']} ({name['jp']})",
                round(float(total[i])),
            ]
        )
    return out
