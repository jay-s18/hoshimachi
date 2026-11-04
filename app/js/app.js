/**
 * Recomputes the odds for every region whenever a setting changes, then redraws the map and panel.
 */
import { BORTLE_SQM, ORIGINS } from "./config.js";
import { CELLS } from "./data.js";
import { state, ymd, monthOf } from "./state.js";
import { hav } from "./util.js";
import { blendAll, excludedYears, monthBlend, monthRaw, tripRaw } from "./odds.js";
import { paint } from "./map.js";
import { renderPanel } from "./panel.js";
import { moonLine } from "./controls.js";

/** Debounce for slider drags, in ms. */
const RECOMPUTE_DELAY = 120;

/**
 * Latest result per cell (same order as CELLS):
 * { i, ok, p, lo, hi, m, nightP, wins, dates, anyWin, expGood, luck, actual, ... }.
 * Reassigned by recompute(); other modules see the update through the live binding.
 */
export let results = [];

const originPoint = () => ORIGINS.find((o) => o[0] === state.origin)[2];

/** Straight-line km from the chosen origin to the cell's darkest spot, or null for "anywhere". */
export function distOf(c) {
  const o = originPoint();
  return o ? hav(o, [c.bl[1], c.bl[0]]) : null;
}

/** Darkness and distance filters. */
function filtersPass(c) {
  if (c.sqm < BORTLE_SQM[state.bortle]) return false;
  const d = distOf(c);
  return d === null || d <= state.dist;
}

export function recompute() {
  const opt = { moon: true, mw: state.target === "mw" },
    d = ymd(),
    k = state.nights,
    excl = excludedYears(d, k);
  const blended = blendAll(CELLS.map((_, i) => tripRaw(i, d, k, opt, excl)));
  // Month odds are only needed for the month layer; skip them otherwise (they are the slow part).
  const mvals = state.layer === "month" ? CELLS.map((_, i) => monthRaw(i, monthOf(), opt)) : null;
  results = CELLS.map((c, i) => Object.assign(blended[i], { ok: filtersPass(c), i, m: mvals ? monthBlend(mvals, i) : undefined }));
  state.excl = excl;
  moonLine();
  paint();
  renderPanel();
}

let timer = null;
/** Recompute shortly after the last change. */
export function schedule() {
  clearTimeout(timer);
  timer = setTimeout(recompute, RECOMPUTE_DELAY);
}
