// Beating a boss (any of them: the three lieutenants, src/game/bosses.ts; the Grey Ringer, src/systems/enemies.ts; the
// Great Koi, src/game/greatkoi.ts) is a moment: the world stops dead for a breath, a blaze of light goes up where they
// fell, a fanfare plays (the music holds off for it: src/audio/music.ts), fireworks go off round the hero for a few
// seconds, and VICTORY goes up across the screen, golden, with confetti coming down (src/ui/victory.ts). Whatever
// comes after (a lieutenant's last words) waits till it's all over. The rules are VICTORY, in src/data/victory.ts.
import { VICTORY as V } from "../data/victory.ts";
import type { BurstPalette } from "./fx.ts";
import type { Game } from "./game.ts";
import { sound } from "./sfx.ts";

/** A victory being celebrated: whose fall, how long since, where, seconds to the next firework; and what's to happen once it's over. */
export interface Victory { name: string; title: string; t: number; x: number; y: number; nextBang: number; n: number; then: (() => void) | null }

const victories = new WeakMap<Game, Victory>();

/** The celebration going on now, if there is one. */
export function victoryOf(g: Game): Victory | null {
  const v = victories.get(g);
  return v && v.t < V.last ? v : null;
}

/** A boss has fallen at (x, y) (cell top-left): celebrate; and once it's over, `then`. */
export function celebrate(g: Game, name: string, title: string, x: number, y: number, then?: () => void): void {
  victories.get(g)?.then?.();                               // one still going (two bosses at once?): its business first
  victories.set(g, { name, title, t: 0, x, y, nextBang: V.fireworks.first, n: 0, then: then ?? null });
  g.hitstop = Math.max(g.hitstop, V.hitstop);
  g.shake = Math.max(g.shake, V.shake);
  g.fx.push({ type: "levelUp", x, y });
  for (const palette of ["fire", "spark", "arcane"] as const) g.fx.push({ type: "burst", x, y, palette });
  sound(g, "victory");
}

const PALETTES: readonly BurstPalette[] = ["fire", "spark", "arcane", "frost", "slime"];

/** Every frame: the fireworks, round the hero, while the celebration lasts; and once it's over, what comes after. */
export function victorySystem(g: Game, dt: number): void {
  const v = victoryOf(g);
  if (!v) return;
  v.t += dt;
  if (v.t >= V.last) {
    const then = v.then;
    v.then = null;
    then?.();
    return;
  }
  const F = V.fireworks;
  if (v.t > F.until || (v.nextBang -= dt) > 0) return;
  v.nextBang = F.every[0] + Math.random() * (F.every[1] - F.every[0]);
  const p = g.world.need(g.player, "transform"), a = Math.random() * Math.PI * 2, d = F.near[0] + Math.random() * (F.near[1] - F.near[0]);
  const x = p.x + Math.cos(a) * d, y = p.y + Math.sin(a) * d * 0.7 - F.up;   // up in the air over him, more or less
  const palette = PALETTES[v.n++ % PALETTES.length]!;
  g.fx.push({ type: "burst", x, y, palette });
  if (v.n % 2) g.fx.push({ type: "burst", x: x + 6, y: y - 4, palette: PALETTES[v.n % PALETTES.length]! });
  sound(g, "firework", { x, y });
}
