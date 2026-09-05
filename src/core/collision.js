// Collision in the mode-independent forward/lateral frame.
// Player sits at lateral x, forward f = 0. Forward (+f) is "ahead":
// the horn sticks out ahead of the body, so approaching entities always
// meet the horn before the body — the core horn-first mechanic.

import { segDist } from "../core/math.js";
import { BODY_RF, BODY_RX, HORN_LEN, HORN_R, SWEEP_SLACK } from "../core/constants.js";

/**
 * True when the swept horn core overlaps the entity.
 * Relative motion sweeps continuously in both axes, with rear coyote slack.
 * Targets use a narrower safe core; hazards use their full radius.
 * @param {number} px current player x
 * @param {number} prevX player x last frame
 * @param {number} ex entity x
 * @param {number} ef entity forward-local position (fz - depth)
 * @param {number} er entity radius
 * @param {number} [prevF] previous forward position
 * @param {number} [prevEx] previous entity x (moving islands)
 * @param {boolean} [core] false for a lethal full-radius hazard
 */
export function hornHit(px, prevX, ex, ef, er, prevF = ef, prevEx = ex, core = true) {
  const reach = HORN_R + (core ? Math.min(10, er * 0.4) : er);
  const back = BODY_RF - SWEEP_SLACK; // slight rear slack
  const front = BODY_RF + HORN_LEN;
  const ax = prevEx - prevX, bx = ex - px;
  // Relative motion sweeps both moving targets and player. End-point capsule
  // tests plus segment crossing cover the entire path, not only its ends.
  if (segDist(ax, prevF, 0, back, 0, front) <= reach ||
      segDist(bx, ef, 0, back, 0, front) <= reach ||
      segDist(0, back, ax, prevF, bx, ef) <= reach ||
      segDist(0, front, ax, prevF, bx, ef) <= reach) return true;
  const t = -ax / (bx - ax);
  const f = prevF + (ef - prevF) * t;
  return t >= 0 && t <= 1 && f >= back && f <= front;
}

/**
 * True when the entity overlaps the body hurtbox (an ellipse smaller than
 * the drawn sprite). Lethal for the player on any hazard, and lethal on a
 * destructible only when the horn missed it.
 */
export function bodyHit(px, ex, ef, er, prevX = px, prevF = ef, prevEx = ex) {
  const rx = BODY_RX + er * 0.6, rf = BODY_RF + er * 0.6;
  return segDist(0, 0, (prevEx - prevX) / rx, prevF / rf,
    (ex - px) / rx, ef / rf) <= 1;
}
