/** Small, dependency-free helpers shared by several modules. */
import { DIRS, MONTHS } from "./config.js";
import { isJa, t } from "./i18n.js";

export const R2D = 180 / Math.PI;

/** Escape text for use inside HTML attributes and text. */
export function esc(t) {
  return String(t).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
}

/** A probability as a short percentage, e.g. 0.834 -> "83%". */
export function pct(p) {
  return p >= 0.995 ? ">99%" : p > 0 && p < 0.005 ? "<1%" : Math.round(p * 100) + "%";
}

/** Great-circle distance in km between [lat, lon] points. */
export function hav(a, b) {
  const R = 6371,
    p1 = a[0] / R2D,
    p2 = b[0] / R2D,
    dp = p2 - p1,
    dl = (b[1] - a[1]) / R2D;
  const x = Math.sin(dp / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}

/** Initial bearing in degrees from a to b ([lat, lon]). */
export function bearing(a, b) {
  const p1 = a[0] / R2D,
    p2 = b[0] / R2D,
    dl = (b[1] - a[1]) / R2D;
  const y = Math.sin(dl) * Math.cos(p2),
    x = Math.cos(p1) * Math.sin(p2) - Math.sin(p1) * Math.cos(p2) * Math.cos(dl);
  return (Math.atan2(y, x) * R2D + 360) % 360;
}

export function dirName(deg) {
  return DIRS[Math.round(deg / 45) % 8]; // an English code (N, NE, …); translate with t() for display
}

export const isLeap = (y) => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;

/** [y, m, d] shifted by k days. */
export function addDays(ymd, k) {
  const t = new Date(Date.UTC(ymd[0], ymd[1] - 1, ymd[2] + k));
  return [t.getUTCFullYear(), t.getUTCMonth() + 1, t.getUTCDate()];
}

/** "YYYY-MM-DD" shifted by k days. */
export function isoAdd(iso, k) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + k)).toISOString().slice(0, 10);
}

/** [y, m, d] -> "Jan 7" (English) or "1月7日" (Japanese). */
export function fmtDate(d) {
  return isJa() ? `${d[1]}月${d[2]}日` : `${MONTHS[d[1] - 1]} ${d[2]}`;
}

/** Short month name for month m (0..11): "Jan" or "1月". */
export const monthName = (m) => (isJa() ? `${m + 1}月` : MONTHS[m]);

/** Whole days from today (local date) to [y, m, d]; negative if in the past. */
export function daysFromToday(ymd) {
  const t = new Date();
  const today = Date.UTC(t.getFullYear(), t.getMonth(), t.getDate());
  return Math.round((Date.UTC(ymd[0], ymd[1] - 1, ymd[2]) - today) / 864e5);
}

/** An "i" button whose text shows as a tooltip (see the tooltip handlers in controls.js). */
export function ib(text, label) {
  return `<button type="button" class="ib" aria-label="${esc(t("About: {x}", { x: label }))}" data-tip="${esc(text)}">i</button>`;
}
