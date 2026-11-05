/**
 * "What you'll see here": what each Bortle class means for someone standing there, in plain words, plus a
 * small illustrated night sky. The figures are a rough guide from Bortle's own descriptions (Sky & Telescope,
 * 2001) and naked-eye limiting magnitudes, for a clear, moonless night with eyes adapted to the dark.
 *
 * Star counts are stars visible at one time across the whole sky above you, rounded heavily: from the
 * limiting magnitude, about a third of all stars brighter than it (half the sky is below the horizon, and
 * haze near the horizon hides more).
 */
import { t } from "./i18n.js";

/** One entry per Bortle class 1..9. nelm = naked-eye limiting magnitude; mw = Milky Way strength 0..1. */
export const BORTLE_VIEW = [
  {
    name: "Excellent dark-sky site",
    stars: "5,000+",
    mw: 1,
    nelm: 7.8,
    milkyWay: "Bright enough to cast faint shadows, full of detail and dark lanes. Zodiacal light and airglow are visible.",
  },
  {
    name: "Truly dark site",
    stars: "~4,000",
    mw: 0.85,
    nelm: 7.3,
    milkyWay: "Clearly structured, like veined marble, almost down to the horizon.",
  },
  {
    name: "Rural sky",
    stars: "~3,000",
    mw: 0.62,
    nelm: 6.8,
    milkyWay: "Shows structure overhead, fading near the horizon. Faint glows from towns sit on the horizon.",
  },
  {
    name: "Rural–suburban transition",
    stars: "~2,000",
    mw: 0.4,
    nelm: 6.3,
    milkyWay: "Easy to see overhead but with little detail, washed out lower down. Town glows in several directions.",
  },
  { name: "Suburban sky", stars: "~1,000", mw: 0.2, nelm: 5.8, milkyWay: "Faint, and only visible high in the sky." },
  {
    name: "Bright suburban sky",
    stars: "~500",
    mw: 0.07,
    nelm: 5.3,
    milkyWay: "Barely visible, only straight overhead on the best nights.",
  },
  { name: "Suburban–urban transition", stars: "~300", mw: 0, nelm: 4.9, milkyWay: "Not visible. The whole sky glows grey." },
  { name: "City sky", stars: "~100", mw: 0, nelm: 4.5, milkyWay: "Not visible. Only the familiar constellations stand out." },
  { name: "Inner-city sky", stars: "under 50", mw: 0, nelm: 4.0, milkyWay: "Not visible. Only the Moon, planets and the brightest stars." },
];

/** Repeatable pseudo-random numbers, so the same stars appear in every class (only fewer of them). */
function rng(seed) {
  return () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
}

/** A fixed field of stars: [x 0..1, y 0..1, magnitude], about as many faint ones per magnitude as the real sky. */
const FIELD = (() => {
  const r = rng(7),
    out = [];
  for (let k = 0; k < 1400; k++) out.push([r(), r(), 8 + Math.log10(Math.max(r(), 1e-6)) / 0.45]);
  return out;
})();

