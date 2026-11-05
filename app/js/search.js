/**
 * The place search floating over the map. As the user types, a drop-down lists:
 *   - Hoshimachi's own spots and towns (instant, offline);
 *   - after a short pause, places anywhere in Japan from Photon / GSI (place.js).
 * Choosing an entry (click, or arrows + Enter; Enter alone takes the first) selects its region, pins the exact
 * point, keeps the place's name on the pin and zooms the map there.
 */
import { SPOTS } from "./config.js";
import { CELLS } from "./data.js";
import { esc } from "./util.js";
import { nameHint, searchPlaces } from "./place.js";
import { cellAt, centerOn, select } from "./map.js";

const MAX_LOCAL = 5;
const DEBOUNCE_MS = 300; // wait for a pause in typing before asking the place services
const MIN_REMOTE_CHARS = 2;

let input, list;
let local = []; // matches from spots and towns
let remote = []; // matches from the place services
let remoteState = "idle"; // "idle" | "loading" | "done" | "error"
let active = -1;
let timer = null,
  ctrl = null;

/** Spots and towns whose English or Japanese name contains q (prefix matches first). */
function localMatches(q) {
  q = q.toLowerCase();
  const out = [];
  for (const s of SPOTS) {
    const names = [s[1], s[2]].map((x) => x.toLowerCase());
    if (names.some((x) => x.includes(q)))
      out.push({
        score: names.some((x) => x.startsWith(q)) ? 0 : 2,
        name: `${s[1]} ${s[2]}`,
        detail: s[5],
        lat: s[3],
        lon: s[4],
        named: true,
      });
  }
  for (const c of CELLS)
    for (const t of c.also) {
      const [en, jp] = t.split("|");
      if (en.toLowerCase().includes(q) || jp.includes(q)) {
        // A town stands for its region: pin the region's darkest spot, the useful point for stargazing there.
        const prefix = en.toLowerCase().startsWith(q) || jp.startsWith(q);
        out.push({
          score: prefix ? 1 : 3,
          name: `${en} ${jp}`,
          detail: `${c.pref} · this region's darkest spot`,
          lat: c.bl[1],
          lon: c.bl[0],
        });
        break;
      }
    }
  const seen = new Set();
  return out
    .sort((a, b) => a.score - b.score)
    .filter((x) => !seen.has(x.name) && seen.add(x.name))
    .slice(0, MAX_LOCAL);
}

/** Selectable entries in display order. */
const entries = () => [...local, ...remote];

function render() {
  const q = input.value.trim();
  if (!q) {
    list.hidden = true;
    input.setAttribute("aria-expanded", "false");
    return;
  }
  const row = (it, k) =>
    `<li role="option" id="ps-${k}" data-k="${k}" aria-selected="${k === active}" class="${k === active ? "on" : ""}"><b>${esc(it.name)}</b>${it.detail ? `<span class="hint">${esc(it.detail)}</span>` : ""}</li>`;
  let html = "";
  if (local.length)
    html += `<li class="ps-group" role="presentation">Hoshimachi spots and towns</li>${local.map((it, k) => row(it, k)).join("")}`;
  if (q.length >= MIN_REMOTE_CHARS) {
    html += `<li class="ps-group" role="presentation">Places in Japan</li>`;
    if (remote.length) html += remote.map((it, k) => row(it, local.length + k)).join("");
    else if (remoteState === "loading" || remoteState === "idle") html += `<li class="ps-note" role="presentation">Searching…</li>`;
    else if (remoteState === "error") html += `<li class="ps-note" role="presentation">Place search is unavailable right now.</li>`;
    else html += `<li class="ps-note" role="presentation">No other places found.</li>`;
  } else if (!local.length) html += `<li class="ps-note" role="presentation">Keep typing…</li>`;
  list.innerHTML = html;
  list.hidden = false;
  input.setAttribute("aria-expanded", "true");
  input.setAttribute("aria-activedescendant", active >= 0 ? `ps-${active}` : "");
}

function onInput() {
  const q = input.value.trim();
  local = q ? localMatches(q) : [];
  remote = [];
  active = -1;
  clearTimeout(timer);
  ctrl?.abort();
  remoteState = q.length >= MIN_REMOTE_CHARS ? "idle" : "done";
  render();
  if (q.length < MIN_REMOTE_CHARS) return;
  timer = setTimeout(async () => {
    ctrl = new AbortController();
    remoteState = "loading";
    render();
    try {
      const found = await searchPlaces(q, ctrl.signal);
      if (input.value.trim() !== q) return;
      const localNames = new Set(local.map((x) => x.name.split(" ")[0]));
      remote = found.filter((x) => !localNames.has(x.name)).map((x) => ({ ...x, named: true }));
      remoteState = "done";
    } catch (err) {
      if (err.name === "AbortError") return;
      remoteState = "error";
    }
    render();
  }, DEBOUNCE_MS);
}

function close() {
  clearTimeout(timer);
  ctrl?.abort();
  list.hidden = true;
  active = -1;
  input.setAttribute("aria-expanded", "false");
}

function choose(it) {
  close();
  input.value = it.name;
  input.blur();
  const i = cellAt(it.lat, it.lon);
  if (it.named) nameHint(it.lat, it.lon, it.name); // keep "Lake Mashu" on the pin, not just the district
  if (i >= 0) select(i, [it.lat, it.lon]);
  centerOn([it.lat, it.lon], 11);
  if (i < 0) {
    list.innerHTML = `<li class="ps-note" role="presentation">${esc(it.name)} is outside the regions Hoshimachi covers (sea or a small island).</li>`;
    list.hidden = false;
  }
}

export function initSearch() {
  input = document.getElementById("placeSearch");
  list = document.getElementById("placeList");
  input.addEventListener("input", onInput);
  input.addEventListener("focus", () => input.value.trim() && list.hidden && onInput());
  input.addEventListener("keydown", (e) => {
    const all = entries();
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      if (!all.length) return;
      e.preventDefault();
      active = (active + (e.key === "ArrowDown" ? 1 : -1) + all.length) % all.length;
      render();
    } else if (e.key === "Enter") {
      e.preventDefault();
      const it = all[active >= 0 ? active : 0];
      if (it) choose(it);
    } else if (e.key === "Escape") close();
  });
  // pointerdown, not click: it fires before the input loses focus.
  list.addEventListener("pointerdown", (e) => {
    const li = e.target.closest("li[data-k]");
    if (!li) return;
    e.preventDefault();
    choose(entries()[+li.dataset.k]);
  });
  document.addEventListener("pointerdown", (e) => {
    if (!e.target.closest(".msearch")) close();
  });
  // Map gestures shouldn't start when using the search box.
  if (globalThis.L) {
    L.DomEvent.disableClickPropagation(input.parentElement);
    L.DomEvent.disableScrollPropagation(input.parentElement);
  }
}
