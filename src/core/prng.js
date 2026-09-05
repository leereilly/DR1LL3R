// Tiny deterministic PRNG (mulberry32). Same seed => same stream, so
// authored sequences and reachability tests stay reproducible.

/** @param {number} seed */
export function makePrng(seed) {
  let s = seed >>> 0 || 1;
  const next = () => {
    s |= 0;
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    /** float in [lo, hi) */
    range: (lo, hi) => lo + (hi - lo) * next(),
    /** int in [lo, hi] inclusive */
    int: (lo, hi) => lo + Math.floor(next() * (hi - lo + 1)),
    /** random element */
    pick: (arr) => arr[Math.floor(next() * arr.length)],
    /** +1 or -1 */
    sign: () => (next() < 0.5 ? -1 : 1),
    chance: (p) => next() < p,
  };
}