/** Draw the illustrated sky for Bortle class b (1..9) on canvas cv. */
export function drawSkyView(cv, b) {
  const v = BORTLE_VIEW[b - 1],
    dpr = window.devicePixelRatio || 1;
  const W = cv.clientWidth || 300,
    H = Math.round(W * 0.42);
  cv.width = W * dpr;
  cv.height = H * dpr;
  cv.style.height = H + "px";
  const g = cv.getContext("2d");
  g.scale(dpr, dpr);
  const k = (b - 1) / 8; // 0 = darkest, 1 = city

  // Sky: near-black overhead, warmer and brighter towards the horizon as light pollution rises.
  const mix = (a, c, f) => a.map((x, i) => Math.round(x + (c[i] - x) * f));
  const top = mix([4, 5, 12], [46, 42, 44], k ** 0.8),
    low = mix([10, 12, 22], [150, 104, 64], k ** 0.7);
  const sky = g.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0, `rgb(${top})`);
  sky.addColorStop(0.55, `rgb(${mix(top, low, 0.35)})`);
  sky.addColorStop(1, `rgb(${low})`);
  g.fillStyle = sky;
  g.fillRect(0, 0, W, H);

  // Milky Way: a soft diagonal band, mottled with brighter clouds and a dark lane in the darkest classes.
  if (v.mw > 0) {
    const r = rng(11);
    g.save();
    g.translate(W * 0.5, H * 0.55);
    g.rotate(-0.5);
    const band = g.createLinearGradient(0, -H * 0.32, 0, H * 0.32);
    band.addColorStop(0, "rgba(220,215,200,0)");
    band.addColorStop(0.5, `rgba(220,215,200,${0.22 * v.mw})`);
    band.addColorStop(1, "rgba(220,215,200,0)");
    g.fillStyle = band;
    g.fillRect(-W, -H * 0.32, W * 2, H * 0.64);
    for (let n = 0; n < 160 * v.mw; n++) {
      const x = (r() - 0.5) * W * 1.6,
        y = (r() + r() + r() - 1.5) * H * 0.14,
        rad = 4 + r() * 14;
      const blob = g.createRadialGradient(x, y, 0, x, y, rad);
      blob.addColorStop(0, `rgba(235,228,210,${0.09 * v.mw ** 1.5})`);
      blob.addColorStop(1, "rgba(235,228,210,0)");
      g.fillStyle = blob;
      g.fillRect(x - rad, y - rad, rad * 2, rad * 2);
    }
    if (v.mw > 0.5) {
      g.strokeStyle = `rgba(0,0,0,${0.25 * v.mw})`;
      g.lineWidth = 3;
      g.beginPath();
      g.moveTo(-W * 0.4, 2);
      g.bezierCurveTo(-W * 0.1, -6, W * 0.1, 8, W * 0.4, 0);
      g.stroke();
    }
    g.restore();
  }

  // Stars brighter than the limiting magnitude, fainter ones drawn dimmer and smaller.
  for (const [x, y, m] of FIELD) {
    const margin = v.nelm - m - y * 0.6; // haze dims stars lower in the sky
    if (margin <= 0) continue;
    const a = Math.min(1, 0.25 + margin / 2.5),
      size = Math.min(1.9, 0.45 + margin * 0.28);
    g.fillStyle = `rgba(245,242,232,${a})`;
    g.beginPath();
    g.arc(x * W, y * H * 0.92, size, 0, 2 * Math.PI);
    g.fill();
  }

  // Hills along the bottom, so it reads as a view from the ground.
  g.fillStyle = "#050506";
  g.beginPath();
  g.moveTo(0, H);
  const r = rng(3);
  for (let x = 0; x <= W; x += W / 16) g.lineTo(x, H - 6 - r() * 12 - Math.sin((x / W) * 3.1) * 6);
  g.lineTo(W, H);
  g.fill();
}

/** The section's HTML for Bortle class b at the pin; the class buttons let people compare (see wireSkyView). */
export function skyViewHtml(b) {
  const btns = BORTLE_VIEW.map(
    (_, k) =>
      `<button type="button" data-b="${k + 1}" class="${k + 1 === b ? "on" : ""}" title="${t("Bortle {n}", { n: k + 1 })}${k + 1 === b ? ` · ${t("here")}` : ""}">${k + 1}${k + 1 === b ? '<i class="here" aria-hidden="true"></i>' : ""}</button>`,
  ).join("");
  return `<canvas id="skyView" class="skyview" role="img"></canvas>
    <div class="seg skyview-seg" id="skyViewSeg" aria-label="${t("Compare Bortle classes")}">${btns}</div>
    <div id="skyViewTxt" class="skyview-txt"></div>
    <div class="hint">${t("Tap a class to compare. The dot marks the estimate for the pin. A rough guide for a clear, moonless night with eyes used to the dark for 20 minutes; eyesight, haze and the season change it.")}</div>`;
}

/** Fill the text and picture for class b, marking whether it is the pin's own class `here`. */
function showClass(b, here) {
  const v = BORTLE_VIEW[b - 1];
  const cv = document.getElementById("skyView");
  cv.setAttribute("aria-label", t("Illustration of the night sky at Bortle {n}", { n: b }));
  drawSkyView(cv, b);
  document.getElementById("skyViewTxt").innerHTML =
    `<div class="skyview-head"><b>${t("Bortle {n}", { n: b })}</b> · ${t(v.name)}${b === here ? ` <span class="chip">${t("this spot")}</span>` : ""}</div>
    <div class="skyview-facts"><div><span class="v num">${t(v.stars)}</span><span class="k">${t("stars visible at once")}</span></div>
    <div><span class="k">${t("Milky Way")}</span><span>${t(v.milkyWay)}</span></div></div>`;
}

/** Draw the section for the pin's class `here` and wire its class buttons. */
export function wireSkyView(here) {
  const seg = document.getElementById("skyViewSeg");
  if (!seg) return;
  showClass(here, here);
  seg.querySelectorAll("button").forEach((btn) =>
    btn.addEventListener("click", () => {
      seg.querySelectorAll("button").forEach((x) => x.classList.toggle("on", x === btn));
      showClass(+btn.dataset.b, here);
    }),
  );
}
