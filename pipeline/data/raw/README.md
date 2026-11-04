# Raw inputs

Put the pipeline's inputs here. They are git-ignored; the source of truth is the Cloud Storage
bucket used by the yearly update (`gs://$HOSHIMACHI_BUCKET/hoshimachi/raw/`).

| File | What it is | How to get it |
|---|---|---|
| `era5_nights_*.tif` | Nightly 12-bit clear-hour masks from ERA5, one band per night named `dYYYYMMDD`. Any split by year works (one file per year, or several years per file); together they must cover whole calendar years with no gaps. | `pipeline/earthengine/export.py` (automated) or `export_manual.js` (Code Editor) |
| `viirs_japan_30s.tif` | Band 1: latest VIIRS annual radiance. Band 2: linear trend per year since 2014. 30 arc-second grid. | same |
| `viirs_japan_30s.json` | Optional: `{"firstYear": 2014, "lastYear": 2024}` for the trend text in the app. | written by `export.py` |
| `muni_s0010.json` | Municipality polygons (MLIT 国土数値情報 N03, simplified by SmartNews Media Research Institute, [japan-topography](https://github.com/smartnews-smri/japan-topography)). | download once |
| `prefs_s0001.json` | Prefecture polygons, same source. | download once |

Check what is here with `hoshimachi info`.
