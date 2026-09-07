// Fixed-step simulation. Pure (no DOM): it mutates `state` and pushes sound
// requests onto `state.audio.queue` for the browser layer to play. Rendering
// reads state separately. This keeps the whole game testable headless.

import {
  VW, ANCHOR_N, ANCHOR_R, MAX_VX,
  BODY_RF, BODY_RX, SPEED_BASE, SPEED_MAX, SPEED_RAMP, DR_SPEED_MUL,
  DIST_SCORE, HIT_BASE, NEAR_BONUS, NEAR_DIST, NEAR_COOLDOWN,
  COMBO_MAX, BAND, DR_CHARGE, DR_TIME, DR_EXIT_COMBO, DR_SCORE_MUL, DR_GRACE, DR_AFTER_MUL, VIEW_TOP,
  HITSTOP, DEATH_LOCK, RAINBOW, STEP,
} from "../core/constants.js";
import { approach } from "../core/math.js";
import { hornHit, bodyHit } from "../core/collision.js";
import { reachable } from "../core/reach.js";
import { move } from "../core/movement.js";
import { beginRun } from "./state.js";
import { spawnUpdate } from "./spawn.js";
import { saveBest } from "../core/storage.js";

const HORIZON = 720;
const DEATH_MSGS = ["NOT HORN-FIRST", "HORN ERROR", "YOU HAD ONE HORN", "WRONG END", "UN-POINTED"];

const sfx = (s, type, extra) => s.audio.queue.push({ type, ...extra });

/** One fixed simulation step. @param {any} s @param {number} dt */
export function update(s, dt) {
  dt = Math.max(0, Math.min(STEP, dt));
  if (!dt || s.paused) return;
  // Consume the one-shot input edge exactly once per step.
  const pressed = s.input.pressEdge;
  s.input.pressEdge = false;

  if (s.mode === "title") {
    s.attractT += dt;
    stepFx(s, dt, false);
    if (pressed) beginRun(s);
    return;
  }

  if (s.mode === "over") {
    stepFx(s, dt, false);
    s.deathT += dt;
    const neutral = !s.input.held;
    if (neutral) s.restartArmed = true;
    if (pressed && s.restartArmed) s.restartQueued = true;
    if (s.deathT >= DEATH_LOCK && s.restartQueued) beginRun(s);
    return;
  }

  if (s.mode === "dying") {
    stepFx(s, dt, false);
    s.deathT += dt;
    if (s.deathT >= 0.35) {
      s.mode = "over";
      if (s.score > s.best) sfx(s, "best");
      s.best = saveBest(Math.max(s.best, Math.round(s.score)), s.store);
    }
    return;
  }

  // mode === 'run'
  if (s.dr.phase === "charge") {
    stepDoubleRainbow(s, dt);
    stepFx(s, dt, true);
    return;
  }
  if (s.hitstop > 0) {
    s.hitstop -= dt;
    stepFx(s, dt, true);
    return;
  }
  stepRun(s, dt);
  stepFx(s, dt, true);
}

