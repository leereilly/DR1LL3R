// Authored, hand-tuned sequence templates. Each returns entity specs in a
// local forward frame (f grows ahead) plus the sequence length. The director
// applies bounded transforms (mirror, spacing, jitter) and validates every
// required target with the movement simulation, so runs feel designed rather
// than randomly cruel.

import { VW } from "../core/constants.js";

const TR = 22; // roomy target radius
const TS = 17; // small target radius
const HR = 18; // hazard radius

const target = (x, f, r = TR, required = true) => ({ x, f, r, kind: "target", required, optional: false });
const bonus = (x, f) => ({ x, f, r: TS, kind: "target", required: false, optional: true });
const hazard = (x, f) => ({ x, f, r: HR, kind: "hazard", required: false, optional: false });

const C = VW / 2;

/** @typedef {{x:number,f:number,r:number,kind:string,required:boolean,optional:boolean,amp?:number,w?:number,phase?:number}} Spec */

/** Trivial, close, centered — the two-second tutorial. */
export const centeredStart = () => ({
  len: 620,
  items: [target(C, 150, 24), target(C, 340, 24), target(C, 520, 22)],
});

/** Alternating side shifts with roomy timing. */
export const zigzag = () => ({
  len: 900,
  items: [target(110, 160), target(250, 360), target(110, 560), target(250, 760)],
});

/** Fast hit rhythm rewarding momentum; small, steady steps. */
export const chainSnake = () => ({
  len: 980,
  items: [
    target(150, 150, TS), target(190, 300, TS), target(150, 450, TS),
    target(210, 600, TS), target(160, 750, TS), target(200, 900, TS),
  ],
});

/** One big sinusoidal island — teaches leading a moving target. */
export const movingIsland = () => ({
  len: 560,
  items: [{ x: C, f: 320, r: 26, kind: "target", required: true, optional: false, amp: 52, w: 1.2, phase: 0 }],
});

/** Explicit horn-only safe line between two hazards. */
export const tunnel = () => ({
  len: 760,
  items: [
    target(C, 170, 22),
    hazard(92, 430), hazard(268, 430),
    target(C, 470, 20),
    target(C, 690, 22),
  ],
});

/** Safe required center path plus optional side bonuses. */
export const riskFork = () => ({
  len: 720,
  items: [
    target(C, 170, 22),
    bonus(78, 380), target(C, 430, 20), bonus(282, 380),
    target(C, 660, 22),
  ],
});

export const SEQUENCES = [centeredStart, zigzag, chainSnake, movingIsland, tunnel, riskFork];

// Weighted pools per director intensity phase (indices into SEQUENCES).
export const PHASE_POOLS = {
  calm: [0, 1, 3],
  build: [1, 2, 3, 5],
  chaos: [2, 4, 5, 1],
  relief: [0, 3],
};
