// The walk up (STORY.md, "0:55"): the hero home at dawn with Calder's head, up through the waking city to the King.
// People stop and stare as he goes by; once he's past, grown-ups fall in behind him, more and more of them, until by
// Castle Street there's a crowd following him, in rows at his back, through the castle gate and into the ward. When
// he's set the head down at the King's feet they stand and watch (src/game/ending.ts), and after, they go back to
// their day. The townsfolk themselves walk in src/game/townsfolk.ts; this keeps who's following and where he's been.
import { CROWD, CROWD_SAYS } from "../data/ending.ts";
import { HALF } from "../data/world.ts";
import { beaten } from "./bosses.ts";
import type { Game } from "./game.ts";
import { carryingHead } from "./head.ts";

/** Where he carries it: the city's streets. */
const CITY = new Set(["capital", "castle", "kingsroad"]);

interface Crowd {
  /** Who's following him (census ids), in the order they fell in: their places in the rows behind him. */
  following: number[];
  /** Where he's walked lately (px, centres), newest last, for them to walk in his steps; in which area. */
  trail: [number, number][];
  trailIn: unknown;
  /** Gathered where he's put it down, watching (the point they face); or null. */
  gathered: { x: number; y: number } | null;
  /** Seconds till someone in the crowd (or staring) may say something. */
  hush: number;
}
const crowds = new WeakMap<Game, Crowd>();
export function crowdOf(g: Game): Crowd {
  let c = crowds.get(g);
  if (!c) {
    const fresh: Crowd = { following: [], trail: [], trailIn: null, gathered: null, hush: 0 };
    crowds.set(g, c = fresh);
    g.events.on("reset", () => Object.assign(fresh, { following: [], trail: [], trailIn: null, gathered: null, hush: 0 }));
  }
  return c;
}

/** Is he on his way up with the head: Calder beaten, the head in his bag, and him in the city? */
export const processionOn = (g: Game): boolean => CITY.has(g.area.def.id) && beaten(g, "calder") && carryingHead(g);

/** They stop where they are and watch, facing `at` (px): he's put it down. */
export function gatherCrowd(g: Game, at: { x: number; y: number }): void { crowdOf(g).gathered = { ...at }; }

/** It's over: they go back to their day, and nobody's following him any more. */
export function disperseCrowd(g: Game): void {
  const c = crowdOf(g);
  c.gathered = null;
  c.following = [];
}

/** Join the crowd behind him (if there's room): their place in it, or null. */
export function fallIn(g: Game, id: number): number | null {
  const c = crowdOf(g), at = c.following.indexOf(id);
  if (at >= 0) return at;
  if (c.following.length >= CROWD.most) return null;
  c.following.push(id);
  return c.following.length - 1;
}

/** May someone say something now? Not everyone at once. */
export function mayRemark(g: Game, chance: number): boolean {
  const c = crowdOf(g);
  if (c.hush > 0 || g.rng.next() > chance) return false;
  c.hush = CROWD.remark * (0.6 + g.rng.next() * 0.8);
  return true;
}

/** Every frame, before the townsfolk move: note where he's walked, and now and then the crowd behind him says something. */
export function updateCrowd(g: Game, dt: number, say: (id: number, line: string) => void): void {
  const c = crowdOf(g), hero = g.world.need(g.player, "transform"), hx = hero.x + HALF, hy = hero.y + HALF;
  c.hush -= dt;
  if (c.trailIn !== g.area) { c.trailIn = g.area; c.trail = []; }
  const last = c.trail[c.trail.length - 1];
  if (!last || Math.hypot(last[0] - hx, last[1] - hy) >= 3) { c.trail.push([hx, hy]); if (c.trail.length > 80) c.trail.shift(); }
  if (processionOn(g) && c.following.length > 2 && mayRemark(g, dt * 0.5)) say(c.following[g.rng.int(0, c.following.length - 1)]!, CROWD_SAYS[g.rng.int(0, CROWD_SAYS.length - 1)]!);
}

/** Where the nth of the crowd walks (px, centres): in rows behind him along where he's been, a few abreast. */
export function placeInCrowd(g: Game, slot: number): [number, number] {
  const c = crowdOf(g), hero = g.world.need(g.player, "transform"), row = Math.floor(slot / CROWD.perRow), col = slot % CROWD.perRow;
  const back = CROWD.back + row * CROWD.row, side = (col - (CROWD.perRow - 1) / 2) * CROWD.side + (row % 2 ? CROWD.side / 3 : 0);
  // Back along his trail that far; facing the way he went there.
  let x = hero.x + HALF, y = hero.y + HALF, dx = 0, dy = -1, gone = 0;
  for (let i = c.trail.length - 1; i > 0 && gone < back; i--) {
    const [ax, ay] = c.trail[i]!, [bx, by] = c.trail[i - 1]!, step = Math.hypot(ax - bx, ay - by);
    if (step < 0.01) continue;
    dx = (ax - bx) / step; dy = (ay - by) / step;
    const k = Math.min(1, (back - gone) / step);
    x = ax - dx * step * k; y = ay - dy * step * k;
    gone += step * k;
  }
  if (gone < back) { x -= dx * (back - gone); y -= dy * (back - gone); }
  return [x - dy * side, y + dx * side];
}
