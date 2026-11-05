/**
 * The results panel: the ranked list of regions, and the detail card for a selected region.
 */
import { BORTLE_COLORS, FORECAST, MONTHS, ORIGINS } from "./config.js";
import { CELLS, YEARS, manifest, periodLabel } from "./data.js";
import { state, ymd, monthOf } from "./state.js";
import { addDays, daysFromToday, esc, fmtDate, ib, pct } from "./util.js";
import { bortleOf, hoursLabel, moonIcon, moonInfo, moonName } from "./astro.js";
import { monthSeries } from "./odds.js";
import { drawPanorama, horizonProfile, spotInfo } from "./sky.js";
import { results, distOf } from "./app.js";
import { clearSelection, select } from "./map.js";
import { cachedPlace, lookupPlace } from "./place.js";
import { forecastStatus, tripInRange } from "./forecast.js";
import { writeLink } from "./link.js";

const rangeTxt = (r) => `${pct(r.lo)}–${pct(r.hi)}`;

/** Small Bortle chip with a colour dot. */
function bChip(sqm) {
  const b = bortleOf(sqm);
  return `<span class="chip" style="border:1px solid #34323a;color:var(--ink)"><span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${BORTLE_COLORS[b - 1]};border:1px solid #5a554c;margin-right:5px;vertical-align:0"></span>Bortle ${b}</span>`;
}

/** Context notes about the chosen dates (close to today, in the past, or inside the record). */
function notices() {
  const d = ymd(),
    dt = daysFromToday(d),
    lastYear = YEARS[YEARS.length - 1],
    out = [];
  if (tripInRange(d, state.nights)) {
    const st = forecastStatus();
    if (st === "ready")
      out.push(
        `<b>Live forecast included.</b> Nights in the next ${FORECAST.days} days blend today's Japan Meteorological Agency cloud forecast with the historical odds, trusting the forecast more the closer the night. The blend is a rough rule, not validated like the history.`,
      );
    else if (st === "error")
      out.push("The live cloud forecast couldn't load, so these are historical odds only. Check a forecast before you go.");
    else out.push("Loading the live cloud forecast for your trip…");
  }
  if (dt < 0 && d[0] > lastYear) out.push("These dates have passed. The odds show what history suggested beforehand.");
  if (state.excl && state.excl.size)
    out.push(
      `Your dates fall inside our ${periodLabel()} record, so ${[...state.excl].join(" and ")} is left out of the odds. Each region card shows what actually happened.`,
    );
  return out.map((t) => `<div class="note">${t}</div>`).join("");
}

