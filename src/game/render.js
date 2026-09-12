// All Canvas2D rendering. Purely procedural: no images, no fonts beyond the
// system stack. Reads state; never mutates gameplay. Gameplay lives in a
// fixed 360x640 logical column; extra screen area is decorative parallax.

import { VW, VH, RAINBOW, BIOMES, COMBO_MAX, BAND, DEATH_LOCK, VIEW_TOP } from "../core/constants.js";
import { clamp } from "../core/math.js";

const FONT = "system-ui,-apple-system,Segoe UI,Roboto,sans-serif";
export const GAME_TITLE = "DR1LL3R";

/**
 * @param {CanvasRenderingContext2D} ctx
 * @param {any} s state
 * @param {{cssW:number,cssH:number,dpr:number,scale:number,offX:number,offY:number}} v
 * @param {number} t wall-clock seconds
 */
export function render(ctx, s, v, t) {
  const { cssW, cssH, dpr, scale, offX, offY } = v;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  const biome = BIOMES[s.director.biome % BIOMES.length];
  drawBackground(ctx, cssW, cssH, biome, s, t);

  ctx.save();
  ctx.beginPath();
  ctx.rect(offX, offY, VW * scale, VH * scale);
  ctx.clip();
  ctx.translate(offX, offY);
  ctx.scale(scale, scale);

  ctx.save();
  // Only the world shakes/zooms. HUD and its touch hit area stay fixed.
  const sh = s.cam.shake;
  const zx = (Math.random() - 0.5) * sh;
  const zy = (Math.random() - 0.5) * sh;
  ctx.translate(VW / 2, VH / 2);
  ctx.scale(s.cam.zoom, s.cam.zoom);
  ctx.translate(-VW / 2 + zx, -VH / 2 + zy + s.cam.py * s.cam.sign);

  const Y = (fz) => s.cam.anchor + s.cam.sign * (fz - s.depth);

  if (s.mode === "title") {
    drawAttract(ctx, s, t, Y);
  } else {
    drawRibbon(ctx, s, t, Y);
    drawEntities(ctx, s, Y, biome);
    drawParticles(ctx, s, Y);
    if (s.mode === "run") {
      drawUnicorn(ctx, s.player.x, s.cam.anchor, s.player.tilt, s.cam.sign, t, s.player, s);
      if (s.dr.phase === "active") drawUnicorn(ctx, VW - s.player.x, s.cam.anchor, -s.player.tilt, -1, t, s.player, s);
    }
    drawPopups(ctx, s, Y);
  }
  ctx.restore();
  if (s.mode === "title") drawTitle(ctx, s, t);
  else {
    drawHUD(ctx, s, t);
    if (s.dr.phase === "active" || s.dr.phase === "charge") drawDoubleText(ctx, s, t);
    if (s.mode === "over") drawOver(ctx, s, t);
    if (s.mode === "run" && s.maxCombo < 3) {
      label(ctx, "CENTER THE HORN", 180, 116, 12, "#ffe4a3");
      label(ctx, "↓", 180, 142, 20, "#ffe4a3");
    }
  }
  drawMute(ctx, s);
  if (s.paused && s.mode === "run") {
    ctx.fillStyle = "#0b1429aa"; ctx.fillRect(0, 0, VW, VH);
    label(ctx, "HOLD THAT HORN", 180, 300, 25, "#fff");
    label(ctx, "RETURN TO CONTINUE", 180, 330, 11, "#ffe4a3");
  }

  // impact flash
  if (s.fx.flash > 0.01) {
    ctx.globalAlpha = s.fx.flash * 0.7;
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, VW, VH);
    ctx.globalAlpha = 1;
  }
  drawVignette(ctx);
  ctx.restore();
}

// --- Background -----------------------------------------------------------

