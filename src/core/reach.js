// Reachability simulation. Runs the real lateral movement model to check
// whether the player can get from one x to another before a target closes
// the forward gap. Authored sequences are validated against this so a run
// is never physically unfair.

import { STEP } from "./constants.js";
import { move } from "./movement.js";

/**
 * @param {number} fromX start lateral position
 * @param {number} toX desired lateral position
 * @param {number} df forward distance to cover
 * @param {number} speed forward px/s
 * @param {number} [tol] acceptable lateral error at arrival
 */
export function reachable(fromX, toX, df, speed, tol = 10) {
  const time = df / speed;
  const p = { x: fromX, vx: 0 };
  let t = 0;
  while (t < time) {
    move(p, toX, 0, STEP);
    t += STEP;
  }
  return Math.abs(p.x - toX) <= tol;
}
