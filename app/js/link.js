/**
 * Shareable links: the trip dates, filters, map style and selected spot are kept in the address bar,
 * e.g. ?d=2026-11-08&to=2026-11-10&b=3&cell=40_65&pin=35.9500,138.4700
 * so copying the URL shares the exact view. Only settings that differ from the defaults are written,
 * except the dates, which are always included (the default dates move with the moon).
 * Invalid values in a link are ignored rather than trusted.
 */
import { ORIGINS } from "./config.js";
import { CELLS } from "./data.js";
import { state } from "./state.js";
import { lang } from "./i18n.js";

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const MAX_NIGHTS = 14;

const oneOf =
  (...vals) =>
  (v) =>
    vals.includes(v) ? v : undefined;
const bool = (v) => (v === "0" ? false : v === "1" ? true : undefined);
const int = (lo, hi) => (v) => {
  const n = Number(v);
  return Number.isInteger(n) && n >= lo && n <= hi ? n : undefined;
};

/** [URL parameter, state key, parse] for the simple settings. Ranges match the controls in index.html. */
const FIELDS = [
  ["o", "origin", (v) => (ORIGINS.some((x) => x[0] === v) ? v : undefined)],
  ["km", "dist", int(100, 1500)],
  ["t", "target", oneOf("sky", "mw")],
  ["b", "bortle", int(1, 5)],
  ["h", "hours", int(1, 10)],
  ["r", "rule", oneOf("run", "any")],
  ["l", "layer", oneOf("trip", "month", "dark", "trend")],
  ["map", "base", oneOf("plain", "roads", "terrain")],
  ["spots", "spots", bool],
  ["live", "live", bool],
];

let defaults = null;

const days = (a, b) => Math.round((Date.parse(b) - Date.parse(a)) / 864e5);

/**
 * Apply the settings in the current URL to `state`. Call after the defaults are set and before the map
 * and controls are built. Returns the region and pin to select once the map exists ({ sel: null } if none).
 */
export function readLink() {
  defaults = { ...state };
  const q = new URLSearchParams(location.search);
  for (const [param, key, parse] of FIELDS) {
    const v = q.has(param) ? parse(q.get(param)) : undefined;
    if (v !== undefined) state[key] = v;
  }
  const d = q.get("d"),
    to = q.get("to");
  if (ISO.test(d ?? "") && ISO.test(to ?? "") && !isNaN(Date.parse(d)) && !isNaN(Date.parse(to))) {
    const n = days(d, to);
    if (n >= 1 && n <= MAX_NIGHTS) Object.assign(state, { date: d, dateTo: to, nights: n });
  }
  const [r, c] = (q.get("cell") || "").split("_").map(Number);
  const sel = CELLS.findIndex((x) => x.r === r && x.c === c);
  const [lat, lon] = (q.get("pin") || "").split(",").map(Number);
  const pin = Number.isFinite(lat) && Number.isFinite(lon) && Math.abs(lat) <= 90 && Math.abs(lon) <= 180 ? [lat, lon] : null;
  return { sel: sel >= 0 ? sel : null, pin };
}

/** Write the current view into the address bar (no new history entry). */
export function writeLink() {
  if (!defaults || !state.date) return;
  const parts = [`d=${state.date}`, `to=${state.dateTo}`];
  for (const [param, key] of FIELDS)
    if (state[key] !== defaults[key])
      parts.push(`${param}=${typeof state[key] === "boolean" ? (state[key] ? 1 : 0) : encodeURIComponent(state[key])}`);
  if (state.sel != null) {
    const c = CELLS[state.sel];
    parts.push(`cell=${c.r}_${c.c}`);
    if (state.pin) parts.push(`pin=${state.pin[0].toFixed(4)},${state.pin[1].toFixed(4)}`);
  }
  if (lang === "ja") parts.push("lang=ja"); // a shared Japanese view opens in Japanese
  const url = `${location.pathname}?${parts.join("&")}${location.hash}`;
  if (url !== location.pathname + location.search + location.hash) history.replaceState(null, "", url);
}
