import { ACCEL, MAX_VX, DAMP, VW } from "./constants.js";
import { approach, clamp } from "./math.js";

/** Shared by the live simulation and reachability checks. */
export function move(p, aimX, keys, dt) {
  const target = keys ? keys * MAX_VX : aimX == null ? 0 : clamp((aimX - p.x) * 12, -MAX_VX, MAX_VX);
  p.vx = approach(p.vx, target, ACCEL * dt);
  if (!target) p.vx = approach(p.vx, 0, DAMP * Math.abs(p.vx) * dt + 4);
  p.x += p.vx * dt;
  if (p.x < 12 || p.x > VW - 12) { p.x = clamp(p.x, 12, VW - 12); p.vx = 0; }
}
