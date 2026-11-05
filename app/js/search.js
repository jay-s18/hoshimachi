/**
 * The place search in the header. While typing, it suggests the app's own spots and towns (instant, offline).
 * Pressing Enter (or choosing "Search all places") asks GSI / OpenStreetMap for any named place in Japan
 * (place.js; those services don't allow search-as-you-type). Choosing a result selects its region, pins the
 * exact point and zooms the map there.
 */
import { SPOTS } from "./config.js";
import { CELLS } from "./data.js";
import { esc } from "./util.js";
import { nameHint, searchPlaces } from "./place.js";
import { cellAt, centerOn, select } from "./map.js";

const MAX_LOCAL = 6;

let input, list, status;
let items = []; // [{ name, detail, lat, lon } | { search: true }]
let active = -1;

/** Spots and towns whose English or Japanese name contains q (prefix matches first). */
function localMatches(q) {
  q = q.toLowerCase();
  const out = [];
  const add = (score, name, detail, lat, lon, named = false) => out.push({ score, name, detail, lat, lon, named });
  for (const s of SPOTS) {
    const names = [s[1], s[2]].map((x) => x.toLowerCase());
    if (names.some((x) => x.includes(q))) add(names.some((x) => x.startsWith(q)) ? 0 : 2, `${s[1]} ${s[2]}`, s[5], s[3], s[4], true);
  }
  CELLS.forEach((c) => {
    for (const t of c.also) {
      const [en, jp] = t.split("|");
      const lo = en.toLowerCase();
      if (lo.includes(q) || jp.includes(q)) {
        // A town's region: pin its darkest spot, the most useful point for stargazing there.
        add(lo.startsWith(q) || jp.startsWith(q) ? 1 : 3, `${en} ${jp}`, `${c.pref} · darkest spot in this region`, c.bl[1], c.bl[0]);
        break;
      }
    }
  });
  const seen = new Set();
  return out
    .sort((a, b) => a.score - b.score)
    .filter((x) => !seen.has(x.name) && seen.add(x.name))
    .slice(0, MAX_LOCAL);
}

function render() {
  list.innerHTML = items
    .map((it, k) =>
      it.search
        ? `<li role="option" id="ps-${k}" data-k="${k}" class="ps-all${k === active ? " on" : ""}">Search all places for “${esc(input.value.trim())}” <span class="hint">↵</span></li>`
        : `<li role="option" id="ps-${k}" data-k="${k}" class="${k === active ? "on" : ""}"><b>${esc(it.name)}</b>${it.detail ? `<span class="hint">${esc(it.detail)}</span>` : ""}</li>`,
    )
    .join("");
  const open = items.length > 0 || status.textContent !== "";
  list.hidden = items.length === 0;
  input.setAttribute("aria-expanded", String(open));
  input.setAttribute("aria-activedescendant", active >= 0 ? `ps-${active}` : "");
}

function suggest() {
  const q = input.value.trim();
  status.textContent = "";
  active = -1;
  items = q ? [...localMatches(q), { search: true }] : [];
  render();
}

async function searchAll() {
  const q = input.value.trim();
  if (!q) return;
  items = [];
  active = -1;
  status.textContent = "Searching…";
  render();
  try {
    const found = await searchPlaces(q);
    if (input.value.trim() !== q) return; // the user typed on meanwhile
    items = found.map((x) => ({ ...x, named: true }));
    status.textContent = found.length ? "" : `No places in Japan found for “${q}”.`;
  } catch {
    status.textContent = "Place search is unavailable right now (offline or blocked).";
  }
  render();
}

function choose(it) {
  if (it.search) return searchAll();
  const i = cellAt(it.lat, it.lon);
  items = [];
  status.textContent = i < 0 ? `${it.name} is outside the regions Hoshimachi covers (sea or a small island).` : "";
  render();
  // A searched place or marked spot keeps its own name on the pin; a town's darkest spot is just a point.
  if (it.named) nameHint(it.lat, it.lon, it.name);
  if (i >= 0) select(i, [it.lat, it.lon]);
  centerOn([it.lat, it.lon], 11);
  input.blur();
}

export function initSearch() {
  input = document.getElementById("placeSearch");
  list = document.getElementById("placeList");
  status = document.getElementById("placeStatus");
  input.addEventListener("input", suggest);
  input.addEventListener("focus", () => input.value.trim() && !items.length && suggest());
  input.addEventListener("keydown", (e) => {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      if (!items.length) return;
      e.preventDefault();
      active = (active + (e.key === "ArrowDown" ? 1 : -1) + items.length) % items.length;
      render();
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (active >= 0) choose(items[active]);
      else searchAll();
    } else if (e.key === "Escape") {
      items = [];
      status.textContent = "";
      render();
    }
  });
  // pointerdown, not click: it fires before the input loses focus.
  list.addEventListener("pointerdown", (e) => {
    const li = e.target.closest("li[data-k]");
    if (!li) return;
    e.preventDefault();
    choose(items[+li.dataset.k]);
  });
  document.addEventListener("pointerdown", (e) => {
    if (!e.target.closest(".psearch")) {
      items = [];
      status.textContent = "";
      render();
    }
  });
}
