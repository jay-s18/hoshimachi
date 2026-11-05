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
