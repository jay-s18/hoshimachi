/**
 * The control panel (trip, sky and map settings), the moon strip, and the "i" tooltips.
 */
import { ORIGINS } from "./config.js";
import { state, ymd } from "./state.js";
import { addDays, fmtDate, isoAdd } from "./util.js";
import { POP, moonIcon, moonInfo, moonName, windowMask } from "./astro.js";
import { baseUI, paint, setBase } from "./map.js";
import { results, schedule } from "./app.js";

/** Longest trip the date pickers allow, in nights. */
const MAX_NIGHTS = 14;
/** Reference point for the moon strip (central Honshu); the moon's cost barely varies across Japan. */
const MOON_REF = [36.0, 138.0];

/** Wire a segmented button group #id to state[key]. */
function seg(id, key, cast = String) {
  const buttons = document.querySelectorAll(`#${id} button`);
  buttons.forEach((b) => b.classList.toggle("on", b.dataset.v === String(state[key]))); // may come from a shared link
  buttons.forEach((b) =>
    b.addEventListener("click", () => {
      buttons.forEach((x) => x.classList.toggle("on", x === b));
      state[key] = cast(b.dataset.v);
      if (key !== "layer") return schedule();
      // The month layer needs month odds, which are only computed while it is showing.
      if (b.dataset.v === "month" && results.every((r) => r.m === undefined)) return schedule();
      paint();
    }),
  );
}

function nightsText() {
  const d = ymd(),
    ns = Array.from({ length: state.nights }, (_, j) => fmtDate(addDays(d, j)));
  document.getElementById("nightsOut").textContent =
    `${state.nights} night${state.nights > 1 ? "s" : ""}: ` + (ns.length <= 3 ? ns.join(", ") : `${ns[0]} to ${ns[ns.length - 1]}`);
}

/** One chip per night: moon phase and how many dark hours the moon costs. */
export function moonLine() {
  const d = ymd(),
    el = document.getElementById("moonline");
  el.innerHTML = Array.from({ length: state.nights }, (_, j) => {
    const dj = addDays(d, j),
      m = moonInfo(dj);
    const dark = POP[windowMask(MOON_REF[0], MOON_REF[1], dj[0], dj[1], dj[2], { moon: false, mw: false })];
    const free = POP[windowMask(MOON_REF[0], MOON_REF[1], dj[0], dj[1], dj[2], { moon: true, mw: false })];
    const lost = dark - free;
    return `<span class="moonchip${lost > 0 ? " bad" : ""}" title="${moonName(m.f, m.waxing)}, ${Math.round(m.f * 100)}% lit">${moonIcon(m.f, m.waxing, 18)}<span class="k"><span>${fmtDate(dj)}</span><span class="num hint">${Math.round(m.f * 100)}% lit</span><span class="hint">${lost > 0 ? `moon costs ${lost} h` : "no moon cost"}</span></span></span>`;
  }).join("");
}

function initDates() {
  const f = document.getElementById("dFrom"),
    t = document.getElementById("dTo");
  const days = (x, y) => Math.round((Date.parse(y) - Date.parse(x)) / 864e5);
  // Keep arrive < leave and the trip at most MAX_NIGHTS, moving whichever date the user didn't touch.
  const sync = (changed) => {
    let a = f.value || state.date,
      b = t.value || state.dateTo;
    if (days(a, b) < 1) {
      if (changed === "from") b = isoAdd(a, Math.max(state.nights, 1));
      else a = isoAdd(b, -1);
    }
    if (days(a, b) > MAX_NIGHTS) {
      if (changed === "from") b = isoAdd(a, MAX_NIGHTS);
      else a = isoAdd(b, -MAX_NIGHTS);
    }
    state.date = a;
    state.dateTo = b;
    state.nights = days(a, b);
    f.value = a;
    t.value = b;
    t.min = isoAdd(a, 1);
    nightsText();
    schedule();
  };
  f.value = state.date;
  t.value = state.dateTo;
  t.min = isoAdd(state.date, 1);
  nightsText();
  f.onchange = () => sync("from");
  t.onchange = () => sync("to");
}

