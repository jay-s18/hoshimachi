# Hoshimachi 星待ち

**A stargazing trip planner for Japan.** Pick your dates, and Hoshimachi gives the odds of at least one clear, dark night for every region in Japan. It ranks the regions and shows each one's sky darkness, horizon light domes, moon hours, light-pollution trend and best months.

The odds come from replaying every year of hourly ERA5 cloud data on record (2015 onward) against the exact dark, moon-free hours of your trip. They were checked out of sample on 2.2 million predictions (see `docs/ARCHITECTURE.md` › Validation).

Every feature is listed in [`docs/FEATURES.md`](docs/FEATURES.md), with a table for comparing competitors.

```
hoshimachi/
├── app/                  the website: static HTML, CSS and ES modules, no build step
│   ├── index.html
│   ├── css/app.css
│   ├── js/               one module per concern (see docs/ARCHITECTURE.md)
│   ├── vendor/           Leaflet 1.9.4 and SunCalc 1.9.0, pinned, with licences
│   └── data/             the published dataset + manifest.json (written by the pipeline)
├── pipeline/             Python package that builds and validates app/data
│   ├── config.toml       every setting that shapes the data, in one reviewed file
│   ├── src/hoshimachi_pipeline/
│   ├── earthengine/      exports of the raw inputs from Google Earth Engine
│   └── tests/
├── tools/                dev server and the single-file (offline) builder
├── tests/                browser smoke tests (Playwright)
├── docs/                 features, architecture, data format, yearly update, deployment
└── .github/workflows/    CI, yearly data update, optional GitHub Pages deploy
```

## Run it locally

The app is static files. Any web server works; it must be served over HTTP, not opened as a file, because it fetches `data/`.

```bash
npm install          # dev tools only (lint, tests, single-file build); the app has no runtime npm dependencies
npm start            # http://localhost:8000
# or, with no Node at all:
cd app && python -m http.server 8000
```

## Host it

Upload the `app/` folder to any static host (GitHub Pages, Netlify, Cloudflare Pages, Vercel, S3, a university web space). There is no server code and nothing to configure. `docs/DEPLOY.md` has step-by-step notes, and `.github/workflows/deploy-pages.yml` publishes to GitHub Pages on every push to `main` once Pages is switched on.

For a single file that opens from disk or can be emailed (data included, about 5 MB):

```bash
npm run build:single   # -> dist/hoshimachi.html
```

## Rebuild the data

```bash
cd pipeline
pip install -e ".[dev]"
# put the raw inputs in pipeline/data/raw/ (see the README there)
hoshimachi info        # what years are present and how validation will split them
hoshimachi build       # skyglow -> calibration -> regions -> validation gate -> app/data
hoshimachi check       # app/data matches its manifest
```

`hoshimachi build` takes about 30 seconds on a laptop (plus a minute the first time, for the skyglow convolution, which is then cached). It refuses to publish if the refreshed model fails the validation gate.

## Yearly data updates

Adding a year needs **no code changes**. The period, the validation years and the model's settings all follow the data:

1. The cloud export for the new year is added next to the old ones (`era5_nights_2025.tif`).
2. `hoshimachi build` detects the longer record. Validation rolls forward: the last two years become the test set and the two before them choose the settings.
3. If the gate passes, `app/data/` and its `manifest.json` are rewritten. The app reads every year, count and setting from the manifest.

`.github/workflows/yearly-update.yml` does all of this on a schedule and opens a pull request for review. It needs a one-time setup (a Google Cloud project, a bucket and a service account), described in `docs/YEARLY_UPDATE.md`.

## Quality checks

|                                              | Command                                                | Runs in CI |
| -------------------------------------------- | ------------------------------------------------------ | ---------- |
| JavaScript lint and format                   | `npm run lint`                                         | ✓          |
| Browser smoke tests (hosted and single-file) | `npm run build:single && npm test`                     | ✓          |
| Python lint and format                       | `cd pipeline && ruff check . && ruff format --check .` | ✓          |
| Pipeline unit tests                          | `cd pipeline && pytest`                                | ✓          |
| Published data integrity                     | `cd pipeline && hoshimachi check`                      | ✓          |

## Data credits

- Cloud: ECMWF ERA5 hourly reanalysis (Copernicus Climate Change Service), via Google Earth Engine.
- Night lights: VIIRS Day/Night Band annual composites v2.1/v2.2, Earth Observation Group, Colorado School of Mines.
- Boundaries: MLIT 国土数値情報 (N03), simplified by SmartNews Media Research Institute.
- Base maps: 地理院タイル, Geospatial Information Authority of Japan.
- Libraries: Leaflet (BSD-2-Clause), SunCalc (BSD-2-Clause).

Each source has its own terms of use; keep these credits (they also appear in the app's About dialog) wherever the app is hosted.

## Licence

No licence has been chosen yet, so by default all rights are reserved. Add a `LICENSE` file before making the repository public if you want others to reuse the code (MIT or Apache-2.0 are common choices for a project like this).
