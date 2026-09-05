import { test } from "node:test";
import assert from "node:assert/strict";
import { makeState, beginRun } from "../src/game/state.js";
import { update } from "../src/game/update.js";
import { drive } from "../src/game/autopilot.js";
import { reachable } from "../src/core/reach.js";
import { STEP } from "../src/core/constants.js";

test("12 seeded five-minute runs reach every biome, reverse and return through real steering", () => {
  const biomes = new Set(), phases = new Set();
  for (let seed = 1; seed <= 12; seed++) {
    const s = makeState(seed);
    beginRun(s);
    let activations = 0, exits = 0, previous = "none";
    for (let f = 0; f < 18000; f++) {
      drive(s); update(s, STEP);
      assert.ok(!s.audio.queue.some(e => e.type === "miss"), `unreachable required target: seed ${seed}`);
      s.audio.queue.length = 0;
      assert.equal(s.mode, "run", `seed ${seed}, t=${s.time}, x=${s.player.x}, ${s.deathMsg}`);
      assert.ok(s.fx.parts.length <= 260 && s.fx.ribbon.length <= 96 && s.entities.length < 40);
      if (s.dr.phase === "active" && previous !== "active") activations++;
      if (s.dr.phase === "exit" && previous !== "exit") exits++;
      previous = s.dr.phase;
      biomes.add(s.director.biome); phases.add(s.director.phaseIdx);
    }
    assert.ok(activations >= 3 && exits >= 3, `seed ${seed}: ${activations}/${exits}`);
  }
  assert.equal(biomes.size, 5);
  assert.equal(phases.size, 4);
});

test("generator is reproducible and adjacent required target envelopes are reachable", () => {
  for (let seed = 1; seed <= 80; seed++) {
    const a = makeState(seed), b = makeState(seed);
    beginRun(a); beginRun(b);
    assert.deepEqual(a.entities, b.entities);
    let prev = { x: 180, amp: 0, fz: 0 };
    for (const e of a.entities.filter(e => e.required)) {
      for (const sign of [-1, 1]) {
        assert.ok(reachable(prev.x - sign * prev.amp, e.x + sign * e.amp, e.fz - prev.fz, 360));
      }
      prev = e;
    }
  }
});

test("pause freezes simulation and input consumption; resume has no catch-up", () => {
  const s = makeState(1); beginRun(s); s.paused = true;
  const d = s.depth;
  s.input.pressEdge = true;
  for (let i = 0; i < 60; i++) update(s, STEP);
  assert.equal(s.depth, d);
  assert.equal(s.input.pressEdge, true);
  s.paused = false;
  update(s, STEP);
  assert.ok(s.depth - d < 4);
});
