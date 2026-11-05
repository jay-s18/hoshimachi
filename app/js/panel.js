/**
 * The results panel: the ranked list of regions, and the detail card for a selected region.
 */
import { BORTLE_COLORS, FORECAST, ORIGINS } from "./config.js";
import { CELLS, YEARS, manifest, periodLabel } from "./data.js";
import { state, ymd, monthOf } from "./state.js";
import { addDays, daysFromToday, esc, fmtDate, ib, monthName, pct } from "./util.js";
import { isJa, nm, nm2, nmPair, t } from "./i18n.js";
import { bortleOf, hoursLabel, moonIcon, moonInfo, moonName } from "./astro.js";
import { monthSeries } from "./odds.js";
import { drawPanorama, horizonProfile, spotInfo, trendAt, trendClassOf, trendPctAt } from "./sky.js";
import { skyViewHtml, wireSkyView } from "./skyview.js";
import { results, distOf } from "./app.js";
import { clearSelection, select } from "./map.js";
import { cachedPlace, lookupPlace } from "./place.js";
import { forecastStatus, tripInRange } from "./forecast.js";
import { writeLink } from "./link.js";
import { pinWeather, pinWeatherCached, weatherHtml } from "./weather.js";

const rangeTxt = (r) => `${pct(r.lo)}–${pct(r.hi)}`;
const nightsTxt = (n) => t(n === 1 ? "{n} night" : "{n} nights", { n });

/** Small Bortle chip with a colour dot. */
function bChip(sqm) {
  const b = bortleOf(sqm);
  return `<span class="chip" style="border:1px solid #34323a;color:var(--ink)"><span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${BORTLE_COLORS[b - 1]};border:1px solid #5a554c;margin-right:5px;vertical-align:0"></span>${t("Bortle {n}", { n: b })}</span>`;
}

/** Context notes about the chosen dates (close to today, in the past, or inside the record). */
function notices() {
  const d = ymd(),
    dt = daysFromToday(d),
    lastYear = YEARS[YEARS.length - 1],
    out = [];
  if (tripInRange(d, state.nights) && !state.live)
    out.push(
      t(
        "Your trip is within a week, so a weather forecast is available. Tick <b>Use the live forecast in the odds</b> to update these odds with it.",
      ),
    );
  else if (tripInRange(d, state.nights)) {
    const st = forecastStatus();
    if (st === "ready")
      out.push(
        t(
          "<b>Live forecast included.</b> These odds now mix the past {n} years with today's cloud forecast from the Japan Meteorological Agency. The closer a night is, the more the forecast counts. This mix is a rough estimate, not tested like the historical odds.",
          { n: YEARS.length },
        ),
      );
    else if (st === "error")
      out.push(
        t(
          "The live cloud forecast couldn't load, so these are historical odds only. It will try again in a minute; each region's card also has its own forecast.",
        ),
      );
    else out.push(t("Loading the live cloud forecast for your trip…"));
  }
  if (dt < 0 && d[0] > lastYear) out.push(t("These dates have passed. The odds show what history suggested beforehand."));
  if (state.excl && state.excl.size)
    out.push(
      t("Your dates fall inside our {period} record, so {years} is left out of the odds. Each region card shows what actually happened.", {
        period: periodLabel(),
        years: [...state.excl].join(t(" and ")),
      }),
    );
  return out.map((x) => `<div class="note">${x}</div>`).join("");
}

/** Search relevance of a cell for the query q: 3 = town prefix, 2 = town substring, 1 = prefecture, 0 = none. */
function searchScore(c, q) {
  if (!q) return 0;
  const towns = [c.en, c.jp, ...c.also.flatMap((x) => x.split("|"))].map((x) => x.toLowerCase());
  if (towns.some((x) => x.startsWith(q))) return 3;
  if (towns.some((x) => x.includes(q))) return 2;
  if (c.pref.toLowerCase().startsWith(q) || c.prefjp.startsWith(q)) return 1;
  return 0;
}

