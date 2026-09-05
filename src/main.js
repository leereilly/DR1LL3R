// Bootstrap: canvas + responsive letterbox, fixed-step loop with a capped
// accumulator, blur/visibility pause with fair resume, input + audio wiring.
// Dev-only URL hooks (seed/start/autopilot/mute) are dead-stripped from the
// production bundle via the `__DEV__` define, so the shipped game has no
// debug surface or cheats.

import { VW, VH, STEP, MAX_STEPS } from "./core/constants.js";
import { makeState, beginRun } from "./game/state.js";
import { update } from "./game/update.js";
import { render, muteHit } from "./game/render.js";
import { attachInput } from "./game/input.js";
import { createAudio } from "./game/audio.js";
import { loadBest } from "./core/storage.js";
import { drive } from "./game/autopilot.js";

const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById("c"));
const ctx = /** @type {CanvasRenderingContext2D} */ (canvas.getContext("2d"));

const params = typeof __DEV__ === "undefined" ? new URLSearchParams(location.search) : null;
const seed = typeof __DEV__ === "undefined" && params.get("seed") ? parseInt(params.get("seed"), 10) : (Date.now() & 0xffff);
const state = makeState(seed, loadBest());

const audio = createAudio(state);

const view = { cssW: 0, cssH: 0, dpr: 1, scale: 1, offX: 0, offY: 0, rectLeft: 0, rectTop: 0 };

function resize() {
  const cssW = innerWidth, cssH = innerHeight;
  const dpr = Math.min(2, devicePixelRatio || 1);
  canvas.width = Math.round(cssW * dpr);
  canvas.height = Math.round(cssH * dpr);
  canvas.style.width = cssW + "px";
  canvas.style.height = cssH + "px";
  const scale = Math.min(cssW / VW, cssH / VH, 1.7);
  view.cssW = cssW; view.cssH = cssH; view.dpr = dpr; view.scale = scale;
  view.offX = (cssW - VW * scale) / 2;
  view.offY = (cssH - VH * scale) / 2;
  const r = canvas.getBoundingClientRect();
  view.rectLeft = r.left; view.rectTop = r.top;
}
addEventListener("resize", resize);
resize();

const mapX = (clientX) => (clientX - view.rectLeft - view.offX) / view.scale;
const onMute = () => { state.input.muted = !state.input.muted; audio.setMuted(state.input.muted); };
attachInput(state, canvas, mapX,
  (cx, cy) => muteHit(view, cx, cy),
  onMute,
  () => audio.unlock());

if (typeof __DEV__ === "undefined") {
  if (params.get("mute") === "1") state.input.muted = true;
  if (params.get("start") === "run") beginRun(state);
}
const debug = typeof __DEV__ === "undefined" ? { state, view, audio, auto: params.get("autopilot") === "1" } : null;
if (typeof __DEV__ === "undefined") window.__uhd = debug;

// --- Main loop ------------------------------------------------------------

let last = performance.now();
let acc = 0;
let paused = false;

function frame(now) {
  requestAnimationFrame(frame);
  let dt = (now - last) / 1000;
  last = now;
  if (paused) { dt = 0; }
  if (dt > 0.25) dt = 0.25; // guard against huge tab-restore jumps
  acc += dt;
  let steps = 0;
  while (acc >= STEP && steps < MAX_STEPS) {
    if (typeof __DEV__ === "undefined" && debug.auto) drive(state);
    update(state, STEP);
    acc -= STEP;
    steps++;
  }
  if (steps === MAX_STEPS) acc = 0;
  audio.pump();
  render(ctx, state, view, now / 1000);
}
requestAnimationFrame(frame);

function pause(p) {
  paused = p;
  state.paused = p;
  if (!p) { last = performance.now(); acc = 0; }
}
addEventListener("blur", () => pause(true));
addEventListener("focus", () => pause(false));
document.addEventListener("visibilitychange", () => pause(document.hidden));
