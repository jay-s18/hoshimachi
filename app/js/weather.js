/**
 * "Live forecast at the pin": the next nights hour by hour (cloud cover, with the usable dark hours marked),
 * plus each night's clear hours, low temperature, wind, rain and humidity. JMA models via Open-Meteo, the
 * same source the odds blend uses (forecast.js), but for the exact pin rather than a 2×2-region block.
 * A night's hours are firstHourLocal … firstHourLocal + hours − 1 (18:00–05:00 JST), as everywhere else.
 */
import { FORECAST } from "./config.js";
import { manifest } from "./data.js";
import { windowMask } from "./astro.js";
import { state } from "./state.js";
import { addDays, fmtDate } from "./util.js";
import { t } from "./i18n.js";

const VARS = ["cloud_cover", "temperature_2m", "wind_speed_10m", "precipitation", "relative_humidity_2m"];
const cache = new Map(); // "lat,lon@hour" -> Promise

const keyOf = (lat, lon) => `${lat.toFixed(3)},${lon.toFixed(3)}@${new Date().toISOString().slice(0, 13)}`;

/** Whether the forecast for [lat, lon] is already loaded or loading this hour (showing it costs no request). */
export const pinWeatherCached = (lat, lon) => cache.has(keyOf(lat, lon));

/** Hourly forecast for [lat, lon]: { t0, elevation, cloud_cover: [], temperature_2m: [], … }. Cached for the hour. */
export function pinWeather(lat, lon) {
  const key = keyOf(lat, lon);
  if (!cache.has(key)) {
    const url = `${FORECAST.url}?latitude=${lat.toFixed(4)}&longitude=${lon.toFixed(4)}&hourly=${VARS.join(",")}&models=${FORECAST.model}&forecast_days=${FORECAST.days + 2}&timezone=GMT`;
    const p = fetch(url)
      .then((r) => {
        if (!r.ok) throw new Error(`Open-Meteo HTTP ${r.status}`);
        return r.json();
      })
      .then((j) => ({ t0: Date.parse(j.hourly.time[0] + "Z"), elevation: j.elevation, ...j.hourly }));
    p.catch(() => cache.delete(key)); // let a later render try again
    cache.set(key, p);
  }
  return cache.get(key);
}

/** Today's date in Japan as [y, m, d]: before firstHourLocal it is still "last night" for stargazing. */
function tonightJST() {
  const n = manifest.night,
    t = new Date(Date.now() + n.utcOffsetHours * 3.6e6);
  const d = [t.getUTCFullYear(), t.getUTCMonth() + 1, t.getUTCDate()];
  return t.getUTCHours() < 12 ? addDays(d, -1) : d; // after midnight, the night that started yesterday
}

/** Per-night rows for the next FORECAST.days + 1 nights that the forecast fully covers. */
function nights(w, lat, lon) {
  const n = manifest.night,
    clearBelow = n.clearCloudBelow * 100,
    opt = { moon: true, mw: state.target === "mw" },
    tripStart = state.date,
    tripEnd = state.dateTo;
  const out = [];
  for (let j = 0; j <= FORECAST.days; j++) {
    const dt = addDays(tonightJST(), j);
    const win = windowMask(lat, lon, dt[0], dt[1], dt[2], opt);
    const hours = [];
    for (let k = 0; k < n.hours; k++) {
      const t = Date.UTC(dt[0], dt[1] - 1, dt[2], n.firstHourLocal + k - n.utcOffsetHours);
      const i = Math.round((t - w.t0) / 3.6e6);
      const cc = w.cloud_cover[i];
      if (cc === null || cc === undefined) break;
      hours.push({
        h: (n.firstHourLocal + k) % 24,
        cc,
        temp: w.temperature_2m[i],
        wind: w.wind_speed_10m[i],
        rain: w.precipitation[i] ?? 0,
        rh: w.relative_humidity_2m[i],
        usable: Boolean(win & (1 << k)),
      });
    }
    if (hours.length < n.hours) break;
    const iso = `${dt[0]}-${String(dt[1]).padStart(2, "0")}-${String(dt[2]).padStart(2, "0")}`;
    const usable = hours.filter((x) => x.usable);
    out.push({
      dt,
      hours,
      trip: iso >= tripStart && iso < tripEnd,
      clearH: usable.filter((x) => x.cc < clearBelow).length,
      usableH: usable.length,
      low: Math.min(...hours.map((x) => x.temp)),
      wind: Math.max(...hours.map((x) => x.wind)),
      rain: hours.reduce((a, x) => a + x.rain, 0),
      rh: Math.max(...hours.map((x) => x.rh)),
    });
  }
  return out;
}