export function renderPanel() {
  const el = document.getElementById("res");
  writeLink();
  if (state.sel != null) return renderCard(el, state.sel);
  const d = ymd(),
    end = addDays(d, state.nights - 1);
  const q = state.query.trim().toLowerCase();
  const passing = results.filter((r) => r.ok);
  let list = passing;
  if (q) list = list.filter((r) => searchScore(CELLS[r.i], q) > 0);
  const byOdds = (a, b) => b.p - a.p || CELLS[b.i].sqm - CELLS[a.i].sqm,
    byDark = (a, b) => CELLS[b.i].sqm - CELLS[a.i].sqm || b.p - a.p;
  list = [...list].sort(
    (a, b) => searchScore(CELLS[b.i], q) - searchScore(CELLS[a.i], q) || (state.sort === "dark" ? byDark(a, b) : byOdds(a, b)),
  );
  const noWin = passing.every((r) => !r.anyWin);
  const top = list[0];
  // Divider below the regions whose range overlaps #1's: those are statistically tied with it.
  // The ranges are historical, so the divider is skipped once a forecast has moved the odds.
  const cut = top && state.sort !== "dark" && !q && !top.fc ? list.findIndex((r) => r.hi < top.lo) : -1;
  const seen = new Set();
  const rows = list
    .slice(0, 40)
    .map((r, k) => {
      const c = CELLS[r.i],
        dd = distOf(c),
        dup = seen.has(c.en);
      seen.add(c.en);
      // Several cells can share a main town name; label repeats with another nearby town.
      const near = dup ? (c.also.find((a) => !a.startsWith(c.en + "|")) || "").split("|") : null;
      const divider =
        k === cut
          ? `<li class="divider" aria-hidden="true">${t("Clearly lower odds than #1 from here down. Everything above is within the uncertainty of #1.")}</li>`
          : "";
      return (
        divider +
        `<li data-i="${r.i}" class="${state.sel === r.i ? "sel" : ""}"><span class="rk num">${k + 1}</span><span><span class="nm">${esc(nm(c.en, c.jp))}</span> <span class="jp">${esc(nm2(c.en, c.jp))}</span>${near && near[0] ? ` <span class="hint">${esc(t("near {x}", { x: nm(near[0], near[1]) }))}</span>` : ""}</span><span class="odds">${pct(r.p)}</span>
      <span class="sub"><span>${esc(nm(c.pref, c.prefjp))}</span>${bChip(c.sqm)}${dd != null ? `<span class="num">${Math.round(dd)} km</span>` : ""}${r.fc ? `<span class="num rng">${t("history {p}", { p: pct(r.pHist) })}</span>` : `<span class="num rng">${t("range {r}", { r: rangeTxt(r) })}</span>`}</span></li>`
      );
    })
    .join("");
  const dates = fmtDate(d) + (state.nights > 1 ? "–" + fmtDate(end) : "");
  el.innerHTML = `<div class="reshead"><h2>${t("Best regions for {dates}, {nights}", { dates, nights: nightsTxt(state.nights) })}</h2>
    ${notices()}
    <input id="search" type="search" placeholder="${t("Filter regions by town or prefecture")}" value="${esc(state.query)}" aria-label="${t("Filter regions")}">
    <div class="row" style="justify-content:space-between"><span class="lblrow hint">${t("{n} regions pass your filters", { n: passing.length })}${ib(t("Odds are the chance of at least one good night on your trip, from replaying {period} weather around your dates. The range is a 95% interval from year-to-year variation. Regions above the dashed line are within the uncertainty of #1, so treat them as tied.", { period: periodLabel() }), t("Odds and ranges"))}</span>
      <div class="seg" id="sortSeg" style="flex:none"><button type="button" data-v="odds" class="${state.sort !== "dark" ? "on" : ""}">${t("Best odds")}</button><button type="button" data-v="dark" class="${state.sort === "dark" ? "on" : ""}">${t("Darkest")}</button></div></div></div>
    ${noWin ? `<div class="empty">${t(state.target === "mw" ? "No usable dark hours on these dates: the moon is up and bright all night or the Milky Way core stays below 10°. Try dates nearer the new moon." : "No usable dark hours on these dates: the moon is up and bright all night. Try dates nearer the new moon.")}</div>` : ""}
    <ol class="list">${rows}</ol>
    ${list.length === 0 && !noWin ? `<div class="empty">${t("No regions match. Widen the distance or relax the darkness limit.")}</div>` : ""}`;

  const s = document.getElementById("search");
  s.addEventListener("input", (e) => {
    // Re-rendering replaces the input, so restore focus and caret afterwards.
    state.query = e.target.value;
    const pos = e.target.selectionStart;
    renderPanel();
    const n = document.getElementById("search");
    n.focus();
    n.setSelectionRange(pos, pos);
  });
  el.querySelectorAll("#sortSeg button").forEach((b) =>
    b.addEventListener("click", () => {
      state.sort = b.dataset.v;
      renderPanel();
    }),
  );
  el.querySelectorAll("li[data-i]").forEach((li) => li.addEventListener("click", () => select(+li.dataset.i)));
}

