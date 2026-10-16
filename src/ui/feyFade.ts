// Deep in the fairy ring's spell (src/game/fairyring.ts), the screen's own furniture goes too: the hearts and the bar,
// the names over things, the buttons, the odd word. It comes back as soon as he moves.
import { uiFadeOf } from "../game/fairyring.ts";
import type { Game } from "../game/game.ts";
import { smooth } from "../core/math.ts";

/** What fades: everything on screen while he's playing (not the panels he opens himself). */
const FADES = ["#hudCanvas", "#labels", ".hud", "#menuBar", "#toast", "#alert", "#held", "#tooltip"];

export function createFeyFade(g: Game): { draw(dt: number): void } {
  let shown = 1, set = 1;
  return {
    draw(dt) {
      const want = 1 - uiFadeOf(g);
      shown = want > shown ? smooth(shown, want, dt, 6) : want;   // back quickly once he moves; out as slowly as the spell says
      const v = Math.round(shown * 100) / 100;
      if (v === set) return;
      set = v;
      for (const el of document.querySelectorAll<HTMLElement>(FADES.join(","))) {
        el.style.opacity = v >= 1 ? "" : `${v}`;
        el.style.pointerEvents = v < 0.05 ? "none" : "";
      }
    },
  };
}
