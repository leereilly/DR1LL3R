# UNICORN HORN DRILL

A tiny browser arcade game. Steer a unicorn, drill through glowing cores,
and dodge spikes. Graphics and audio are generated in code, with no runtime
dependencies.

## Play

```sh
npm ci
npm start
```

Open http://127.0.0.1:8080/.

Or download the [release ZIP](dist/unicorn-horn-drill.zip), extract it, and open
`index.html`. The source version needs `npm start`; it cannot run directly from disk.

## Controls

- Press any key or tap to start or restart.
- Use left/right arrows, A/D, mouse movement, or touch-drag to steer.
- Line up your horn with glowing cores. Body hits and red spikes end the run.
- Press M or tap the speaker to toggle sound.

Chain 28 hits to trigger Double Rainbow: fly upward with a second unicorn and
earn double hit scores for 9.5 seconds. Missing a core resets your combo.
After the first Double Rainbow, descent stays 6% faster for the rest of the run.
Your best score is saved locally.

## Development

```sh
npm test
npm run build
```

The build uses esbuild to produce `dist/unicorn-horn-drill.zip` containing a
standalone `index.html`. It fails if the ZIP reaches 13,000 bytes.

Development URL options: `?seed=42&autopilot=1`, `?start=run`, and `?mute=1`.
These and the `window.__uhd` debug hook are removed from release builds.
