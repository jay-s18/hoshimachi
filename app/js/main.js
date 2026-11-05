/**
 * Entry point: load the data, fill data-driven text, then start the map and controls.
 */
import { loadData, manifest, CELLS, YEARS, MODEL, periodLabel } from "./data.js";
import { state } from "./state.js";
import { esc, isoAdd } from "./util.js";
import { applyStatic, isJa, onLang, t } from "./i18n.js";
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
  const els = document.querySelectorAll("[data-validation]"); // one in each language's copy of the dialog
  const v = manifest.validation;
  if (!v) {
    els.forEach((el) => (el.innerHTML = `<p class="hint">${t("No validation results are bundled with this data.")}</p>`));
    return;
  }
  const ci = (s) => `${fmtPct(s.value)}% <span class="hint">(${fmtPct(s.lo)}–${fmtPct(s.hi)})</span>`;
  const rows = v.results
    .map(
      (r) =>
        `<tr><td>${t(r.nights > 1 ? "{n} nights" : "{n} night", { n: r.nights })}</td><td class="num">${t("{x} pts", { x: fmtPct(r.maxCalibrationGap) })}</td><td class="num">${ci(r.skill.regionAllYear)}</td><td class="num">${ci(r.skill.nationalMonth)}</td></tr>`,
    )
    .join("");
  const rm = v.results.map((r) => r.skill.regionMonth.value);
  const perLength = v.predictionsPerTripLength
    ? t(" (about {k},000 predictions per trip length)", { k: Math.round(v.predictionsPerTripLength / 1000).toLocaleString("en") })
    : "";
  let html = `<p>${t("Settings were chosen on {tune} using data before them. The model was then refit on everything before {y0} and tested once on every trip start date in {test} across all {n} regions{per}.", { tune: yearSpan(v.tuneYears), y0: v.testYears[0], test: yearSpan(v.testYears), n: CELLS.length.toLocaleString("en"), per: perLength })}</p>
    <table>
      <tr><th>${t("Trip length")}</th><th>${t("Largest calibration gap")}</th><th>${t("Better than ignoring the season")}</th><th>${t("Better than ignoring the region")}</th></tr>
      ${rows}
    </table>
    <p>${t('Brier skill scores with 95% block-bootstrap intervals. Most of the skill comes from knowing the region and the season: against a plain "this region, this month" average, the replay and blending add {lo}–{hi}%. A single night\'s weather is mostly luck, so no base rate can be sharp; its job is to be honest about the odds.', { lo: fmtPct(Math.min(...rm)), hi: fmtPct(Math.max(...rm)) })}</p>`;
  // The note is written by the pipeline in English only.
  if (v.note && !isJa()) html += `<p>${esc(v.note)}</p>`;

  const s = manifest.stats;
  if (s) {
    const bits = [];
    if (s.darknessCloudCorrelation != null)
      bits.push(
        t("Across Japan, darkness and clear-night odds are negatively correlated ({r}).", {
          r: s.darknessCloudCorrelation.toFixed(2).replace("-", "−"),
        }),
      );
    if (s.clearNightShareHalves?.length === 2) {
      const [a, b] = s.clearNightShareHalves;
      bits.push(
        t("National clear-night frequency was {a}% in {ya} and {b}% in {yb}.", {
          a: fmtPct(a.share),
          ya: yearSpan(a.years),
          b: fmtPct(b.share),
          yb: yearSpan(b.years),
        }),
      );
    }
    if (bits.length) html += `<p>${t("Other checks:")} ${bits.join(" ")}</p>`;
  }
  els.forEach((el) => (el.innerHTML = html));
}

function showBootError(err) {
  const boot = document.getElementById("boot");
  boot.classList.add("error");
  boot.innerHTML = `<b>${t("Hoshimachi could not start.")}</b><br>${esc(err.message || String(err))}<br><span class="hint">${t("If you opened index.html directly from disk, serve the folder over HTTP instead (see README).")}</span>`;
  console.error(err);
}

async function main() {
  applyStatic(); // the loading message and page title in the chosen language
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
    onLang(() => {
      renderValidation();
      recompute(); // redraws the map legend, the list or card, and the moon strip
    });
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
