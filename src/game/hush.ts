// The hush: while the hero's talking to someone, and for a moment after, whatever's about lets him be. The world goes
// on (nothing's paused), but the slimes lose interest in him and hop about where they please (one coming at him turns
// away), and don't hurt him if they bump into him; the mages hold their spells and their swords; and nothing new turns
// up. Bolts already in the air still land. Raising a hand himself (a swing, a thrust, drawing the bow, a dash) breaks
// it at once, for the rest of that conversation; walking off ends the talk, and the hush with it once the grace runs
// out. A boss fight is never hushed (nor the Great Koi or the ghost: they've their own systems, and pay it no mind).
import { HUSH } from "../data/dialogue.ts";
import type { Conversation } from "./components.ts";
import { bossHere } from "./bosses.ts";
import type { Game } from "./game.ts";
import { talking } from "./talk.ts";

interface Hush { left: number; broken: Conversation | null }
const hushes = new WeakMap<Game, Hush>();
function hushOf(g: Game): Hush {
  let h = hushes.get(g);
  if (!h) {
    const fresh: Hush = { left: 0, broken: null };
    hushes.set(g, h = fresh);
    g.events.on("reset", () => { fresh.left = 0; fresh.broken = null; });
  }
  return h;
}

/** Is it hushed round him: talking (or just done), no blow struck, and no boss fight on? */
export const hushed = (g: Game): boolean => (hushes.get(g)?.left ?? 0) > 0 && bossHere(g) === null;

/** Every frame, before the enemies move: talking keeps the hush up; done talking, it lingers a moment; a blow ends it. */
export function hushSystem(g: Game, dt: number): void {
  const h = hushOf(g), c = talking(g);
  const a = g.world.need(g.player, "actions"), m = g.world.need(g.player, "motion");
  if (a.attack > 0 || a.swipe || a.draw || a.windup || m.dash > 0) { h.left = 0; h.broken = c; return; }
  if (c && c !== h.broken) h.left = HUSH.grace;
  else h.left = Math.max(0, h.left - dt);
}