/** Search relevance of a cell for the query q: 3 = town prefix, 2 = town substring, 1 = prefecture, 0 = none. */
function searchScore(c, q) {
  if (!q) return 0;
  const towns = [c.en, c.jp, ...c.also.flatMap((x) => x.split("|"))].map((x) => x.toLowerCase());
  if (towns.some((t) => t.startsWith(q))) return 3;
  if (towns.some((t) => t.includes(q))) return 2;
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
      const near = dup ? (c.also.find((a) => !a.startsWith(c.en + "|")) || "").split("|")[0] : "";
      const divider =
        k === cut
          ? `<li class="divider" aria-hidden="true">Clearly lower odds than #1 from here down. Everything above is within the uncertainty of #1.</li>`
          : "";
      return (
        divider +
        `<li data-i="${r.i}" class="${state.sel === r.i ? "sel" : ""}"><span class="rk num">${k + 1}</span><span><span class="nm">${esc(c.en)}</span> <span class="jp">${esc(c.jp)}</span>${near ? ` <span class="hint">near ${esc(near)}</span>` : ""}</span><span class="odds">${pct(r.p)}</span>
      <span class="sub"><span>${esc(c.pref)}</span>${bChip(c.sqm)}${dd != null ? `<span class="num">${Math.round(dd)} km</span>` : ""}${r.fc ? `<span class="num rng">history ${pct(r.pHist)}</span>` : `<span class="num rng">range ${rangeTxt(r)}</span>`}</span></li>`
      );
    })
    .join("");
  el.innerHTML = `<div class="reshead"><h2>Best regions for ${fmtDate(d)}${state.nights > 1 ? "–" + fmtDate(end) : ""}, ${state.nights} night${state.nights > 1 ? "s" : ""}</h2>
    ${notices()}
    <input id="search" type="search" placeholder="Search a town or prefecture" value="${esc(state.query)}" aria-label="Search regions">
    <div class="row" style="justify-content:space-between"><span class="lblrow hint">${passing.length} regions pass your filters${ib(`Odds are the chance of at least one good night on your trip, from replaying ${periodLabel()} weather around your dates. The range is a 95% interval from year-to-year variation. Regions above the dashed line are within the uncertainty of #1, so treat them as tied.`, "Odds and ranges")}</span>
      <div class="seg" id="sortSeg" style="flex:none"><button type="button" data-v="odds" class="${state.sort !== "dark" ? "on" : ""}">Best odds</button><button type="button" data-v="dark" class="${state.sort === "dark" ? "on" : ""}">Darkest</button></div></div></div>
    ${noWin ? `<div class="empty">No usable dark hours on these dates: the moon is up and bright all night${state.target === "mw" ? " or the Milky Way core stays below 10°" : ""}. Try dates nearer the new moon.</div>` : ""}
    <ol class="list">${rows}</ol>
    ${list.length === 0 && !noWin ? `<div class="empty">No regions match. Widen the distance or relax the darkness limit.</div>` : ""}`;

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
  const bars = vals
    .map(
      (v, m) =>
        `<rect x="${G + m * bw + 3}" y="${y(v)}" width="${bw - 6}" height="${Hh - 18 - y(v)}" rx="2" fill="${m === cur ? "#8ad9b1" : "#37659e"}"><title>${MONTHS[m]} ${Math.round(v * 100)}%</title></rect><text x="${G + m * bw + bw / 2}" y="${Hh - 5}" text-anchor="middle" font-size="9" fill="${m === cur ? "#8ad9b1" : "#9a9387"}">${MONTHS[m][0]}</text>`,
    )
    .join("");
  const best = vals.indexOf(Math.max(...vals));
  return {
    svg: `<svg viewBox="0 0 ${W} ${Hh}" width="100%" role="img" aria-label="Good-night odds by month">${grid}${bars}</svg>`,
    best,
    vals,
  };
}

function pinReading(sp) {
  if (sp.sqm === null) return `<div class="hint">The pin is over the sea. Tap on land.</div>`;
  const bt = bortleOf(sp.sqm);
  return `<div class="bortle-read"><div class="bbadge" style="background:${BORTLE_COLORS[bt - 1]};color:${bt >= 6 ? "#16130f" : "#f1ebdd"}"><span class="bnum">${bt}</span><span class="blab">Bortle</span></div>
    <div class="bscale-wrap"><div class="bscale">${BORTLE_COLORS.map((col, k) => `<span style="background:${col}" class="${k + 1 === bt ? "cur" : ""}"></span>`).join("")}</div>
    <div class="ticks num"><span>1 darkest</span><span>9 city</span></div><div class="hint num">est. ${sp.sqm.toFixed(2)} mag/arcsec² · ${sp.lat.toFixed(4)}, ${sp.lon.toFixed(4)}</div></div></div>`;
}

function trendText(c) {
  if (c.trend == null) return "Too little artificial light here for the satellite to measure a trend.";
  const col = c.trend > 3 ? "var(--warn)" : "var(--ink)";
  return `Satellite-measured light in this region: <b class="num" style="color:${col}">${c.trend > 0 ? "+" : ""}${c.trend}% per decade</b>`;
}

/** The pinned spot's place name: undefined = still looking up, null = not found. */
function placeHtml(place) {
  const icon = `<svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2a7 7 0 0 0-7 7c0 5 7 13 7 13s7-8 7-13a7 7 0 0 0-7-7zm0 9.5A2.5 2.5 0 1 1 12 6.5a2.5 2.5 0 0 1 0 5z" fill="currentColor"/></svg>`;
  if (place === undefined) return `${icon}<span class="hint">Finding the place name…</span>`;
  if (!place) return `${icon}<span class="hint">Place name unavailable here</span>`;
  return `${icon}<span><b>${esc(place.local || place.area)}</b>${place.local && place.area ? ` <span class="area">· ${esc(place.area)}</span>` : ""}</span>`;
}

