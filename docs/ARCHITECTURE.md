# Architecture

Hoshimachi has two halves joined by one contract:

```
 raw inputs ──► pipeline (Python) ──► app/data/ + manifest.json ──► app (static JS) ──► browser
 (Earth Engine,     config.toml           the contract:                reads everything
  boundaries)       validation gate       docs/DATA_FORMAT.md          data-dependent from it
```

The pipeline does the heavy, slow, reproducible work once per data update. The app does the per-trip work (dates, moon, filters) live in the browser, so it needs no server.

## The app (`app/`)

Plain ES modules, loaded natively by the browser: no framework, no bundler, no build step. Leaflet and SunCalc are vendored at pinned versions and loaded as classic scripts that define the globals `L` and `SunCalc`.

| Module        | Responsibility                                                                                                                                                                           |
| ------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `main.js`     | Entry point. Loads data, fills data-dependent text (`data-bind` spans, the validation table), sets default dates, starts everything. Shows a readable error if loading fails.            |
| `config.js`   | Product constants that do **not** change with the data: starting cities, marked spots, colour scales, astronomy thresholds, base-map tiles, panorama settings.                           |
| `data.js`     | Loads `data/manifest.json` and the files it lists; checks the schema version and sizes; exposes the data as read-only live bindings (`CELLS`, `MASKS`, `YEARS`, `MODEL`, …).             |
| `state.js`    | The user's current settings, one plain object.                                                                                                                                           |
| `astro.js`    | Sun, moon and Milky Way timing; the 12-bit usable-hour masks; good-night tests.                                                                                                          |
| `odds.js`     | The odds model: replay, neighbour shrinkage, 95% range, month climatology. Mirrors `pipeline/.../validation/estimator.py`.                                                               |
| `sky.js`      | Pixel-level readings at the pin: sky brightness, light-dome directions, the horizon panorama.                                                                                            |
| `map.js`      | The Leaflet map: layers, overlays, legend, selection box and pin.                                                                                                                        |
| `panel.js`    | The ranked list and the region card.                                                                                                                                                     |
| `controls.js` | The settings panel, moon strip and info tooltips.                                                                                                                                        |
| `app.js`      | `recompute()`: runs the model for every region after a change and redraws. Holds `results`.                                                                                              |
| `forecast.js` | Live cloud forecast (JMA via Open-Meteo) blended into the odds for trip nights within 7 days. A hand-set trust rule, not validated like the history; loads in the background.            |
| `place.js`    | Place names: reverse lookup for the pin (GSI and Nominatim) and place search (Photon and GSI); throttled and cached. Names chosen in search or from a spot marker are kept on the pin.   |
| `weather.js`  | "Live forecast at the pin": the next 8 nights hour by hour (cloud, usable dark hours) with clear hours, low, wind, rain, dew.                                                            |
| `search.js`   | Place search floating over the map: as you type, a drop-down of Hoshimachi's spots and towns plus places from Photon (and GSI for Japanese text). Selects the region and pins the place. |
| `link.js`     | Shareable links: reads settings and the selected spot from the URL at start-up and keeps the address bar in sync.                                                                        |
| `util.js`     | Small pure helpers (dates, distances, escaping).                                                                                                                                         |

Conventions:

- **Data flows one way.** Controls change `state`, then call `schedule()`; `recompute()` rebuilds `results` and redraws the map and panel. Nothing else writes `results`.
- **Live bindings for shared data.** Modules `export let` values and assign them only in their own module; importers always see the current value.
- **Nothing year-specific in code.** Years, counts and validated settings come from the manifest. `grep -rn "20[12][0-9]" app/js` should only find comments and the certification years of the marked spots.
- **Strings from data are escaped** (`esc()`) before going into HTML.

### Adding a feature

- A new control: add the markup in `index.html`, a field in `state.js`, wire it in `controls.js`, and read it where it matters (usually `odds.js` or `app.js`).
- A new per-region field: compute it in `pipeline/src/hoshimachi_pipeline/cells.py`, document it in `DATA_FORMAT.md`, and read it in `panel.js`. Adding a field is backwards compatible; renaming or removing one is a schema change (bump `SCHEMA_VERSION` in both `publish.py` and `data.js`).
- A new map layer: build the image in `overlays.py`, register it in `publish.FILES`, and add it to `map.js`.

## The pipeline (`pipeline/`)

A Python package with one command, `hoshimachi`. Every setting that shapes the data is in `config.toml`, loaded into frozen dataclasses (`config.py`) that reject unknown or missing keys.

| Step                  | Module                    | Output                                                                                           |
| --------------------- | ------------------------- | ------------------------------------------------------------------------------------------------ |
| Read and check inputs | `inputs.py`               | Nightly masks merged from any number of files; must be whole years without gaps.                 |
| Skyglow               | `sky.py`                  | Walker's-law convolution of VIIRS radiance out to 150 km, in latitude bands. Cached in `build/`. |
| Calibration           | `sky.py`                  | SQM per pixel, anchored to one ground reading; Bortle classes.                                   |
| Regions               | `cells.py`, `names.py`    | Per-cell metadata (darkest spot, light domes, trend, towns) and the nights × cells mask matrix.  |
| Good nights           | `validation/nights.py`    | Clear and astronomically dark hours, at each cell centre.                                        |
| Validation and gate   | `validation/run.py`       | Rolling tune/test split, chosen settings, skill and calibration, pass/fail.                      |
| Summary stats         | `stats.py`                | Numbers quoted in the About dialog.                                                              |
| Overlays and grids    | `overlays.py`, `grids.py` | Map images, byte grids for spot readings, named light sources.                                   |
| Publish               | `publish.py`              | Writes `app/data/` atomically with checksums in `manifest.json`.                                 |

The build is deterministic: the same inputs and config give byte-identical files (gzip timestamps are zeroed), so a data pull request shows only real changes.

## Validation

The odds are a base rate, so the test is whether they are honest (calibrated) and better than simpler base rates (skill). With full years Y₀…Yₙ:

- **Test**: the last 2 years, scored once at the end.
- **Tune**: the 2 years before that. Every combination of replay window (0, 7, 15, 30 days) and neighbour weight (0, 0.25, 0.5, 0.75) is scored on trips starting there, fitting only on earlier years. One setting is chosen for all trip lengths.
- **Final**: refit on everything before the test years with the chosen setting, then score every trip start date in the test years, for 1-, 3- and 5-night trips, across all regions.

Baselines: the region's all-year rate (ignores season), the national rate for the month (ignores region), and the region's rate for the month (the strongest simple rule). Skill is the Brier skill score with a 95% interval from a block bootstrap over test weeks (all regions in one week share weather, so weeks, not predictions, are resampled).

The **gate** (in `config.toml`) blocks publication if, for any trip length, the largest calibration gap exceeds 8 points or the skill interval against the season-only or season-blind baseline reaches zero. The chosen setting and a summary are written into the manifest; the app shows them in the About dialog.

With the 2015–2024 data: settings ±30 days and neighbour weight 0.25; largest calibration gaps 4.3 / 5.7 / 6.2 points; skill 6.8–14.3% against either simple baseline and 0.7–1.7% against region-and-month.
