import { test } from "node:test";
import assert from "node:assert/strict";
import { makePrng } from "../src/core/prng.js";
import { loadBest, saveBest } from "../src/core/storage.js";
import { clamp, lerp, segDist } from "../src/core/math.js";

test("prng is deterministic per seed", () => {
  const a = makePrng(42), b = makePrng(42);
  const sa = [a.next(), a.next(), a.next()];
  const sb = [b.next(), b.next(), b.next()];
  assert.deepEqual(sa, sb);
});

test("prng diverges for different seeds", () => {
  const a = makePrng(1), b = makePrng(2);
  assert.notEqual(a.next(), b.next());
});

test("prng ranges stay in bounds", () => {
  const r = makePrng(7);
  for (let i = 0; i < 500; i++) {
    const v = r.range(3, 9);
    assert.ok(v >= 3 && v < 9);
    const n = r.int(0, 4);
    assert.ok(n >= 0 && n <= 4 && Number.isInteger(n));
  }
});

test("math helpers", () => {
  assert.equal(clamp(5, 0, 3), 3);
  assert.equal(clamp(-1, 0, 3), 0);
  assert.equal(lerp(0, 10, 0.5), 5);
  // distance from point to a vertical segment == lateral distance
  assert.ok(Math.abs(segDist(10, 5, 0, 0, 0, 10) - 10) < 1e-9);
  assert.ok(Math.abs(segDist(3, 20, 0, 0, 0, 10) - Math.hypot(3, 10)) < 1e-9);
});

test("storage falls back safely when it throws", () => {
  const throwing = {
    getItem() { throw new Error("denied"); },
    setItem() { throw new Error("denied"); },
    removeItem() {},
  };
  assert.equal(loadBest(throwing), 0);
  const v = saveBest(1234, throwing); // should not throw, keeps memory best
  assert.equal(v, 1234);
  assert.equal(loadBest(throwing), 1234); // memory fallback survives
});

test("storage round-trips through a working store", () => {
  const map = new Map();
  const store = {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, v),
    removeItem: (k) => map.delete(k),
  };
  saveBest(1500, store);
  assert.equal(loadBest(store), 1500);
  saveBest(500, store);
  assert.equal(loadBest(store), 1500);
});
