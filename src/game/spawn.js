// Spawn director: paces authored sequences ahead of the player, applies
// bounded transforms, guarantees reachability, cycles intensity phases and
// biomes, and opens occasional relief gaps that preserve the earned combo.

import { VW, SPEED_MAX, MAX_VX } from "../core/constants.js";
import { SEQUENCES, PHASE_POOLS } from "./sequences.js";

const HORIZON = 720; // spawn until this far ahead of the player
const EDGE = 62; // keep targets off the walls
const PHASE_ORDER = ["calm", "build", "chaos", "relief"];
const PHASE_LEN = [2, 3, 3, 1];

export function spawnInit(state) {
  const d = state.director;
  d.cursor = state.depth + 20;
  d.phaseIdx = 0;
  d.phaseLeft = PHASE_LEN[0];
  d.count = 0;
  d.lastX = VW / 2;
  d.lastF = state.depth;
  d.lastAmp = 0;
  // Always open with the trivial tutorial sequence.
  emit(state, SEQUENCES[0](), "intro");
  fill(state);
}

export function spawnUpdate(state) {
  state.director.biome = Math.floor(state.time / 32) % 5;
  fill(state);
}

function fill(state) {
  const d = state.director;
  while (d.cursor - state.depth < HORIZON) {
    if (d.phaseLeft <= 0) advancePhase(d);
    const phase = PHASE_ORDER[d.phaseIdx];
    const pool = PHASE_POOLS[phase];
    const idx = state.rng.pick(pool);
    emit(state, SEQUENCES[idx](), phase);
    d.phaseLeft--;
    d.count++;
  }
}

function advancePhase(d) {
  d.phaseIdx = (d.phaseIdx + 1) % PHASE_ORDER.length;
  d.phaseLeft = PHASE_LEN[d.phaseIdx];
}

function emit(state, seq, phase = "calm") {
  const rng = state.rng;
  const mirror = phase !== "intro" && rng.chance(0.5);
  const scale = phase === "intro" ? 1 : rng.range(0.95, 1.08);
  const jitter = phase === "intro" ? 0 : rng.range(-16, 16);
  const d = state.director;
  const gap = phase === "intro" ? 0 : phase === "relief" ? rng.range(320, 420) : rng.range(100, 160);
  const base = d.cursor + gap;

  // Build transformed specs.
  const specs = seq.items.map((it) => {
    let x = mirror ? VW - it.x : it.x;
    x = Math.min(VW - EDGE, Math.max(EDGE, x + jitter));
    return { ...it, x, f: it.f * scale };
  });

  // Reachability fixup for the required chain.
  const req = specs.filter((s) => s.required).sort((a, b) => a.f - b.f);
  for (const cur of req) {
    // Reserve acceleration, settling, and both moving-target envelopes at
    // the maximum speed, including sequence boundaries. Shift the whole
    // following row (hazards included), never move a core toward its spikes.
    const travel = Math.abs(cur.x - d.lastX) + (cur.amp || 0) + d.lastAmp;
    const needed = (travel / MAX_VX + 0.25) * SPEED_MAX;
    const add = Math.max(0, needed - (base + cur.f - d.lastF));
    if (add) {
      const from = cur.f;
      for (const item of specs) if (item.f >= from) item.f += add;
    }
    d.lastX = cur.x; d.lastAmp = cur.amp || 0; d.lastF = base + cur.f;
  }
  for (const s of specs) {
    state.entities.push({
      x: s.x,
      baseX: s.x,
      fz: base + s.f,
      r: s.r,
      kind: s.kind,
      required: s.required,
      optional: s.optional,
      alive: true,
      counted: false,
      neared: false,
      amp: s.amp || 0,
      w: s.w || 0,
      phase: s.phase || 0,
      skin: s.optional ? 3 : rng.int(0, 2),
    });
  }
  d.cursor = base + Math.max(seq.len * scale, ...specs.map(s => s.f + 90));
}
