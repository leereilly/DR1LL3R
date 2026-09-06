import { test } from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const run = promisify(execFile);
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

test("dev index.html guards file:// with a classic script before the module", async () => {
  const html = await readFile(join(ROOT, "index.html"), "utf8");
  const guard = html.indexOf('location.protocol === "file:"');
  const moduleTag = html.indexOf('type="module"');
  assert.ok(guard !== -1, "expected a file:// guard");
  assert.ok(moduleTag !== -1, "expected the module script");
  assert.ok(guard < moduleTag, "guard must run before the module script");
  assert.match(html, /npm start/);
  assert.match(html, /127\.0\.0\.1:8080/);
});

test("production build stays self-contained and free of the dev guard", async () => {
  await run("node", ["scripts/build.mjs"], { cwd: ROOT });
  const built = await readFile(join(ROOT, "dist/index.html"), "utf8");
  assert.doesNotMatch(built, /file:/);
  assert.doesNotMatch(built, /npm start/);
  assert.doesNotMatch(built, /\b(src|href)\s*=|https?:\/\//i);
});