function stepRun(s, dt) {
  const p = s.player;
  const slowing = s.slow > 0;
  const ts = slowing ? 0.4 : 1; // near-miss slow-mo
  s.time += dt;
  s.speed = Math.min(SPEED_MAX, SPEED_BASE + s.time * SPEED_RAMP);

  // --- Movement (Double Rainbow mirrors the world, so it mirrors steering) -
  const flip = s.dr.phase === "active" ? -1 : 1;
  const kb = ((s.input.right ? 1 : 0) - (s.input.left ? 1 : 0)) * flip;
  const aimX = s.input.aim ? (flip < 0 ? VW - s.input.aimX : s.input.aimX) : null;
  move(p, aimX, kb, dt);
  p.tilt = approach(p.tilt, (p.vx / MAX_VX) * 0.5, 6 * dt);
  p.eye = approach(p.eye, 0, dt * 3); // relax widened eyes

  // --- Double Rainbow lifecycle -----------------------------------------
  stepDoubleRainbow(s, dt);
  // Charge/active/exit keep their authored pacing; only the resumed normal
  // phase carries the earned Double Rainbow boost.
  const spdMul = s.dr.phase === "active" ? DR_SPEED_MUL : s.dr.phase === "none" ? s.dr.boost : 1;
  const effSpeed = s.speed * spdMul * ts;

  // --- World advance + distance score ------------------------------------
  const prevDepth = s.depth;
  s.depth += effSpeed * dt;
  s.score += effSpeed * dt * DIST_SCORE;
  s.nearCd = Math.max(0, s.nearCd - dt);
  if (slowing) s.slow -= dt;

  // --- Spawn ahead -------------------------------------------------------
  if (s.dr.phase === "active") drFill(s, effSpeed);
  else spawnUpdate(s);

  // --- Entity motion + collision ----------------------------------------
  const prevX = s.prevHornX;
  const px = p.x;
  const gx = VW - px; // ghost twin horn (Double Rainbow)
  const gprev = VW - prevX;

  for (const e of s.entities) {
    const prevEx = e.x;
    if (e.amp) e.x = e.baseX + e.amp * Math.sin(s.time * e.w + e.phase);
    const lf = e.fz - s.depth;
    const prevF = e.fz - prevDepth;

    if (!e.alive) continue;

    if (e.kind === "hazard") {
      if (hornHit(px, prevX, e.x, lf, e.r, prevF, prevEx, false) ||
          bodyHit(px, e.x, lf, e.r, prevX, prevF, prevEx)) {
        return die(s, "SPIKE. NOT SNACK.");
      }
    } else {
      // destructible: horn first, else lethal body overlap
      if (hornHit(px, prevX, e.x, lf, e.r, prevF, prevEx)) { onHit(s, e, lf); continue; }
      if (s.dr.phase === "active" && hornHit(gx, gprev, e.x, lf, e.r, prevF, prevEx)) { onHit(s, e, lf); continue; }
      if (bodyHit(px, e.x, lf, e.r, prevX, prevF, prevEx) ||
          s.dr.phase === "active" && bodyHit(gx, e.x, lf, e.r, gprev, prevF, prevEx)) return die(s, pick(s, DEATH_MSGS));

      // Optional stars never break the required-target chain.
      if (e.required && !e.counted && lf < -(BODY_RF + 12)) {
        e.counted = true;
        if (s.combo) s.fx.pops.push({ x: px, fz: s.depth + 75, txt: "COMBO LOST", life: 0.8, max: 0.8, col: "#fff" });
        s.combo = 0;
        sfx(s, "miss");
      }
    }

    // Both spikes and undrilled targets can graze the player's flank.
    if (lf < 0 && !e.neared) {
      e.neared = true;
      const gap = Math.abs(e.x - px);
      if (s.nearCd <= 0 && gap > BODY_RX + e.r && gap <= BODY_RX + e.r + NEAR_DIST) {
        onNearMiss(s, e);
      }
    }
  }

  // recycle entities that fell far behind
  for (let i = s.entities.length - 1; i >= 0; i--) {
    if (s.entities[i].fz - s.depth < -140) s.entities.splice(i, 1);
  }

  // ribbon history sample
  const rb = s.fx.ribbon;
  rb.push({ x: px, d: s.depth });
  if (rb.length > 96) rb.shift();

  s.prevHornX = px;
  s.audio.tier = s.dr.phase === "active" ? 4 : s.combo >= 20 ? 3 : s.combo >= 10 ? 2 : s.combo >= 5 ? 1 : 0;
}

function pick(s, arr) { return arr[s.rng.int(0, arr.length - 1)]; }