export function initControls() {
  const o = document.getElementById("origin"),
    di = document.getElementById("dist"),
    dout = document.getElementById("distOut");
  o.innerHTML = ORIGINS.map((x) => `<option value="${x[0]}">${x[1]}</option>`).join("");
  // Controls start from state, which a shared link may have set.
  o.value = state.origin;
  di.value = state.dist;
  dout.textContent = state.dist + " km";
  di.disabled = state.origin === "any";
  o.onchange = () => {
    state.origin = o.value;
    di.disabled = state.origin === "any";
    schedule();
  };
  di.oninput = () => {
    state.dist = +di.value;
    dout.textContent = di.value + " km";
    schedule();
  };

  seg("target", "target");
  seg("bortle", "bortle", Number);
  seg("rule", "rule");
  seg("layer", "layer");
  document.querySelectorAll("#baseSeg button").forEach((b) =>
    b.addEventListener("click", () => {
      if (!b.disabled) setBase(b.dataset.v);
    }),
  );
  baseUI();

  const hr = document.getElementById("hours"),
    hout = document.getElementById("hoursOut");
  const hoursText = () => (hout.textContent = state.hours + (state.hours === 1 ? " hour" : " hours"));
  hr.value = state.hours;
  hoursText();
  hr.oninput = () => {
    state.hours = +hr.value;
    hoursText();
    schedule();
  };

  initDates();

  document.getElementById("showSpots").checked = state.spots;
  document.getElementById("showSpots").onchange = (e) => {
    state.spots = e.target.checked;
    paint();
  };
  const sb = document.getElementById("shareBtn");
  sb.onclick = async () => {
    try {
      await navigator.clipboard.writeText(location.href);
      sb.textContent = "Link copied";
    } catch {
      sb.textContent = "Copy the address bar";
    }
    setTimeout(() => (sb.textContent = "Share"), 2000);
  };
  const ab = document.getElementById("about");
  document.getElementById("aboutBtn").onclick = () => ab.showModal();
  document.getElementById("aboutClose").onclick = () => ab.close();
  const rb = document.getElementById("redBtn");
  rb.onclick = () => {
    const on = document.documentElement.classList.toggle("red");
    rb.classList.toggle("on", on);
    rb.setAttribute("aria-pressed", on);
  };
  initTooltips();
}

/* ---------- "i" buttons: tap/click to pin, hover to preview (mouse only), Esc or outside click to close ---------- */
function initTooltips() {
  const TIP = document.getElementById("tip");
  const canHover = matchMedia("(hover: hover) and (pointer: fine)").matches;
  let tipBtn = null,
    tipPinned = false;

  const showTip = (btn, pin) => {
    if (tipBtn && tipBtn !== btn) tipBtn.setAttribute("aria-expanded", "false");
    tipBtn = btn;
    tipPinned = pin;
    TIP.textContent = btn.dataset.tip;
    TIP.classList.add("on");
    btn.setAttribute("aria-expanded", "true");
    const r = btn.getBoundingClientRect(),
      w = TIP.offsetWidth,
      h = TIP.offsetHeight;
    const x = Math.min(Math.max(8, r.left + r.width / 2 - w / 2), innerWidth - w - 8);
    let y = r.bottom + 8;
    if (y + h > innerHeight - 8) y = r.top - h - 8;
    TIP.style.left = x + "px";
    TIP.style.top = y + "px";
  };
  const hideTip = () => {
    TIP.classList.remove("on");
    if (tipBtn) tipBtn.setAttribute("aria-expanded", "false");
    tipBtn = null;
    tipPinned = false;
  };

  document.addEventListener(
    "click",
    (e) => {
      const b = e.target.closest(".ib");
      if (b) {
        e.stopPropagation();
        if (tipBtn === b && tipPinned) hideTip();
        else showTip(b, true);
      } else if (!e.target.closest("#tip")) hideTip();
    },
    true,
  );
  document.addEventListener("mouseover", (e) => {
    if (!canHover || tipPinned) return;
    const b = e.target.closest(".ib");
    if (b) showTip(b, false);
  });
  document.addEventListener("mouseout", (e) => {
    if (!canHover || tipPinned) return;
    if (e.target.closest(".ib")) hideTip();
  });
  document.addEventListener("focusin", (e) => {
    const b = e.target.closest(".ib");
    if (b && !tipPinned) showTip(b, false);
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") hideTip();
  });
  document.addEventListener(
    "scroll",
    () => {
      if (tipBtn) hideTip();
    },
    true,
  );
}
