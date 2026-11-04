# Yearly data update

Each spring, one more year of cloud history is added and everything is rebuilt and re-validated. No code changes: years, validation splits and model settings all follow the data (see `ARCHITECTURE.md`).

## Automated (GitHub Actions)

`.github/workflows/yearly-update.yml` runs every 15 April (ERA5 in Earth Engine lags real time by about three months) and can be started by hand from the Actions tab with a chosen year.

It:

1. exports the previous year's nightly cloud masks (and, by default, a fresh VIIRS night-light composite) from Earth Engine to Cloud Storage;
2. downloads every raw input from the bucket;
3. runs `hoshimachi build`, which **stops without publishing if the validation gate fails**;
4. checks the published files and runs the browser smoke test on the new data;
5. opens a pull request `Data update: add <year>` with the validation table in its description and the full report attached to the run.

Merging the pull request deploys it (if `deploy-pages.yml`, or your host's Git integration, is on).

### One-time setup

1. **Google Cloud project** with the Earth Engine API enabled and the project [registered for Earth Engine](https://developers.google.com/earth-engine/guides/access) (non-commercial use is free).
2. **Bucket**, e.g. `gs://hoshimachi-data`. Upload the current raw inputs to `hoshimachi/raw/` once:
   ```bash
   gcloud storage cp pipeline/data/raw/* gs://hoshimachi-data/hoshimachi/raw/
   ```
3. **Service account** with roles _Earth Engine Resource Writer_ and _Service Usage Consumer_ on the project and _Storage Object Admin_ on the bucket. Create a JSON key.
4. In the GitHub repository settings:
   - Secret `GEE_SERVICE_ACCOUNT_KEY`: the JSON key.
   - Variables `HOSHIMACHI_BUCKET` (bucket name, no `gs://`) and `HOSHIMACHI_GCP_PROJECT`.
   - Actions › General › "Allow GitHub Actions to create and approve pull requests": on.

Workload Identity Federation is the more secure alternative to a JSON key; swap the `google-github-actions/auth` step's input if you set it up.

`earthengine/export.py` mirrors `earthengine/export_manual.js`, which produced the current data, but has not yet been run end to end. Run the workflow once by hand for an existing year (say 2024) and compare the downloaded file with the manual export before relying on the schedule.

## Manual

```bash
# 1. Export: in the Earth Engine Code Editor, run pipeline/earthengine/export_manual.js with YEARS = [2025],
#    or: python pipeline/earthengine/export.py --bucket <bucket> --years 2025 --viirs
# 2. Put era5_nights_2025.tif (and the VIIRS files) in pipeline/data/raw/
cd pipeline
hoshimachi info      # should now report one more year, and the new validation split
hoshimachi build     # stops if the gate fails
hoshimachi check
cd .. && npm run build:single && npm test
```

Commit `app/data/` (and nothing else should have changed).

## Reviewing an update

The pull request shows the validation table. Compare it with the previous release:

- **Model settings** (window, neighbour weight) may change as the validation years roll. That is expected; large swings between years are worth a look.
- **Calibration gaps** should stay in single digits. The gate blocks anything over 8 points.
- **Skill** against the season-only and season-blind baselines should stay clearly positive (the gate requires the lower 95% bound above zero). Skill against region-and-month is small by nature (about 1%); it is reported, not gated.
- **Darkness vs cloud correlation** and the clear-night share by half should move only slightly. A big jump usually means an export problem, not a change in climate.

If the gate fails, nothing is published and the run's `validation-report` artifact explains why. Usually the cause is an incomplete export; re-run it. If the model genuinely degrades, revisit the method in `config.toml` (for example the window grid) in a normal pull request. `hoshimachi build --force` publishes despite a failing gate and should only be used with a written reason.

## When something else changes

- **VIIRS adds a new version** (v2.3, …): add the collection in both export scripts.
- **Municipal mergers**: refresh `muni_s0010.json` from the boundaries source; region names update on the next build.
- **Extending the record backwards** (pre-2015) works the same way: add the files; the gap check requires the record to be continuous.
