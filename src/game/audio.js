// Compact WebAudio: oscillator tones, filtered-noise bursts, and a tiny
// tiered music sequencer. Everything degrades silently if AudioContext is
// unavailable or blocked. Only starts after the first trusted input.

export function createAudio(state) {
  /** @type {AudioContext|null} */
  let ac = null;
  let master = null;
  let noiseBuf = null;
  let nextBeat = 0;
  let beat = 0;

  function ensure() {
    if (ac || typeof AudioContext === "undefined") return;
    try { ac = new AudioContext(); }
    catch { return; } // unavailable device or browser policy
      master = ac.createGain();
      master.gain.value = state.input.muted ? 0 : 0.9;
      master.connect(ac.destination);
      const n = ac.sampleRate * 0.4;
      noiseBuf = ac.createBuffer(1, n, ac.sampleRate);
      const ch = noiseBuf.getChannelData(0);
      for (let i = 0; i < n; i++) ch[i] = Math.random() * 2 - 1;
  }

  function tone(freq, dur, type, gain, when, glide) {
    if (!ac) return;
    const o = ac.createOscillator();
    const g = ac.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, when);
    if (glide) o.frequency.exponentialRampToValueAtTime(Math.max(20, glide), when + dur);
    g.gain.setValueAtTime(0.0001, when);
    g.gain.exponentialRampToValueAtTime(gain, when + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, when + dur);
    o.connect(g); g.connect(master);
    o.start(when); o.stop(when + dur + 0.02);
  }

  function noise(dur, gain, when, cut) {
    if (!ac || !noiseBuf) return;
    const src = ac.createBufferSource();
    src.buffer = noiseBuf;
    const f = ac.createBiquadFilter();
    f.type = "bandpass"; f.frequency.value = cut;
    const g = ac.createGain();
    g.gain.setValueAtTime(gain, when);
    g.gain.exponentialRampToValueAtTime(0.0001, when + dur);
    src.connect(f); f.connect(g); g.connect(master);
    src.start(when); src.stop(when + dur);
  }

  function play(ev, t) {
    switch (ev.type) {
      case "hit": {
        const f = 200 + (ev.combo || 1) * 26;
        tone(f, 0.09, "square", 0.22, t, f * 0.5);
        noise(0.06, 0.3, t, 1200 + (ev.combo || 0) * 60);
        break;
      }
      case "near": tone(1500, 0.14, "sine", 0.14, t, 2200); break;
      case "miss": tone(150, 0.16, "sawtooth", 0.12, t, 80); break;
      case "charge": tone(400, 0.5, "sine", 0.16, t, 1600); break;
      case "dr":
        for (let i = 0; i < 4; i++) tone(330 * Math.pow(2, i / 4), 0.5, "triangle", 0.16, t + i * 0.05, 660);
        break;
      case "drexit": tone(880, 0.4, "sine", 0.16, t, 220); break;
      case "best":
        for (let i = 0; i < 3; i++) tone(660 * 2 ** (i / 3), 0.18, "sine", 0.1, t + i * 0.12);
        break;
      case "death":
        noise(0.5, 0.4, t, 400);
        for (let i = 0; i < 7; i++) tone(600 - i * 60, 0.5, "sawtooth", 0.12, t + i * 0.04, 120);
        break;
    }
  }

  // Tiered pentatonic pulse; more layers as combo/mode escalate.
  const SCALE = [0, 3, 5, 7, 10];
  function music(t) {
    const tier = state.audio.tier;
    if (tier === 0 && state.mode !== "run") return;
    const dr = state.dr.phase === "active";
    const oct = dr ? 2 : 1;
    const root = 220 * oct;
    const step = SCALE[beat % SCALE.length];
    const f = root * Math.pow(2, step / 12);
    tone(f, 0.18, "triangle", 0.05, t);
    if (tier >= 2) tone(f * 1.5, 0.12, "sine", 0.03, t + 0.05);
    if (tier >= 3 || dr) tone(f * 0.5, 0.22, "sawtooth", 0.035, t);
    if (tier >= 2 && beat % 2 === 0) tone(105, 0.12, "sine", 0.13, t, 38);
    if (tier >= 3 || dr) noise(0.035, 0.06, t + 0.08, 6500);
    beat++;
  }

  return {
    unlock() {
      ensure();
      if (ac && ac.state === "suspended") {
        ac.resume().then(() => { state.audio.unlocked = true; }, () => { state.audio.unlocked = false; });
      } else if (ac) state.audio.unlocked = true;
    },
    setMuted(m) { if (master) master.gain.value = m ? 0 : 0.9; },
    pump() {
      if (!ac || ac.state !== "running" || state.paused) { state.audio.queue.length = 0; return; }
      const now = ac.currentTime;
      const q = state.audio.queue;
      if (!state.input.muted) for (const ev of q) play(ev, now);
      q.length = 0;
      if (!state.input.muted && (state.mode === "run")) {
        const interval = state.dr.phase === "active" ? 0.15 : 0.3;
        if (nextBeat < now) nextBeat = now;
        while (nextBeat < now + 0.2) { music(nextBeat); nextBeat += interval; }
      } else {
        nextBeat = now;
      }
    },
  };
}
