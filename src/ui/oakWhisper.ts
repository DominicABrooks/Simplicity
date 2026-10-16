// A gilded oak whispering (src/game/oaks.ts): the line its acorn held, faint and glowing over the tree, fading in, holding
// long enough to read, drifting up a little, and fading out.
import { FAIRY_RING as F } from "../data/fey.ts";
import { whisperOf } from "../game/oaks.ts";
import type { Game } from "../game/game.ts";
import type { Projector } from "../render/projector.ts";

/** How high over the oak's foot the words float (world units). */
const ABOVE = 1.7;

export function createOakWhisper(g: Game, view: Projector): { draw(): void } {
  const el = document.createElement("div");
  el.id = "oakWhisper";
  document.body.append(el);
  let showing: unknown = null;
  return {
    draw() {
      const w = whisperOf(g);
      if (!w) { if (showing) { el.style.opacity = "0"; showing = null; } return; }
      if (showing !== w) { showing = w; el.textContent = w.oak.line; }
      const at = view.gameToScreen(w.oak.x, w.oak.y, ABOVE), out = w.age - F.line.in - w.hold;
      el.style.left = `${Math.round(at.x)}px`;
      el.style.top = `${Math.round(at.y - w.age * 3)}px`;
      el.style.opacity = `${Math.max(0, Math.min(1, w.age / F.line.in, 1 - out / F.line.out))}`;
    },
  };
}
