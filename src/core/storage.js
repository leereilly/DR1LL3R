// Best-score persistence that never throws, even when localStorage is
// blocked (private mode, denied storage, sandboxed iframe). Falls back to
// an in-memory value so the run still tracks a session best.

const KEY = "uhd_best";
let memoryBest = 0;

/** @param {Storage|undefined|null} store */
export function loadBest(store) {
  try {
    const s = store ?? (typeof window !== "undefined" ? window.localStorage : null);
    if (!s) return memoryBest;
    const raw = s.getItem(KEY);
    const n = raw == null ? 0 : parseInt(raw, 10);
    if (Number.isFinite(n) && n > 0) memoryBest = Math.max(memoryBest, n);
    return memoryBest;
  } catch {
    return memoryBest;
  }
}

/** @param {number} value @param {Storage|undefined|null} store */
export function saveBest(value, store) {
  memoryBest = Math.max(memoryBest, Number.isFinite(value) ? Math.round(value) : 0);
  try {
    const s = store ?? (typeof window !== "undefined" ? window.localStorage : null);
    if (s) s.setItem(KEY, String(memoryBest));
  } catch {
    /* storage denied — memoryBest already holds the value */
  }
  return memoryBest;
}
