// The banner when a boss falls (src/game/victory.ts): VICTORY, big and golden, slamming in over golden rays turning
// slowly behind it, the boss's name and title under it ("Cinder, Ember Lieutenant of the Greyed, has fallen"), and
// confetti coming down the whole screen; then it all fades.
import { VICTORY as V } from "../data/victory.ts";
import type { Game } from "../game/game.ts";
import { victoryOf, type Victory } from "../game/victory.ts";

const COLOURS = ["#ffd75e", "#ff9d3a", "#ff5a4e", "#8fd8ff", "#b48cff", "#9effa0", "#fff4d6"];

export function createVictory(g: Game): { draw(): void } {
  const el = document.createElement("div"), rays = document.createElement("div"), word = document.createElement("div");
  const who = document.createElement("div"), fall = document.createElement("div");
  el.id = "victory";
  el.hidden = true;
  rays.className = "rays";
  word.className = "word";
  who.className = "who";
  fall.className = "confetti";
  el.append(rays, fall, word, who);
  document.body.append(el);
  let shown: Victory | null = null;

  /** A fresh fall of confetti: each bit its own colour, size, place, drift, spin and pace. */
  const throwConfetti = (): void => {
    fall.replaceChildren(...Array.from({ length: V.confetti }, () => {
      const c = document.createElement("i"), r = Math.random;
      c.style.left = `${(r() * 100).toFixed(1)}%`;
      c.style.background = COLOURS[Math.floor(r() * COLOURS.length)]!;
      c.style.width = `${4 + Math.round(r() * 5)}px`;
      c.style.height = `${6 + Math.round(r() * 8)}px`;
      c.style.setProperty("--drift", `${((r() - 0.5) * 160).toFixed(0)}px`);
      c.style.setProperty("--spin", `${Math.round((r() - 0.5) * 1440)}deg`);
      c.style.animationDuration = `${(2.4 + r() * 2.2).toFixed(2)}s`;
      c.style.animationDelay = `${(r() * 1.2).toFixed(2)}s`;
      return c;
    }));
  };

  return {
    draw() {
      const v = victoryOf(g);
      if (v === shown) {
        if (v) el.style.opacity = `${Math.min(1, (V.last - v.t) / 0.8)}`;   // fading out at the end
        return;
      }
      shown = v;
      el.hidden = !v;
      if (!v) return;
      word.textContent = V.says;
      who.textContent = `${v.name}, ${v.title}, has fallen`;
      el.style.opacity = "1";
      // Start the animations over for this victory.
      for (const part of [rays, word, who]) { part.style.animation = "none"; void part.offsetWidth; part.style.animation = ""; }
      throwConfetti();
    },
  };
}
