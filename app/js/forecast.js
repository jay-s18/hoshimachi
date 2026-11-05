/**
 * Live cloud forecast, blended into the historical odds for trip nights within FORECAST.days of today.
 *
 * For each such night the forecast's hourly cloud cover is turned into the same clear-hour mask the history
 * uses (cloud below manifest.night.clearCloudBelow), and the night counts as forecast-good or not with the
 * user's darkness window and hours rule. That is blended with the night's historical odds:
 *     p_night = w × forecastGood + (1 − w) × historicalNight,   w = trust(lead in days)
 * and the trip odds are adjusted night by night, so they equal the historical odds when the forecast adds nothing:
 *     P = 1 − (1 − P_history) × Π (1 − p_night) / (1 − historicalNight)
 * The trust rule is a hand-set assumption, not validated like the historical odds, and the UI says so.
 */
import { FORECAST } from "./config.js";
import { CELLS, manifest } from "./data.js";
import { POP, good } from "./astro.js";
import { daysFromToday } from "./util.js";

let groupOf = null; // cell index -> forecast point index
let points = null; // [[lat, lon]] per forecast point
// This hour's forecast, per point: data[pointIndex] = { t0, cc: [] }. Points are fetched only when a region
// that needs them is in play, so a page load asks for the regions passing the filters, not all of Japan.
let fc = { hour: null, data: [], loading: new Set(), retryAt: 0 };

/** One forecast point per 2×2 block of region cells, at the mean of their centres. */
function buildPoints() {
  const blocks = new Map();
  groupOf = CELLS.map((c) => {
    const k = `${c.r >> 1}_${c.c >> 1}`;
    if (!blocks.has(k)) blocks.set(k, { i: blocks.size, lat: 0, lon: 0, n: 0 });
    const b = blocks.get(k);
    b.lat += c.lat;
    b.lon += c.lon;
    b.n++;
    return b.i;
  });
  points = [...blocks.values()].map((b) => [b.lat / b.n, b.lon / b.n]);
}

/** Whether any night of a trip starting on [y, m, d] for k nights is within forecast range. */
export function tripInRange(d, k) {
  const lead = daysFromToday(d);
  return lead <= FORECAST.days && lead + k - 1 >= 0;
}

let wanted = []; // point indices the current results need
/** "ready" (every region in play has its forecast), "loading" or "error" (some are missing after a failure). */
export function forecastStatus() {
  if (wanted.every((k) => fc.data[k])) return "ready";
  return fc.loading.size ? "loading" : "error";
}

/**
 * Make sure this hour's forecast is loaded, or loading, for the regions `cells` (cell indices); `onReady` runs
 * when a fetch finishes (successfully or not), so the caller can recompute.
 *
 * Open-Meteo's free tier counts every location and allows 600 a minute and 10,000 a day per network, shared by
 * everyone on it (a classroom). So only the points the given regions need are asked for, already loaded points
 * are never asked for again, and the forecast is kept in localStorage for the hour: reloading reuses it. After a
 * failure (e.g. HTTP 429, over the limit) it retries after 1–2 minutes, at a random moment so that browsers that
 * failed together (a class opening the link at once) don't all retry together.
 */
const STORE_KEY = "hoshimachi.forecast.v2";
const retryDelay = () => 60_000 + Math.random() * 60_000;

export function ensureForecast(cells, onReady) {
  if (!points) buildPoints();
  const hour = new Date().toISOString().slice(0, 13);
  if (fc.hour !== hour) fc = { hour, data: readStore(hour), loading: new Set(), retryAt: 0 };
  wanted = [...new Set(cells.map((i) => groupOf[i]))];
  const missing = wanted.filter((k) => !fc.data[k] && !fc.loading.has(k));
  if (!missing.length || Date.now() < fc.retryAt) return;
  missing.forEach((k) => fc.loading.add(k));
  const batches = [];
  for (let i = 0; i < missing.length; i += FORECAST.batch) batches.push(missing.slice(i, i + FORECAST.batch));
  const mine = fc;
  Promise.all(
    batches.map((ks) =>
      fetchBatch(ks.map((k) => points[k])).then((rows) => {
        if (fc !== mine) return;
        ks.forEach((k, j) => (fc.data[k] = rows[j]));
        writeStore(fc);
      }),
    ),
  )
    .catch((err) => {
      console.warn("Live forecast unavailable:", err);
      if (fc !== mine) return;
      const wait = retryDelay();
      fc.retryAt = Date.now() + wait;
      setTimeout(onReady, wait + 500); // recompute then, which retries the fetch
    })
    .finally(() => {
      missing.forEach((k) => mine.loading.delete(k));
      onReady();
    });
}

