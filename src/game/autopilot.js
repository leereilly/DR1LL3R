// Development-only steering. Never awards hits or changes simulation time.
export function drive(s) {
  if (s.mode !== "run") return;
  const double = s.dr.phase === "active";
  const speed = s.speed * (double ? 1.4 : 1);
  const targets = s.entities.filter(e => e.alive && e.kind !== "hazard" &&
    (double || e.required) && e.fz - s.depth > -10);
  targets.sort((a, b) => a.fz - b.fz || Math.abs(a.x - s.player.x) - Math.abs(b.x - s.player.x));
  const e = targets[0];
  if (!e) return;
  const until = Math.max(0, (e.fz - s.depth - 65) / speed);
  s.input.aim = true;
  s.input.aimX = e.baseX + (e.amp || 0) * Math.sin((s.time + until) * e.w + e.phase);
}
