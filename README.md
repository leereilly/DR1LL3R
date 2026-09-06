# UNICORN HORN DRILL

**One horn. No brakes.** An endless, single-canvas arcade game. Everything is
procedural: unicorns, skies, crystals, rainbow ribbons, particles, music and
sound effects. No runtime dependencies, downloads, images or font/audio assets.

## Play

```sh
npm ci
npm start
```

Open **http://127.0.0.1:8080/**. The server binds only to loopback.
Alternatively, extract the release ZIP and open its `index.html` directly.

> The repo's dev `index.html` loads ES modules and must be served over HTTP
> (`npm start`); opening it straight from disk via `file://` won't run. Only
> the release ZIP's `index.html` is meant to be opened directly.

- **Any key or tap** starts. **← / →**, **A / D**, mouse movement, or touch-drag
  steers. Keyboard steering takes over from the mouse.
- **Center the gold horn on glowing cores.** Side/body impacts and red spikes
  are fatal. Your visible body is larger than its hurtbox.
- **M** or the top-right speaker toggles sound; audio only unlocks on a gesture.
- A fresh press/tap restarts after **0.55 seconds**. Held controls never restart
  accidentally; a fresh press during the score-card entrance is buffered.
- Losing focus pauses the simulation; returning resumes without a time jump.

## Chase the rainbow

Distance earns points. Hits award `100 × (1 + floor(combo / 4))`. Missing a
required core breaks the combo and empties the meter; optional gold stars never
penalize. Close shaves with spikes or undrilled targets occasionally award
**+50** and a tiny slow-motion moment.

The seven-color meter fills at **28 hits**. Ribbons grow at x5/x10, glow at x15,
music layers at x20, and the meter warns at x25. **DOUBLE RAINBOW** freezes
the world briefly, reverses the drill upward for **9.5 simulation seconds**,
adds a mirrored unicorn and paired targets, doubles hit scores and speeds up
the music. Return with 14 combo and a protected approach.

Six seeded pattern families alternate calm, build, chaos and open-air relief.
Five sky palettes unfold over longer runs. Best score persists in local
storage, with an in-memory fallback if storage is blocked.

## Develop / ship

```sh
npm test           # Node built-in tests, including one hour of seeded simulation
npm run build      # esbuild → inline HTML → deterministic level-9 ZIP
unzip -t dist/unicorn-horn-drill.zip
```

`src/core/` holds physics, swept collisions, storage and seeded randomness.
`src/game/` separates state, the director, simulation, rendering, input and
WebAudio; `src/main.js` owns the fixed-step loop and browser lifecycle.
The only development dependency is locked **esbuild**.

Development-only URL options: `?seed=42&autopilot=1`, `?start=run`, `?mute=1`.
The autopilot **only steers** through the same movement/collision code; it
does not award hits. `window.__uhd` exposes development state for browser tests.
All these hooks are removed from production, and the builder checks for leaks.

The build reports source, minified, HTML and ZIP bytes and **fails at 13,000
bytes or more**. The release ZIP contains **only `index.html`**, with a fixed
1980 timestamp and no source maps or screenshots. Run the build for the exact
current byte count; the measured release size is recorded below.

Browser checks cover keyboard, mouse, emulated native touch, mute/audio unlock,
blur/resume, resize/DPR, death/restart, and both directions of Double Rainbow.
Browser runs use both real elapsed time and Playwright's clock, with steering
rather than injected hits. The desktop Double Rainbow check averaged 60 fps
(16.8 ms 95th-percentile frame interval) in local headless Chrome.
WebAudio is verified to unlock and schedule without errors; device loudness
and physical-phone performance still depend on the user's hardware.

**[Release ZIP](dist/unicorn-horn-drill.zip): 11,308 bytes** — 1,692 bytes below
the strict 13,000-byte cap. Its standalone HTML is 28,479 bytes before ZIP
compression. Repeated builds produce identical archive bytes.
