// End-to-end smoke test: the app loads its data, ranks regions, and opens a region card.
// Run: npm test   (starts a static server on port 8123 via playwright.config.mjs)
import { existsSync } from "node:fs";
import { test, expect } from "@playwright/test";

// Never call the free weather and place services from tests: they have shared per-network limits, and the app
// must work without them anyway (it falls back to historical odds and plain coordinates).
const LIVE_APIS = /open-meteo\.com|openstreetmap\.org|photon\.komoot\.io|gsi\.go\.jp\/(?!xyz)/;
test.beforeEach(async ({ page }) => {
  await page.route(LIVE_APIS, (r) => r.abort());
});

test("loads, ranks regions and opens a card", async ({ page }) => {
  // Fail on script errors and on any failed request to our own origin. Third-party requests
  // (map tiles, web fonts) may be blocked in CI and are not part of this test.
  const errors = [];
  const ownOrigin = (url) => url.startsWith("http://localhost:8123");
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => m.type() === "error" && !m.text().startsWith("Failed to load resource") && errors.push(m.text()));
  page.on("requestfailed", (r) => ownOrigin(r.url()) && errors.push(`request failed: ${r.url()}`));
  page.on("response", (r) => ownOrigin(r.url()) && r.status() >= 400 && errors.push(`HTTP ${r.status()}: ${r.url()}`));

  await page.goto("/");
  await expect(page.locator("#boot")).toBeHidden({ timeout: 30_000 });

  const rows = page.locator("#res li[data-i]");
  await expect(rows.first()).toBeVisible();
  expect(await rows.count()).toBeGreaterThan(10);

  // Text that depends on the data comes from the manifest, not the HTML.
  const manifest = await (await page.request.get("/data/manifest.json")).json();
  const years = manifest.period.years;
  await expect(page.locator('[data-bind="period"]').first()).toHaveText(`${years[0]}–${years.at(-1)}`);
  await expect(page.locator('[data-lang="en"] [data-validation] table tr')).toHaveCount(1 + manifest.validation.results.length);

  await rows.first().click();
  await expect(page.locator("#res .card h3")).toBeVisible();
  await expect(page.locator("#pano")).toBeVisible();
  await page.locator("#backBtn").click();
  await expect(rows.first()).toBeVisible();

  // Switching layers repaints without errors.
  for (const v of ["month", "dark", "trend", "trip"]) await page.locator(`#layer button[data-v="${v}"]`).click();
  await page.waitForTimeout(500);

  expect(errors).toEqual([]);
});

test("a shared link restores dates, settings and the pinned spot", async ({ page }) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const cells = await (await page.request.get("/data/cells.json")).json();
  const c = cells[Math.floor(cells.length / 2)];
  const pin = `${c.bl[1].toFixed(4)},${c.bl[0].toFixed(4)}`;
  // Far-future dates, so the live forecast is not involved.
  await page.goto(`/?d=2030-03-02&to=2030-03-05&b=3&h=5&l=dark&cell=${c.r}_${c.c}&pin=${pin}`);
  await expect(page.locator("#boot")).toBeHidden({ timeout: 30_000 });

  await expect(page.locator("#res .card h3")).toHaveText(c.en);
  await expect(page.locator("#dFrom")).toHaveValue("2030-03-02");
  await expect(page.locator("#dTo")).toHaveValue("2030-03-05");
  await expect(page.locator("#bortle button.on")).toHaveText("3");
  await expect(page.locator("#layer button.on")).toHaveAttribute("data-v", "dark");
  await expect(page.locator("#hoursOut")).toHaveText("5 hours");
  await expect(page.locator("#res .bortle-read")).toContainText(pin.replace(",", ", "));

  // The address bar keeps the view, and changes to it are written back.
  await expect(page).toHaveURL(new RegExp(`cell=${c.r}_${c.c}&pin=${pin}`));
  await page.locator("#backBtn").click();
  await page.locator('#bortle button[data-v="2"]').click();
  await expect.poll(() => page.evaluate("location.search")).toContain("b=2");
  expect(await page.evaluate("location.search")).not.toContain("cell=");

  expect(errors).toEqual([]);
});

// Same rule as replay_predict in pipeline/.../validation/estimator.py: a past trip counts only if it starts AND ends
// outside the excluded years, even when a ±window or a multi-night trip crosses New Year. Synthetic weather makes
// any leak visible: every night in the excluded year is perfect and every other night is cloudy, so odds must be 0.
test("no peeking: nothing from an excluded year reaches the odds", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("#res li[data-i]").first()).toBeVisible();
  const result = await page.evaluate(`(async () => {
    const O = await import("/js/odds.js");
    const D = await import("/js/data.js");
    const idx = (y, m, d) => O.histIndex(y, m, d);
    const fill = (from, to, v) => { for (let i = from; i <= to; i++) D.MASKS[i * D.NC] = v; };
    const opt = { moon: false, mw: false };
    const trip = (ymd, k) => O.tripRaw(0, ymd, k, opt, O.excludedYears(ymd, k));
    const out = {};

    // Only 2020 is clear. Reached before the fix by the 2019 windows (+30 days) and by multi-night tails.
    fill(0, D.NN - 1, 0);
    fill(idx(2020, 1, 1), idx(2020, 12, 31), 4095);
    out.lateDec = trip([2020, 12, 20], 1).raw;
    out.lateDecTail = trip([2020, 12, 20], 3).raw;
    out.earlyJan = trip([2020, 1, 5], 1).raw; // reached from the 2021 windows (-30 days)

    // The opposite weather: only 2020 is cloudy, so every remaining sample is good and none was dropped wrongly.
    fill(0, D.NN - 1, 4095);
    fill(idx(2020, 1, 1), idx(2020, 12, 31), 0);
    const clear = trip([2020, 12, 20], 1);
    out.clearRaw = clear.raw;
    out.clearN = clear.n;

    // A trip crossing New Year excludes both years, reports the real dates, and past boxes can't touch them.
    fill(0, D.NN - 1, 0);
    fill(idx(2020, 12, 31), idx(2021, 1, 1), 4095); // the trip itself: both nights good
    const cross = trip([2020, 12, 31], 2);
    out.crossExcl = [...O.excludedYears([2020, 12, 31], 2)];
    out.crossActual = cross.actual;
    out.crossRaw = cross.raw;
    out.luck2019 = cross.luck[D.YEARS.indexOf(2019)]; // Dec 31 2019 + Jan 1 2020 touches excluded 2020
    out.luck2018 = cross.luck[D.YEARS.indexOf(2018)];
    return out;
  })()`);
  expect(result.lateDec).toBe(0);
  expect(result.lateDecTail).toBe(0);
  expect(result.earlyJan).toBe(0);
  expect(result.clearRaw).toBe(1);
  expect(result.clearN).toBeGreaterThan(0);
  expect(result.crossExcl).toEqual([2020, 2021]);
  expect(result.crossActual).toEqual({ year: 2020, nights: 2 });
  expect(result.crossRaw).toBe(0);
  expect(result.luck2019).toBeNull();
  expect(result.luck2018).toBe(false);
});

test("single-file build runs from disk", async ({ page }) => {
  const file = new URL("../dist/hoshimachi.html", import.meta.url);
  test.skip(!existsSync(file), "run `npm run build:single` first");
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(file.href);
  await expect(page.locator("#boot")).toBeHidden({ timeout: 30_000 });
  await expect(page.locator("#res li[data-i]").first()).toBeVisible();
  expect(errors).toEqual([]);
});