function renderCard(el, i) {
  const c = CELLS[i],
    r = results[i];
  const sp = spotInfo(state.pin[0], state.pin[1]),
    atBest = Math.abs(state.pin[0] - c.bl[1]) < 1e-6 && Math.abs(state.pin[1] - c.bl[0]) < 1e-6;
  const dd = distOf(c),
    mc = monthChart(i);
  const origin = ORIGINS.find((o) => o[0] === state.origin)[1];
  const trendSince = manifest.lightTrend ? ` since ${manifest.lightTrend.firstYear}` : "";
  el.innerHTML = `<div class="card">
    <button class="back" type="button" id="backBtn">← All regions</button>
    <div><h3>${esc(c.en)}</h3><div class="jp">${esc(c.jp)} · ${esc(c.pref)} <span class="jp">${esc(c.prefjp)}</span></div></div>
    <div class="place" id="placeName" aria-live="polite">${placeHtml(sp.sqm === null ? null : cachedPlace(sp.lat, sp.lon))}</div>
    ${notices()}
    ${r.ok ? "" : `<div class="note">This region doesn't pass your current darkness or distance filter.</div>`}
    <div class="tiles">
      <div class="tile"><div class="v" style="color:var(--odds)">${pct(r.p)}</div><div class="k">${r.fc ? `trip odds with live forecast<br><span class="num">history alone ${pct(r.pHist)}</span>` : `trip odds, at least one good night<br><span class="num">range ${rangeTxt(r)}</span>`}</div></div>
      <div class="tile"><div class="v">${bortleOf(c.sqm)}</div><div class="k">Bortle at darkest spot <span class="num">(est. ${c.sqm.toFixed(1)} mag/arcsec²)</span></div></div>
      <div class="tile"><div class="v">${dd != null ? Math.round(dd) : "–"}</div><div class="k">${dd != null ? `km from ${origin}, straight line` : "km: pick a starting city"}</div></div>
    </div>
    <div class="sect"><h4>Pinned spot${ib("Click or tap anywhere on the map to drop the pin. Sky brightness is the model estimate for that ~1 km pixel.", "Pinned spot")}</h4>
      <div class="pinbox">
        ${pinReading(sp)}
        <div class="actions">
          <a class="act" href="https://www.google.com/maps/search/?api=1&query=${sp.lat},${sp.lon}" target="_blank" rel="noopener"><svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2a7 7 0 0 0-7 7c0 5 7 13 7 13s7-8 7-13a7 7 0 0 0-7-7zm0 9.5A2.5 2.5 0 1 1 12 6.5a2.5 2.5 0 0 1 0 5z" fill="currentColor"/></svg>Google Maps</a>
          <a class="act" href="https://maps.gsi.go.jp/#14/${sp.lat.toFixed(5)}/${sp.lon.toFixed(5)}/" target="_blank" rel="noopener"><svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true"><path d="M2 20l7-11 4 6 3-4 6 9z" fill="currentColor"/></svg>Terrain (地理院)</a>
          <a class="act" href="https://www.windy.com/?clouds,${sp.lat},${sp.lon},9" target="_blank" rel="noopener"><svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 18a5 5 0 0 1-.6-9.96A6 6 0 0 1 18 9a4.5 4.5 0 0 1-.5 9z" fill="currentColor"/></svg>Live clouds</a>
          <button type="button" class="act" id="copyBtn"><svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true"><path d="M8 8h11v13H8zM5 3h11v3H7v11H5z" fill="currentColor"/></svg>Copy coordinates</button>
        </div>
        ${atBest ? "" : `<button type="button" class="act wide" id="toBest">Back to this region's darkest spot</button>`}
        <div class="hint">Satellite estimate, not a surveyed site. Check road access, land access and safety before you go.</div>
      </div></div>
    <div class="sect"><h4>Sky from the pin${ib("An approximate picture of the whole sky from the pin: horizon at the bottom, zenith at the top, all the way round. Glow falls with distance squared and haze, so a big city far away can look fainter than a village nearby, and distant domes sit lower. The sky is brightest near the horizon because you look through more air there (about 4× the zenith). Stars fade where the glow is strong. Hills that would hide a town are not modelled, and white LEDs are under-counted. An illustration, not a measurement.", "Sky from the pin")}</h4>
      <canvas id="pano" class="pano" role="img" aria-label="Simulated horizon glow around the pin"></canvas>
      <div class="hint" id="panoTxt" style="margin-top:6px"></div></div>
    <div class="sect"><h4>Night by night${ib(`Usable hours have the sun 18° below the horizon and the moon down or under 25% lit${state.target === "mw" ? ", with the galactic core 10° up" : ""}. Odds per night differ by a few points mostly through noise.`, "Night by night")}</h4>
      <table class="nights"><tr><th>Night of</th><th>Moon</th><th>Usable hours</th>${r.fc ? "<th>Forecast</th>" : ""}<th style="text-align:right">Odds</th></tr>
      ${r.dates
        .map((dt, j) => {
          const m = moonInfo(dt),
            f = r.fc?.[j];
          const fcCell = !r.fc
            ? ""
            : `<td class="num">${f ? `<span class="${f.good ? "fc-good" : "fc-bad"}" title="Forecast clear hours in the usable window; trusted ${Math.round(f.w * 100)}% for this night">${f.good ? "clear" : "cloudy"} ${f.clearH} h</span>` : `<span class="hint">beyond ${FORECAST.days} days</span>`}</td>`;
          const odds = f ? f.p : r.nightP[j];
          return `<tr><td>${fmtDate(dt)}</td><td><span title="${moonName(m.f, m.waxing)}, ${Math.round(m.f * 100)}% lit">${moonIcon(m.f, m.waxing)} <span class="num">${Math.round(m.f * 100)}%</span></span></td><td class="num">${hoursLabel(r.wins[j])}</td>${fcCell}<td class="num" style="text-align:right">${r.wins[j] ? pct(odds) : "–"}</td></tr>`;
        })
        .join("")}
      </table>
      <div class="hint" style="margin-top:6px">Expected good nights on this trip: <span class="num">${r.expGood.toFixed(1)}</span></div></div>
    ${r.actual ? `<div class="sect"><h4>What actually happened in ${r.actual.year}</h4><div class="hint">On these exact dates: <b class="num" style="color:var(--ink)">${r.actual.nights}</b> good night${r.actual.nights === 1 ? "" : "s"} out of ${state.nights}. That year is excluded from the odds above.</div></div>` : ""}
    <div class="sect"><h4>How much luck is involved${ib("Each box is the same dates in a past year. It shows how much outcomes swing from year to year. A clear night on these dates in a past year doesn't make one more likely this year: the odds pool every year and a month either side of your dates.", "Luck")}</h4>
      <div class="years">${r.luck.map((v, k) => `<div class="yr"><i class="${v ? "y" : ""}${v === null ? " x" : ""}" title="${YEARS[k]}: ${v === null ? "not used" : v ? "at least one good night" : "no good night"}"></i>${String(YEARS[k]).slice(2)}</div>`).join("")}</div>
      <div class="hint" style="margin-top:4px">Filled = at least one good night on these dates that year.</div></div>
    <div class="sect"><h4>Best months here${ib("Share of all nights in each month with a good clear window, using your hours setting. The moon is not counted, so pick new-moon dates within the best months.", "Best months")}</h4>${mc.svg}<div class="hint">Best: ${MONTHS[mc.best]} (${pct(mc.vals[mc.best])})</div></div>
    <div class="sect"><h4>Is the sky here changing?${ib(`Change in satellite-measured night light in this region${trendSince}. The satellite under-sees blue-white LEDs, so real brightening is likely worse than shown.`, "Light trend")}</h4><div class="hint">${trendText(c)}</div></div>
    <div class="sect"><h4>Towns in this region</h4><div class="towns">${c.also
      .map((a) => {
        const [e, j] = a.split("|");
        return `${esc(e)} <span class="jp">${esc(j)}</span>`;
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
      btn.textContent = "Copied";
    } catch {
      btn.textContent = "Copy failed: select the numbers above";
    }
  };
  const tb = document.getElementById("toBest");
  if (tb) tb.onclick = () => select(i);

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
  const lv = pr.peak < 0.15 ? "Low" : pr.peak < 0.35 ? "Moderate" : pr.peak < 0.6 ? "High" : "Very high";
  const from =
    sp.src && pr.peak >= 0.1 ? `, mainly from ${esc(sp.src.nm)}${sp.src.d > 3 ? `, ${Math.round(sp.src.d)} km away` : ", close by"}` : "";
  const core =
    state.target === "mw"
      ? ["SE", "S", "SW"].includes(pr.dir)
        ? " That's where the Milky Way core sits, low between south-east and south-west."
        : " The southern sky, where the Milky Way core sits, is clearer."
      : "";
  document.getElementById("panoTxt").innerHTML =
    `Horizon glow: <b style="color:var(--ink)">${lv}</b>. Brightest towards <b style="color:var(--ink)">${pr.dir}</b>${from}.${core}`;
}
