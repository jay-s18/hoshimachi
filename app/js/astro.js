/**
 * Sun, moon and Milky Way timing (via the global SunCalc library) and the 12-bit hour masks
 * that describe which hours of a night are usable.
 *
 * Hour mask convention, shared with the pipeline: bit k is the hour starting at
 * (firstHourLocal + k), i.e. 18:00, 19:00, ... 05:00 JST for k = 0..11.
 */
import { t } from "./i18n.js";
import { BORTLE_EDGES, SKY } from "./config.js";
import { state } from "./state.js";
import { R2D } from "./util.js";

export const HOURS = 12;
const UTC_OF_FIRST_HOUR = 9; // 18:00 JST = 09:00 UTC on the evening's date

/** Bortle class (1..9) for a sky brightness in mag/arcsec². */
export function bortleOf(sqm) {
  for (let i = 0; i < BORTLE_EDGES.length; i++) if (sqm >= BORTLE_EDGES[i]) return i + 1;
  return 9;
}

/** Galactic-centre altitude in degrees at time t and [lat, lon]. */
export function gcAlt(t, lat, lon) {
  const d = t.getTime() / 864e5 + 2440587.5 - 2451545.0;
  const gmst = (280.46061837 + 360.98564736629 * d) % 360;
  const H = ((gmst + lon - 266.405) % 360) / R2D,
    ph = lat / R2D,
    de = -29.008 / R2D;
  return Math.asin(Math.sin(ph) * Math.sin(de) + Math.cos(ph) * Math.cos(de) * Math.cos(H)) * R2D;
}

const illumCache = new Map();
function moonFrac(t) {
  const k = t.getTime();
  let v = illumCache.get(k);
  if (v === undefined) {
    v = SunCalc.getMoonIllumination(t).fraction;
    illumCache.set(k, v);
  }
  return v;
}

/**
 * 12-bit mask of usable hours for the night starting on y-m-d at [lat, lon].
 * opt.moon: exclude hours with a >25%-lit moon above the horizon (one phase per night, at local midnight).
 * opt.mw: also require the galactic core 10° up.
 */
export function windowMask(lat, lon, y, m, d, opt) {
  let w = 0;
  const nightFrac = opt.moon ? moonFrac(new Date(Date.UTC(y, m - 1, d, 15))) : 0;
  for (let h = 0; h < HOURS; h++) {
    const t = new Date(Date.UTC(y, m - 1, d, UTC_OF_FIRST_HOUR + h));
    if (SunCalc.getPosition(t, lat, lon).altitude * R2D > SKY.sunAltMax) continue;
    if (opt.moon) {
      const ma = SunCalc.getMoonPosition(t, lat, lon).altitude * R2D;
      if (ma > 0 && nightFrac > SKY.moonLitMax) continue;
    }
    if (opt.mw && gcAlt(t, lat, lon) < SKY.coreAltMin) continue;
    w |= 1 << h;
  }
  return w;
}

/** "19:00–06:00" style label for a mask. */
export function hoursLabel(w) {
  if (!w) return t("none");
  const hs = [];
  for (let h = 0; h < HOURS; h++) if ((w >> h) & 1) hs.push(h);
  const f = (h) => String((18 + h) % 24).padStart(2, "0") + ":00";
  const segs = [];
  let s = hs[0],
    p = hs[0];
  for (let i = 1; i <= hs.length; i++) {
    if (hs[i] === p + 1) {
      p = hs[i];
      continue;
    }
    segs.push(f(s) + "–" + f(p + 1));
    s = hs[i];
    p = hs[i];
  }
  return segs.join(", ");
}

/* Lookup tables over all 4096 masks: number of set bits (POP) and longest run of set bits (RUN). */
export const POP = new Uint8Array(4096);
export const RUN = new Uint8Array(4096);
for (let v = 0; v < 4096; v++) {
  let p = 0,
    r = 0,
    b = 0;
  for (let h = 0; h < HOURS; h++) {
    if ((v >> h) & 1) {
      p++;
      r++;
      b = Math.max(b, r);
    } else r = 0;
  }
  POP[v] = p;
  RUN[v] = b;
}

/** Is a night good? clearBits = hours that were clear, win = hours that are dark enough. */
export function good(clearBits, win) {
  const v = clearBits & win;
  return state.rule === "run" ? RUN[v] >= state.hours : POP[v] >= state.hours;
}

/** Moon illuminated fraction and waxing flag at local midnight of [y, m, d]. */
export function moonInfo(dt) {
  const t = new Date(Date.UTC(dt[0], dt[1] - 1, dt[2], 15));
  const mi = SunCalc.getMoonIllumination(t);
  return { f: mi.fraction, waxing: mi.phase < 0.5 };
}

export function moonName(f, waxing) {
  if (f < 0.03) return t("New moon");
  if (f > 0.97) return t("Full moon");
  if (f < 0.5) return t(waxing ? "Waxing crescent" : "Waning crescent");
  return t(waxing ? "Waxing gibbous" : "Waning gibbous");
}

/** Moon phase icon as inline SVG: lit part warm white, dark part graphite (northern-hemisphere view). */
export function moonIcon(f, waxing, size = 16) {
  const r = size / 2 - 1,
    c = size / 2,
    rx = Math.abs(1 - 2 * f) * r,
    side = waxing ? 1 : 0;
  const lit =
    f < 0.01
      ? ""
      : f > 0.99
        ? `<circle cx="${c}" cy="${c}" r="${r}" fill="#e4ddcf"/>`
        : `<path d="M${c},${c - r} A${r},${r} 0 0 ${side} ${c},${c + r} A${rx},${r} 0 0 ${f < 0.5 === waxing ? 0 : 1} ${c},${c - r} Z" fill="#e4ddcf"/>`;
  return `<svg class="moonico" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" aria-hidden="true"><circle cx="${c}" cy="${c}" r="${r}" fill="#2a2930" stroke="#5a5650" stroke-width=".8"/>${lit}</svg>`;
}

/** The evening before the next new moon (within 32 days), as "YYYY-MM-DD": the default trip start. */
export function nextNewMoon(now = new Date()) {
  let best = null,
    bf = 2;
  for (let k = 0; k < 32; k++) {
    const t = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + k, 14));
    const f = SunCalc.getMoonIllumination(t).fraction;
    if (f < bf) {
      bf = f;
      best = t;
    }
  }
  return new Date(best.getTime() - 864e5).toISOString().slice(0, 10);
}