/** Bar chart of good-night share by month for one cell (moon ignored). */
function monthChart(ci) {
  const vals = monthSeries(ci, { mw: state.target === "mw" }),
    cur = monthOf() - 1,
    W = 300,
    Hh = 110,
    G = 28,
    bw = (W - G) / 12;
  const top = 0.6,
    y = (v) => Hh - 18 - ((Hh - 30) * Math.min(v, top)) / top;
  const grid = [0, 0.2, 0.4, 0.6]
    .map(
      (g) =>
        `<line x1="${G}" x2="${W}" y1="${y(g)}" y2="${y(g)}" stroke="#26252b"/><text x="${G - 4}" y="${y(g) + 3}" text-anchor="end" font-size="9" fill="#7d776c">${Math.round(g * 100)}%</text>`,
    )
    .join("");
  // Axis letters: J F M … in English, 1 2 3 … in Japanese.
  const tick = (m) => (isJa() ? String(m + 1) : monthName(m)[0]);
  const bars = vals
    .map(
      (v, m) =>
        `<rect x="${G + m * bw + 3}" y="${y(v)}" width="${bw - 6}" height="${Hh - 18 - y(v)}" rx="2" fill="${m === cur ? "#8ad9b1" : "#37659e"}"><title>${monthName(m)} ${Math.round(v * 100)}%</title></rect><text x="${G + m * bw + bw / 2}" y="${Hh - 5}" text-anchor="middle" font-size="9" fill="${m === cur ? "#8ad9b1" : "#9a9387"}">${tick(m)}</text>`,
    )
    .join("");
  const best = vals.indexOf(Math.max(...vals));
  return {
    svg: `<svg viewBox="0 0 ${W} ${Hh}" width="100%" role="img" aria-label="${t("Good-night odds by month")}">${grid}${bars}</svg>`,
    best,
    vals,
  };
}

function pinReading(sp) {
  if (sp.sqm === null) return `<div class="hint">${t("The pin is over the sea. Tap on land.")}</div>`;
  const bt = bortleOf(sp.sqm);
  return `<div class="bortle-read"><div class="bbadge" style="background:${BORTLE_COLORS[bt - 1]};color:${bt >= 6 ? "#16130f" : "#f1ebdd"}"><span class="bnum">${bt}</span><span class="blab">${t("Bortle")}</span></div>
    <div class="bscale-wrap"><div class="bscale">${BORTLE_COLORS.map((col, k) => `<span style="background:${col}" class="${k + 1 === bt ? "cur" : ""}"></span>`).join("")}</div>
    <div class="ticks num"><span>${t("1 darkest")}</span><span>${t("9 city")}</span></div><div class="hint num">${t("est.")} ${sp.sqm.toFixed(2)} mag/arcsec² · ${sp.lat.toFixed(4)}, ${sp.lon.toFixed(4)}</div></div></div>`;
}

function trendText(c) {
  if (c.trend == null) return t("Whole region (~28 km): too little artificial light for the satellite to measure a trend.");
  const col = c.trend > 3 ? "var(--warn)" : "var(--ink)";
  return t("Whole region (~28 km square), all its lights together: {x}", {
    x: `<b class="num" style="color:${col}">${t("{p}% per decade", { p: (c.trend > 0 ? "+" : "") + c.trend })}</b>`,
  });
}

