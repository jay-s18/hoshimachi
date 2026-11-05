/**
 * Place names, from two free services (see PLACE_API in config.js):
 *   - lookupPlace(): the name for the pinned spot, e.g. "野辺山 · Minamimaki, Minamisaku County, Nagano".
 *     GSI gives the local district (大字・町名), present almost everywhere on land in Japan; Nominatim
 *     (OpenStreetMap) gives municipality, county and prefecture in English where OSM has it.
 *   - searchPlaces(): find a named place. GSI for Japanese text (it knows 地名 well), Nominatim otherwise,
 *     each falling back to the other when it finds nothing.
 * Nominatim allows one request a second and no search-as-you-type, so its requests share one throttle and
 * search only runs when the user submits. Either service may fail; callers then show fewer details.
 */
import { PLACE_API } from "./config.js";

/** "lat,lon" (4 dp, ~10 m) -> { local, area } once looked up; null if nothing was found. */
const done = new Map();
const pending = new Map();
/** "lat,lon" -> a name the user chose (a search result or a marked spot), shown instead of the district. */
const hints = new Map();
let nextNominatim = 0;

const keyOf = (lat, lon) => `${lat.toFixed(4)},${lon.toFixed(4)}`;

/** Remember that [lat, lon] is the named place `name` (e.g. 摩周湖), so the pin shows that name. */
export function nameHint(lat, lon, name) {
  const key = keyOf(lat, lon);
  hints.set(key, name);
  done.delete(key);
}

/** The place for [lat, lon] if already looked up, otherwise undefined. */
export function cachedPlace(lat, lon) {
  return done.get(keyOf(lat, lon));
}

/**
 * Look up the place for [lat, lon]. `stillWanted()` is checked before the throttled Nominatim request,
 * so a pin that has already moved on doesn't spend a request.
 */
export function lookupPlace(lat, lon, stillWanted = () => true) {
  const key = keyOf(lat, lon);
  if (done.has(key)) return Promise.resolve(done.get(key));
  if (pending.has(key)) return pending.get(key);
  const p = Promise.all([gsi(lat, lon).catch(() => null), nominatim(lat, lon, stillWanted).catch(() => undefined)]).then(
    ([district, osm]) => {
      pending.delete(key);
      if (osm === undefined && !district) return null; // nothing reached: don't cache, a later click may succeed
      let place = compose(district, osm);
      const hint = hints.get(key);
      if (hint) {
        const area = [place?.local, place?.area].filter((x) => x && !hint.includes(x)).join(", ");
        place = { local: hint, area };
      }
      done.set(key, place);
      return place;
    },
  );
  pending.set(key, p);
  return p;
}

async function gsi(lat, lon) {
  const r = await fetch(`${PLACE_API.gsi}?lat=${lat.toFixed(5)}&lon=${lon.toFixed(5)}`);
  if (!r.ok) throw new Error(`GSI ${r.status}`);
  const nm = (await r.json())?.results?.lv01Nm;
  return nm && nm !== "−" && nm !== "-" ? nm.replace(/^大字/, "") : null;
}

/** GET a Nominatim URL, at most one request per PLACE_API.minIntervalMs across the whole app. */
async function nominatimGet(url, stillWanted = () => true) {
  const wait = nextNominatim - Date.now();
  nextNominatim = Math.max(Date.now(), nextNominatim) + PLACE_API.minIntervalMs;
  if (wait > 0) await new Promise((res) => setTimeout(res, wait));
  if (!stillWanted()) throw new Error("no longer needed");
  const r = await fetch(url);
  if (!r.ok) throw new Error(`Nominatim ${r.status}`);
  return r.json();
}

async function nominatim(lat, lon, stillWanted) {
  const base = PLACE_API.nominatim.replace(/\/search$/, "/reverse");
  const d = await nominatimGet(`${base}?format=jsonv2&lat=${lat.toFixed(5)}&lon=${lon.toFixed(5)}&zoom=16&accept-language=en`, stillWanted);
  return d.error ? null : d.address || null;
}

/** True if q contains hiragana, katakana (U+3040–U+30FF) or kanji (U+3400–U+9FFF). */
const hasJapanese = (q) =>
  [...q].some((ch) => {
    const c = ch.codePointAt(0);
    return (c >= 0x3040 && c <= 0x30ff) || (c >= 0x3400 && c <= 0x9fff);
  });

/**
 * Places in Japan matching the text q: [{ name, detail, lat, lon }], best first (at most PLACE_API.searchLimit).
 * Throws if neither service could be reached.
 */
export async function searchPlaces(q) {
  q = q.trim();
  if (!q) return [];
  const order = hasJapanese(q) ? [gsiSearch, osmSearch] : [osmSearch, gsiSearch];
  let reached = false;
  for (const find of order) {
    try {
      const found = await find(q);
      reached = true;
      if (found.length) return found.slice(0, PLACE_API.searchLimit);
    } catch (err) {
      console.warn("Place search:", err);
    }
  }
  if (!reached) throw new Error("Place search is unavailable");
  return [];
}

async function gsiSearch(q) {
  const r = await fetch(`${PLACE_API.gsiSearch}?q=${encodeURIComponent(q)}`);
  if (!r.ok) throw new Error(`GSI search ${r.status}`);
  return (await r.json()).map((f) => ({
    name: f.properties.title,
    detail: "",
    lon: f.geometry.coordinates[0],
    lat: f.geometry.coordinates[1],
  }));
}

async function osmSearch(q) {
  const base = PLACE_API.nominatim.replace(/\/reverse$/, "/search");
  const d = await nominatimGet(
    `${base}?format=jsonv2&countrycodes=jp&accept-language=en&limit=${PLACE_API.searchLimit}&q=${encodeURIComponent(q)}`,
  );
  const out = d.map((x) => {
    // display_name runs from the place itself out to the country; keep the last three named levels as context.
    const parts = x.display_name.split(", ").filter((p) => p !== "Japan" && !/^\d{3}-?\d{4}$/.test(p));
    return { name: x.name || parts[0], detail: parts.slice(1).slice(-3).join(", "), lat: Number(x.lat), lon: Number(x.lon) };
  });
  // OSM often has several objects for one place (a station and its bus stop): keep the first within ~1 km.
  return out.filter((x, k) => !out.slice(0, k).some((y) => y.name === x.name && Math.abs(y.lat - x.lat) + Math.abs(y.lon - x.lon) < 0.015));
}

/** { local, area }: local = the most specific name, area = the English hierarchy above it. */
function compose(district, a) {
  a = a || {};
  const sub = [a.quarter, a.neighbourhood, a.hamlet, a.suburb].find(Boolean)?.replace(/^大字/, "");
  const muni = a.city || a.town || a.village || a.municipality;
  const pref = (a.province || a.state || "").replace(/ Prefecture$/, "");
  const local = district || sub || muni || null;
  const area = [muni, a.county, pref].filter((x, i, xs) => x && x !== local && xs.indexOf(x) === i).join(", ");
  return local || area ? { local, area } : null;
}
