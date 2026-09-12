import { test } from "node:test";
import assert from "node:assert/strict";
import { attachInput } from "../src/game/input.js";
import { makeState } from "../src/game/state.js";
import { createAudio } from "../src/game/audio.js";
import { GAME_TITLE, muteHit } from "../src/game/render.js";

test("title screen uses the DR1LL3R game name", () => {
  assert.equal(GAME_TITLE, "DR1LL3R");
});

test("keyboard repeats, held aliases, pointer restart, mute, and blur clearing", () => {
  const handlers = {};
  const old = globalThis.addEventListener;
  globalThis.addEventListener = (name, fn) => { handlers[name] = fn; };
  try {
    const s = makeState(1), pointer = {};
    const canvas = { addEventListener: (name, fn) => { pointer[name] = fn; }, setPointerCapture() {} };
    attachInput(s, canvas, x => x, x => x > 314, () => { s.input.muted = !s.input.muted; }, () => {});
    const key = code => ({ code, repeat: false, preventDefault() {} });
    handlers.keydown(key("KeyA"));
    assert.equal(s.input.pressEdge, true);
    s.input.pressEdge = false;
    handlers.keydown({ ...key("KeyA"), repeat: true });
    assert.equal(s.input.pressEdge, false);
    handlers.keydown(key("ArrowLeft"));
    handlers.keyup(key("KeyA"));
    assert.equal(s.input.left, true);
    handlers.keyup(key("ArrowLeft"));
    assert.equal(s.input.held, false);
    handlers.keydown(key("KeyM"));
    assert.equal(s.input.muted, true);
    assert.equal(s.input.pressEdge, false);
    pointer.pointerdown({ clientX: 180, clientY: 300, pointerId: 1 });
    assert.equal(s.input.held, true);
    pointer.pointerup({ pointerId: 1, pointerType: "mouse" });
    assert.equal(s.input.aim, true);
    assert.equal(s.input.held, false);
    pointer.pointerdown({ clientX: 180, clientY: 300, pointerId: 2 });
    pointer.pointerdown({ clientX: 337, clientY: 20, pointerId: 3 });
    pointer.pointerup({ pointerId: 3, pointerType: "touch" });
    assert.equal(s.input.aim, true, "second-finger mute must not cancel the steering finger");
    pointer.pointerup({ pointerId: 2, pointerType: "touch" });
    assert.equal(s.input.aim, false);
    handlers.blur();
    assert.equal(s.input.aim, false);
    assert.equal(s.input.pressEdge, false);
  } finally { globalThis.addEventListener = old; }
});

test("audio never constructs before unlock and denied devices remain playable", () => {
  const old = globalThis.AudioContext;
  let attempted = 0;
  globalThis.AudioContext = class { constructor() { attempted++; throw new Error("device unavailable"); } };
  try {
    const s = makeState(1), audio = createAudio(s);
    audio.pump();
    assert.equal(attempted, 0);
    audio.unlock();
    assert.equal(attempted, 1);
    s.audio.queue.push({ type: "hit" });
    audio.pump();
    assert.equal(s.audio.queue.length, 0);
    assert.equal(s.audio.unlocked, false);
    audio.setMuted(true);
  } finally { globalThis.AudioContext = old; }
});

test("mute has a 44px mobile hit area and stays aligned in letterboxed view", () => {
  const v = { rectLeft: 0, rectTop: 0, offX: 400, offY: 0, scale: 1.4 };
  assert.ok(muteHit(v, 400 + 320 * 1.4, 40 * 1.4));
  assert.ok(!muteHit(v, 400 + 300 * 1.4, 40 * 1.4));
});
