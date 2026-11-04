// Builds dist/hoshimachi.html: the whole app (code, styles, libraries and data) in one file that
// opens from disk or can be emailed. The hosted app in app/ is the primary build; this is for
// offline sharing and submissions.
//
// Usage: npm run build:single   (or: node tools/build-single-file.mjs [outFile])
import { build } from "esbuild";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const APP = join(ROOT, "app");
const OUT = resolve(process.argv[2] ?? join(ROOT, "dist", "hoshimachi.html"));

const read = (p) => readFile(join(APP, p), "utf8");
const b64 = async (p) => (await readFile(join(APP, p))).toString("base64");
// Inline <script> contents must not close the tag early.
const safeScript = (js) => js.replace(/<\/script/gi, "<\\/script");
/** Replace exactly one occurrence, so a changed index.html fails loudly instead of building a broken file. */
function replaceOnce(html, find, by) {
  const n = html.split(find).length - 1;
  if (n !== 1) throw new Error(`expected exactly one ${JSON.stringify(find)} in index.html, found ${n}`);
  return html.replace(find, () => by);
}

const bundle = await build({
  entryPoints: [join(APP, "js", "main.js")],
  bundle: true,
  format: "iife",
  minify: true,
  target: "es2022",
  write: false,
  legalComments: "inline",
});
const appJs = bundle.outputFiles[0].text;

const manifest = JSON.parse(await read("data/manifest.json"));
const data = { "manifest.json": await b64("data/manifest.json") };
for (const { path } of Object.values(manifest.files)) data[path] = await b64(join("data", path));

let html = await read("index.html");
html = replaceOnce(
  html,
  '<link rel="icon" href="favicon.svg" type="image/svg+xml" />',
  `<link rel="icon" href="data:image/svg+xml;base64,${await b64("favicon.svg")}" />`,
);
html = replaceOnce(
  html,
  '<link rel="stylesheet" href="vendor/leaflet/leaflet.css" />',
  `<style>${await read("vendor/leaflet/leaflet.css")}</style>`,
);
html = replaceOnce(html, '<link rel="stylesheet" href="css/app.css" />', `<style>${await read("css/app.css")}</style>`);
html = replaceOnce(html, '<script src="vendor/leaflet/leaflet.js" defer></script>', "");
html = replaceOnce(html, '<script src="vendor/suncalc/suncalc.js" defer></script>', "");
html = replaceOnce(html, '<script type="module" src="js/main.js"></script>', "");
// Libraries, data and the app run at the end of <body>, after the elements they use exist.
html = replaceOnce(
  html,
  "</body>",
  [
    `<script>${safeScript(await read("vendor/leaflet/leaflet.js"))}</script>`,
    `<script>${safeScript(await read("vendor/suncalc/suncalc.js"))}</script>`,
    `<script>globalThis.HOSHIMACHI_EMBEDDED_DATA=${JSON.stringify(data)};</script>`,
    `<script>${safeScript(appJs)}</script>`,
    "</body>",
  ].join("\n"),
);

await mkdir(dirname(OUT), { recursive: true });
await writeFile(OUT, html);
console.log(
  `Wrote ${OUT} (${(Buffer.byteLength(html) / 1e6).toFixed(1)} MB, data ${manifest.period.firstNight} to ${manifest.period.lastNight})`,
);