function onHit(s, e, lf) {
  e.alive = false;
  const band = Math.floor(s.combo / BAND);
  const drm = s.dr.phase === "active" ? DR_SCORE_MUL : 1;
  const pts = Math.round(HIT_BASE * (1 + band) * drm);
  s.score += pts;
  s.combo = Math.min(COMBO_MAX, s.combo + 1);
  s.maxCombo = Math.max(s.maxCombo, s.combo);

  s.fx.pops.push({ x: e.x, fz: e.fz, txt: "+" + pts, life: 0.7, max: 0.7, col: s.dr.phase === "active" ? "#fff3bd" : RAINBOW[s.combo % 7] });
  burst(s, e.x, e.fz, e.r, s.combo);
  s.hitstop = HITSTOP;
  s.cam.shake = Math.min(6, s.cam.shake + 2.2);
  s.cam.py = 5;
  s.player.squash = 1;
  s.fx.flash = Math.max(s.fx.flash, 0.16);
  s.fx.shock = 0.28; s.fx.shockX = e.x; s.fx.shockFz = e.fz; s.fx.shockR = e.r;
  sfx(s, "hit", { combo: s.combo });

  if (s.combo >= COMBO_MAX && s.dr.phase === "none") {
    s.dr.phase = "charge"; s.dr.charge = DR_CHARGE; s.fx.flash = 1; sfx(s, "charge");
  }
}

function onNearMiss(s, e) {
  s.score += NEAR_BONUS;
  s.nearCd = NEAR_COOLDOWN;
  s.slow = 0.12;
  s.player.eye = 1; // eyes widen
  s.fx.pops.push({ x: e.x, fz: e.fz, txt: "NICE +50", life: 0.6, max: 0.6, col: "#fff" });
  for (let i = 0; i < 6; i++) {
    const a = s.rng.range(0, Math.PI * 2);
    s.fx.parts.push(part(e.x, e.fz, Math.cos(a) * 120, Math.sin(a) * 120, 0.35, "#fff", 2));
  }
  sfx(s, "near");
}

function die(s, msg) {
  s.mode = "dying";
  s.deathT = 0;
  s.deathMsg = msg;
  s.player.hurt = 1;
  s.cam.shake = 12;
  s.fx.flash = 1;
  // rainbow splat
  for (let i = 0; i < 46; i++) {
    const a = s.rng.range(0, Math.PI * 2);
    const sp = s.rng.range(60, 320);
    s.fx.parts.push(part(s.player.x, s.depth, Math.cos(a) * sp, Math.sin(a) * sp,
      s.rng.range(0.5, 1.1), RAINBOW[i % 7], s.rng.range(3, 6)));
  }
  sfx(s, "death");
}

// --- Double Rainbow -------------------------------------------------------

function stepDoubleRainbow(s, dt) {
  const dr = s.dr;
  if (dr.phase === "charge") {
    dr.charge -= dt;
    s.combo = COMBO_MAX;
    if (dr.charge <= 0) activateDR(s);
  } else if (dr.phase === "active") {
    dr.t -= dt;
    dr.stage = dr.t > DR_TIME - 1.4 ? 1 : 2; // staged DOUBLE then RAINBOW text
    if (dr.t <= 0) exitDR(s);
  } else if (dr.phase === "exit") {
    dr.t -= dt;
    s.cam.zoom = approach(s.cam.zoom, 1, dt * 1.5);
    // Assignment, not accumulation: the bump is earned once and never stacks.
    if (dr.t <= 0) { dr.phase = "none"; dr.boost = DR_AFTER_MUL; }
  }
  // ease zoom during active
  if (dr.phase === "active") s.cam.zoom = approach(s.cam.zoom, 0.88, dt * 1.2);
}

