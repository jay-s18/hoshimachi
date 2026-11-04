/**
 * The user's current settings. One shared object, mutated by the controls and read everywhere else.
 * Kept deliberately small and serialisable so it can later be synced to the URL or local storage.
 */
export const state = {
  origin: "any", // ORIGINS id
  dist: 400, // km, maximum straight-line distance
  date: null, // "YYYY-MM-DD", first night (arrival)
  dateTo: null, // "YYYY-MM-DD", departure
  nights: 2,
  target: "sky", // "sky" = any dark sky, "mw" = Milky Way core must be up
  bortle: 4, // darkest spot must be this Bortle class or darker
  hours: 3, // clear, dark hours needed for a good night
  rule: "run", // "run" = in a row, "any" = passing clouds OK
  layer: "trip", // map layer: "trip" | "month" | "dark" | "trend"
  base: "plain", // base map: "plain" | "roads" | "terrain"
  opOdds: 0.6, // overlay opacity for the odds layers
  opRaster: 0.9, // overlay opacity for the darkness / trend rasters
  spots: true, // show spot markers
  sort: "odds", // results list order: "odds" | "dark"
  query: "", // results search text
  sel: null, // selected cell index, or null for the list
  pin: null, // [lat, lon] of the pinned spot
  excl: null, // Set of years excluded because the trip falls inside them
};

/** The trip's first night as [year, month, day]. */
export function ymd() {
  return state.date.split("-").map(Number);
}

/** Month (1..12) of the first night. */
export function monthOf() {
  return Number(state.date.split("-")[1]);
}
