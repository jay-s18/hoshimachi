"""Writing the app's data folder and its manifest.

The manifest is the contract between pipeline and app (see docs/DATA_FORMAT.md). The app reads
everything period- or model-dependent from it, so a data update never needs a code change.
Bump SCHEMA_VERSION (here and in app/js/data.js) only when a file's layout changes.
"""

from __future__ import annotations

import gzip
import hashlib
import json
import shutil
from datetime import UTC, datetime
from pathlib import Path

from . import __version__

SCHEMA_VERSION = 1

FILES = {
    # manifest key: (file name, description)
    "cells": ("cells.json", "Region metadata, one object per 0.25° land cell"),
    "prefectures": ("prefectures.geojson", "Prefecture outlines"),
    "lightSources": ("light-sources.json", "Named light sources: [lat, lon, name, total radiance]"),
    "nightMasks": ("night-masks.u16.gz", "uint16 little-endian, nights × cells, gzip"),
    "skyBrightness": ("sky-brightness.u8.gz", "uint8 SQM code per pixel, rows × cols, gzip"),
    "radiance": ("radiance.u8.gz", "uint8 log radiance code per pixel, rows × cols, gzip"),
    "lightTrend": ("light-trend.u8.gz", "uint8 trend code (% per decade + trendOffset; 255 = none), rows × cols, gzip"),
    "bortleOverlay": ("bortle.png", "Sky brightness overlay on the Bortle colour ramp, Web Mercator rows"),
    "trendOverlay": ("trend.png", "Light-trend overlay, Web Mercator rows"),
}


def _json_bytes(obj) -> bytes:
    return json.dumps(obj, ensure_ascii=False, separators=(",", ":")).encode()


def _gzip(data: bytes) -> bytes:
    return gzip.compress(data, compresslevel=9, mtime=0)  # mtime=0 keeps output byte-identical between runs


def publish(out_dir: Path, payloads: dict[str, bytes | object], manifest_fields: dict) -> dict:
    """Write every payload and manifest.json into a fresh copy of out_dir, then swap it in.

    payloads: manifest key -> bytes (written as-is) or JSON-serialisable object.
    Writing to a temporary folder first means a failed run never leaves a half-updated app.
    """
    missing = set(FILES) - set(payloads)
    if missing:
        raise ValueError(f"missing payloads: {sorted(missing)}")
    tmp = out_dir.with_name(out_dir.name + ".tmp")
    if tmp.exists():
        shutil.rmtree(tmp)
    tmp.mkdir(parents=True)
    files = {}
    for key, (name, desc) in FILES.items():
        data = payloads[key]
        if not isinstance(data, bytes):
            data = _json_bytes(data)
        if name.endswith(".gz") and not data.startswith(b"\x1f\x8b"):
            data = _gzip(data)
        (tmp / name).write_bytes(data)
        files[key] = {"path": name, "bytes": len(data), "sha256": hashlib.sha256(data).hexdigest(), "description": desc}
    manifest = {
        "schemaVersion": SCHEMA_VERSION,
        "generatedAt": datetime.now(UTC).replace(microsecond=0).isoformat(),
        "pipelineVersion": __version__,
        **manifest_fields,
        "files": files,
    }
    (tmp / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n")
    if out_dir.exists():
        shutil.rmtree(out_dir)
    tmp.rename(out_dir)
    return manifest


def check(out_dir: Path) -> list[str]:
    """Problems with a published data folder (empty list = OK)."""
    problems = []
    mpath = out_dir / "manifest.json"
    if not mpath.exists():
        return [f"{mpath} not found"]
    manifest = json.loads(mpath.read_text())
    if manifest.get("schemaVersion") != SCHEMA_VERSION:
        problems.append(f"schemaVersion {manifest.get('schemaVersion')} != {SCHEMA_VERSION}")
    for key in FILES:
        entry = manifest.get("files", {}).get(key)
        if not entry:
            problems.append(f"manifest lacks files.{key}")
            continue
        p = out_dir / entry["path"]
        if not p.exists():
            problems.append(f"{entry['path']} missing")
            continue
        data = p.read_bytes()
        if len(data) != entry["bytes"] or hashlib.sha256(data).hexdigest() != entry["sha256"]:
            problems.append(f"{entry['path']} does not match its manifest checksum")
    period, cells = manifest.get("period", {}), None
    try:
        cells = json.loads((out_dir / manifest["files"]["cells"]["path"]).read_text())
        masks = gzip.decompress((out_dir / manifest["files"]["nightMasks"]["path"]).read_bytes())
        if len(masks) != 2 * period["nights"] * len(cells):
            problems.append("nightMasks size != 2 bytes × nights × cells")
        g = manifest["pixelGrid"]
        for key in ("skyBrightness", "radiance", "lightTrend"):
            n = len(gzip.decompress((out_dir / manifest["files"][key]["path"]).read_bytes()))
            if n != g["rows"] * g["cols"]:
                problems.append(f"{key} size != rows × cols")
    except (KeyError, OSError, ValueError) as e:
        problems.append(f"could not cross-check sizes: {e}")
    return problems
