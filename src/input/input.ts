// Keyboard and mouse -> the game's Input resource, plus the few keys that drive the UI and the run.
import { DASH } from "../data/player.ts";
import { setState, type Game } from "../game/game.ts";
import { resetGame } from "../game/reset.ts";
import { isHandled, isUiTarget } from "../ui/dom.ts";

export interface InputHooks {
  toggleInventory(): void;
  toggleJournal(): void;
  closePanels(): void;
}

/** Double-tap dash: WASD and arrows map to the same four directions. */
const DIRS: Record<string, [number, number]> = {
  a: [-1, 0], arrowleft: [-1, 0], d: [1, 0], arrowright: [1, 0],
  w: [0, -1], arrowup: [0, -1], s: [0, 1], arrowdown: [0, 1],
};
const NO_SCROLL = [" ", "arrowup", "arrowdown", "arrowleft", "arrowright"];

/** Listen for input. Returns the cursor's screen position (null until the mouse moves, or after it leaves). */
export function bindInput(g: Game, hooks: InputHooks): { mouse(): { x: number; y: number } | null; overUi(): boolean } {
  const input = g.input;
  let lastTap: { dir: string | null; time: number } = { dir: null, time: -1 };
  let mouse: { x: number; y: number } | null = null;

  addEventListener("keydown", e => {
    const k = e.key.toLowerCase();
    if (NO_SCROLL.includes(k)) e.preventDefault();
    if (g.state !== "play") {
      // Any key starts from the title; R rises again after a fall.
      if (g.state === "title" || (g.state === "dead" && k === "r")) {
        resetGame(g);
        setState(g, "play");
        if (k === "r") g.resetLatch = true;
      }
      return;
    }
    if (k === "i" || k === "tab") { e.preventDefault(); if (!e.repeat) hooks.toggleInventory(); return; }
    if (k === "l") { if (!e.repeat) hooks.toggleJournal(); return; }
    if (k === "escape") { hooks.closePanels(); return; }
    if (!e.repeat) {
      if (k === "j" || k === "enter") input.attackPressed = true;
      if (k === " ") input.jumpPressed = true;
      const dir = DIRS[k];
      if (dir) {
        const key = dir.join(), now = performance.now() / 1000;
        if (lastTap.dir === key && now - lastTap.time < DASH.doubleTap) { input.dashRequest = dir; lastTap = { dir: null, time: -1 }; }
        else lastTap = { dir: key, time: now };
      }
    }
    input.keys.add(k);
  });
  addEventListener("keyup", e => {
    const k = e.key.toLowerCase();
    input.keys.delete(k);
    if (k === "r") g.resetLatch = false;
    if (k === "j" || k === "enter") input.attackReleased = true;
  });
  addEventListener("mousedown", e => {
    if (g.state !== "play" || e.button !== 0 || isHandled(e) || isUiTarget(e.target)) return;   // clicks on the UI aren't attacks
    input.attackPressed = true;
  });
  addEventListener("mouseup", e => { if (e.button === 0) input.attackReleased = true; });
  let overUi = false;
  addEventListener("mousemove", e => { mouse = { x: e.clientX, y: e.clientY }; overUi = isUiTarget(e.target); });
  addEventListener("mouseleave", () => { mouse = null; });
  addEventListener("blur", () => input.keys.clear());

  return { mouse: () => mouse, overUi: () => overUi };
}
