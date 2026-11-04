"""Sky brightness from satellite night lights.

1. Skyglow: every lit pixel adds glow ∝ radiance × distance^-exponent to every pixel within
   radius_km (Walker's law). Done as an FFT convolution in latitude bands, because a degree of
   longitude shrinks towards the north.
2. Calibration: SQM = natural - 2.5 log10(1 + G / G0). G0 is set so the anchor site reads its
   measured value.
3. Bortle class from SQM edges.
"""

from __future__ import annotations

import numpy as np
from rasterio.transform import rowcol
from scipy.signal import fftconvolve

from .config import Config

KM_PER_DEG_LAT = 111.32


def _kernel(cfg: Config, lat0: float, px_deg: float) -> np.ndarray:
    s = cfg.skyglow
    ky = KM_PER_DEG_LAT * px_deg
    kx = ky * np.cos(np.radians(lat0))
    ny, nx = int(s.radius_km / ky), int(s.radius_km / kx)
    yy, xx = np.mgrid[-ny : ny + 1, -nx : nx + 1]
    d = np.hypot(yy * ky, xx * kx)
    k = np.where(d <= s.radius_km, np.maximum(d, 1.0) ** -s.exponent, 0.0)
    return k * (kx * ky)  # weight by pixel area


def skyglow(cfg: Config, radiance: np.ndarray, transform) -> np.ndarray:
    """Artificial glow index per pixel (arbitrary units, calibrated later)."""
    h = radiance.shape[0]
    px_deg = transform.a
    lat = transform.f + (np.arange(h) + 0.5) * transform.e
    pad = int(cfg.skyglow.radius_km / (KM_PER_DEG_LAT * px_deg)) + 2
    glow = np.zeros_like(radiance)
    for top, bottom, lat0 in cfg.skyglow.bands:
        rows = np.flatnonzero((lat <= top) & (lat > bottom))
        if not len(rows):
            continue
        r0, r1 = max(rows[0] - pad, 0), min(rows[-1] + pad + 1, h)
        conv = fftconvolve(radiance[r0:r1], _kernel(cfg, lat0, px_deg), mode="same")
        glow[rows] = conv[rows - r0]
    return np.clip(glow, 0, None)


def calibrate(cfg: Config, glow: np.ndarray, transform) -> tuple[np.ndarray, float]:
    """Zenith SQM per pixel, and G0."""
    c = cfg.calibration
    r, col = rowcol(transform, c.anchor_lon, c.anchor_lat)
    k = c.anchor_pixels
    g_anchor = float(glow[r - k : r + k + 1, col - k : col + k + 1].mean())
    g0 = g_anchor / (10 ** ((c.natural_sqm - c.anchor_sqm) / 2.5) - 1)
    sqm = c.natural_sqm - 2.5 * np.log10(1 + glow / g0)
    return sqm, g0


def bortle(cfg: Config, sqm: np.ndarray) -> np.ndarray:
    """Bortle class 1 (darkest) .. 9 (inner city)."""
    edges = cfg.bortle.edges
    return np.select([sqm >= e for e in edges], list(range(1, len(edges) + 1)), len(edges) + 1)
