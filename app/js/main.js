/**
 * Entry point: load the data, fill data-driven text, then start the map and controls.
 */
import { loadData, manifest, CELLS, YEARS, MODEL, periodLabel } from "./data.js";
import { state } from "./state.js";
import { esc, isoAdd } from "./util.js";
import { nextNewMoon } from "./astro.js";
import { centerOn, initMap, select } from "./map.js";
import { readLink } from "./link.js";
import { initControls } from "./controls.js";
import { initSearch } from "./search.js";
import { recompute } from "./app.js";

/** Default trip length on first load, in nights. */
const DEFAULT_NIGHTS = 2;

const fmtPct = (x, digits = 1) => (x * 100).toFixed(digits);
const yearSpan = (ys) => (ys.length > 1 ? `${ys[0]}–${ys[ys.length - 1]}` : `${ys[0]}`);

/** Text in the page that depends on the data (years, validated settings) is filled from the manifest. */
function bindText() {
  const w = MODEL.windowDays;
  const values = {
    period: periodLabel(),
    yearsCount: String(YEARS.length),
    windowDays: String(w),
    maxTrips: ((2 * w + 1) * YEARS.length).toLocaleString("en"),
    blendRatio: `${Math.round(MODEL.ownWeight * 100)}/${Math.round((1 - MODEL.ownWeight) * 100)}`,
    regions: CELLS.length.toLocaleString("en"),
  };
  document.querySelectorAll("[data-bind]").forEach((el) => {
    const v = values[el.dataset.bind];
    if (v !== undefined) el.textContent = v;
  });
  const first = YEARS[0];
  document.getElementById("dFrom").min = `${first}-01-01`;
  document.getElementById("dTo").min = `${first}-01-02`;
}

/** The "How well it works" section of the About dialog, from manifest.validation and manifest.stats. */
function renderValidation() {
  const el = document.getElementById("validation-summary");
  const v = manifest.validation;
  if (!v) {
    el.innerHTML = `<p class="hint">No validation results are bundled with this data.</p>`;
    return;
  }
  const ci = (s) => `${fmtPct(s.value)}% <span class="hint">(${fmtPct(s.lo)}–${fmtPct(s.hi)})</span>`;
  const rows = v.results
    .map(
      (r) =>
        `<tr><td>${r.nights} night${r.nights > 1 ? "s" : ""}</td><td class="num">${fmtPct(r.maxCalibrationGap)} pts</td><td class="num">${ci(r.skill.regionAllYear)}</td><td class="num">${ci(r.skill.nationalMonth)}</td></tr>`,
    )
    .join("");
  const rm = v.results.map((r) => r.skill.regionMonth.value);
  const perLength = v.predictionsPerTripLength
    ? ` (about ${Math.round(v.predictionsPerTripLength / 1000).toLocaleString("en")},000 predictions per trip length)`
    : "";
  let html = `<p>Settings were chosen on ${yearSpan(v.tuneYears)} using data before them. The model was then refit on everything before ${v.testYears[0]} and tested once on every trip start date in ${yearSpan(v.testYears)} across all ${CELLS.length.toLocaleString("en")} regions${perLength}.</p>
    <table>
      <tr><th>Trip length</th><th>Largest calibration gap</th><th>Better than ignoring the season</th><th>Better than ignoring the region</th></tr>
      ${rows}
    </table>
    <p>Brier skill scores with 95% block-bootstrap intervals. Most of the skill comes from knowing the region and the season: against a plain "this region, this month" average, the replay and blending add ${fmtPct(Math.min(...rm))}–${fmtPct(Math.max(...rm))}%. A single night's weather is mostly luck, so no base rate can be sharp; its job is to be honest about the odds.</p>`;
  if (v.note) html += `<p>${esc(v.note)}</p>`;

  const s = manifest.stats;
  if (s) {
    const bits = [];
    if (s.darknessCloudCorrelation != null)
      bits.push(
        `Across Japan, darkness and clear-night odds are negatively correlated (${s.darknessCloudCorrelation.toFixed(2).replace("-", "−")}).`,
      );
    if (s.clearNightShareHalves?.length === 2) {
      const [a, b] = s.clearNightShareHalves;
      bits.push(
        `National clear-night frequency was ${fmtPct(a.share)}% in ${yearSpan(a.years)} and ${fmtPct(b.share)}% in ${yearSpan(b.years)}.`,
      );
    }
    if (bits.length) html += `<p>Other checks: ${bits.join(" ")}</p>`;
  }
  el.innerHTML = html;
}

function showBootError(err) {
  const boot = document.getElementById("boot");
  boot.classList.add("error");
  boot.innerHTML = `<b>Hoshimachi could not start.</b><br>${esc(err.message || String(err))}<br><span class="hint">If you opened index.html directly from disk, serve the folder over HTTP instead (see README).</span>`;
  console.error(err);
}

async function main() {
  try {
    await loadData();
    bindText();
    renderValidation();
    state.date = nextNewMoon();
    state.dateTo = isoAdd(state.date, DEFAULT_NIGHTS);
    state.nights = DEFAULT_NIGHTS;
    const shared = readLink(); // settings from a shared link override the defaults above
    initMap();
    initControls();
    initSearch();
    recompute();
    if (shared.sel !== null) {
      select(shared.sel, shared.pin);
      centerOn(state.pin);
    }
    document.getElementById("boot").hidden = true;
  } catch (err) {
    showBootError(err);
  }
}

main();
