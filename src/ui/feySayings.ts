// What the fair folk say to him, deep in their ring (src/game/fairyring.ts): a line at a time, faint and glowing, fading
// in somewhere round the edge of the screen (never over the ring, in the middle), drifting a little, and fading out.
import { FAIRY_RING as F } from "../data/fey.ts";
import { sayingOf } from "../game/fairyring.ts";
import type { Game } from "../game/game.ts";

/** Where a line can turn up (its middle, as a share of the screen), in turn by how many have been said before. */
const SPOTS = [[0.28, 0.2], [0.72, 0.78], [0.5, 0.12], [0.26, 0.74], [0.74, 0.24], [0.5, 0.86], [0.22, 0.46], [0.78, 0.52]] as const;

export function createFeySayings(g: Game): { draw(): void } {
  const el = document.createElement("div");
  el.id = "feySaying";
  document.body.append(el);
  let shown = -1;
  return {
    draw() {
      const s = sayingOf(g);
      if (!s) { if (shown !== -1) { el.style.opacity = "0"; shown = -1; } return; }
      if (s.n !== shown) {
        shown = s.n;
        el.textContent = s.text;
        const [x, y] = SPOTS[s.n % SPOTS.length]!;
        el.style.left = `${x * 100}%`;
        el.style.top = `${y * 100}%`;
      }
      const L = F.line, out = s.age - L.in - s.hold;
      el.style.opacity = `${Math.max(0, Math.min(1, s.age / L.in, 1 - out / L.out))}`;
      el.style.transform = `translate(-50%, calc(-50% - ${(s.age * 3).toFixed(1)}px))`;
    },
  };
}
