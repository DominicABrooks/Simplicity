// Under the hill with only the watchers there (src/game/underhill.ts): what they murmur, low and grey over the head of
// whichever of them said it, shivering; and the screen going wrong, a jolt every so often, till he leaves.
import { UNDERHILL as U } from "../data/underhill.ts";
import { HALF } from "../data/world.ts";
import type { Game } from "../game/game.ts";
import { murmurOf, watched } from "../game/underhill.ts";
import type { Projector } from "../render/projector.ts";

/** How high over a watcher's foot its words float (world units): over its hood. */
const ABOVE = 2.2;
/** Seconds a murmur takes to come and go, at each end of its life. */
const FADE = 0.7;
/** How many bands of wrongness a jolt can put across the screen. */
const BANDS = 5;

const between = ([lo, hi]: readonly [number, number]) => lo + Math.random() * (hi - lo);

export function createWatched(g: Game, view: Projector): { draw(dt: number): void } {
  const words = document.createElement("div"), glitch = document.createElement("div");
  words.id = "murmur";
  glitch.id = "glitch";
  const bands = Array.from({ length: BANDS }, () => glitch.appendChild(document.createElement("i")));
  document.body.append(words, glitch);
  const screen = document.getElementById("screen")!;
  let shown = -1, wait = 0, left = 0;

  /** One frame of a jolt: the picture shoved and skewed and its colours wrong, and bands torn across it. */
  const jolt = (): void => {
    const dx = (Math.random() - 0.5) * 26, skew = (Math.random() - 0.5) * 6;
    screen.style.transform = `translate(${dx.toFixed(1)}px, ${((Math.random() - 0.5) * 6).toFixed(1)}px) skewX(${skew.toFixed(1)}deg)`;
    screen.style.filter = Math.random() < 0.25 ? "invert(1) hue-rotate(180deg)" : `hue-rotate(${Math.round(Math.random() * 360)}deg) contrast(1.6) saturate(2.2)`;
    glitch.hidden = false;
    for (const b of bands) {
      const on = Math.random() < 0.7;
      b.style.display = on ? "block" : "none";
      if (!on) continue;
      b.style.top = `${(Math.random() * 100).toFixed(1)}%`;
      b.style.height = `${(1 + Math.random() * 7).toFixed(1)}%`;
      b.style.transform = `translateX(${((Math.random() - 0.5) * 60).toFixed(0)}px)`;
      b.style.backdropFilter = `invert(${Math.random() < 0.5 ? 1 : 0}) hue-rotate(${Math.round(Math.random() * 360)}deg) blur(${Math.random() < 0.3 ? 2 : 0}px)`;
    }
  };
  const still = (): void => {
    screen.style.transform = screen.style.filter = "";
    glitch.hidden = true;
  };
  still();

  return {
    draw(dt) {
      const on = watched(g) && g.state === "play";
      // The screen: quiet between jolts, wrong all through one.
      if (!on) { if (left > 0 || !glitch.hidden) still(); left = 0; wait = between(U.glitch.every); }
      else if (left > 0) { if ((left -= dt) > 0) jolt(); else { still(); wait = between(U.glitch.every); } }
      else if ((wait -= dt) <= 0) { left = between(U.glitch.last); jolt(); }

      // Their words.
      const m = on ? murmurOf(g) : null, at = m && g.world.get(m.who, "transform");
      if (!m || !at) { words.style.opacity = "0"; shown = -1; return; }
      if (m.n !== shown) { shown = m.n; words.textContent = m.text; }
      const p = view.gameToScreen(at.x + HALF, at.y + HALF, ABOVE), shiver = () => ((Math.random() - 0.5) * 2.4).toFixed(1);
      // Kept on the screen, clear of the bars along its foot, when the one speaking is off the edge of it.
      const half = words.offsetWidth / 2 + 16, clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
      words.style.left = `${Math.round(clamp(p.x, half, innerWidth - half))}px`;
      words.style.top = `${Math.round(clamp(p.y, words.offsetHeight + 40, innerHeight - 90))}px`;
      words.style.transform = `translate(calc(-50% + ${shiver()}px), calc(-100% + ${shiver()}px - ${(m.age * 4).toFixed(1)}px))`;
      words.style.opacity = `${Math.max(0, Math.min(1, m.age / FADE, (U.murmurs.life - m.age) / FADE)) * 0.85}`;
    },
  };
}
