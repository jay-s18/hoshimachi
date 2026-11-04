/**
 * Pixel-level sky readings (~1 km grid): darkness at any point, where the light domes are,
 * and the "Sky from the pin" panorama.
 *
 * Light-dome model: each lit pixel brightens the sky at distance d in proportion to
 * radiance × d^-2.5 (Walker's law), from 2 to 150 km, the same model the pipeline uses for
 * the region data. The panorama is an illustration, not a measurement: no terrain, no weather,
 * and the satellite under-counts white LEDs.
 */
import { PANO } from "./config.js";
import { GRID, RADG, RADLUT, SOURCES, SQMG } from "./data.js";
import { R2D, dirName, hav } from "./util.js";

/** Pixel [row, col] containing [lat, lon]. */
export function gridRC(lat, lon) {
  return [Math.floor((GRID.n - lat) / GRID.step), Math.floor((lon - GRID.w) / GRID.step)];
}

/** Sky brightness (mag/arcsec²) of a pixel, or null over the sea / outside the grid. */
export function sqmRC(r, c) {
  if (r < 0 || c < 0 || r >= GRID.H || c >= GRID.W) return null;
  const q = SQMG[r * GRID.W + c];
  return q === 255 ? null : GRID.sqmOffset + q / GRID.sqmScale;
}

/** Centre [lat, lon] of a pixel. */
export function rcLatLon(r, c) {
  return [GRID.n - (r + 0.5) * GRID.step, GRID.w + (c + 0.5) * GRID.step];
}

/** Darkness and light domes at a point: brightness, glow per 8 directions, and the town behind the strongest dome. */
export function spotInfo(lat, lon) {
  const [r0, c0] = gridRC(lat, lon),
    sqm = sqmRC(r0, c0);
  const kmLat = 111.32 / 120,
    kmLon = kmLat * Math.cos(lat / R2D);
  const sect = new Float64Array(8),
    bestPx = new Array(8).fill(null),
    bestV = new Float64Array(8),
    R = 150,
    dr = Math.ceil(R / kmLat),
    dc = Math.ceil(R / kmLon);
  for (let r = Math.max(0, r0 - dr); r <= Math.min(GRID.H - 1, r0 + dr); r++) {
    const dy = (r0 - r) * kmLat,
      row = r * GRID.W;
    for (let c = Math.max(0, c0 - dc); c <= Math.min(GRID.W - 1, c0 + dc); c++) {
      const q = RADG[row + c];
      if (!q) continue;
      const dx = (c - c0) * kmLon,
        d = Math.hypot(dx, dy);
      if (d < 2 || d > R) continue;
      const az = (Math.atan2(dx, dy) * R2D + 360) % 360;
      const k8 = Math.floor((az + 22.5) / 45) % 8;
      sect[k8] += RADLUT[q] * Math.pow(d, -2.5);
      const blk = RADLUT[q] * Math.pow(Math.max(d, 5), -2.5);
      if (blk > bestV[k8]) {
        bestV[k8] = blk;
        bestPx[k8] = [r, c];
      }
    }
  }
  const tot = sect.reduce((a, b) => a + b, 0),
    top = sect.indexOf(Math.max(...sect));
  // name the town nearest the strongest light source in the strongest direction
  let src = null;
  if (bestPx[top]) {
    const ll = rcLatLon(bestPx[top][0], bestPx[top][1]);
    let bd = 1e9,
      nm = null;
    for (const [sl, so, n] of SOURCES) {
      const d = hav(ll, [sl, so]);
      if (d < bd) {
        bd = d;
        nm = n;
      }
    }
    if (nm && bd < 20) src = { nm, d: hav([lat, lon], ll) };
  }
  return { lat, lon, sqm, dome: Array.from(sect, (v) => (tot ? v / tot : 0)), domeI: tot, top, src };
}

/* ---------- panorama ---------- */
const PB = PANO.bins,
  PROWS = PANO.rows,
  PEL = PANO.elevationMax,
  B0 = PANO.naturalSky;
const PH = PANO.bands.map((b) => Math.atan(6 / b[2]) * R2D); // dome radius per distance band, degrees
const AIR = Float64Array.from({ length: PROWS }, (_, r) => (1 + PANO.airK) / (Math.sin((r * PEL) / (PROWS - 1) / R2D) + PANO.airK));

/** Light reaching the pin per azimuth bin, split into 4 distance bands. */
export function horizonProfile(lat, lon) {
  const [r0, c0] = gridRC(lat, lon),
    kmLat = 111.32 / 120,
    kmLon = kmLat * Math.cos(lat / R2D);
  const I = PANO.bands.map(() => new Float64Array(PB)),
    R = 200,
    dr = Math.ceil(R / kmLat),
    dc = Math.ceil(R / kmLon);
  for (let r = Math.max(0, r0 - dr); r <= Math.min(GRID.H - 1, r0 + dr); r++) {
    const dy = (r0 - r) * kmLat,
      row = r * GRID.W;
    for (let c = Math.max(0, c0 - dc); c <= Math.min(GRID.W - 1, c0 + dc); c++) {
      const q = RADG[row + c];
      if (!q) continue;
      const dx = (c - c0) * kmLon,
        d = Math.max(Math.hypot(dx, dy), 1);
      if (d > R) continue;
      const b = d < 10 ? 0 : d < 30 ? 1 : d < 80 ? 2 : 3;
      I[b][Math.floor(((Math.atan2(dx, dy) * R2D + 360) % 360) / 2) % PB] += (RADLUT[q] / (d * d)) * Math.exp(-d / 100);
    }
  }
  return I;
}