/** Trend line for the pin, e.g. "+18% per decade · brightening", with the map's colour for that class. */
function trendLine(cls, p) {
  const sw = (rgb) => `<i class="sw" style="background:${rgb ? `rgb(${rgb.join(",")})` : "transparent;border:1px solid var(--rule)"}"></i>`;
  const at = t("At the pin (~1 km):");
  if (!cls && (p === null || p === undefined))
    return `${sw(null)}<span>${at} ${t("too little artificial light to measure a trend, a good sign for darkness")}</span>`;
  if (p === null || p === undefined) return `${sw(cls.rgb)}<span>${at} <b>${t(cls.label)}</b>, ${t(cls.detail)}</span>`;
  const sign = p > 0 ? "+" : p < 0 ? "−" : "±";
  const txt = Math.abs(p) >= 127 ? t("more than {x}", { x: `${p > 0 ? "+" : "−"}127%` }) : `${sign}${Math.abs(p)}%`;
  return `${sw(cls.rgb)}<span>${at} <b class="num">${t("{x} per decade", { x: txt })}</b> · ${t(cls.label)}</span>`;
}

/** The pinned spot's place name: undefined = still looking up, null = not found. */
function placeHtml(place) {
  const icon = `<svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2a7 7 0 0 0-7 7c0 5 7 13 7 13s7-8 7-13a7 7 0 0 0-7-7zm0 9.5A2.5 2.5 0 1 1 12 6.5a2.5 2.5 0 0 1 0 5z" fill="currentColor"/></svg>`;
  if (place === undefined) return `${icon}<span class="hint">${t("Finding the place name…")}</span>`;
  if (!place) return `${icon}<span class="hint">${t("Place name unavailable here")}</span>`;
  return `${icon}<span><b>${esc(place.local || place.area)}</b>${place.local && place.area ? ` <span class="area">· ${esc(place.area)}</span>` : ""}</span>`;
}

