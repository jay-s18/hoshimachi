/**
 * Static configuration: things that are part of the product, not of the yearly data.
 *
 * Anything that changes when the data is rebuilt (years covered, validated model settings,
 * grid sizes, file names) comes from data/manifest.json instead. See js/data.js.
 */

/** Location of the data folder, relative to index.html. */
export const DATA_URL = "data/";

/** Starting cities for the distance filter: [id, label, [lat, lon] | null]. */
export const ORIGINS = [
  ["any", "Anywhere in Japan", null],
  ["tokyo", "Tokyo", [35.681, 139.767]],
  ["osaka", "Osaka", [34.702, 135.496]],
  ["nagoya", "Nagoya", [35.171, 136.882]],
  ["sapporo", "Sapporo", [43.069, 141.351]],
  ["sendai", "Sendai", [38.26, 140.882]],
  ["fukuoka", "Fukuoka", [33.59, 130.42]],
  ["hiroshima", "Hiroshima", [34.397, 132.475]],
  ["kanazawa", "Kanazawa", [36.578, 136.648]],
  ["naha", "Naha", [26.212, 127.679]],
];

/**
 * Map markers: [kind, English name, Japanese name, lat, lon, note].
 * kind: "cert" = certified International Dark Sky Place, "mine" = author's field-tested spot,
 * "known" = well-known stargazing spot. Positions are approximate.
 */
export const SPOTS = [
  ["cert", "Iriomote-Ishigaki National Park", "西表石垣国立公園", 24.33, 123.81, "Certified Dark Sky Park, 2018"],
  ["cert", "Kozushima", "神津島", 34.21, 139.15, "Certified Dark Sky Park, 2020"],
  ["cert", "Bisei, Ibara City", "井原市美星町", 34.672, 133.544, "Certified Dark Sky Community, 2021"],
  ["cert", "Minami-Rokuroshi, Ono City", "大野市南六呂師", 35.975, 136.578, "Certified Urban Night Sky Place, 2023"],
  ["mine", "Unarizaki Park, Iriomote", "宇奈利崎公園", 24.43, 123.78, "Field-tested by the author"],
  ["mine", "Hirakubozaki Lighthouse, Ishigaki", "平久保崎灯台", 24.61, 124.315, "Field-tested by the author"],
  ["mine", "Lake Toya", "洞爺湖", 42.6, 140.85, "Field-tested by the author"],
  ["known", "Achi Village", "阿智村", 35.46, 137.65, "Well-known stargazing spot"],
  ["known", "Norikura Plateau", "乗鞍高原", 36.11, 137.63, "Well-known stargazing spot"],
  ["known", "Utsukushigahara", "美ヶ原", 36.225, 138.105, "Well-known stargazing spot"],
  ["known", "Nobeyama", "野辺山", 35.95, 138.47, "Well-known stargazing spot"],
  ["known", "Lake Mashu", "摩周湖", 43.57, 144.53, "Well-known stargazing spot"],
  ["known", "Hateruma Island", "波照間島", 24.06, 123.78, "Well-known stargazing spot"],
  ["known", "Jododaira", "浄土平", 37.72, 140.25, "Well-known stargazing spot"],
];

/** Lower edge (mag/arcsec²) of Bortle classes 1..8; anything darker than an edge is that class. */
export const BORTLE_EDGES = [21.99, 21.89, 21.69, 20.49, 19.5, 18.94, 18.38, 17.8];
/** Darkness filter: minimum sky brightness for "Bortle N or darker". */
export const BORTLE_SQM = { 1: 21.99, 2: 21.89, 3: 21.69, 4: 20.49, 5: 19.5 };

/** Darkness criteria used when building each night's usable-hours window. */
export const SKY = {
  sunAltMax: -18, // degrees: astronomical darkness
  moonLitMax: 0.25, // a moon above the horizon only spoils an hour if more than 25% lit
  coreAltMin: 10, // Milky Way mode: galactic centre at least 10° up
};

export const DIRS = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
export const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/* ---------- colours (see "Reading the colours" in the About dialog) ---------- */
/** Odds scale ('mako'-style): perceptually ordered and colour-blind safe. Stops on 0..0.6. */
export const ODDS_STOPS = [
  [0, [46, 30, 59]],
  [0.12, [65, 61, 123]],
  [0.24, [55, 101, 158]],
  [0.36, [52, 143, 167]],
  [0.48, [64, 183, 173]],
  [0.6, [138, 217, 177]],
];
/** Bortle 1..9 as a warm glow ramp: lighter = more light pollution. Must match pipeline overlays.py. */
export const BORTLE_COLORS = ["#1b1714", "#2e1c16", "#4a221a", "#6e2b1c", "#98401e", "#c0621f", "#dd8d2e", "#eebd62", "#f8eccb"];

