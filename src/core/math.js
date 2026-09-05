// Small pure math helpers used across gameplay and rendering.

export const TAU = Math.PI * 2;

export const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);

export const lerp = (a, b, t) => a + (b - a) * t;

/** Smooth 0..1 ease. */
export const smooth = (t) => t * t * (3 - 2 * t);

/** Move `a` toward `b` by at most `d`. */
export const approach = (a, b, d) => (a < b ? Math.min(a + d, b) : Math.max(a - d, b));

/** Squared distance, avoids sqrt in hot paths. */
export const dist2 = (ax, ay, bx, by) => {
  const dx = ax - bx;
  const dy = ay - by;
  return dx * dx + dy * dy;
};

/**
 * Distance from point P to the segment A->B (all in the same 2D frame).
 * Returns the euclidean distance. Used for the horn capsule collision.
 */
export const segDist = (px, py, ax, ay, bx, by) => {
  const abx = bx - ax;
  const aby = by - ay;
  const len2 = abx * abx + aby * aby || 1e-6;
  let t = ((px - ax) * abx + (py - ay) * aby) / len2;
  t = t < 0 ? 0 : t > 1 ? 1 : t;
  const cx = ax + abx * t;
  const cy = ay + aby * t;
  return Math.hypot(px - cx, py - cy);
};