/**
 * Cloud cover as a colour that matches the clear-hour rule: green only below the clear threshold
 * (brighter = clearer), then greys from partly cloudy to overcast.
 */
function cloudColour(cc, clearBelow) {
  const mix = (a, b, t) => `rgb(${a.map((v, k) => Math.round(v + (b[k] - v) * Math.min(1, Math.max(0, t)))).join(",")})`;
  return cc < clearBelow
    ? mix([138, 217, 177], [70, 140, 108], cc / clearBelow)
    : mix([112, 108, 118], [44, 43, 49], (cc - clearBelow) / (100 - clearBelow));
}

/** The forecast section's HTML for weather w at [lat, lon]. */
export function weatherHtml(w, lat, lon) {
  const rows = nights(w, lat, lon);
  if (!rows.length) return `<div class="hint">${t("No forecast for the coming nights here.")}</div>`;
  const clearBelow = manifest.night.clearCloudBelow * 100;
  const hourHead = rows[0].hours.map((x, k) => `<span>${k % 3 === 0 ? String(x.h).padStart(2, "0") : ""}</span>`).join("");
  const body = rows
    .map((r, j) => {
      const label = j === 0 ? t("Tonight") : fmtDate(r.dt);
      const cells = r.hours
        .map(
          (x) =>
            `<i class="${x.usable ? "use" : ""}" style="background:${cloudColour(x.cc, clearBelow)}" title="${String(x.h).padStart(2, "0")}:00 · ${t("cloud {p}%", { p: Math.round(x.cc) })} · ${x.temp.toFixed(0)}°C${x.rain > 0 ? ` · ${t("rain {mm} mm", { mm: x.rain.toFixed(1) })}` : ""}${x.usable ? ` · ${t("usable dark hour")}` : ""}"></i>`,
        )
        .join("");
      const verdict = !r.usableH
        ? `<span class="hint">${t("no dark hours")}</span>`
        : `<span class="${r.clearH >= state.hours ? "fc-good" : "fc-bad"}">${t("{a}/{b} h clear", { a: r.clearH, b: r.usableH })}</span>`;
      const extras = [t("low {c}°", { c: r.low.toFixed(0) }), t("wind {v} km/h", { v: Math.round(r.wind) })];
      if (r.rain >= 0.5) extras.push(t("rain {mm} mm", { mm: r.rain.toFixed(1) }));
      if (r.rh >= 95 && r.low < 10) extras.push(t("dew likely"));
      return `<div class="wx-row${r.trip ? " trip" : ""}"><span class="wx-d">${label}${r.trip ? ' <span class="wx-tag">${t("trip")}</span>' : ""}</span><span class="wx-h">${cells}</span><span class="wx-s">${verdict}<span class="hint num">${extras.join(" · ")}</span></span></div>`;
    })
    .join("");
  return `<div class="wx"><div class="wx-row wx-head"><span class="wx-d"></span><span class="wx-h">${hourHead}</span><span class="wx-s"></span></div>${body}</div>
    <div class="wx-key hint"><span><i style="background:${cloudColour(0, clearBelow)}"></i>${t("clear (cloud under {p}%, as in the odds)", { p: clearBelow })}</span><span><i style="background:${cloudColour(50, clearBelow)}"></i>${t("partly cloudy")}</span><span><i style="background:${cloudColour(100, clearBelow)}"></i>${t("overcast")}</span><span><i class="use" style="background:${cloudColour(0, clearBelow)}"></i>${t("usable dark hour")}</span></div>
    <div class="hint">${t("Model forecast for a ~5 km square around the pin (ground {m} m). Valley fog and mountain cloud can differ locally.", { m: Math.round(w.elevation) })}</div>`;
}