function drawBackground(ctx, w, h, biome, s, t) {
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, biome.top);
  g.addColorStop(1, biome.bot);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);

  // parallax dots (stars / bokeh) scrolling with depth
  const d = (s.mode === "title" ? t * 16 : -s.depth * s.cam.sign) * 0.25;
  ctx.fillStyle = biome.fog;
  for (let i = 0; i < 60; i++) {
    const px = (i * 97.13) % w;
    const py = (((i * 53.7 + d * (1 + (i % 3) * 0.4)) % (h + 40) + h + 40) % (h + 40)) - 20;
    const r = (i % 3) * 0.6 + 0.5;
    ctx.globalAlpha = 0.12 + (i % 4) * 0.05;
    ctx.beginPath(); ctx.arc(px, py, r, 0, 7); ctx.fill();
  }
  ctx.globalAlpha = 1;
  // Broad, quiet cloudbanks and floating landforms give the tiny playfield
  // depth without competing with the saturated interactive cores.
  for (let i = 0; i < 9; i++) {
    const x = ((i * 293.7) % (w + 220)) - 100;
    const y = ((i * 197 + d * 0.5) % (h + 240) + h + 240) % (h + 240) - 120;
    ctx.fillStyle = biome.fog; ctx.globalAlpha = 0.045 + i % 3 * 0.018;
    for (let j = 0; j < 4; j++) ellipse(ctx, x + j * 42, y + Math.sin(j * 2) * 14, 70, 26);
    ctx.beginPath(); ctx.moveTo(x - 25, y + 20); ctx.lineTo(x + 85, y + 20);
    ctx.lineTo(x + 35, y + 95); ctx.closePath(); ctx.fill();
  }
  ctx.globalAlpha = 1;

  // rare horned moon cameo in darker biomes
  if (s.director.biome >= 3 || s.dr.phase === "active") {
    const mx = w * 0.5 + Math.sin(s.depth * 0.001) * w * 0.2;
    const my = h * 0.22;
    ctx.globalAlpha = 0.5;
    ctx.fillStyle = "#f7f0d8";
    ctx.beginPath(); ctx.arc(mx, my, 34, 0, 7); ctx.fill();
    ctx.fillStyle = "#b2a5c1"; ellipse(ctx, mx - 17, my - 15, 7, 5);
    ellipse(ctx, mx + 13, my + 17, 9, 6);
    ctx.fillStyle = "#ffd21e";
    ctx.beginPath(); ctx.moveTo(mx - 5, my - 30); ctx.lineTo(mx + 6, my - 65);
    ctx.lineTo(mx + 5, my - 30); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = "#504365"; ctx.lineWidth = 2;
    for (const x of [-10, 10]) {
      ctx.beginPath(); ctx.arc(mx + x, my, 3, 0, Math.PI); ctx.stroke();
    }
    ctx.beginPath(); ctx.arc(mx, my + 7, 7, 0.2, 2.9); ctx.stroke();
    ctx.globalAlpha = 1;
  }

  // speed lines during fast/DR
  if (s.dr.phase === "active") {
    ctx.globalAlpha = 0.06;
    for (let i = 0; i < 7; i++) {
      ctx.fillStyle = RAINBOW[i];
      ctx.beginPath(); ctx.moveTo(w / 2, h / 2);
      ctx.lineTo(i * w / 6 - 100, 0); ctx.lineTo(i * w / 6 + 100, h);
      ctx.closePath(); ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.strokeStyle = "rgba(255,255,255,0.15)"; ctx.lineWidth = 2;
    for (let i = 0; i < 12; i++) {
      const x = (i * 131 + (t * 400 % w)) % w;
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
    }
  }
}

