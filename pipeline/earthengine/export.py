"""Export Hoshimachi's raw inputs from Google Earth Engine to Google Cloud Storage, then download them.

Used by the yearly-update workflow; also runnable by hand.

    pip install -e "pipeline[earthengine]"
    python pipeline/earthengine/export.py --bucket my-bucket --years 2025            # one new year of clouds
    python pipeline/earthengine/export.py --bucket my-bucket --years 2015-2025 --viirs   # everything

Authentication: on a laptop, `earthengine authenticate` once. In CI, set GOOGLE_APPLICATION_CREDENTIALS to a
service-account key that is registered for Earth Engine and can write to the bucket.

Outputs (same names the pipeline expects in pipeline/data/raw/):
    era5_nights_<YEAR>.tif     one band per night, named dYYYYMMDD (local evening date);
                               bit k set <=> hour (18 + k) JST had total cloud cover < 25 %
    viirs_japan_30s.tif        band 1 latest annual radiance, band 2 linear trend per year since 2014
    viirs_japan_30s.json       {"firstYear", "lastYear"} of the VIIRS composites used

Status: written against the Earth Engine Python API to mirror export_manual.js (which produced the current
data). Run it once by hand and compare against the manual export before trusting it in CI.
"""

from __future__ import annotations

import argparse
import json
import sys
import time
from pathlib import Path

import ee
from google.cloud import storage

# Grid aligned to ERA5's native 0.25° cells; must match [grid] in pipeline/config.toml.
WEST, NORTH, EAST, SOUTH = 122.375, 46.125, 146.375, 23.875
ERA_TRANSFORM = [0.25, 0, WEST, 0, -0.25, NORTH]
VIIRS_TRANSFORM = [1 / 120, 0, WEST, 0, -1 / 120, NORTH]
UTC_FIRST_HOUR, HOURS, CLEAR_BELOW = 9, 12, 0.25  # 18:00 JST = 09:00 UTC; 12 hourly snapshots; cloud < 25 %
VIIRS_TREND_FROM = 2014
PREFIX = "hoshimachi/raw"


def region() -> ee.Geometry:
    return ee.Geometry.Rectangle([WEST, SOUTH, EAST, NORTH], None, False)


def nightly_masks(year: int) -> ee.Image:
    """One uint16 band per night of `year`; bit k = hour (18 + k) JST was clear."""
    start = ee.Date.fromYMD(year, 1, 1)
    end = ee.Date.fromYMD(year + 1, 1, 1)
    era = (
        ee.ImageCollection("ECMWF/ERA5/HOURLY")
        .select("total_cloud_cover")
        .filter(ee.Filter.calendarRange(UTC_FIRST_HOUR, UTC_FIRST_HOUR + HOURS - 1, "hour"))
        .filterDate(start, end)
    )
    n_days = end.difference(start, "day")
    days = ee.List.sequence(0, n_days.subtract(1))

    def one_night(d):
        day = start.advance(d, "day")
        hours = era.filterDate(day, day.advance(1, "day"))

        def bit(img):
            h = ee.Number(ee.Date(img.get("system:time_start")).get("hour"))
            return img.lt(CLEAR_BELOW).multiply(ee.Number(2).pow(h.subtract(UTC_FIRST_HOUR))).rename("m").toUint16()

        return ee.Image(hours.map(bit).sum()).rename("m").toUint16()

    names = days.map(lambda d: ee.String("d").cat(start.advance(d, "day").format("YYYYMMdd")))
    return ee.ImageCollection.fromImages(days.map(one_night)).toBands().rename(names)


def viirs() -> tuple[ee.Image, int, int]:
    v21 = ee.ImageCollection("NOAA/VIIRS/DNB/ANNUAL_V21").filterDate(f"{VIIRS_TREND_FROM}-01-01", "2022-01-01")
    v22 = ee.ImageCollection("NOAA/VIIRS/DNB/ANNUAL_V22").filterDate("2022-01-01", "2100-01-01")
    col = v21.merge(v22).select("average_masked").sort("system:time_start")
    years = col.aggregate_array("system:time_start").map(lambda t: ee.Date(t).get("year")).getInfo()
    latest = ee.Image(col.sort("system:time_start", False).first()).rename("rad_latest")

    def with_t(img):
        t = ee.Number(ee.Date(img.get("system:time_start")).get("year")).subtract(VIIRS_TREND_FROM)
        return ee.Image.constant(t).float().rename("t").addBands(img.rename("rad").float())

    slope = col.map(with_t).reduce(ee.Reducer.linearFit()).select("scale").rename("rad_slope")
    return latest.addBands(slope).toFloat(), min(years), max(years)


def start_export(image: ee.Image, name: str, bucket: str, transform: list[float]) -> ee.batch.Task:
    task = ee.batch.Export.image.toCloudStorage(
        image=image,
        description=name,
        bucket=bucket,
        fileNamePrefix=f"{PREFIX}/{name}",
        region=region(),
        crs="EPSG:4326",
        crsTransform=transform,
        maxPixels=1e10,
    )
    task.start()
    print(f"started {name} ({task.id})", flush=True)
    return task


def wait(tasks: list[ee.batch.Task], poll_s: int = 30) -> None:
    pending = list(tasks)
    while pending:
        time.sleep(poll_s)
        for t in list(pending):
            s = t.status()
            if s["state"] == "COMPLETED":
                print(f"done {s['description']}", flush=True)
                pending.remove(t)
            elif s["state"] in ("FAILED", "CANCELLED"):
                raise RuntimeError(f"{s['description']}: {s['state']} {s.get('error_message', '')}")


def download(bucket: str, names: list[str], dest: Path) -> None:
    """Earth Engine may split large exports into tiles; this expects the single-file case (true for this grid)."""
    dest.mkdir(parents=True, exist_ok=True)
    b = storage.Client().bucket(bucket)
    for name in names:
        blob = b.blob(f"{PREFIX}/{name}")
        blob.download_to_filename(dest / name)
        print(f"downloaded {name}", flush=True)


def parse_years(s: str) -> list[int]:
    if "-" in s:
        a, b = map(int, s.split("-"))
        return list(range(a, b + 1))
    return [int(y) for y in s.split(",")]


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    ap.add_argument("--bucket", required=True, help="Cloud Storage bucket for exports")
    ap.add_argument("--years", required=True, type=parse_years, help="e.g. 2025, 2015-2025 or 2023,2024")
    ap.add_argument("--viirs", action="store_true", help="also refresh the night-light composite")
    ap.add_argument("--dest", type=Path, default=Path(__file__).resolve().parents[1] / "data" / "raw")
    ap.add_argument("--project", help="Google Cloud project registered for Earth Engine")
    args = ap.parse_args()

    ee.Initialize(project=args.project)
    tasks, files = [], []
    for y in args.years:
        tasks.append(start_export(nightly_masks(y), f"era5_nights_{y}", args.bucket, ERA_TRANSFORM))
        files.append(f"era5_nights_{y}.tif")
    meta = None
    if args.viirs:
        img, first, last = viirs()
        tasks.append(start_export(img, "viirs_japan_30s", args.bucket, VIIRS_TRANSFORM))
        files.append("viirs_japan_30s.tif")
        meta = {"firstYear": first, "lastYear": last}
    wait(tasks)
    download(args.bucket, files, args.dest)
    if meta:
        (args.dest / "viirs_japan_30s.json").write_text(json.dumps(meta) + "\n")
        storage.Client().bucket(args.bucket).blob(f"{PREFIX}/viirs_japan_30s.json").upload_from_string(json.dumps(meta))
    return 0


if __name__ == "__main__":
    sys.exit(main())
