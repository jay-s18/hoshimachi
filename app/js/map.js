/**
 * The Leaflet map: base layers, region squares, raster overlays, legend, selection and pin.
 */
import { BASE_TILES, BORTLE_COLORS, GSI_ATTR, MONTHS, ODDS_STOPS, SPOTS, TILE_PROBE } from "./config.js";
import { BOUNDS, CELLS, OVERLAY_URLS, PREFS } from "./data.js";
import { state, monthOf } from "./state.js";
import { ib, pct } from "./util.js";
import { results } from "./app.js";
import { renderPanel } from "./panel.js";
import { writeLink } from "./link.js";
import { nameHint } from "./place.js";

let map, landFill, ovB, ovT, rects, spotLayer, selR, BASES;
let selMarker = null,
  pinMarker = null,
  tilesOK = null, // null = still checking, true/false = remote tiles can / cannot load
  basePicked = false, // the user chose a base map, so never switch it automatically
  startBase; // the base map the page opens with (state.base at start-up)

export function initMap() {
  map = L.map("map", { zoomControl: true, attributionControl: false, minZoom: 4, maxZoom: 15, zoomSnap: 0.5, preferCanvas: true });
  L.control.attribution({ prefix: false, position: "bottomright" }).addTo(map);
  map.fitBounds([
    [30.2, 128.8],
    [45.6, 146.0],
  ]);
  map.setMaxBounds([
    [19, 115],
    [50, 155],
  ]);
  // Explicit panes keep the stacking order stable: base < rasters < squares < outlines < selection
  map.createPane("base").style.zIndex = 350;
  map.createPane("rasters").style.zIndex = 420;
  map.createPane("cellsP").style.zIndex = 430;
  map.createPane("lines").style.zIndex = 435;
  map.createPane("sel").style.zIndex = 440;
  selR = L.svg({ pane: "sel" });

  landFill = L.geoJSON(PREFS, {
    pane: "base",
    renderer: L.svg({ pane: "base" }),
    style: { color: "#2a292f", weight: 0.7, fillColor: "#18181c", fillOpacity: 1 },
    interactive: false,
  }).addTo(map);
  BASES = Object.fromEntries(
    Object.entries(BASE_TILES).map(([k, sets]) => [
      k,
      L.layerGroup(
        sets.map(({ url, ...zoom }) => L.tileLayer(url, { maxZoom: 18, ...zoom, className: "tiles-" + k, attribution: GSI_ATTR })),
      ),
    ]),
  );
  startBase = state.base;
  applyBase(startBase); // show Roads straight away; probeTiles() falls back to Plain only if tiles can't load
  probeTiles();

  ovB = L.imageOverlay(OVERLAY_URLS.bortle, BOUNDS, { opacity: 0.95, interactive: false, pane: "rasters", className: "ov-smooth" });
  ovT = L.imageOverlay(OVERLAY_URLS.trend, BOUNDS, { opacity: 0.95, interactive: false, pane: "rasters" });
  L.geoJSON(PREFS, {
    pane: "lines",
    renderer: L.svg({ pane: "lines" }),
    style: { color: "#e4ddcf", weight: 0.7, opacity: 0.45, fill: false },
    interactive: false,
  }).addTo(map);

  const cellRenderer = L.canvas({ padding: 0.3, pane: "cellsP" });
  rects = CELLS.map((c, i) =>
    L.rectangle(
      [
        [c.lat - 0.125, c.lon - 0.125],
        [c.lat + 0.125, c.lon + 0.125],
      ],
      { renderer: cellRenderer, weight: 0, fillOpacity: 0, stroke: false },
    )
      .on("click", (e) => select(i, [e.latlng.lat, e.latlng.lng]))
      .bindTooltip(
        () => {
          const r = results[i];
          const v = r ? (state.layer === "month" ? r.m : r.p) : null;
          return `<b>${c.en}</b> <span class="jp">${c.jp}</span><br>${c.pref}${v != null ? ` · <span class="num">${pct(v)}</span>` : ""}`;
        },
        { sticky: true },
      )
      .addTo(map),
  );
  spotLayer = L.layerGroup(
    SPOTS.map((s) =>
      L.marker([s[3], s[4]], {
        icon: L.divIcon({ className: "", html: `<div class="mk ${s[0]}">${s[0] === "known" ? "●" : "✦"}</div>`, iconSize: [14, 14] }),
        keyboard: false,
      })
        .bindTooltip(`<b>${s[1]}</b> <span class="jp">${s[2]}</span><br><span class="hint">${s[5]}</span>`)
        // Markers swallow clicks, so the region square underneath never sees them: select it here instead.
        .on("click", () => {
          const i = cellAt(s[3], s[4]);
          nameHint(s[3], s[4], `${s[1]} ${s[2]}`);
          if (i >= 0) select(i, [s[3], s[4]]);
        }),
    ),
  ).addTo(map);
}

