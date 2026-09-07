// Game state factory plus run/restart helpers. Pure data only — no DOM — so
// the whole simulation runs headless in node:test.

import {
  VW, ANCHOR_N, SPEED_BASE,
} from "../core/constants.js";
import { makePrng } from "../core/prng.js";
import { spawnInit } from "./spawn.js";

/**
 * @param {number} seed
 * @param {number} best
 */
export function makeState(seed, best = 0) {
  return {
    seed,
    rng: makePrng(seed),
    /** @type {'title'|'run'|'dying'|'over'} */
    mode: "title",
    time: 0,
    depth: 0,
    speed: SPEED_BASE,
    score: 0,
    best,
    combo: 0, // consecutive successful hits, 0..COMBO_MAX
    maxCombo: 0,

    player: { x: VW / 2, vx: 0, tilt: 0, eye: 0, hurt: 0, squash: 0 },
    prevHornX: VW / 2,

    /** @type {any[]} */
    entities: [],
    fx: {
      /** @type {any[]} */ parts: [],
      /** @type {any[]} */ pops: [],
      /** @type {any[]} */ ribbon: [], // {x, d} ring of player history
      flash: 0,
      shock: 0, // expanding impact ring timer
      shockX: 0,
      shockY: 0,
    },
    cam: { shake: 0, px: 0, py: 0, zoom: 1, sign: 1, anchor: ANCHOR_N },
    dr: { phase: "none", t: 0, charge: 0, stage: 0, boost: 1 }, // none|charge|active|exit
    hitstop: 0,
    slow: 0, // brief near-miss slow-mo timer

    director: { cursor: 0, biome: 0, phaseIdx: 0, phaseLeft: 0, count: 0 },
    input: { left: false, right: false, aimX: null, aim: false, held: false, pressEdge: false, muted: false },
    paused: false,

    deathT: 0,
    deathMsg: "",
    restartArmed: false,
    restartQueued: false,
    nearCd: 0,

    audio: { /** @type {any[]} */ queue: [], tier: 0, unlocked: false },
    attractT: 0,

    /** @type {Storage|null} */
    store: null,
  };
}

/** Reset only the run fields and start a fresh descent. */
export function beginRun(state) {
  state.mode = "run";
  state.time = 0;
  state.depth = 0;
  state.speed = SPEED_BASE;
  state.score = 0;
  state.combo = 0;
  state.maxCombo = 0;
  state.player.x = VW / 2;
  state.player.vx = 0;
  state.player.tilt = 0;
  state.player.hurt = 0;
  state.player.eye = 0;
  state.player.squash = 0;
  state.prevHornX = VW / 2;
  state.entities.length = 0;
  state.fx.parts.length = 0;
  state.fx.pops.length = 0;
  state.fx.ribbon.length = 0;
  state.fx.flash = 0;
  state.fx.shock = 0;
  state.cam.shake = 0;
  state.cam.px = 0;
  state.cam.py = 0;
  state.cam.zoom = 1;
  state.cam.sign = 1;
  state.cam.anchor = ANCHOR_N;
  state.dr.phase = "none";
  state.dr.t = 0;
  state.dr.charge = 0;
  state.dr.boost = 1;
  state.hitstop = 0;
  state.slow = 0;
  state.nearCd = 0;
  state.restartArmed = false;
  state.restartQueued = false;
  state.deathMsg = "";
  state.deathT = 0;
  state.audio.queue.length = 0;
  state.audio.tier = 0;
  state.director.biome = 0;
  spawnInit(state);
}