function renderCard(el, i) {
  const c = CELLS[i],
    r = results[i];
  const sp = spotInfo(state.pin[0], state.pin[1]),
    atBest = Math.abs(state.pin[0] - c.bl[1]) < 1e-6 && Math.abs(state.pin[1] - c.bl[0]) < 1e-6;
  const dd = distOf(c),
    mc = monthChart(i);
  const o = ORIGINS.find((x) => x[0] === state.origin),
    origin = isJa() ? o[3] : o[1];
  const trendSince = manifest.lightTrend ? t(" since {y}", { y: manifest.lightTrend.firstYear }) : "";
  el.innerHTML = `<div class="card">
    <button class="back" type="button" id="backBtn">${t("← All regions")}</button>
    <div><h3>${esc(nm(c.en, c.jp))}</h3><div class="jp">${esc(nm2(c.en, c.jp))} · ${esc(nm(c.pref, c.prefjp))} <span class="jp">${esc(nm2(c.pref, c.prefjp))}</span></div></div>
    <div class="place" id="placeName" aria-live="polite">${placeHtml(sp.sqm === null ? null : cachedPlace(sp.lat, sp.lon))}</div>
    ${notices()}
    ${r.ok ? "" : `<div class="note">${t("This region doesn't pass your current darkness or distance filter.")}</div>`}
    <div class="tiles">
      <div class="tile"><div class="v" style="color:var(--odds)">${pct(r.p)}</div><div class="k">${r.fc ? `${t("trip odds with live forecast")}<br><span class="num">${t("history alone {p}", { p: pct(r.pHist) })}</span>` : `${t("trip odds, at least one good night")}<br><span class="num">${t("range {r}", { r: rangeTxt(r) })}</span>`}</div></div>
      <div class="tile"><div class="v">${bortleOf(c.sqm)}</div><div class="k">${t("Bortle at darkest spot")} <span class="num">(${t("est.")} ${c.sqm.toFixed(1)} mag/arcsec²)</span></div></div>
      <div class="tile"><div class="v">${dd != null ? Math.round(dd) : "–"}</div><div class="k">${dd != null ? t("km from {o}, straight line", { o: origin }) : t("km: pick a starting city")}</div></div>
    </div>
    <div class="sect"><h4>${t("Pinned spot")}${ib(t("Click or tap anywhere on the map to drop the pin. Sky brightness is the model estimate for that ~1 km pixel."), t("Pinned spot"))}</h4>
      <div class="pinbox">
        ${pinReading(sp)}
        <div class="actions">
          <a class="act" href="https://www.google.com/maps/search/?api=1&query=${sp.lat},${sp.lon}" target="_blank" rel="noopener"><svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2a7 7 0 0 0-7 7c0 5 7 13 7 13s7-8 7-13a7 7 0 0 0-7-7zm0 9.5A2.5 2.5 0 1 1 12 6.5a2.5 2.5 0 0 1 0 5z" fill="currentColor"/></svg>Google Maps</a>
          <a class="act" href="https://maps.gsi.go.jp/#14/${sp.lat.toFixed(5)}/${sp.lon.toFixed(5)}/" target="_blank" rel="noopener"><svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true"><path d="M2 20l7-11 4 6 3-4 6 9z" fill="currentColor"/></svg>${t("Terrain (地理院)")}</a>
          <a class="act" href="https://www.windy.com/?clouds,${sp.lat},${sp.lon},9" target="_blank" rel="noopener"><svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 18a5 5 0 0 1-.6-9.96A6 6 0 0 1 18 9a4.5 4.5 0 0 1-.5 9z" fill="currentColor"/></svg>${t("Live clouds")}</a>
          <button type="button" class="act" id="copyBtn"><svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true"><path d="M8 8h11v13H8zM5 3h11v3H7v11H5z" fill="currentColor"/></svg>${t("Copy coordinates")}</button>
        </div>
        ${atBest ? "" : `<button type="button" class="act wide" id="toBest">${t("Back to this region's darkest spot")}</button>`}
        <div class="hint">${t("Satellite estimate, not a surveyed site. Check road access, land access and safety before you go.")}</div>
      </div></div>
    ${
      sp.sqm === null
        ? ""
        : `<div class="sect"><h4>${t("What you'll see here")}${ib(t("What the Bortle class means for your eyes: roughly how many stars you can see at once and how the Milky Way looks, on a clear night with no moon. The picture is an illustration, not a photo of this spot."), t("What you'll see here"))}</h4>${skyViewHtml(bortleOf(sp.sqm))}</div>`
    }
    ${
      sp.sqm === null
        ? ""
        : `<div class="sect"><h4>${t("Live forecast at the pin")}${ib(t('Japan Meteorological Agency forecast for the next {n} nights at the pinned spot, hour by hour from 18:00 to 05:00. Outlined hours are usable: astronomically dark, with the moon down or under 25% lit. A night counts as good when its clear usable hours meet your "good night needs" setting.', { n: FORECAST.days + 1 }), t("Live forecast"))}</h4><div id="wxBox"></div></div>`
    }
    <div class="sect"><h4>${t("Sky from the pin")}${ib(t("An approximate picture of the whole sky from the pin: horizon at the bottom, zenith at the top, all the way round. Glow falls with distance squared and haze, so a big city far away can look fainter than a village nearby, and distant domes sit lower. The sky is brightest near the horizon because you look through more air there (about 4× the zenith). Stars fade where the glow is strong. Hills that would hide a town are not modelled, and white LEDs are under-counted. An illustration, not a measurement."), t("Sky from the pin"))}</h4>
      <canvas id="pano" class="pano" role="img" aria-label="${t("Simulated horizon glow around the pin")}"></canvas>
      <div class="hint" id="panoTxt" style="margin-top:6px"></div></div>
    <div class="sect"><h4>${t("Night by night")}${ib(t(state.target === "mw" ? "Usable hours have the sun 18° below the horizon and the moon down or under 25% lit, with the galactic core 10° up. Odds per night differ by a few points mostly through noise." : "Usable hours have the sun 18° below the horizon and the moon down or under 25% lit. Odds per night differ by a few points mostly through noise."), t("Night by night"))}</h4>
      <table class="nights"><tr><th>${t("Night of")}</th><th>${t("Moon")}</th><th>${t("Usable hours")}</th>${r.fc ? `<th>${t("Forecast")}</th>` : ""}<th style="text-align:right">${t("Odds")}</th></tr>
      ${r.dates
        .map((dt, j) => {
          const m = moonInfo(dt),
            f = r.fc?.[j];
          const fcCell = !r.fc
            ? ""
            : `<td class="num">${f ? `<span class="${f.good ? "fc-good" : "fc-bad"}" title="${t("Forecast clear hours in the usable window; trusted {p}% for this night", { p: Math.round(f.w * 100) })}">${t(f.good ? "clear {h} h" : "cloudy {h} h", { h: f.clearH })}</span>` : `<span class="hint">${t("beyond {n} days", { n: FORECAST.days })}</span>`}</td>`;
          const odds = f ? f.p : r.nightP[j];
          return `<tr><td>${fmtDate(dt)}</td><td><span title="${moonName(m.f, m.waxing)}, ${t("{p}% lit", { p: Math.round(m.f * 100) })}">${moonIcon(m.f, m.waxing)} <span class="num">${Math.round(m.f * 100)}%</span></span></td><td class="num">${hoursLabel(r.wins[j])}</td>${fcCell}<td class="num" style="text-align:right">${r.wins[j] ? pct(odds) : "–"}</td></tr>`;
        })
        .join("")}
      </table>
      <div class="hint" style="margin-top:6px">${t("Expected good nights on this trip:")} <span class="num">${r.expGood.toFixed(1)}</span></div></div>
    ${r.actual ? `<div class="sect"><h4>${t("What actually happened in {y}", { y: r.actual.year })}</h4><div class="hint">${t(r.actual.nights === 1 ? "On these exact dates: {x} good night out of {n}. That year is excluded from the odds above." : "On these exact dates: {x} good nights out of {n}. That year is excluded from the odds above.", { x: `<b class="num" style="color:var(--ink)">${r.actual.nights}</b>`, n: state.nights })}</div></div>` : ""}
    <div class="sect"><h4>${t("How much luck is involved")}${ib(t("Each box is the same dates in a past year. It shows how much outcomes swing from year to year. A clear night on these dates in a past year doesn't make one more likely this year: the odds pool every year and a month either side of your dates."), t("Luck"))}</h4>
      <div class="years">${r.luck.map((v, k) => `<div class="yr"><i class="${v ? "y" : ""}${v === null ? " x" : ""}" title="${YEARS[k]}: ${t(v === null ? "not used" : v ? "at least one good night" : "no good night")}"></i>${String(YEARS[k]).slice(2)}</div>`).join("")}</div>
      <div class="hint" style="margin-top:4px">${t("Filled = at least one good night on these dates that year.")}</div></div>
    <div class="sect"><h4>${t("Best months here")}${ib(t("Share of all nights in each month with a good clear window, using your hours setting. The moon is not counted, so pick new-moon dates within the best months."), t("Best months"))}</h4>${mc.svg}<div class="hint">${t("Best: {m} ({p})", { m: monthName(mc.best), p: pct(mc.vals[mc.best]) })}</div></div>
    <div class="sect"><h4>${t("Is the sky here changing?")}${ib(t("Change in satellite-measured night light{since}, in % per decade: at the pin for its ~1 km pixel, as coloured on the Light trend layer, and for the whole region. The satellite under-sees blue-white LEDs, so real brightening is likely worse than shown.", { since: trendSince }), t("Light trend"))}</h4><div class="trend-pin" id="trendPin">${sp.sqm === null ? "" : t("Reading the trend at the pin…")}</div><div class="hint" style="margin-top:4px">${trendText(c)}</div></div>
    <div class="sect"><h4>${t("Towns in this region")}</h4><div class="towns">${c.also
      .map((a) => {
        const [e, j] = a.split("|");
        return `${esc(nm(e, j))} <span class="jp">${esc(nm2(e, j))}</span>`;
      })
      .join(" · ")}</div></div>
  </div>`;

  document.getElementById("backBtn").onclick = () => {
    clearSelection();
    renderPanel();
  };
  document.getElementById("copyBtn").onclick = async (e) => {
    const btn = e.currentTarget;
    try {
      await navigator.clipboard.writeText(`${sp.lat.toFixed(5)}, ${sp.lon.toFixed(5)}`);
      btn.textContent = t("Copied");
    } catch {
      btn.textContent = t("Copy failed: select the numbers above");
    }
  };
  const tb = document.getElementById("toBest");
  if (tb) tb.onclick = () => select(i);

  if (sp.sqm !== null) wireSkyView(bortleOf(sp.sqm));

  if (sp.sqm !== null) {
    const [wlat, wlon] = state.pin;
    const box = document.getElementById("wxBox");
    const load = () => {
      box.innerHTML = `<div class="hint">${t("Loading the forecast…")}</div>`;
      pinWeather(sp.lat, sp.lon)
        .then((w) => {
          if (box.isConnected && state.pin && state.pin[0] === wlat && state.pin[1] === wlon)
            box.innerHTML = weatherHtml(w, sp.lat, sp.lon);
        })
        .catch(() => {
          if (box.isConnected)
            box.innerHTML = `<div class="hint">${t('The live forecast couldn\'t load (offline, blocked or over the free limit). Try "Live clouds" above.')}</div>`;
        });
    };
    // Only ask the free weather service when the user wants it: automatically with the live forecast ticked,
    // otherwise one tap per spot.
    if (state.live || pinWeatherCached(sp.lat, sp.lon)) load();
    else {
      box.innerHTML = `<button type="button" class="act wide" id="wxLoad">${t("Show the forecast for the next {n} nights here", { n: FORECAST.days + 1 })}</button>`;
      document.getElementById("wxLoad").onclick = load;
    }
  }

  if (sp.sqm !== null) {
    // Exact % for the pixel under the pin when the data has the per-pixel grid; its class (and colour) then
    // comes from the same number. Older data only has the overlay image, read back as a class.
    const p = trendPctAt(sp.lat, sp.lon);
    const box = document.getElementById("trendPin");
    if (p !== undefined) box.innerHTML = trendLine(p === null ? null : trendClassOf(p), p);
    else
      trendAt(sp.lat, sp.lon)
        .then((cls) => box.isConnected && (box.innerHTML = trendLine(cls, undefined)))
        .catch(() => (box.textContent = ""));
  }

  if (sp.sqm !== null && cachedPlace(sp.lat, sp.lon) === undefined) {
    const [plat, plon] = state.pin;
    const samePin = () => state.pin && state.pin[0] === plat && state.pin[1] === plon;
    lookupPlace(sp.lat, sp.lon, samePin).then((place) => {
      const box = document.getElementById("placeName");
      if (box && samePin()) box.innerHTML = placeHtml(place);
    });
  }

  const cv = document.getElementById("pano");
  const pr = drawPanorama(cv, horizonProfile(sp.lat, sp.lon));
  const lv = t(pr.peak < 0.15 ? "Low" : pr.peak < 0.35 ? "Moderate" : pr.peak < 0.6 ? "High" : "Very high");
  const src = sp.src && pr.peak >= 0.1 ? esc(nmPair(sp.src.nm)) : "";
  const from = src
    ? sp.src.d > 3
      ? t(", mainly from {x}, {d} km away", { x: src, d: Math.round(sp.src.d) })
      : t(", mainly from {x}, close by", { x: src })
    : "";
  const core =
    state.target === "mw"
      ? ["SE", "S", "SW"].includes(pr.dir)
        ? t(" That's where the Milky Way core sits, low between south-east and south-west.")
        : t(" The southern sky, where the Milky Way core sits, is clearer.")
      : "";
  document.getElementById("panoTxt").innerHTML = t("Horizon glow: {lv}. Brightest towards {dir}{from}.{core}", {
    lv: `<b style="color:var(--ink)">${lv}</b>`,
    dir: `<b style="color:var(--ink)">${t(pr.dir)}</b>`,
    from,
    core,
  });
}