/** Index of the 0.25° cloud cell containing [lat, lon], or -1 if none (e.g. open sea). */
export function cellAt(lat, lon) {
  return CELLS.findIndex((c) => Math.abs(lat - c.lat) <= 0.125 && Math.abs(lon - c.lon) <= 0.125);
}

/**
 * Check whether remote base-map tiles can load here. If they can't, fall back to Plain and disable Roads/Terrain.
 * A slow connection may time out and then succeed: the late success restores the starting base map.
 */
function probeTiles() {
  const im = new Image();
  const done = (ok) => {
    if (tilesOK === true || (tilesOK === false && !ok)) return;
    tilesOK = ok;
    if (!basePicked) applyBase(ok ? startBase : "plain");
    else baseUI();
  };
  im.onload = () => done(true);
  im.onerror = () => done(false);
  im.src = TILE_PROBE;
  setTimeout(() => done(false), 8000);
}

export function oddsColor(p) {
  p = Math.max(0, Math.min(1, (p / (state.layer === "month" ? 0.6 : 1)) * 0.6));
  for (let i = 1; i < ODDS_STOPS.length; i++) {
    const [a, ca] = ODDS_STOPS[i - 1],
      [b, cb] = ODDS_STOPS[i];
    if (p <= b) {
      const t = (p - a) / (b - a);
      return `rgb(${ca.map((v, k) => Math.round(v + (cb[k] - v) * t)).join(",")})`;
    }
  }
  return "rgb(138,217,177)";
}

/** Redraw the active layer from the latest results. */
export function paint() {
  const lay = state.layer;
  [ovB, ovT].forEach((o) => map.hasLayer(o) && map.removeLayer(o));
  if (lay === "dark") ovB.setOpacity(state.opRaster).addTo(map);
  if (lay === "trend") ovT.setOpacity(state.opRaster).addTo(map);
  rects.forEach((r, i) => {
    const res = results[i];
    if ((lay === "trip" || lay === "month") && res && res.ok)
      r.setStyle({ fillColor: oddsColor(lay === "month" ? res.m : res.p), fillOpacity: state.opOdds });
    else if ((lay === "trip" || lay === "month") && res) r.setStyle({ fillColor: "#000000", fillOpacity: state.opOdds * 0.6 });
    else r.setStyle({ fillOpacity: 0 });
  });
  spotLayer[state.spots ? "addTo" : "remove"](map);
  legend();
  writeLink();
}

function applyOpacity() {
  if (state.layer === "dark") ovB.setOpacity(state.opRaster);
  else if (state.layer === "trend") ovT.setOpacity(state.opRaster);
  else
    rects.forEach((r, i) => {
      const res = results[i];
      if (res && res.ok) r.setStyle({ fillOpacity: state.opOdds });
      else if (res) r.setStyle({ fillOpacity: state.opOdds * 0.6 });
    });
}

function opacityCtl() {
  const v = Math.round((state.layer === "dark" || state.layer === "trend" ? state.opRaster : state.opOdds) * 100);
  return `<div class="row" style="margin-top:8px"><label for="opac" class="hint" style="white-space:nowrap">Overlay</label><input type="range" id="opac" min="10" max="100" step="5" value="${v}"><span class="num hint" id="opacOut" style="min-width:36px;text-align:right">${v}%</span></div>`;
}

function wireOpacity() {
  const o = document.getElementById("opac");
  if (!o) return;
  o.oninput = () => {
    const v = +o.value / 100;
    if (state.layer === "dark" || state.layer === "trend") state.opRaster = v;
    else state.opOdds = v;
    document.getElementById("opacOut").textContent = o.value + "%";
    applyOpacity();
  };
}

export function baseUI() {
  document.querySelectorAll("#baseSeg button").forEach((b) => {
    const off = b.dataset.v !== "plain" && tilesOK === false;
    b.disabled = off;
    b.classList.toggle("on", b.dataset.v === state.base);
    b.title = off ? "Road and terrain maps could not load here (the page may be embedded in a viewer that blocks them)." : "";
  });
}

/** User choice from the Plain / Roads / Terrain buttons. */
export function setBase(v) {
  basePicked = true;
  applyBase(v);
}

function applyBase(v) {
  Object.values(BASES).forEach((t) => map.hasLayer(t) && map.removeLayer(t));
  state.base = v;
  if (v !== "plain") BASES[v].addTo(map);
  landFill.setStyle({ fillOpacity: v === "plain" ? 1 : 0 });
  baseUI();
  writeLink();
}

/** Centre the map on [lat, lon], zooming in to at least `zoom` (used when a shared link opens a spot). */
export function centerOn(latlon, zoom = 9) {
  map.setView(latlon, Math.max(map.getZoom(), zoom));
}