/** The stored forecast points for this hour, or none. Storage may be unavailable (private mode). */
function readStore(hour) {
  try {
    const s = JSON.parse(localStorage.getItem(STORE_KEY) || "null");
    return s && s.hour === hour && s.points === points.length ? s.data : [];
  } catch {
    return [];
  }
}

function writeStore(f) {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify({ hour: f.hour, points: points.length, data: f.data }));
  } catch {
    // Full or blocked storage only means the next reload fetches again.
  }
}

async function fetchBatch(pts) {
  const lat = pts.map((p) => p[0].toFixed(3)).join(","),
    lon = pts.map((p) => p[1].toFixed(3)).join(",");
  const url = `${FORECAST.url}?latitude=${lat}&longitude=${lon}&hourly=cloud_cover&models=${FORECAST.model}&forecast_days=${FORECAST.days + 2}&timezone=GMT`;
  const r = await fetch(url);
  if (!r.ok) throw new Error(`Open-Meteo HTTP ${r.status}`);
  const j = await r.json();
  const list = Array.isArray(j) ? j : [j];
  if (list.length !== pts.length) throw new Error("Open-Meteo returned the wrong number of locations");
  return list.map((x) => ({ t0: Date.parse(x.hourly.time[0] + "Z"), cc: x.hourly.cloud_cover }));
}

/** Forecast clear-hour mask for cell ci on the night of [y, m, d] (bit k = hour firstHourLocal + k), or null. */
function forecastMask(ci, dt) {
  const pt = fc.data[groupOf[ci]];
  if (!pt) return null;
  const n = manifest.night,
    clearBelow = n.clearCloudBelow * 100;
  let mask = 0;
  for (let k = 0; k < n.hours; k++) {
    const t = Date.UTC(dt[0], dt[1] - 1, dt[2], n.firstHourLocal + k - n.utcOffsetHours);
    const v = pt.cc[Math.round((t - pt.t0) / 3.6e6)];
    if (v === null || v === undefined) return null;
    if (v < clearBelow) mask |= 1 << k;
  }
  return mask;
}

/** How much the forecast is trusted for a night `lead` days ahead (0 = tonight). */
export const trust = (lead) => Math.max(0, FORECAST.trust0 - FORECAST.trustDrop * lead);

/**
 * Blend the forecast into one region's result r (from blendAll). Adds r.pHist (history alone) and
 * r.fc[j] = { clearH, good, w, p } for nights the forecast covers (null for the others).
 */
export function applyForecast(r, ci) {
  if (!groupOf || !fc.data[groupOf[ci]]) return r;
  let ratio = 1,
    any = false;
  const nights = r.dates.map((dt, j) => {
    const lead = daysFromToday(dt);
    if (lead < 0 || lead > FORECAST.days) return null;
    const mask = forecastMask(ci, dt);
    if (mask === null) return null;
    const win = r.wins[j],
      w = trust(lead),
      g = win ? good(mask, win) : false,
      p = win ? w * (g ? 1 : 0) + (1 - w) * r.nightP[j] : 0;
    if (win) {
      ratio *= (1 - p) / Math.max(1 - r.nightP[j], 0.01);
      any = true;
    }
    return { clearH: POP[mask & win], good: g, w, p };
  });
  if (!any) return r;
  return Object.assign(r, { pHist: r.p, p: Math.min(1, Math.max(0, 1 - (1 - r.p) * ratio)), fc: nights });
}
