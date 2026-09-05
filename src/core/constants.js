// Central tunables. Everything the simulation needs lives here so gameplay
// feel is easy to read and adjust, and so the build can constant-fold them.

// Fixed logical playfield. Extra landscape width is decorative only, which
// keeps target reachability identical across devices.
export const VW = 360;
export const VH = 640;

// Fixed-step simulation.
export const STEP = 1 / 60;
export const MAX_STEPS = 5; // catch-up cap so a blur/resume never blurs forward

// Player anchor on screen (upper-middle normal, mirrored in Double Rainbow).
export const ANCHOR_N = VH * 0.3;
export const ANCHOR_R = VH - ANCHOR_N;

// Movement feel: strong accel, tiny carry.
export const ACCEL = 2800;
export const MAX_VX = 300;
export const DAMP = 10;

// Player collision geometry, in the forward/lateral frame (player at f=0).
export const BODY_RF = 16; // deliberately smaller than the visible body
export const BODY_RX = 16;
export const HORN_LEN = 42; // horn reach ahead of the body front
export const HORN_R = 9; // generous swept core radius
export const SWEEP_SLACK = 10; // rear forward slack for fast crossings

// World scroll speed (forward px/s) and difficulty ramp.
export const SPEED_BASE = 205;
export const SPEED_MAX = 360;
export const SPEED_RAMP = 3.4; // px/s added per second of run time
export const DR_SPEED_MUL = 1.4; // Double Rainbow is faster

// Scoring.
export const DIST_SCORE = 0.09; // score per forward px
export const HIT_BASE = 100;
export const NEAR_BONUS = 50;
export const NEAR_DIST = 20; // extra lateral margin that counts as a near miss
export const NEAR_COOLDOWN = 0.35;

// Combo / rainbow meter.
export const COMBO_MAX = 28; // 7 colors x 4 hits
export const BAND = 4;
export const COLORS = 7;

// Double Rainbow.
export const DR_CHARGE = 0.15; // activation hold before the flip
export const DR_TIME = 9.5; // active seconds
export const DR_EXIT_COMBO = 14; // retained heat on exit
export const DR_SCORE_MUL = 2; // base point multiplier during the mode

// Timing juice.
export const HITSTOP = 0.03; // 30 ms freeze on a clean hit
export const DEATH_LOCK = 0.55; // measured from impact, not from the score card

// The seven rainbow colors, top band first.
export const RAINBOW = [
  "#ff3b3b",
  "#ff9f1c",
  "#ffd21e",
  "#38d430",
  "#2bb7ff",
  "#5b5bff",
  "#b95cff",
];

// Biome palettes cycled by the director. [sky top, sky bottom, accent].
export const BIOMES = [
  { name: "sky", top: "#101e37", bot: "#294d65", fog: "#bfe3ff" },
  { name: "sunset", top: "#3a1d54", bot: "#c9506b", fog: "#ffcf9e" },
  { name: "storm", top: "#0e1524", bot: "#37425e", fog: "#9fb4d8" },
  { name: "space", top: "#05060f", bot: "#141033", fog: "#8f7bd8" },
  { name: "void", top: "#0a0018", bot: "#2a0a3a", fog: "#ff9ff0" },
];
