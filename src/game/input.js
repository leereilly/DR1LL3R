// Browser input wiring. Maintains steering state on `state.input` and a
// single consumable `pressEdge` that only fires on a genuine neutral->press
// transition, so a key held across death can never auto-restart. Mute is
// handled separately (M key + on-canvas button) and never starts the game.

/**
 * @param {any} state
 * @param {HTMLElement} canvas
 * @param {(clientX:number)=>number} mapX client px -> logical x
 * @param {(cx:number,cy:number)=>boolean} hitMute is a client point on the mute button
 * @param {()=>void} onMute
 * @param {()=>void} onFirstInput audio unlock on first trusted gesture
 */
export function attachInput(state, canvas, mapX, hitMute, onMute, onFirstInput) {
  const down = new Set();
  const press = (id) => {
    const was = down.size;
    down.add(id);
    state.input.held = true;
    if (was === 0) state.input.pressEdge = true;
  };
  const release = (id) => { down.delete(id); state.input.held = down.size > 0; };
  const isMuteBtn = hitMute;

  addEventListener("keydown", (e) => {
    if (e.repeat) return;
    if (e.isTrusted) onFirstInput();
    const c = e.code;
    if (c === "KeyM") { onMute(); return; }
    state.input.aim = false;
    if (c === "ArrowLeft" || c === "KeyA") state.input.left = true;
    if (c === "ArrowRight" || c === "KeyD") state.input.right = true;
    if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Space"].includes(c)) e.preventDefault();
    press("k:" + c);
  });
  addEventListener("keyup", (e) => {
    const c = e.code;
    release("k:" + c);
    state.input.left = down.has("k:ArrowLeft") || down.has("k:KeyA");
    state.input.right = down.has("k:ArrowRight") || down.has("k:KeyD");
  });

  canvas.addEventListener("pointerdown", (e) => {
    if (e.isTrusted) onFirstInput();
    if (isMuteBtn(e.clientX, e.clientY)) { onMute(); return; }
    canvas.setPointerCapture?.(e.pointerId);
    state.input.aim = true;
    state.input.aimX = mapX(e.clientX);
    press("p:" + e.pointerId);
  });
  canvas.addEventListener("pointermove", (e) => {
    if (e.pointerType === "mouse") {
      state.input.aim = true;
      state.input.aimX = mapX(e.clientX);
    } else if (down.has("p:" + e.pointerId)) {
      state.input.aim = true;
      state.input.aimX = mapX(e.clientX);
    }
  });
  const end = (e) => {
    release("p:" + e.pointerId);
    if (e.pointerType !== "mouse" && ![...down].some(id => id.startsWith("p:"))) state.input.aim = false;
  };
  canvas.addEventListener("pointerup", end);
  canvas.addEventListener("pointercancel", end);
  addEventListener("blur", () => {
    down.clear();
    state.input.left = state.input.right = state.input.held = state.input.pressEdge = state.input.aim = false;
  });
}
