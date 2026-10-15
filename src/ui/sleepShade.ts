// Asleep (src/game/sleeping.ts), the world goes black but for the tent or the bed he's in: a soft-edged hole in
// a dark shade over the screen, fading in as he shuts his eyes and out as he wakes. Names over loot go under it.
import { sleeping } from "../game/sleeping.ts";
import type { Game } from "../game/game.ts";
import type { Projector } from "../render/projector.ts";
import { T } from "../data/world.ts";

/** How far out from the bed the light reaches before it's all dark (tiles), and how high its middle is. */
const REACH = 1.5, HEIGHT = 0.4;

export function createSleepShade(g: Game, view: Projector): { draw(): void } {
  const shade = document.createElement("div");
  shade.id = "sleepShade";
  document.body.append(shade);
  return {
    draw() {
      const s = sleeping(g), at = s && g.world.get(s.bed, "transform");
      shade.classList.toggle("on", !!at);
      document.body.classList.toggle("asleep", !!at);
      if (!at) return;
      const c = view.gameToScreen(at.x, at.y, HEIGHT), edge = view.gameToScreen(at.x + REACH * T, at.y, HEIGHT);
      const r = Math.max(8, Math.hypot(edge.x - c.x, edge.y - c.y));
      shade.style.background = `radial-gradient(circle at ${Math.round(c.x)}px ${Math.round(c.y)}px, transparent ${Math.round(r * 0.45)}px, rgb(0 0 0 / 0.85) ${Math.round(r * 0.8)}px, #000 ${Math.round(r)}px)`;
    },
  };
}
