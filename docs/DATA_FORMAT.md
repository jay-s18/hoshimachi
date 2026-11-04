# Data format (schema version 1)

`app/data/` is written by `pipeline/src/hoshimachi_pipeline/publish.py` and read by `app/js/data.js`. `manifest.json` is the only fixed file name; everything else is found through it.

## Compatibility rules

- Adding a field to the manifest or to a cell object is backwards compatible. No version bump.
- Renaming or removing a field, or changing a file's layout or encoding, is a breaking change. Bump `SCHEMA_VERSION` in **both** `publish.py` and `data.js`. The app refuses data with a schema it does not know and says so, rather than drawing nonsense.

## manifest.json

```jsonc
{
  "schemaVersion": 1,
  "generatedAt": "2026-11-04T16:13:41+00:00",
  "pipelineVersion": "1.0.0",
  "period": {
    "firstNight": "2015-01-01",          // local (JST) evening date of night 0
    "lastNight": "2024-12-31",
    "nights": 3653,
    "years": [2015, 2016, ...]           // full calendar years; the app's "record"
  },
  "night": { "hours": 12, "firstHourLocal": 18, "utcOffsetHours": 9, "clearCloudBelow": 0.25 },
  "model": { "windowDays": 30, "neighbourWeight": 0.25 },   // chosen by validation
  "lightTrend": { "firstYear": 2014, "lastYear": null },   // null if unknown
  "calibration": { "anchor": "Yonago Kosen rooftop", "anchorSqm": 18.8, "g0": 2.15 },
  "overlayBounds": [[south, west], [north, east]],
  "pixelGrid": { "west", "north", "step", "rows", "cols", "sqmOffset", "sqmScale", "radianceMax", "radianceLevels" },
  "validation": {                        // null if the build skipped validation
    "tuneYears": [2021, 2022], "testYears": [2023, 2024],
    "predictionsPerTripLength": 724626, "step": 1, "gatePassed": true,
    "results": [
      { "nights": 1, "predictions": 726614, "maxCalibrationGap": 0.043,   // fraction, not points
        "skill": { "regionAllYear": {"value", "lo", "hi"}, "nationalMonth": {...}, "regionMonth": {...} } }
    ]
  },
  "stats": {
    "darknessCloudCorrelation": -0.391,
    "clearNightShareHalves": [{ "years": [...], "share": 0.2811 }, ...],
    "goodNightShareByMonth": [12 fractions, Jan..Dec]
  },
  "files": {
    "<key>": { "path": "cells.json", "bytes": 401776, "sha256": "…", "description": "…" }
  }
}
```

The app appends the first 12 hex digits of each file's `sha256` as `?v=` when fetching, so browsers and CDNs never mix files from two data releases. The manifest itself is fetched with `cache: "no-cache"`.

## Files

| Key             | File                   | Format                                                                                                                                              |
| --------------- | ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| `cells`         | `cells.json`           | Array of region objects, below. Order defines the cell index everywhere else.                                                                       |
| `prefectures`   | `prefectures.geojson`  | FeatureCollection of prefecture outlines, coordinates rounded to 0.001°.                                                                            |
| `lightSources`  | `light-sources.json`   | `[lat, lon, "English (日本語)", totalRadiance]`, brightest first.                                                                                   |
| `nightMasks`    | `night-masks.u16.gz`   | gzip of uint16 little-endian, `nights × cells`, row-major (night-major). Bit _k_ set = hour `firstHourLocal + k` had cloud below `clearCloudBelow`. |
| `skyBrightness` | `sky-brightness.u8.gz` | gzip of uint8 `rows × cols`. SQM = `sqmOffset + code / sqmScale`; 255 = sea.                                                                        |
| `radiance`      | `radiance.u8.gz`       | gzip of uint8 `rows × cols`. Radiance = `expm1(code / radianceLevels × log1p(radianceMax))` nW/cm²/sr.                                              |
| `bortleOverlay` | `bortle.png`           | RGBA, rows resampled to Web Mercator, spans `overlayBounds`.                                                                                        |
| `trendOverlay`  | `trend.png`            | Same geometry.                                                                                                                                      |

Pixel row _r_, column _c_ covers latitude `north − (r + ½)·step`, longitude `west + (c + ½)·step`.

Some hosts serve `.gz` files with `Content-Encoding: gzip`, so the browser has already unpacked them; the app checks the gzip magic bytes and handles both.

### Region object (`cells.json`)

| Field            | Type           | Meaning                                                               |
| ---------------- | -------------- | --------------------------------------------------------------------- |
| `r`, `c`         | int            | Row and column on the 0.25° cloud grid (neighbours are ±1).           |
| `lat`, `lon`     | number         | Cell centre.                                                          |
| `bl`             | `[lon, lat]`   | Darkest land pixel in the cell (the default pin).                     |
| `sqm`            | number         | Estimated zenith brightness there, mag/arcsec².                       |
| `f4`             | number         | Share of the cell's land at Bortle 4 or darker.                       |
| `dome`           | number[8]      | Share of artificial glow from N, NE, E, SE, S, SW, W, NW (2–150 km).  |
| `domeI`          | number         | Total glow from those sources (model units).                          |
| `domeSrc`        | string \| null | Municipality contributing most to the strongest sector.               |
| `trend`          | number \| null | Satellite light change, % per decade; null where too dark to measure. |
| `en`, `jp`       | string         | Municipality at the darkest spot.                                     |
| `pref`, `prefjp` | string         | Prefecture.                                                           |
| `also`           | string[]       | Up to 8 municipalities in the cell, `"English\|日本語"`, by area.     |
