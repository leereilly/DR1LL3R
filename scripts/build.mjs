// Build: bundle + minify with esbuild, strip dev hooks via __DEV__=false,
// inline everything into a single self-contained dist/index.html, then pack a
// reproducible ZIP (fixed timestamps, single entry, level-9 deflate).
// Hard-fails if the archive is not strictly below 13,000 bytes, contains
// anything other than index.html, or references any external resource.

import { build } from "esbuild";
import { writeFile, mkdir } from "node:fs/promises";
import { deflateRawSync } from "node:zlib";

const CAP = 13000; // strict decimal cap (also < 13*1024)
const OUT_HTML = "dist/index.html";
const OUT_ZIP = "dist/unicorn-horn-drill.zip";

const CSS =
  "html,body{margin:0;height:100%;background:#05060f;overflow:hidden;" +
  "touch-action:none;overscroll-behavior:none}canvas{display:block}";

const VIEWPORT =
  "width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no,viewport-fit=cover";

async function main() {
  await mkdir("dist", { recursive: true });

  const res = await build({
    entryPoints: ["src/main.js"],
    bundle: true,
    format: "iife",
    minify: true,
    target: "es2020",
    define: { __DEV__: "false" },
    drop: ["console", "debugger"],
    legalComments: "none",
    write: false,
    metafile: true,
  });
  const js = res.outputFiles[0].text.trim();
  if (/__uhd|autopilot|URLSearchParams/.test(js)) throw new Error("development hooks leaked into production");
  const rawBytes = Object.values(res.metafile.inputs).reduce((n, input) => n + input.bytes, 0);

  const html =
    "<!doctype html><html lang=en><head><meta charset=utf-8>" +
    `<meta name=viewport content="${VIEWPORT}">` +
    "<title>UNICORN HORN DRILL</title><style>" + CSS + "</style></head>" +
    '<body><canvas id=c aria-label="Unicorn Horn Drill. Arrow keys, A and D, or drag to steer. M to mute."></canvas><script>' + js + "</script></body></html>";

  // Guard against accidental external references.
  if (/\b(src|href)\s*=|https?:\/\//i.test(html)) {
    throw new Error("built HTML contains an external reference");
  }

  await writeFile(OUT_HTML, html);
  const htmlBytes = Buffer.byteLength(html);
  const zip = makeZip("index.html", Buffer.from(html));
  await writeFile(OUT_ZIP, zip);

  const pct = ((zip.length / CAP) * 100).toFixed(1);
  console.log("── UNICORN HORN DRILL build ──────────────");
  console.log(`  source JS   : ${rawBytes.toLocaleString()} B`);
  console.log(`  minified JS : ${Buffer.byteLength(js).toLocaleString()} B`);
  console.log(`  inline HTML : ${htmlBytes.toLocaleString()} B`);
  console.log(`  ZIP archive : ${zip.length.toLocaleString()} B  (${pct}% of ${CAP})`);
  console.log(`  headroom    : ${(CAP - zip.length).toLocaleString()} B`);
  console.log("──────────────────────────────────────────");

  if (zip.length >= CAP) {
    throw new Error(`ZIP ${zip.length} >= cap ${CAP}`);
  }
  console.log("OK: archive is under cap and self-contained.");
}

// --- Reproducible single-file ZIP ----------------------------------------

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function makeZip(name, data) {
  const nameBuf = Buffer.from(name);
  const comp = deflateRawSync(data, { level: 9 });
  const crc = crc32(data);
  const DOS_TIME = 0;
  const DOS_DATE = 33; // 1980-01-01, fixed for reproducibility

  const local = Buffer.alloc(30);
  local.writeUInt32LE(0x04034b50, 0);
  local.writeUInt16LE(20, 4); // version needed
  local.writeUInt16LE(0, 6); // flags
  local.writeUInt16LE(8, 8); // method: deflate
  local.writeUInt16LE(DOS_TIME, 10);
  local.writeUInt16LE(DOS_DATE, 12);
  local.writeUInt32LE(crc, 14);
  local.writeUInt32LE(comp.length, 18);
  local.writeUInt32LE(data.length, 22);
  local.writeUInt16LE(nameBuf.length, 26);
  local.writeUInt16LE(0, 28); // extra len

  const central = Buffer.alloc(46);
  central.writeUInt32LE(0x02014b50, 0);
  central.writeUInt16LE(20, 4); // version made by
  central.writeUInt16LE(20, 6); // version needed
  central.writeUInt16LE(0, 8);
  central.writeUInt16LE(8, 10);
  central.writeUInt16LE(DOS_TIME, 12);
  central.writeUInt16LE(DOS_DATE, 14);
  central.writeUInt32LE(crc, 16);
  central.writeUInt32LE(comp.length, 20);
  central.writeUInt32LE(data.length, 24);
  central.writeUInt16LE(nameBuf.length, 28);
  central.writeUInt16LE(0, 30); // extra
  central.writeUInt16LE(0, 32); // comment
  central.writeUInt16LE(0, 34); // disk
  central.writeUInt16LE(0, 36); // internal attrs
  central.writeUInt32LE(0, 38); // external attrs
  central.writeUInt32LE(0, 42); // local header offset

  const localOffset = 0;
  const centralOffset = local.length + nameBuf.length + comp.length;
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(0, 4);
  eocd.writeUInt16LE(0, 6);
  eocd.writeUInt16LE(1, 8);
  eocd.writeUInt16LE(1, 10);
  eocd.writeUInt32LE(central.length + nameBuf.length, 12);
  eocd.writeUInt32LE(centralOffset, 16);
  eocd.writeUInt16LE(0, 20);

  void localOffset;
  return Buffer.concat([local, nameBuf, comp, central, nameBuf, eocd]);
}

main().catch((e) => { console.error("BUILD FAILED:", e.message); process.exit(1); });