function activateDR(s) {
  const dr = s.dr;
  dr.phase = "active"; dr.t = DR_TIME; dr.stage = 1;
  s.cam.sign = -1; s.cam.anchor = ANCHOR_R;
  s.fx.flash = 1;
  // protect the transition: clear the field, then hold the first mirrored
  // pair off-screen for DR_GRACE seconds so the flipped view can be read.
  // The lead covers the ramping speed, so the runway is never shorter.
  s.entities.length = 0;
  s.fx.ribbon.length = 0;
  s.director.cursor = s.depth + (ANCHOR_R - VIEW_TOP) +
    (s.speed + SPEED_RAMP * DR_GRACE) * DR_SPEED_MUL * DR_GRACE;
  s.director.lastX = s.player.x;
  sfx(s, "dr");
}

function exitDR(s) {
  const dr = s.dr;
  dr.phase = "exit"; dr.t = 0.5;
  s.cam.sign = 1; s.cam.anchor = ANCHOR_N;
  s.fx.flash = 1;
  s.combo = DR_EXIT_COMBO;
  s.entities.length = 0;
  s.fx.ribbon.length = 0;
  s.director.cursor = s.depth + 180;
  s.director.lastX = s.player.x;
  s.director.lastF = s.depth;
  s.director.lastAmp = 0;
  // Preserve the director's phrase: resetting it here would keep skilled
  // runs in the tutorial forever. The cleared spawn buffer is the relief.
  spawnUpdate(s);
  sfx(s, "drexit");
}

/** Mirrored target-pair stream, hittable by the real + ghost horn together. */
function drFill(s, speed) {
  const d = s.director;
  while (d.cursor - s.depth < HORIZON) {
    let x = s.rng.range(78, 142);
    let guard = 0;
    while (d.lastX != null && !reachable(d.lastX, x, 170, speed) && guard++ < 30) {
      x += (d.lastX - x) * 0.2;
    }
    d.lastX = x;
    const fz = d.cursor;
    s.entities.push(mkPair(x, fz), mkPair(VW - x, fz));
    d.cursor += s.rng.range(205, 250);
  }
}

const mkPair = (x, fz) => ({
  x, baseX: x, fz, r: 18, kind: "target", required: false, optional: true,
  alive: true, counted: false, neared: false, amp: 0, w: 0, phase: 0,
  skin: 3,
});

// --- FX stepping ----------------------------------------------------------

function stepFx(s, dt, running) {
  const fx = s.fx;
  s.cam.shake = approach(s.cam.shake, 0, dt * 30);
  s.cam.py = approach(s.cam.py, 0, dt * 30);
  s.player.squash = approach(s.player.squash, 0, dt * 7);
  fx.flash = approach(fx.flash, 0, dt * 3.2);
  if (fx.shock > 0) fx.shock -= dt;
  for (let i = fx.parts.length - 1; i >= 0; i--) {
    const q = fx.parts[i];
    q.life -= dt;
    if (q.life <= 0) { fx.parts.splice(i, 1); continue; }
    q.fz += q.vf * dt; q.x += q.vx * dt;
    q.vx *= 1 - 2 * dt; q.vf *= 1 - 2 * dt; q.vf += 60 * dt; // slight drift toward drill
    q.rot += q.spin * dt;
  }
  for (let i = fx.pops.length - 1; i >= 0; i--) {
    fx.pops[i].life -= dt;
    if (fx.pops[i].life <= 0) fx.pops.splice(i, 1);
  }
  // cap pools
  if (fx.parts.length > 260) fx.parts.splice(0, fx.parts.length - 260);
}

function burst(s, x, fz, r, combo) {
  const n = 8 + Math.min(14, combo);
  for (let i = 0; i < n; i++) {
    const a = s.rng.range(0, Math.PI * 2);
    const sp = s.rng.range(50, 60 + r * 6);
    s.fx.parts.push(part(x, fz, Math.cos(a) * sp, Math.sin(a) * sp,
      s.rng.range(0.3, 0.7), RAINBOW[(i + combo) % 7], s.rng.range(2, 5)));
  }
}

function part(x, fz, vx, vf, life, col, size) {
  return { x, fz, vx, vf, life, max: life, col, size, rot: Math.random() * 6, spin: (Math.random() - 0.5) * 12 };
}