/**
 * Glow over the whole sky (rows = elevation, columns = azimuth). Nearby towns (<10 km) light most of
 * the sky as a very wide fan; farther cities form domes whose height shrinks with distance. Everything
 * is then scaled by the air path, so the zenith is darkest.
 */
function glowGrid(I) {
  const G = Array.from({ length: PROWS }, () => new Float64Array(PB));
  for (let b = 0; b < 4; b++) {
    const src = [];
    for (let i = 0; i < PB; i++) if (I[b][i] > 0) src.push(i);
    if (!src.length) continue;
    if (b === 0) {
      for (let row = 0; row < PROWS; row++) {
        const el = (row * PEL) / (PROWS - 1),
          K = Float64Array.from({ length: 91 }, (_, k) => Math.exp(-Math.hypot(2 * k, el) / 90)),
          out = G[row];
        for (const i of src) {
          const v = I[0][i];
          for (let k = -90; k < 90; k++) out[(((i + k) % PB) + PB) % PB] += v * K[Math.abs(k)];
        }
      }
      continue;
    }
    const h = PH[b],
      reach = Math.min(90, Math.ceil((3 * h) / 2) + 1);
    for (let row = 0; row < PROWS; row++) {
      const el = (row * PEL) / (PROWS - 1);
      if (el > 4 * h) break;
      const K = new Float64Array(reach + 1);
      for (let k = 0; k <= reach; k++) K[k] = Math.exp(-Math.hypot(k * 2, el) / h);
      const out = G[row];
      for (const i of src) {
        const v = I[b][i];
        for (let k = -reach; k <= reach; k++) out[(((i + k) % PB) + PB) % PB] += v * K[Math.abs(k)];
      }
    }
  }
  for (let row = 0; row < PROWS; row++) {
    const a = AIR[row],
      g = G[row];
    for (let i = 0; i < PB; i++) g[i] *= a;
  }
  return G;
}

let GREF = null;
/** Draw the panorama on a canvas. Returns the brightest direction and its relative glow (0..1). */
export function drawPanorama(cv, I) {
  const G = glowGrid(I);
  if (GREF === null) {
    const ref = glowGrid(horizonProfile(...PANO.reference));
    GREF = Math.log10(1 + Math.max(...ref[0]) / B0);
  }
  const dpr = Math.min(window.devicePixelRatio || 1, 2),
    Wc = cv.clientWidth || 320,
    Hc = 150,
    ground = 18;
  cv.width = Math.round(Wc * dpr);
  cv.height = Math.round(Hc * dpr);
  const ctx = cv.getContext("2d"),
    img = ctx.createImageData(cv.width, cv.height),
    D = img.data;
  const skyH = Math.round((Hc - ground) * dpr);
  const vAt = (x, y) => {
    const fb = (x / cv.width) * PB,
      i0 = Math.floor(fb) % PB,
      i1 = (i0 + 1) % PB,
      t = fb - Math.floor(fb);
    const fr = (1 - y / skyH) * (PROWS - 1),
      r0 = Math.min(PROWS - 1, Math.floor(fr)),
      r1 = Math.min(PROWS - 1, r0 + 1),
      u = fr - r0;
    const g = (G[r0][i0] * (1 - t) + G[r0][i1] * t) * (1 - u) + (G[r1][i0] * (1 - t) + G[r1][i1] * t) * u;
    return Math.min(1, Math.log10(1 + g / B0) / GREF);
  };
  for (let y = 0; y < cv.height; y++)
    for (let x = 0; x < cv.width; x++) {
      const o = (y * cv.width + x) * 4;
      if (y >= skyH) {
        D[o] = 6;
        D[o + 1] = 6;
        D[o + 2] = 7;
        D[o + 3] = 255;
        continue;
      }
      const t = y / skyH,
        e = Math.min(1, vAt(x, y) * 1.6); // perceived glow over the natural sky
      D[o] = Math.min(255, 8 + 8 * t + e * (190 + 65 * e)); // dim amber, turning cream when strong
      D[o + 1] = Math.min(255, 10 + 8 * t + e * (105 + 120 * e));
      D[o + 2] = Math.min(255, 18 + 10 * t + e * (40 + 150 * e * e));
      D[o + 3] = 255;
    }
  ctx.putImageData(img, 0, 0);
  let seed = 7;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (let k = 0; k < 280; k++) {
    const x = rnd() * cv.width,
      y = rnd() * skyH * 0.97,
      m = rnd();
    const a = Math.max(0, (0.25 + 0.75 * m) * (1 - vAt(x, y) * 3.2));
    if (a <= 0.02) continue;
    const sz = (m > 0.94 ? 2 : 1) * dpr;
    ctx.fillStyle = `rgba(235,232,222,${a})`;
    ctx.fillRect(x, y, sz, sz);
  }
  ctx.fillStyle = "#3a3830";
  ctx.fillRect(0, skyH, cv.width, dpr);
  ctx.fillStyle = "#9a9387";
  ctx.font = `${10 * dpr}px "IBM Plex Sans", sans-serif`;
  ctx.textAlign = "center";
  for (const [l, a] of [
    ["N", 0],
    ["NE", 45],
    ["E", 90],
    ["SE", 135],
    ["S", 180],
    ["SW", 225],
    ["W", 270],
    ["NW", 315],
    ["N", 360],
  ]) {
    const x = Math.min(Math.max((a / 360) * cv.width, 8 * dpr), cv.width - 8 * dpr);
    ctx.fillText(l, x, skyH + 13 * dpr);
  }
  const row3 = G[3];
  let best = 0,
    bi = 0;
  for (let i = 0; i < PB; i++)
    if (row3[i] > best) {
      best = row3[i];
      bi = i;
    }
  return { dir: dirName(bi * 2 + 1), peak: Math.min(1, Math.log10(1 + best / B0) / GREF) };
}
