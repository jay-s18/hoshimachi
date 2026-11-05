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
let fc = { status: "off", hour: null, data: null }; // status: "off" | "loading" | "ready" | "error"

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

export const forecastStatus = () => fc.status;

/**
 * Make sure a forecast at most an hour old is loaded or loading; `onReady` runs when a fetch finishes
 * (successfully or not), so the caller can recompute.
 *
 * A page load asks Open-Meteo for ~300 locations and its free tier allows 600 a minute, so the forecast is
 * kept in localStorage for the hour: reloading the page reuses it instead of fetching again. After a failure
 * (e.g. HTTP 429, over the limit) the next recompute retries once RETRY_MS has passed.
 */
const STORE_KEY = "hoshimachi.forecast.v1";
const RETRY_MS = 70_000;

export function ensureForecast(onReady) {
  const hour = new Date().toISOString().slice(0, 13);
  if (fc.hour === hour && (fc.status === "ready" || fc.status === "loading")) return;
  if (fc.hour === hour && fc.status === "error" && Date.now() - fc.failedAt < RETRY_MS) return;
  if (!points) buildPoints();
  const stored = readStore(hour);
  if (stored) {
    fc = { status: "ready", hour, data: stored };
    return;
  }
  fc = { status: "loading", hour, data: null };
  const batches = [];
  for (let i = 0; i < points.length; i += FORECAST.batch) batches.push(points.slice(i, i + FORECAST.batch));
  Promise.all(batches.map(fetchBatch))
    .then((parts) => {
      if (fc.hour !== hour) return;
      fc = { status: "ready", hour, data: parts.flat() };
      writeStore(hour, fc.data);
    })
    .catch((err) => {
      console.warn("Live forecast unavailable:", err);
      if (fc.hour !== hour) return;
      fc = { status: "error", hour, data: null, failedAt: Date.now() };
      setTimeout(onReady, RETRY_MS + 1000); // recompute then, which retries the fetch
    })
    .finally(onReady);
}

/** The stored forecast for this hour and these points, or null. Storage may be unavailable (private mode). */
function readStore(hour) {
  try {
    const s = JSON.parse(localStorage.getItem(STORE_KEY) || "null");
    return s && s.hour === hour && s.points === points.length && s.data.length === points.length ? s.data : null;
  } catch {
    return null;
  }
}

function writeStore(hour, data) {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify({ hour, points: points.length, data }));
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
  const pt = fc.data?.[groupOf[ci]];
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
  if (fc.status !== "ready") return r;
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