function drawVignette(ctx) {
  const g = ctx.createRadialGradient(VW / 2, VH / 2, VH * 0.35, VW / 2, VH / 2, VH * 0.72);
  g.addColorStop(0, "rgba(0,0,0,0)");
  g.addColorStop(1, "rgba(0,0,0,0.42)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, VW, VH);
}

// --- Rainbow ribbon -------------------------------------------------------

function drawRibbon(ctx, s, t, Y) {
  const rb = s.fx.ribbon;
  if (rb.length < 2) return;
  const tier = s.combo >= 15 ? 3 : s.combo >= 10 ? 2 : s.combo >= 5 ? 1 : 0;
  const dr = s.dr.phase === "active";
  const baseW = dr ? 5.8 : tier >= 2 ? 2.8 : 1.5;
  const spread = dr ? 5.3 : 1.7 + tier * 0.6;

  const streams = dr ? [1, -1] : [0];
  for (const mir of streams) {
    for (let c = 0; c < 7; c++) {
      ctx.beginPath();
      for (let i = 0; i < rb.length; i++) {
        const p = rb[i];
        const age = dr ? Math.min(1, (s.depth - p.d) / 220) : 1 - i / rb.length;
        const wob = Math.sin(p.d * 0.018 + t * 2) * age * (dr ? 110 : 8);
        const off = (c - 3) * spread + wob;
        let x = p.x + off;
        if (mir === -1) x = VW - x;
        const y = Y(p.d) - s.cam.sign * 26;
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.strokeStyle = RAINBOW[c];
      ctx.globalAlpha = tier === 0 && !dr ? 0.12 : 0.82;
      ctx.lineWidth = baseW;
      ctx.lineJoin = "round"; ctx.lineCap = "round";
      ctx.shadowColor = RAINBOW[c]; ctx.shadowBlur = dr ? 12 : tier >= 3 ? 5 : 0;
      ctx.stroke();
    }
  }
  ctx.shadowBlur = 0;
  for (let i = 0; i < rb.length; i += 13) {
    const p = rb[i];
    ctx.globalAlpha = 0.6;
    ctx.fillStyle = RAINBOW[i % 7];
    ellipse(ctx, p.x + Math.sin(i + t * 4) * 16, Y(p.d) - s.cam.sign * 26, 1.2, 2.4);
  }
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = "source-over";
}

// --- Entities -------------------------------------------------------------

function drawEntities(ctx, s, Y, biome) {
  for (const e of s.entities) {
    if (!e.alive) continue;
    const y = Y(e.fz);
    if (y < VIEW_TOP || y > VH + 40) continue;
    if (e.kind === "hazard") drawHazard(ctx, e.x, y, e.r);
    else drawTarget(ctx, e.x, y, e.r, e.optional, e.skin);
  }
}

function drawTarget(ctx, x, y, r, optional, skin = 0) {
  // soft outer glow
  const g = ctx.createRadialGradient(x, y, 1, x, y, r * 1.5);
  const c = optional ? "#ffe27a" : "#eafcff";
  g.addColorStop(0, "#ffffff");
  g.addColorStop(0.5, c);
  g.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(x, y, r * 1.5, 0, 7); ctx.fill();
  // body
  ctx.fillStyle = optional ? "#ffd257" : skin === 1 ? "#a4d8cd" : "#d4e6f3";
  ctx.strokeStyle = "#ffffff80"; ctx.lineWidth = 1;
  ctx.save(); ctx.translate(x, y);
  if (skin === 0) {
    for (let i = -1; i <= 1; i++) ellipse(ctx, i * r * 0.55, i === 0 ? -r * 0.2 : 0, r * 0.65, r * 0.62);
  } else {
    ctx.beginPath();
    const sides = optional ? 10 : 6;
    for (let i = 0; i < sides; i++) {
      const a = i / sides * Math.PI * 2 - Math.PI / 2;
      const rr = optional && i % 2 ? r * 0.5 : r;
      ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
    }
    ctx.closePath(); ctx.fill(); ctx.stroke();
    if (skin === 1) {
      ctx.fillStyle = "#63859e"; ctx.beginPath(); ctx.moveTo(-r, 0);
      ctx.lineTo(0, r * 1.25); ctx.lineTo(r, 0); ctx.closePath(); ctx.fill();
    }
  }
  ctx.restore();
  // safe diamond core
  ctx.fillStyle = "#fff6ba"; ctx.shadowColor = "#ffec8a"; ctx.shadowBlur = 8;
  ctx.save(); ctx.translate(x, y); ctx.rotate(Math.PI / 4);
  const d = r * 0.34;
  ctx.fillRect(-d, -d, d * 2, d * 2);
  ctx.restore();
  ctx.shadowBlur = 0;
  ctx.strokeStyle = "#edc964"; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.arc(x, y, r * 0.43, 0, 7); ctx.stroke();
}

function drawHazard(ctx, x, y, r) {
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = "#1a1020";
  ctx.strokeStyle = "#ff3b5c"; ctx.lineWidth = 2.5;
  ctx.beginPath();
  const spikes = 8;
  for (let i = 0; i < spikes * 2; i++) {
    const rr = i % 2 ? r * 0.5 : r * 1.05;
    const a = (i / (spikes * 2)) * Math.PI * 2;
    const px = Math.cos(a) * rr, py = Math.sin(a) * rr;
    if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
  }
  ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.strokeStyle = "#ff8591"; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(-4, -4); ctx.lineTo(4, 4);
  ctx.moveTo(4, -4); ctx.lineTo(-4, 4); ctx.stroke();
  ctx.restore();
}

function drawParticles(ctx, s, Y) {
  if (s.fx.shock > 0) {
    const f = s.fx;
    ctx.globalAlpha = f.shock * 2;
    ctx.strokeStyle = "#fff5ca"; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(f.shockX, Y(f.shockFz), f.shockR + (0.28 - f.shock) * 125, 0, 7); ctx.stroke();
  }
  for (const q of s.fx.parts) {
    const a = clamp(q.life / q.max, 0, 1);
    ctx.globalAlpha = a;
    ctx.fillStyle = q.col;
    const y = Y(q.fz);
    ctx.save(); ctx.translate(q.x, y); ctx.rotate(q.rot);
    ctx.fillRect(-q.size, -q.size / 3, q.size * 2, q.size * 0.7);
    ctx.restore();
  }
  ctx.globalAlpha = 1;
}

function drawPopups(ctx, s, Y) {
  ctx.textAlign = "center";
  for (const p of s.fx.pops) {
    const a = clamp(p.life / p.max, 0, 1);
    const rise = (1 - a) * 22;
    ctx.globalAlpha = a;
    ctx.fillStyle = p.col;
    ctx.font = "800 16px " + FONT;
    ctx.fillText(p.txt, p.x, Y(p.fz) - rise);
  }
  ctx.globalAlpha = 1;
}

// --- Unicorn --------------------------------------------------------------

// Side profile of a horse diving horn-first: +y is forward (the drill
// direction), +x is the belly side, -x the spine. Every offset below is in
// that frame, so the whole rig flips cleanly for the mirrored Double Rainbow.
function drawUnicorn(ctx, x, y, tilt, sign, t, pl, s) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(1, sign); // flip vertically so the horn always leads the drill
  ctx.rotate(tilt * 0.12);
  const sq = pl.squash || 0;
  ctx.scale(1 + sq * 0.14, 1 - sq * 0.07);
  const flow = Math.sin(t * 7) * 7; // mane and tail ripple
  ctx.lineCap = "round"; ctx.lineJoin = "round";

  // rainbow tail streaming off the rump (up-screen), four bands only
  ctx.lineWidth = 5;
  for (let c = 0; c < 4; c++) {
    ctx.strokeStyle = RAINBOW[c * 2];
    ctx.beginPath();
    ctx.moveTo(-6, -32);
    ctx.quadraticCurveTo(-27 + flow * 0.5, -50, -11 + c * 5, -66);
    ctx.stroke();
  }

  // two leg marks, drawn under the barrel
  ctx.strokeStyle = "#c3cce4"; ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(-6, -28); ctx.lineTo(-17, -37);
  ctx.moveTo(5, -8); ctx.lineTo(14, 1);
  ctx.stroke();

  // one barrel and a slim neck sweeping forward into the head
  ctx.fillStyle = "#fdf9f5";
  ellipse(ctx, -2, -23, 12, 18);
  ctx.beginPath();
  ctx.moveTo(-6, -16);
  ctx.quadraticCurveTo(-8, 0, -4, 11);
  ctx.lineTo(5, 9);
  ctx.quadraticCurveTo(7, -6, 6, -18);
  ctx.closePath(); ctx.fill();

  // rainbow mane along the crest of the neck
  ctx.lineWidth = 4;
  for (let c = 0; c < 4; c++) {
    ctx.strokeStyle = RAINBOW[c * 2];
    ctx.beginPath();
    ctx.moveTo(-5 - c, 6);
    ctx.quadraticCurveTo(-12 - c + flow * 0.3, -8, -8 - c, -24);
    ctx.stroke();
  }

  // single swept-back ear, then head and muzzle over its base
  ctx.fillStyle = "#fdf9f5";
  ctx.beginPath();
  ctx.moveTo(-4, 13); ctx.lineTo(-15, 3); ctx.lineTo(-1, 6);
  ctx.closePath(); ctx.fill();
  ellipse(ctx, 2, 16, 7.5, 10);
  ellipse(ctx, 7, 25, 5.5, 4.5);

  // eye (expressive; widens on near miss)
  ctx.fillStyle = "#242744"; ellipse(ctx, 5, 15, 2.3, 2.8 + pl.eye * 2);

  // absurd oversized gold horn, pointing forward (down in local space),
  // base at the brow and tip at the collision reach
  ctx.fillStyle = "#ffd21e";
  ctx.beginPath();
  ctx.moveTo(-8, 18); ctx.lineTo(4, 18); ctx.lineTo(-2, 60);
  ctx.closePath(); ctx.fill();
  ctx.fillStyle = "#fff2b0";
  ctx.beginPath();
  ctx.moveTo(-8, 18); ctx.lineTo(-3, 18); ctx.lineTo(-2, 60);
  ctx.closePath(); ctx.fill();

  ctx.restore();
}

function ellipse(ctx, x, y, rx, ry) {
  ctx.save(); ctx.translate(x, y); ctx.scale(rx, ry);
  ctx.beginPath(); ctx.arc(0, 0, 1, 0, 7); ctx.restore(); ctx.fill();
}

function label(ctx, txt, x, y, size, col) {
  ctx.textAlign = "center"; ctx.font = "800 " + size + "px " + FONT;
  ctx.fillStyle = col; ctx.fillText(txt, x, y);
}

// --- HUD ------------------------------------------------------------------

function drawHUD(ctx, s, t) {
  ctx.textAlign = "left";
  ctx.fillStyle = "#fff";
  ctx.font = "900 32px " + FONT;
  ctx.fillText(String(Math.round(s.score)), 14, 39);
  ctx.font = "700 11px " + FONT;
  ctx.fillStyle = "rgba(255,255,255,0.7)";
  ctx.fillText("SCORE", 15, 54);

  // combo center
  ctx.textAlign = "center";
  if (s.combo > 0) {
    ctx.fillStyle = RAINBOW[Math.min(6, Math.floor(s.combo / BAND))];
    ctx.font = "900 25px " + FONT;
    const pulse = 1 + Math.sin(t * 12) * (s.combo >= 24 ? 0.12 : 0.03);
    ctx.save(); ctx.translate(279, 54); ctx.scale(pulse, pulse);
    ctx.fillText("x" + s.combo, 0, 0); ctx.restore();
  }

  // best top-right
  ctx.textAlign = "right";
  ctx.fillStyle = "rgba(255,255,255,0.85)";
  ctx.font = "800 10px " + FONT;
  ctx.fillText("BEST " + Math.round(s.best), VW - 51, 20);

  // 7-color meter
  drawMeter(ctx, s);
  if (s.dr.phase !== "active") label(ctx, ["HIGH SKY", "AFTERGLOW", "STORM CHASER", "STAR STRUCK", "RAINBOW VOID"][s.director.biome], 180, 91, 9, "#ffffff70");
}

function drawMeter(ctx, s) {
  const x0 = 14, y0 = 68, w = 332, seg = w / 7, h = 5;
  for (let c = 0; c < 7; c++) {
    const filled = clamp((s.combo - c * BAND) / BAND, 0, 1);
    ctx.fillStyle = "rgba(255,255,255,0.15)";
    ctx.fillRect(x0 + c * seg, y0, seg - 2, h);
    if (filled > 0) {
      ctx.fillStyle = RAINBOW[c];
      ctx.globalAlpha = 0.5 + filled * 0.5;
      ctx.fillRect(x0 + c * seg, y0, (seg - 2) * filled, h);
      ctx.globalAlpha = 1;
    }
  }
  if (s.combo >= COMBO_MAX - 4) {
    ctx.strokeStyle = "#fff"; ctx.lineWidth = 1;
    ctx.strokeRect(x0 - 1, y0 - 1, w + 1, h + 2);
  }
}

function drawMute(ctx, s) {
  const x = VW - 26, y = 12, sz = 16;
  ctx.fillStyle = "rgba(255,255,255,0.85)";
  ctx.beginPath();
  ctx.moveTo(x, y + 5); ctx.lineTo(x + 5, y + 5); ctx.lineTo(x + 10, y);
  ctx.lineTo(x + 10, y + sz); ctx.lineTo(x + 5, y + 11); ctx.lineTo(x, y + 11);
  ctx.closePath(); ctx.fill();
  ctx.strokeStyle = "rgba(255,255,255,0.85)"; ctx.lineWidth = 2;
  if (s.input.muted) {
    ctx.beginPath(); ctx.moveTo(x + 12, y + 3); ctx.lineTo(x + 18, y + 13); ctx.stroke();
  } else {
    ctx.beginPath(); ctx.arc(x + 12, y + 8, 4, -0.8, 0.8); ctx.stroke();
  }
}

/** client point -> true if over mute button (in logical space) */
export function muteHit(v, cx, cy) {
  const lx = (cx - v.rectLeft - v.offX) / v.scale;
  const ly = (cy - v.rectTop - v.offY) / v.scale;
  return lx >= VW - 46 && lx <= VW && ly >= 0 && ly <= 44;
}

// --- Double Rainbow typography -------------------------------------------

function drawDoubleText(ctx, s, t) {
  const stage = s.dr.stage;
  if (s.dr.phase === "active" && s.dr.t < 7.5) {
    label(ctx, "DOUBLE RAINBOW", 180, 96, 17, "#fff0bc");
    ctx.fillStyle = "#fff0bc"; ctx.fillRect(130, 107, 100 * s.dr.t / 9.5, 2);
    return;
  }
  ctx.textAlign = "center";
  ctx.globalCompositeOperation = "lighter";
  const words = stage >= 2 ? ["DOUBLE", "RAINBOW"] : ["DOUBLE", ""];
  const sizes = [49, 45];
  for (let i = 0; i < 2; i++) {
    if (!words[i]) continue;
    ctx.font = "900 " + sizes[i] + "px " + FONT;
    const yy = VH * 0.4 + i * 52;
    for (let c = 0; c < 7; c++) {
      ctx.fillStyle = RAINBOW[c];
      ctx.globalAlpha = 0.25;
      ctx.fillText(words[i], VW / 2 + Math.cos(t * 3 + c) * 3, yy + Math.sin(t * 3 + c) * 3);
    }
  }
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = "source-over";
  label(ctx, stage >= 2 ? "TWO HORNS. ZERO BRAKES." : "THE SKY IS YOURS.", 180, 376, 10, "#fff");
}

// --- Title / attract ------------------------------------------------------

function drawAttract(ctx, s, t, Y) {
  // a lazily weaving demo unicorn + ribbon behind the title
  const x = VW / 2 + Math.sin(t * 1.2) * 62;
  ctx.save();
  for (let c = 0; c < 7; c++) {
    ctx.strokeStyle = RAINBOW[c]; ctx.lineWidth = 4; ctx.globalAlpha = 0.32;
    ctx.beginPath();
    for (let i = 0; i < 80; i++) {
      const past = t - (79 - i) / 60;
      const yy = VH * 0.7 - (t - past) * 108;
      const xx = VW / 2 + Math.sin(past * 1.2) * 62 + (c - 3) * 3 + Math.sin(past * 6 + c) * 3;
      if (i === 0) ctx.moveTo(xx, yy); else ctx.lineTo(xx, yy);
    }
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
  ctx.restore();
  ctx.save(); ctx.translate(x, VH * 0.69); ctx.scale(1.35, 1.35);
  drawUnicorn(ctx, 0, 0, Math.cos(t * 1.2) * 0.4, 1, t, { hurt: 0, eye: 0 }, s);
  ctx.restore();
}

function drawTitle(ctx, s, t) {
  ctx.textAlign = "center";
  const cx = VW / 2;
  label(ctx, "ONE HORN. NO BRAKES.", cx, 67, 11, "#a5b8d2");
  ctx.font = "italic 900 62px " + FONT;
  for (let c = 0; c < 7; c++) {
    ctx.fillStyle = RAINBOW[c]; ctx.globalAlpha = 0.7;
    ctx.fillText(GAME_TITLE, cx - (7 - c) * 0.8, 223 + (7 - c) * 1.5);
  }
  ctx.globalCompositeOperation = "source-over";
  ctx.globalAlpha = 1;
  ctx.fillStyle = "#fff";
  ctx.fillText(GAME_TITLE, cx, 223);
  ctx.font = "800 18px " + FONT;
  ctx.fillStyle = "#ffd21e";
  ctx.fillText("\u2193 DRILL EVERYTHING \u2193", cx, 342);

  ctx.globalAlpha = 0.8 + Math.sin(t * 4) * 0.2;
  label(ctx, "PRESS ANY KEY", cx, 584, 16, "#fff");
  ctx.globalAlpha = 1;
  label(ctx, "← → / A D  ·  MOVE / DRAG", cx, 609, 10, "#a5b8d2");
}

function drawOver(ctx, s, t) {
  ctx.fillStyle = "rgba(6,4,14,0.55)";
  ctx.fillRect(0, 0, VW, VH);
  ctx.textAlign = "center";
  const cx = VW / 2;
  ctx.font = "900 26px " + FONT;
  ctx.globalCompositeOperation = "lighter";
  for (let c = 0; c < 7; c++) {
    ctx.fillStyle = RAINBOW[c]; ctx.globalAlpha = 0.2;
    ctx.fillText(s.deathMsg, cx + Math.cos(t * 2 + c) * 2, VH * 0.33 + Math.sin(t * 2 + c) * 2);
  }
  ctx.globalCompositeOperation = "source-over"; ctx.globalAlpha = 1;
  ctx.fillStyle = "#fff";
  ctx.fillText(s.deathMsg, cx, VH * 0.33);
  label(ctx, s.deathMsg.includes("SPIKE") ? "AVOID THE RED SPIKES" : "SIDE IMPACT — CENTER THE HORN", cx, 244, 11, "#d4c3db");
  label(ctx, String(Math.round(s.score)), cx, 335, 60, "#fff");
  label(ctx, "BEST " + Math.round(s.best), cx, 370, 16, "#ffd21e");
  label(ctx, "ONE MORE DESCENT?", cx, 460, 11, "#d4c3db");
  if (s.deathT >= DEATH_LOCK && Math.sin(t * 4) > -0.3) {
    ctx.fillStyle = "#fff"; ctx.font = "800 16px " + FONT;
    ctx.fillText("PRESS ANY KEY / TAP", cx, VH - 60);
  }
}