/* ---------- base maps (GSI, Geospatial Information Authority of Japan) ---------- */
export const GSI_ATTR =
  '<a href="https://maps.gsi.go.jp/development/ichiran.html" target="_blank" rel="noopener">地理院タイル</a> (GSI Japan)';
/**
 * Base maps, each one or more GSI tile sets shown over a zoom range.
 * Roads uses the label-free 白地図 (blank) when zoomed out, so place names don't clutter the region squares,
 * and the labelled 淡色地図 (pale) from ROADS_LABEL_ZOOM in.
 */
const ROADS_LABEL_ZOOM = 8;
export const BASE_TILES = {
  roads: [
    {
      url: "https://cyberjapandata.gsi.go.jp/xyz/blank/{z}/{x}/{y}.png",
      minNativeZoom: 5,
      maxNativeZoom: 14,
      maxZoom: ROADS_LABEL_ZOOM - 1,
    },
    { url: "https://cyberjapandata.gsi.go.jp/xyz/pale/{z}/{x}/{y}.png", maxNativeZoom: 18, minZoom: ROADS_LABEL_ZOOM },
  ],
  terrain: [{ url: "https://cyberjapandata.gsi.go.jp/xyz/hillshademap/{z}/{x}/{y}.png", maxNativeZoom: 16 }],
};
/** A single tile used to check whether remote tiles can load (some embedded viewers block them). */
export const TILE_PROBE = "https://cyberjapandata.gsi.go.jp/xyz/pale/5/28/12.png";

/* ---------- sky panorama ("Sky from the pin") ---------- */
export const PANO = {
  bins: 180, // azimuth bins (2° each)
  bands: [
    [1, 10, 6],
    [10, 30, 20],
    [30, 80, 55],
    [80, 200, 140],
  ], // [min km, max km, typical km] distance bands
  elevationMax: 90,
  rows: 91, // 1° rows from horizon to zenith
  airK: 0.35, // path-length factor: glow ∝ (1+k)/(sin(el)+k), ~3.9× brighter at the horizon than the zenith
  naturalSky: 0.75, // natural sky brightness in model units
  reference: [35.69, 139.7], // Shinjuku: the brightest reference used to normalise the picture
};

/* ---------- live services (looked up in the browser; the app still works without them) ---------- */
/**
 * Place names for the pin. Nominatim (OpenStreetMap) gives the English municipality, county and prefecture;
 * GSI's reverse geocoder gives the local district (大字・町名), which OpenStreetMap often lacks.
 * Nominatim's usage policy allows at most one request a second, so lookups are throttled and cached.
 */
export const PLACE_API = {
  nominatim: "https://nominatim.openstreetmap.org/reverse",
  gsi: "https://mreversegeocoder.gsi.go.jp/reverse-geocoder/LonLatToAddress",
  gsiSearch: "https://msearch.gsi.go.jp/address-search/AddressSearch",
  photon: "https://photon.komoot.io/api/",
  japanBox: [122, 24, 146, 46], // west, south, east, north
  minIntervalMs: 1100,
  searchLimit: 8,
};

/**
 * Live cloud forecast, blended into the odds for trip nights within `days` of today.
 * JMA's models via Open-Meteo (free, no key). One forecast point per 2×2 block of regions keeps a page load
 * to about 300 locations, inside Open-Meteo's free per-minute limit.
 * Trust in the forecast for a night `lead` days ahead = max(0, trust0 − trustDrop × lead). This is a rough rule
 * chosen by hand, not validated like the historical odds; the UI says so.
 */
export const FORECAST = {
  url: "https://api.open-meteo.com/v1/forecast",
  model: "jma_seamless",
  days: 7,
  batch: 100, // locations per request
  trust0: 0.85,
  trustDrop: 0.1,
};

/**
 * Light-trend overlay colours (trend.png) and what they mean; must match TREND_* in
 * pipeline/src/hoshimachi_pipeline/overlays.py and [overlays] trend_stable / trend_fast in pipeline/config.toml.
 * Used to read the trend at the pin back from the overlay image.
 */
// Ranges are in % per decade (10 × the pipeline's per-year thresholds), the same unit as a region's `trend`.
export const TREND_CLASSES = [
  { rgb: [255, 182, 92], a: 255, label: "brightening fast", detail: "more than +30% per decade" },
  { rgb: [196, 112, 40], a: 235, label: "brightening", detail: "+10% to +30% per decade" },
  { rgb: [110, 104, 96], a: 150, label: "stable", detail: "between −10% and +10% per decade" },
  { rgb: [88, 136, 200], a: 220, label: "dimming", detail: "more than −10% per decade" },
];
