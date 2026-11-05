/**
 * Loads everything in data/ (produced by the Python pipeline) and exposes it as read-only
 * module bindings. Other modules import these names; they are filled once by loadData().
 *
 * data/manifest.json is the single entry point: it names every file, the period covered,
 * the validated model settings and the validation summary. A yearly data update only replaces
 * the contents of data/; no JavaScript needs to change. See docs/DATA_FORMAT.md.
 */
import { DATA_URL } from "./config.js";

export const SUPPORTED_SCHEMA = 1;

export let manifest = null;
/** Region cells (~0.25° ERA5 cloud cells on land). See docs/DATA_FORMAT.md for fields. */
export let CELLS = [];
export let NC = 0; // number of cells
export let NN = 0; // number of nights
export let T0 = 0; // UTC ms of the first night's evening date
export let YEARS = []; // full calendar years covered
export let NBR = []; // indices of the up-to-8 adjacent cells for each cell
export let PREFS = null; // prefecture outlines (GeoJSON)
export let BOUNDS = null; // overlay bounds [[south, west], [north, east]]
export let SOURCES = []; // named light sources: [lat, lon, "English (日本語)", total radiance]
export let MASKS = null; // Uint16Array nights × cells: bit k = hour (firstHourLocal + k) was clear
export let SQMG = null; // Uint8Array pixel grid: sky brightness code (255 = sea)
export let RADG = null; // Uint8Array pixel grid: log-scaled night-light radiance code
export let TRENDG = null; // Uint8Array pixel grid: light trend, % per decade + GRID.trendOffset (255 = none); null in older data
export let GRID = null; // pixel grid geometry
export let MODEL = null; // validated model settings: { windowDays, ownWeight }
export let OVERLAY_URLS = null; // { bortle, trend } image URLs
export let RADLUT = null; // radiance code -> radiance (nW/cm²/sr)

const url = (name) => DATA_URL + name;

/**
 * The single-file build (tools/build-single-file.mjs) embeds every data file in the page as base64,
 * keyed by file name. In the normal hosted app this is absent and files are fetched.
 */
const EMBEDDED = globalThis.HOSHIMACHI_EMBEDDED_DATA ?? null;
const fromBase64 = (b64) => Uint8Array.from(atob(b64), (ch) => ch.charCodeAt(0));

/**
 * Fetch a data file. Files listed in the manifest carry their checksum as a query string, so a
 * data update is never mixed with stale cached files; the manifest itself is always revalidated.
 */
async function fetchOk(name, entry) {
  if (EMBEDDED) {
    if (!(name in EMBEDDED)) throw new Error(`${name} is not embedded in this page`);
    return new Response(fromBase64(EMBEDDED[name]));
  }
  const res = entry ? await fetch(`${url(name)}?v=${entry.sha256.slice(0, 12)}`) : await fetch(url(name), { cache: "no-cache" });
  if (!res.ok) throw new Error(`Could not load ${name} (HTTP ${res.status})`);
  return res;
}

/**
 * Fetch a gzip-compressed binary file and return its bytes. Some hosts send .gz files with
 * "Content-Encoding: gzip", in which case the browser has already decompressed them; the gzip
 * magic number tells the two cases apart.
 */
async function fetchGzipBytes(entry) {
  const buf = new Uint8Array(await (await fetchOk(entry.path, entry)).arrayBuffer());
  if (buf[0] !== 0x1f || buf[1] !== 0x8b) return buf;
  const stream = new Blob([buf]).stream().pipeThrough(new DecompressionStream("gzip"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

function neighbours(cells) {
  const key = new Map(cells.map((c, i) => [c.r + "_" + c.c, i]));
  return cells.map((c) => {
    const out = [];
    for (let dr = -1; dr <= 1; dr++)
      for (let dc = -1; dc <= 1; dc++) {
        if (!dr && !dc) continue;
        const j = key.get(c.r + dr + "_" + (c.c + dc));
        if (j !== undefined) out.push(j);
      }
    return out;
  });
}

export async function loadData() {
  manifest = await (await fetchOk("manifest.json")).json();
  if (manifest.schemaVersion !== SUPPORTED_SCHEMA)
    throw new Error(`Data schema ${manifest.schemaVersion} is not supported by this app (expects ${SUPPORTED_SCHEMA}).`);
  const f = manifest.files;

  const [cells, prefs, sources, masks, sqm, rad, trend] = await Promise.all([
    fetchOk(f.cells.path, f.cells).then((r) => r.json()),
    fetchOk(f.prefectures.path, f.prefectures).then((r) => r.json()),
    fetchOk(f.lightSources.path, f.lightSources).then((r) => r.json()),
    fetchGzipBytes(f.nightMasks),
    fetchGzipBytes(f.skyBrightness),
    fetchGzipBytes(f.radiance),
    f.lightTrend ? fetchGzipBytes(f.lightTrend) : null, // optional: data published before it existed lacks it
  ]);

  CELLS = cells;
  NC = cells.length;
  NN = manifest.period.nights;
  const [y, m, d] = manifest.period.firstNight.split("-").map(Number);
  T0 = Date.UTC(y, m - 1, d);
  YEARS = manifest.period.years;
  NBR = neighbours(cells);
  PREFS = prefs;
  BOUNDS = manifest.overlayBounds;
  SOURCES = sources;
  MASKS = new Uint16Array(masks.buffer, masks.byteOffset, masks.byteLength / 2);
  if (MASKS.length !== NN * NC) throw new Error(`nightMasks has ${MASKS.length} values, expected ${NN * NC}`);
  SQMG = sqm;
  RADG = rad;
  TRENDG = trend;
  const g = manifest.pixelGrid;
  GRID = {
    w: g.west,
    n: g.north,
    step: g.step,
    H: g.rows,
    W: g.cols,
    sqmOffset: g.sqmOffset,
    sqmScale: g.sqmScale,
    trendOffset: g.trendOffset,
  };
  if (TRENDG && TRENDG.length !== GRID.H * GRID.W) throw new Error("lightTrend grid size does not match the manifest");
  if (SQMG.length !== GRID.H * GRID.W) throw new Error("skyBrightness grid size does not match the manifest");
  RADLUT = Float64Array.from({ length: 256 }, (_, q) => Math.expm1((q / g.radianceLevels) * Math.log1p(g.radianceMax)));
  MODEL = { windowDays: manifest.model.windowDays, ownWeight: 1 - manifest.model.neighbourWeight };
  const versioned = (e) => (EMBEDDED ? `data:image/png;base64,${EMBEDDED[e.path]}` : `${url(e.path)}?v=${e.sha256.slice(0, 12)}`);
  OVERLAY_URLS = { bortle: versioned(f.bortleOverlay), trend: versioned(f.trendOverlay) };
  return manifest;
}

/** "2015–2024" for UI text. */
export function periodLabel() {
  return `${YEARS[0]}–${YEARS[YEARS.length - 1]}`;
}