function legend() {
  const el = document.getElementById("legend"),
    lay = state.layer;
  if (lay === "trip" || lay === "month") {
    const mx = lay === "month" ? 0.6 : 1;
    const grad = ODDS_STOPS.map(([p]) => `${oddsColor((p / 0.6) * mx)} ${(p / 0.6) * 100}%`).join(",");
    const title =
      lay === "trip"
        ? "Chance of at least one good night on your trip"
        : `Share of good nights in ${MONTHS[monthOf() - 1]}, moon not counted`;
    el.innerHTML = `<div class="ttl lblrow">${title}${ib("Each square is a ~28 km cloud cell. Darkened squares fail your darkness or distance filter. A white box marks the selected region and a white dot its darkest spot.", "Map squares")}</div>
      <div class="bar" style="background:linear-gradient(90deg,${grad})"></div><div class="ticks num">${(lay === "month" ? [0, 15, 30, 45, "60+"] : [0, 25, 50, 75, 100]).map((v) => `<span>${v}%</span>`).join("")}</div>
      <div class="keys" style="margin-top:6px"><span><span class="mk cert" style="display:inline">✦</span> certified</span><span><span class="mk mine" style="display:inline">✦</span> author's spots</span><span><span class="mk known" style="display:inline">●</span> well-known</span></div>`;
  } else if (lay === "dark") {
    el.innerHTML = `<div class="ttl lblrow">Estimated sky brightness (Bortle class)${ib("Modelled zenith sky brightness from satellite night lights, spread over 150 km. Brighter and warmer means more light pollution. Labels may be off by one class.", "Darkness layer")}</div><div class="bar" style="background:linear-gradient(90deg,${BORTLE_COLORS.join(",")})"></div><div class="ticks num">${BORTLE_COLORS.map((_, i) => `<span>${i + 1}</span>`).join("")}</div><div class="ticks"><span>darkest sky</span><span>city glow</span></div>`;
  } else {
    el.innerHTML = `<div class="ttl lblrow">Satellite night-light trend${ib("Change in VIIRS satellite night lights over the years on record. The satellite under-sees blue-white LEDs, so real brightening is worse than shown, and some LED-converted areas may even appear to dim.", "Light trend")}</div><div class="keys"><span><span class="sw" style="background:#ffb65c"></span>brightening fast</span><span><span class="sw" style="background:#c47028"></span>brightening</span><span><span class="sw" style="background:#6e6860"></span>stable</span><span><span class="sw" style="background:#5888c8"></span>dimming</span></div>`;
  }
  el.insertAdjacentHTML("beforeend", opacityCtl());
  wireOpacity();
}

/* ---------- selection and pin ---------- */
/** Select region i; pin = [lat, lon] (defaults to the region's darkest spot). */
export function select(i, pin) {
  state.sel = i;
  const c = CELLS[i];
  state.pin = pin || [c.bl[1], c.bl[0]];
  if (selMarker) map.removeLayer(selMarker);
  const bb = [
    [c.lat - 0.125, c.lon - 0.125],
    [c.lat + 0.125, c.lon + 0.125],
  ];
  selMarker = L.layerGroup([
    L.rectangle(bb, { color: "#000000", weight: 6, opacity: 0.85, fill: false, interactive: false, pane: "sel", renderer: selR }),
    L.rectangle(bb, { color: "#ffffff", weight: 2.5, fill: false, interactive: false, pane: "sel", renderer: selR }),
    L.circleMarker([c.bl[1], c.bl[0]], {
      radius: 4,
      color: "#ffffff",
      weight: 2,
      fillColor: "#000000",
      fillOpacity: 1,
      interactive: false,
      pane: "sel",
      renderer: selR,
    }),
  ]).addTo(map);
  placePin();
  renderPanel();
}

function placePin() {
  if (pinMarker) map.removeLayer(pinMarker);
  pinMarker = L.marker(state.pin, {
    interactive: false,
    keyboard: false,
    icon: L.divIcon({
      className: "",
      iconSize: [26, 26],
      iconAnchor: [13, 13],
      html: '<svg width="26" height="26" viewBox="0 0 26 26" aria-hidden="true"><circle cx="13" cy="13" r="8" fill="none" stroke="#000" stroke-width="4"/><circle cx="13" cy="13" r="8" fill="none" stroke="#fff" stroke-width="2"/><path d="M13 1v6M13 19v6M1 13h6M19 13h6" stroke="#000" stroke-width="3.5"/><path d="M13 1v6M13 19v6M1 13h6M19 13h6" stroke="#fff" stroke-width="1.6"/></svg>',
    }),
  }).addTo(map);
}

/** Back to the list: clear the selection box and pin. */
export function clearSelection() {
  state.sel = null;
  if (selMarker) {
    map.removeLayer(selMarker);
    selMarker = null;
  }
  if (pinMarker) {
    map.removeLayer(pinMarker);
    pinMarker = null;
  }
}
