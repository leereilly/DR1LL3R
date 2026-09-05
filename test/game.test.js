import { test } from "node:test";
import assert from "node:assert/strict";
import { makeState, beginRun } from "../src/game/state.js";
import { update } from "../src/game/update.js";
import { STEP, COMBO_MAX, DR_EXIT_COMBO, ANCHOR_N, MAX_VX } from "../src/core/constants.js";
import { SEQUENCES } from "../src/game/sequences.js";

function run(seed = 1) {
  const s = makeState(seed);
  beginRun(s);
  s.entities.length = 0;
  s.director.cursor = 1e9;
  return s;
}
function target(s, x = 180, f = 60, extra = {}) {
  const e = { x, baseX: x, fz: s.depth + f, r: 22, kind: "target",
    required: true, alive: true, amp: 0, ...extra };
  s.entities.push(e);
  return e;
}
function steps(s, n) {
  for (let i = 0; i < n; i++) { update(s, STEP); s.audio.queue.length = 0; }
}

test("first press starts immediately; title does not advance the world", () => {
  const s = makeState(1);
  steps(s, 30);
  assert.equal(s.score, 0);
  assert.equal(s.depth, 0);
  s.input.pressEdge = true;
  update(s, STEP);
  assert.equal(s.mode, "run");
  assert.equal(s.input.pressEdge, false);
});

test("centered horn hit scores, freezes, and produces bounded juice", () => {
  const s = run();
  const e = target(s);
  update(s, STEP);
  assert.equal(e.alive, false);
  assert.equal(s.combo, 1);
  assert.ok(s.score >= 100 && s.score < 101);
  assert.ok(s.hitstop > 0);
  const d = s.depth;
  update(s, STEP);
  assert.equal(s.depth, d);
  assert.ok(s.fx.parts.length && s.fx.shock > 0);
});

test("off-center body collision and horn-first hazard are lethal", () => {
  for (const hazardous of [false, true]) {
    const s = run();
    target(s, hazardous ? 180 : 208, hazardous ? 60 : 0,
      { kind: hazardous ? "hazard" : "target" });
    update(s, STEP);
    assert.equal(s.mode, "dying");
    assert.equal(s.combo, 0);
  }
});

test("required target miss breaks the combo once, including an almost-full rainbow", () => {
  for (const combo of [1, 12, COMBO_MAX - 1]) {
    const s = run();
    s.combo = combo;
    const e = target(s, 300, -50);
    update(s, STEP);
    assert.equal(s.combo, 0);
    assert.equal(s.dr.phase, "none");
    assert.equal(e.counted, true);
    assert.equal(s.audio.queue.filter(e => e.type === "miss").length, 1);
    assert.ok(s.fx.pops.some(p => p.txt === "COMBO LOST"));
    s.combo = 3;
    steps(s, 3);
    assert.equal(s.combo, 3);
  }
});

test("optional stars never break the combo", () => {
  const s = run();
  s.combo = 12;
  target(s, 60, -50, { required: false, optional: true });
  steps(s, 3);
  assert.equal(s.combo, 12);
});

test("near misses of spikes and targets award fifty once with feedback and cooldown", () => {
  for (const kind of ["hazard", "target"]) {
    const s = run();
    target(s, 230, -4, { kind, required: false });
    update(s, STEP);
    assert.equal(s.mode, "run");
    assert.ok(s.score >= 50 && s.score < 51);
    assert.equal(s.player.eye, 1);
    assert.ok(s.fx.pops.some(p => p.txt === "NICE +50"));
    assert.equal(s.audio.queue.filter(e => e.type === "near").length, 1);
    target(s, 130, -4, { kind, required: false });
    steps(s, 2);
    assert.ok(s.score < 51);
  }
});

test("charge is a true 150ms world hold, clears transition, and flips", () => {
  const s = run();
  s.combo = COMBO_MAX - 1;
  target(s);
  target(s, 90, 500, { kind: "hazard" });
  update(s, STEP);
  assert.equal(s.dr.phase, "charge");
  const depth = s.depth;
  steps(s, 8);
  assert.equal(s.depth, depth);
  steps(s, 5);
  assert.equal(s.dr.phase, "active");
  assert.equal(s.cam.sign, -1);
  assert.ok(s.entities.every(e => e.kind !== "hazard"));
});

test("mirrored horn collects both streams; return clears and restores anchor", () => {
  const s = run();
  s.dr.phase = "active"; s.dr.t = 2;
  s.player.x = s.prevHornX = 110;
  target(s, 110);
  target(s, 250);
  update(s, STEP);
  assert.equal(s.combo, 2);
  assert.equal(s.mode, "run");
  s.hitstop = 0;
  s.dr.t = STEP / 2;
  update(s, STEP);
  assert.equal(s.cam.sign, 1);
  assert.equal(s.cam.anchor, ANCHOR_N);
  assert.equal(s.combo, DR_EXIT_COMBO);
  assert.ok(s.entities.every(e => e.fz - s.depth > 100));
});

test("movement accelerates, caps speed and edges, and rejects huge dt", () => {
  const s = run();
  s.input.right = true;
  update(s, STEP);
  assert.ok(s.player.vx > 0 && s.player.vx < MAX_VX);
  steps(s, 80);
  assert.ok(s.player.x <= 348 && s.player.vx <= MAX_VX);
  const d = s.depth;
  update(s, 10);
  assert.ok(s.depth - d < 10);
});

test("restart within a second requires a fresh edge but works after mouse steering", () => {
  const s = run();
  s.input.aim = true; s.input.held = true;
  target(s, 180, 60, { kind: "hazard" });
  steps(s, 1);
  steps(s, 55);
  assert.equal(s.mode, "over");
  assert.equal(s.restartArmed, false);
  s.input.held = false;
  steps(s, 1);
  assert.equal(s.restartArmed, true);
  s.input.pressEdge = true; s.input.held = true;
  steps(s, 1);
  assert.equal(s.mode, "run");
  assert.equal(s.score, 0);
  assert.equal(s.cam.anchor, ANCHOR_N);
});

test("restart resets director, camera, transient audio, and eye state", () => {
  const s = run();
  s.cam.anchor = 448; s.player.eye = 1; s.director.biome = 4;
  s.audio.queue.push({ type: "death" }); s.audio.tier = 4;
  beginRun(s);
  assert.equal(s.cam.anchor, ANCHOR_N);
  assert.equal(s.director.biome, 0);
  assert.equal(s.player.eye, 0);
  assert.equal(s.audio.queue.length, 0);
  assert.equal(s.audio.tier, 0);
  assert.ok(s.entities.filter(e => e.required).slice(0, 3).every(e => e.x === 180));
});

test("fresh restart press during the score-card entrance is buffered safely", () => {
  const s = run();
  target(s, 180, 60, { kind: "hazard" });
  steps(s, 26);
  assert.equal(s.mode, "over");
  s.input.pressEdge = true;
  s.input.held = true;
  steps(s, 1);
  assert.equal(s.mode, "over");
  steps(s, 9);
  assert.equal(s.mode, "run");
});

test("six authored families include motion, hazards, and optional choices", () => {
  assert.equal(SEQUENCES.length, 6);
  const specs = SEQUENCES.flatMap(f => f().items);
  assert.ok(specs.some(e => e.amp));
  assert.ok(specs.some(e => e.kind === "hazard"));
  assert.ok(specs.some(e => e.optional && !e.required));
});
