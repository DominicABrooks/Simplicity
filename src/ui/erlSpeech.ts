// The Erl-King speaking (src/game/underhill.ts): each line over his head, large and glowing gold, fading in, held long
// enough to read, and fading out before the next; and under it all, how to hurry him.
import { THRONE, UNDERHILL as U } from "../data/underhill.ts";
import { HALF, T } from "../data/world.ts";
import { erlKingSays } from "../game/underhill.ts";
import type { Game } from "../game/game.ts";
import type { Projector } from "../render/projector.ts";

/** How high over the throne's foot his words float (world units): over his antlers. */
const ABOVE = 5.2;

export function createErlSpeech(g: Game, view: Projector): { draw(): void } {
  const el = document.createElement("div");
  el.id = "erlSpeech";
  const hint = document.createElement("div");
  hint.id = "erlSkip";
  hint.textContent = "Enter: next   Esc: skip";
  document.body.append(el, hint);
  let line = "";
  return {
    draw() {
      const s = erlKingSays(g);
      hint.classList.toggle("on", !!s);
      if (!s || s.age < 0) { el.style.opacity = "0"; return; }
      const text = s.lines[s.i]!;
      if (text !== line) el.textContent = line = text;
      const L = U.line, out = s.age - L.in - s.hold, at = view.gameToScreen(THRONE.x * T - HALF, THRONE.y * T - HALF, ABOVE);
      el.style.left = `${Math.round(at.x)}px`;
      el.style.top = `${Math.round(Math.max(at.y, el.offsetHeight + 12))}px`;   // never off the top of the screen
      el.style.opacity = `${Math.max(0, Math.min(1, s.age / L.in, 1 - out / L.out))}`;
    },
  };
}
