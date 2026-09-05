import { test } from "node:test";
import assert from "node:assert/strict";
import { hornHit, bodyHit } from "../src/core/collision.js";
import { BODY_RF, HORN_LEN, HORN_R } from "../src/core/constants.js";

const midHorn = BODY_RF + HORN_LEN / 2; // squarely in the horn band

test("horn core destroys a centered target", () => {
  assert.ok(hornHit(180, 180, 180, midHorn, 18));
});

test("body overlap detected when target reaches the torso", () => {
  assert.ok(bodyHit(180, 180, 4, 18));
});

test("far-lateral target neither horns nor bodies", () => {
  assert.ok(!hornHit(180, 180, 260, midHorn, 18));
  assert.ok(bodyHit(180, 180, 4, 18));
  assert.ok(!bodyHit(180, 300, 4, 18));
});

test("horn sweep catches a fast lateral crossing via previous frame", () => {
  // current position misses laterally, previous frame position catches it
  const ex = 205;
  assert.ok(!hornHit(180, 180, ex, midHorn, 10)); // static: 25px > reach
  assert.ok(hornHit(180, 210, ex, midHorn, 10)); // swept from x=210 catches it
});

test("horn reach respects generous centered core, not the full outer target", () => {
  const justInside = 180 + (HORN_R + 5 * 0.4) - 0.5;
  const justOutside = 180 + (HORN_R + 5 * 0.4) + 0.5;
  assert.ok(hornHit(180, 180, justInside, midHorn, 5));
  assert.ok(!hornHit(180, 180, justOutside, midHorn, 5));
});

test("continuous lateral and forward sweeps cannot tunnel", () => {
  assert.ok(hornHit(260, 100, 180, midHorn, 10));
  assert.ok(hornHit(180, 180, 180, -25, 10, 140));
  assert.ok(!hornHit(180, 180, 220, 0, 10, 140));
});
