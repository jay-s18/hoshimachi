// Minimal static file server for local development and tests (no dependencies).
// Usage: node tools/serve.mjs [root=app] [port=8000]
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, join, normalize, resolve } from "node:path";

const root = resolve(process.argv[2] ?? "app");
const port = Number(process.argv[3] ?? 8000);
const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".geojson": "application/geo+json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".gz": "application/octet-stream", // served as-is; the app decompresses (see app/js/data.js)
};

createServer(async (req, res) => {
  try {
    const path = decodeURIComponent(new URL(req.url, "http://x").pathname);
    let file = normalize(join(root, path));
    if (!file.startsWith(root)) throw Object.assign(new Error("forbidden"), { code: "EACCES" });
    if ((await stat(file)).isDirectory()) file = join(file, "index.html");
    const body = await readFile(file);
    res.writeHead(200, { "Content-Type": TYPES[extname(file)] ?? "application/octet-stream", "Cache-Control": "no-cache" });
    res.end(body);
  } catch (e) {
    res.writeHead(e.code === "EACCES" ? 403 : 404, { "Content-Type": "text/plain" });
    res.end(e.code === "EACCES" ? "Forbidden" : "Not found");
  }
}).listen(port, () => console.log(`Serving ${root} at http://localhost:${port}`));
