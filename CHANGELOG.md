# Changelog

All notable changes to this project. Data releases are listed with the period they cover.

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
