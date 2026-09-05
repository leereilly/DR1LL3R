// Minimal static file server for local play: `npm start`.
// No dependencies, localhost only. Serves the repo root so the dev shell
// index.html (which loads ES modules from src/) works directly.

import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";

const ROOT = process.cwd();
const PORT = process.env.PORT || 8080;
const TYPES = {
  ".html": "text/html", ".js": "text/javascript", ".mjs": "text/javascript",
  ".css": "text/css", ".json": "application/json", ".zip": "application/zip",
};

createServer(async (req, res) => {
  try {
    let path = decodeURIComponent(new URL(req.url, "http://x").pathname);
    if (path === "/favicon.ico") { res.writeHead(204).end(); return; }
    if (path === "/") path = "/index.html";
    const file = normalize(join(ROOT, path));
    if (!file.startsWith(ROOT + "/") || path.split("/").some(p => p.startsWith(".") && p !== ".")) {
      res.writeHead(403).end("no"); return;
    }
    const body = await readFile(file);
    res.writeHead(200, { "content-type": TYPES[extname(file)] || "application/octet-stream", "cache-control": "no-store" });
    res.end(body);
  } catch {
    res.writeHead(404, { "content-type": "text/plain" }).end("404");
  }
}).listen(PORT, "127.0.0.1", () => console.log(`UNICORN HORN DRILL dev server: http://127.0.0.1:${PORT}/`));
