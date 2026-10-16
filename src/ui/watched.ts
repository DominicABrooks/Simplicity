// Under the hill with only the watchers there (src/game/underhill.ts): what they murmur, low and grey over the head of
// whichever of them said it, shivering; and their magic getting into everything till he leaves: every so often the
// world swims as if seen through water, a violet and green glow washes in from the edges, and motes of light rise,
// all swelling and falling away again.
import { UNDERHILL as U } from "../data/underhill.ts";
import { HALF } from "../data/world.ts";
import type { Game } from "../game/game.ts";
import { murmurOf, watched } from "../game/underhill.ts";
import type { Projector } from "../render/projector.ts";

/** How high over a watcher's foot its words float (world units): over its hood. */
const ABOVE = 2.2;
/** Seconds a murmur takes to come and go, at each end of its life. */
const FADE = 0.7;
/** How many motes of light rise in a swell, how far they rise (px), and how far (px) the world swims at the height of it. */
const MOTES = 16, RISE = 70, SWIM = 26;

const between = ([lo, hi]: readonly [number, number]) => lo + Math.random() * (hi - lo);
const SVG = "http://www.w3.org/2000/svg";

export function createWatched(g: Game, view: Projector): { draw(dt: number): void } {
  const words = document.createElement("div"), glitch = document.createElement("div");
  words.id = "murmur";
  glitch.id = "glitch";
  const motes = Array.from({ length: MOTES }, () => glitch.appendChild(document.createElement("i")));
  // The swim: the picture pushed about by slow, smooth noise (an SVG filter the canvas is drawn through).
  const svg = document.createElementNS(SVG, "svg"), filter = document.createElementNS(SVG, "filter");
  const noise = document.createElementNS(SVG, "feTurbulence"), shift = document.createElementNS(SVG, "feDisplacementMap");
  svg.setAttribute("width", "0"); svg.setAttribute("height", "0"); svg.style.position = "absolute";
  filter.id = "feyWarp";
  noise.setAttribute("type", "fractalNoise"); noise.setAttribute("numOctaves", "2"); noise.setAttribute("seed", "7");
  shift.setAttribute("in", "SourceGraphic"); shift.setAttribute("xChannelSelector", "R"); shift.setAttribute("yChannelSelector", "G");
  filter.append(noise, shift);
  svg.append(filter);
  document.body.append(words, glitch, svg);
  const screen = document.getElementById("screen")!;
  let shown = -1, wait = 0, left = 0, len = 1, clock = 0;

  /** A swell begins: the motes scattered afresh. */
  const begin = (): void => {
    len = left = between(U.glitch.last);
    for (const m of motes) {
      m.style.left = `${(Math.random() * 100).toFixed(1)}%`;
      m.style.top = `${(15 + Math.random() * 80).toFixed(1)}%`;
      m.style.background = m.style.color = Math.random() < 0.5 ? "#c9a8ff" : "#9effd8";   // and its glow (the shadow's currentColor)
      m.dataset.bright = (0.4 + Math.random() * 0.6).toFixed(2);
    }
    glitch.hidden = false;
  };
  /** One frame of a swell, `e` (0 to 1 and back) how far into it, `p` (0 to 1) how far through it. */
  const swell = (e: number, p: number): void => {
    noise.setAttribute("baseFrequency", `${(0.006 + 0.002 * Math.sin(clock * 1.3)).toFixed(4)} ${(0.011 + 0.003 * Math.cos(clock * 0.9)).toFixed(4)}`);
    shift.setAttribute("scale", (SWIM * e).toFixed(1));
    screen.style.filter = `url(#feyWarp) hue-rotate(${(55 * e).toFixed(0)}deg) saturate(${(1 + 0.5 * e).toFixed(2)}) brightness(${(1 + 0.08 * e).toFixed(2)})`;
    screen.style.transform = `scale(${(1 + 0.012 * e).toFixed(4)})`;
    glitch.style.opacity = e.toFixed(3);
    for (const m of motes) {
      m.style.transform = `translateY(${(-RISE * p).toFixed(1)}px)`;
      m.style.opacity = (Number(m.dataset.bright) * Math.sin(Math.PI * p)).toFixed(3);
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
      clock += dt;
      // The world: quiet between swells, swimming and glowing through one.
      if (!on) { if (left > 0 || !glitch.hidden) still(); left = 0; wait = between(U.glitch.every); }
      else if (left > 0) {
        if ((left -= dt) > 0) { const p = 1 - left / len; swell(Math.sin(Math.PI * p) ** 2, p); }
        else { still(); wait = between(U.glitch.every); }
      } else if ((wait -= dt) <= 0) begin();

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
