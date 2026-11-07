/**
 * The odds model. For a trip of k nights starting on a date:
 *   1. Replay: apply the trip's exact usable-hour windows to every comparable past start date
 *      (same calendar dates ± MODEL.windowDays in every year on record) and count how often at
 *      least one night was good.
 *   2. Shrink: blend each region with the mean of its adjacent regions (MODEL.ownWeight own,
 *      the rest neighbours) to steady noisy cells.
 *   3. Range: a 95% interval from the year-to-year spread of the replayed odds.
 * Both settings are chosen by the out-of-sample validation in the pipeline and read from the
 * manifest, so they update with the data. Mirrors pipeline/src/hoshimachi_pipeline/validation/estimator.py.
 */
import { MONTHS } from "./config.js";
import { CELLS, MASKS, MODEL, NBR, NC, NN, T0, YEARS } from "./data.js";
import { good, windowMask } from "./astro.js";
import { addDays, isLeap } from "./util.js";

/** Index of the night Y-m-d in the record (29 Feb maps to 28 Feb in non-leap years). */
export function histIndex(Y, m, d) {
  if (m === 2 && d === 29 && !isLeap(Y)) d = 28;
  return Math.round((Date.UTC(Y, m - 1, d) - T0) / 864e5);
}

/** Years in the record that the trip itself overlaps; they are left out of the odds ("no peeking"). */
export function excludedYears(ymd, k) {
  const out = new Set();
  const end = addDays(ymd, k - 1);
  for (const y of [ymd[0], end[0]]) if (YEARS.includes(y)) out.add(y);
  return out;
}

/** Un-blended replay for one cell. */
export function tripRaw(ci, ymd, k, opt, excl) {
  const c = CELLS[ci],
    lat = c.bl[1],
    lon = c.bl[0],
    WIN = MODEL.windowDays;
  const wins = [],
    dates = [];
  for (let j = 0; j < k; j++) {
    const dj = addDays(ymd, j);
    dates.push(dj);
    wins.push(windowMask(lat, lon, dj[0], dj[1], dj[2], opt));
  }
  // Night-index range of each excluded year. A past trip touching one is skipped, even if it starts in another year
  // (a ±window or a multi-night trip can cross New Year). Same rule as replay_predict in validation/estimator.py.
  const exclRanges = [...excl].map((y) => [histIndex(y, 1, 1), histIndex(y, 12, 31)]);
  const touchesExcl = (i0) => exclRanges.some(([a, b]) => i0 <= b && i0 + k - 1 >= a);
  const pY = [],
    luck = [],
    nightHits = new Array(k).fill(0);
  let n = 0,
    hit = 0,
    goodNights = 0,
    actual = null;
  for (const Y of YEARS) {
    const base = histIndex(Y, ymd[1], ymd[2]);
    let same = null; // good nights on the exact dates in year Y
    if (base + k - 1 < NN) {
      same = 0;
      for (let j = 0; j < k; j++) if (good(MASKS[(base + j) * NC + ci], wins[j])) same++;
    }
    if (excl.has(Y)) {
      pY.push(null);
      luck.push(null);
      // Only the start year holds the trip's own dates; for a New Year trip, the end year's row is the next winter.
      if (Y === ymd[0] && same !== null) actual = { year: Y, nights: same };
      continue;
    }
    luck.push(same === null || touchesExcl(base) ? null : same > 0);
    let ny = 0,
      hy = 0;
    for (let s = -WIN; s <= WIN; s++) {
      const i0 = base + s;
      if (i0 < 0 || i0 + k - 1 >= NN || touchesExcl(i0)) continue;
      let any = false;
      for (let j = 0; j < k; j++)
        if (good(MASKS[(i0 + j) * NC + ci], wins[j])) {
          any = true;
          nightHits[j]++;
          goodNights++;
        }
      ny++;
      if (any) hy++;
    }
    n += ny;
    hit += hy;
    pY.push(ny ? hy / ny : null);
  }
  return {
    raw: n ? hit / n : 0,
    pY,
    n,
    wins,
    dates,
    anyWin: wins.some((w) => w),
    rawNight: nightHits.map((v) => (n ? v / n : 0)),
    expGood: n ? goodNights / n : 0,
    luck,
    actual,
  };
}

/** Shrink every cell toward its neighbours and attach the 95% range. */
export function blendAll(raws) {
  const W = MODEL.ownWeight;
  return raws.map((r, i) => {
    const nb = NBR[i].filter((j) => raws[j]);
    const mix = (own, f) => (nb.length ? W * own + ((1 - W) * nb.reduce((a, j) => a + f(raws[j]), 0)) / nb.length : own);
    const p = mix(r.raw, (x) => x.raw);
    const ys = r.pY.map((v, y) => (v === null ? null : mix(v, (x) => x.pY[y] ?? x.raw))).filter((v) => v !== null);
    const m = ys.reduce((a, b) => a + b, 0) / ys.length;
    const sd = Math.sqrt(ys.reduce((a, b) => a + (b - m) ** 2, 0) / Math.max(ys.length - 1, 1));
    const se = sd / Math.sqrt(ys.length);
    return Object.assign({}, r, {
      p,
      lo: Math.max(0, p - 1.96 * se),
      hi: Math.min(1, p + 1.96 * se),
      nightP: r.rawNight.map((v, j) => mix(v, (x) => x.rawNight[j])),
    });
  });
}

/**
 * Month climatology (moon ignored): mid-month darkness hours applied to every night of that month
 * in the record. Uses a fixed reference year for the darkness hours.
 */
export function monthRaw(ci, month, opt) {
  const c = CELLS[ci],
    refYear = YEARS[YEARS.length - 1],
    win = windowMask(c.bl[1], c.bl[0], refYear, month, 15, { moon: false, mw: opt.mw });
  let n = 0,
    h = 0;
  for (const Y of YEARS) {
    const days = new Date(Date.UTC(Y, month, 0)).getUTCDate(),
      i0 = histIndex(Y, month, 1);
    for (let d = 0; d < days; d++) {
      n++;
      if (good(MASKS[(i0 + d) * NC + ci], win)) h++;
    }
  }
  return h / n;
}

export function monthBlend(vals, i) {
  const nb = NBR[i],
    W = MODEL.ownWeight;
  return nb.length ? W * vals[i] + ((1 - W) * nb.reduce((a, j) => a + vals[j], 0)) / nb.length : vals[i];
}

/** 12 months for one cell, blended with its neighbours. */
export function monthSeries(ci, opt) {
  const ids = [ci, ...NBR[ci]],
    W = MODEL.ownWeight;
  return MONTHS.map((_, m) => {
    const v = new Map(ids.map((j) => [j, monthRaw(j, m + 1, opt)]));
    const nb = NBR[ci];
    return nb.length ? W * v.get(ci) + ((1 - W) * nb.reduce((a, j) => a + v.get(j), 0)) / nb.length : v.get(ci);
  });
}
