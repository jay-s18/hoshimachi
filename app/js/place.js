/**
 * Place name for the pinned spot, e.g. "野辺山 · Minamimaki, Minamisaku County, Nagano".
 * Two free reverse geocoders, asked only when the pin moves (see PLACE_API in config.js):
 *   - GSI: the local district (大字・町名), present almost everywhere on land in Japan;
 *   - Nominatim (OpenStreetMap): municipality, county and prefecture in English where OSM has it.
 * Either may fail (offline, blocked, rate-limited); the card then just shows fewer details.
 */
import { PLACE_API } from "./config.js";

/** "lat,lon" (4 dp, ~10 m) -> { local, area } once looked up; null if nothing was found. */
const done = new Map();
const pending = new Map();
let nextNominatim = 0;

const keyOf = (lat, lon) => `${lat.toFixed(4)},${lon.toFixed(4)}`;

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
      const place = compose(district, osm);
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

async function nominatim(lat, lon, stillWanted) {
  const wait = nextNominatim - Date.now();
  nextNominatim = Math.max(Date.now(), nextNominatim) + PLACE_API.minIntervalMs;
  if (wait > 0) await new Promise((res) => setTimeout(res, wait));
  if (!stillWanted()) throw new Error("pin moved");
  const url = `${PLACE_API.nominatim}?format=jsonv2&lat=${lat.toFixed(5)}&lon=${lon.toFixed(5)}&zoom=16&accept-language=en`;
  const r = await fetch(url);
  if (!r.ok) throw new Error(`Nominatim ${r.status}`);
  const d = await r.json();
  return d.error ? null : d.address || null;
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
