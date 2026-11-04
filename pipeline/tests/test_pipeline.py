"""Config loading, input checks, encodings and publishing."""

import gzip
import json
from pathlib import Path

import numpy as np
import pytest
import rasterio
from rasterio.transform import from_origin

from hoshimachi_pipeline.config import load_config
from hoshimachi_pipeline.grids import radiance_codes, sqm_codes
from hoshimachi_pipeline.inputs import InputError, load_clouds
from hoshimachi_pipeline.publish import FILES, check, publish
from hoshimachi_pipeline.sky import bortle

CONFIG = Path(__file__).resolve().parents[1] / "config.toml"


@pytest.fixture
def cfg(tmp_path):
    """The real config, with raw/build/app paths redirected into tmp_path."""
    text = CONFIG.read_text()
    text = text.replace('raw_dir = "data/raw"', f'raw_dir = "{tmp_path / "raw"}"')
    text = text.replace('build_dir = "build"', f'build_dir = "{tmp_path / "build"}"')
    text = text.replace('app_data_dir = "../app/data"', f'app_data_dir = "{tmp_path / "app_data"}"')
    p = tmp_path / "config.toml"
    p.write_text(text)
    (tmp_path / "raw").mkdir()
    return load_config(p)


def write_masks(cfg, name, dates, value=0b111):
    t = from_origin(cfg.grid.west, cfg.grid.north, cfg.grid.cell_deg, cfg.grid.cell_deg)
    path = cfg.paths.raw_dir / name
    with rasterio.open(
        path, "w", driver="GTiff", width=2, height=2, count=len(dates), dtype="uint16", transform=t
    ) as dst:
        for i, d in enumerate(dates, 1):
            dst.write(np.full((2, 2), value, np.uint16), i)
            dst.set_band_description(i, "d" + d.replace("-", ""))


def days(y):
    import pandas as pd

    return [d.strftime("%Y-%m-%d") for d in pd.date_range(f"{y}-01-01", f"{y}-12-31")]


def test_config_loads_and_rejects_typos(tmp_path):
    cfg = load_config(CONFIG)
    assert cfg.night.first_hour_utc == 9 and cfg.validation.gate.max_calibration_gap > 0
    bad = tmp_path / "bad.toml"
    bad.write_text(CONFIG.read_text().replace("radius_km =", "radius_kms ="))
    with pytest.raises(ValueError, match="radius_km"):
        load_config(bad)


def test_clouds_merge_yearly_files_in_any_split(cfg):
    write_masks(cfg, "era5_nights_2020.tif", days(2020))
    write_masks(cfg, "era5_nights_2021_2022.tif", days(2021) + days(2022))
    rec = load_clouds(cfg)
    assert rec.years == [2020, 2021, 2022] and len(rec.dates) == 366 + 365 + 365


def test_clouds_reject_gaps_and_partial_years(cfg):
    write_masks(cfg, "era5_nights_2020.tif", days(2020))
    write_masks(cfg, "era5_nights_2022.tif", days(2022))
    with pytest.raises(InputError, match="gap"):
        load_clouds(cfg)
    for f in cfg.paths.raw_dir.iterdir():
        f.unlink()
    write_masks(cfg, "era5_nights_2020.tif", days(2020)[:-1])
    with pytest.raises(InputError, match="whole years"):
        load_clouds(cfg)


def test_bortle_edges(cfg):
    assert bortle(cfg, np.array([22.0, 21.9, 21.7, 20.5, 19.6, 19.0, 18.4, 17.9, 17.0])).tolist() == list(range(1, 10))


def test_grid_codes_round_trip(cfg):
    sqm = np.array([[21.5, 18.0]])
    q = sqm_codes(cfg, sqm, np.array([[True, False]]))
    assert q[0, 1] == 255 and abs(cfg.grids.sqm_offset + q[0, 0] / cfg.grids.sqm_scale - 21.5) < 0.05
    rad = np.array([0.0, 1.0, 500.0])
    code = radiance_codes(cfg, rad)
    back = np.expm1(code / cfg.grids.radiance_levels * np.log1p(cfg.grids.radiance_max))  # as in app/js/data.js
    assert code[0] == 0 and abs(back[2] - 500) < 1 and abs(back[1] - 1) < 0.05


def test_publish_then_check(cfg):
    payloads = {k: {"k": k} for k in FILES}
    payloads["nightMasks"] = np.zeros((3, 1), "<u2").tobytes()
    payloads["skyBrightness"] = payloads["radiance"] = bytes(4)
    payloads["cells"] = [{"r": 0, "c": 0}]
    m = publish(cfg.paths.app_data_dir, payloads, {"period": {"nights": 3}, "pixelGrid": {"rows": 2, "cols": 2}})
    assert m["files"]["nightMasks"]["path"].endswith(".gz")
    assert gzip.decompress((cfg.paths.app_data_dir / "night-masks.u16.gz").read_bytes()) == bytes(6)
    assert check(cfg.paths.app_data_dir) == []
    (cfg.paths.app_data_dir / "cells.json").write_text(json.dumps([{"tampered": True}]))
    assert any("checksum" in p for p in check(cfg.paths.app_data_dir))
