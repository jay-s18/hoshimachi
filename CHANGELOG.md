# Changelog

All notable changes to this project. Data releases are listed with the period they cover.

## [Unreleased]

- Fixed the app's "no peeking" rule for dates inside the record: past trips whose ±window or later nights crossed New Year into an excluded year were still counted. The app now applies the same rule as the validation (a past trip must start and end outside excluded years). Future trips and the validation results are unaffected.
- Fixed "What actually happened" for trips crossing New Year inside the record: it reported the end year's dates (the next winter) instead of the trip's own.
- Japanese language: an English / 日本語 button in the header switches every label, note, tooltip, legend and the How it works dialog; place names show in Japanese first. Opens in Japanese for Japanese browsers, remembers the choice, and shared links keep it (`lang=ja`).
- "What you'll see here" in each region card: for the pin's Bortle class, roughly how many stars are visible at once and how the Milky Way looks, with an illustrated sky; tap 1–9 to compare classes.
- Exact light trend per ~1 km pixel: the pipeline publishes `light-trend.u8.gz` (% per decade), generated for the current data from the same VIIRS export (verified to reproduce `trend.png` and every region's trend exactly). The region card shows the pin's own % ("−13% per decade · dimming") as well as the region's.
- The Light trend layer is drawn in the browser from that grid, so the map's colour and the card always describe the same pixel (the pre-rendered image matched only ~86% of the time near colour edges).
- Map overlays are sampled at the centre of each Web Mercator row, as Leaflet draws them (previously up to one pixel off); `bortle.png` and `trend.png` regenerated.

- Live forecast in the odds is a checkbox, off by default; when the trip is within a week and it is off, a note explains what it does. A region card loads its own forecast with one tap (automatically when the checkbox is on). To stay inside the free Open-Meteo limit shared by a classroom's network, only the regions passing the filters (plus the open one) are fetched, each at most once an hour, and kept in `localStorage`.
- Place search moved to float over the map's top-left corner and suggests places as you type (Photon, plus GSI for Japanese text) in a drop-down; Enter takes the first. Layer buttons sit below it; zoom buttons moved to the bottom right.
- Light trend at the pin is given in % per decade, the same unit as the region figure.

### App

- Live cloud forecast: for trips starting within 7 days, nights in range blend the Japan Meteorological Agency forecast (via Open-Meteo) with the historical odds. The trust rule is hand-set and labelled as not validated.
- Shareable links: dates, settings and the pinned spot are kept in the URL; a Share button copies it.
- "Live forecast at the pin" section: the next 8 nights hour by hour (cloud cover, usable dark hours), with clear hours, low temperature, wind, rain and dew risk.
- Place search in the header: instant suggestions from spots and towns, and any named place in Japan via GSI / OpenStreetMap on Enter.
- Light trend in the region card is now also read at the pin (~1 km), not only for the whole region, so it matches the map's colours.
- The trip forecast is cached for an hour in `localStorage` and retried automatically after a rate-limit error.
- The pinned spot shows its place name (local district plus municipality, county and prefecture) from GSI and OpenStreetMap.
- Spot markers select their region and pin the exact spot.
- Roads is the default base map, without labels until zoom 8; Plain is the fallback when tiles can't load.
- The darkness layer is a smooth gradient instead of 1 km blocks in nine flat colours.

### Pipeline

- `bortle.png` is coloured on a continuous ramp from the published SQM codes (palette PNG).
- Tests run on Windows (forward-slash paths in the test config).

## [1.0.0] - 2026-11-05

First structured release, from the single-file prototype.

### App

- Split into ES modules (`app/js/`), one per concern; external CSS; vendored, pinned Leaflet 1.9.4 and SunCalc 1.9.0.
- All data loaded from `app/data/` through `manifest.json`; years, validated model settings and the validation table are read from it, so data updates need no code changes.
- Checksum-versioned data URLs, schema version check, loading and error states.
- Single-file offline build (`npm run build:single`).

### Pipeline

- Scripts turned into the `hoshimachi_pipeline` package with one `config.toml` and a `hoshimachi` command (`build`, `check`, `info`).
- Cloud exports accepted in any split by year, with gap and whole-year checks.
- Validation integrated with a rolling tune/test split and a publication gate.
- Deterministic, atomic publishing with SHA-256 checksums.
- Earth Engine exports per year (Python API for automation, Code Editor script for manual use).

### Tooling

- ESLint, Prettier, Ruff; Playwright smoke tests; pytest unit tests.
- GitHub Actions: CI, scheduled yearly data update that opens a pull request only if validation passes, optional GitHub Pages deploy.

### Data

- 2015-01-01 to 2024-12-31 (10 years, 994 regions). Validated on 2023–2024: window ±30 days, neighbour weight 0.25.
