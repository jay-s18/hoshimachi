"""Per-region (0.25° ERA5 cell) metadata and nightly masks for the app."""

from __future__ import annotations

import numpy as np

from .config import Config
from .inputs import CloudRecord, LightData
from .names import Namer
from .sky import KM_PER_DEG_LAT


def land_cells(land: np.ndarray, ppc: int) -> np.ndarray:
    """(rows, cols) bool at cell resolution: any land pixel inside the cell."""
    h, w = land.shape[0] // ppc, land.shape[1] // ppc
    return land[: h * ppc, : w * ppc].reshape(h, ppc, w, ppc).any(axis=(1, 3))


def _light_domes(cfg: Config, rad: np.ndarray, gr: int, gc: int, lat: float):
    """Glow arriving from 8 compass sectors (N, NE, ...), and the strongest sector's per-pixel weights."""
    px = KM_PER_DEG_LAT * cfg.grid.pixel_deg
    radius = cfg.skyglow.radius_km
    h, w = rad.shape
    k = int(radius / px) + 1
    kx = int(k / np.cos(np.radians(lat)))
    r0, r1, c0, c1 = max(gr - k, 0), min(gr + k + 1, h), max(gc - kx, 0), min(gc + kx + 1, w)
    yy, xx = np.mgrid[r0:r1, c0:c1]
    dy = (gr - yy) * px
    dx = (xx - gc) * px * np.cos(np.radians(lat))
    d = np.hypot(dx, dy)
    near = (d >= cfg.cells.dome_min_km) & (d <= radius)
    contrib = np.where(near, rad[r0:r1, c0:c1] * np.maximum(d, 1) ** -cfg.skyglow.exponent, 0)
    az = (np.degrees(np.arctan2(dx, dy)) + 360) % 360
    sector = ((az + 22.5) // 45).astype(int) % 8
    sect = np.bincount(sector.ravel(), weights=contrib.ravel(), minlength=8)
    top = int(np.argmax(sect))
    return sect, np.where(sector == top, contrib, 0), (slice(r0, r1), slice(c0, c1))


def build_cells(
    cfg: Config, clouds: CloudRecord, lights: LightData, sqm: np.ndarray, midx: np.ndarray, namer: Namer
) -> tuple[list[dict], np.ndarray]:
    """Metadata for every land cell, and the (nights, cells) uint16 mask matrix in the same order."""
    ppc = cfg.grid.pixels_per_cell
    land = midx > 0
    rad, slope, vt, et = lights.radiance, lights.slope, lights.transform, clouds.transform
    cells = []
    for r, c in np.argwhere(land_cells(land, ppc)):
        blk = (slice(r * ppc, (r + 1) * ppc), slice(c * ppc, (c + 1) * ppc))
        on_land = land[blk]
        # darkest land pixel in the cell
        s = np.where(on_land, sqm[blk], -np.inf)
        br, bc = np.unravel_index(np.argmax(s), s.shape)
        gr, gc = r * ppc + br, c * ppc + bc
        blon, blat = vt.c + (gc + 0.5) * vt.a, vt.f + (gr + 0.5) * vt.e

        sect, top_w, win = _light_domes(cfg, rad, gr, gc, blat)
        by_muni = np.bincount(midx[win].ravel(), weights=top_w.ravel())
        by_muni[0] = 0
        src = namer.label(int(np.argmax(by_muni)) - 1) if by_muni.max() > 0 else None

        here = midx[gr, gc] or midx[blk].max()
        name = namer.label(int(here) - 1) if here > 0 else {"en": "Offshore", "jp": "", "pref": "", "prefjp": ""}

        total = rad[blk][on_land].sum()
        trend = (
            round(float(slope[blk][on_land].sum() * 10 / total * 100), 1)
            if total > cfg.cells.trend_min_radiance
            else None
        )

        ids, counts = np.unique(midx[blk][midx[blk] > 0], return_counts=True)
        towns = [namer.label(int(i) - 1) for i in ids[np.argsort(-counts)][: cfg.cells.towns_listed]]

        cells.append(
            {
                "r": int(r),
                "c": int(c),
                "lon": round(et.c + (c + 0.5) * et.a, 3),
                "lat": round(et.f + (r + 0.5) * et.e, 3),
                "bl": [round(float(blon), 4), round(float(blat), 4)],
                "sqm": round(float(sqm[gr, gc]), 2),
                "f4": round(float((sqm[blk][on_land] >= cfg.bortle.dark_class_sqm).mean()), 2),
                "dome": [round(float(v), 3) for v in sect / max(sect.sum(), 1e-9)],
                "domeI": round(float(sect.sum()), 4),
                "domeSrc": f"{src['en']} ({src['jp']})" if src else None,
                "trend": trend,
                "also": [t["en"] + "|" + t["jp"] for t in towns],
                **name,
            }
        )
    masks = np.stack([clouds.masks[:, cl["r"], cl["c"]] for cl in cells], axis=1).astype("<u2")
    return cells, masks
