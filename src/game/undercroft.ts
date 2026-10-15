// The Undercroft under St Mary's (src/areas/undercroft.ts; the story is in docs/CURIOSITIES.md). The low door at
// the foot of the tower is locked, and the Rusted Key is the one that opens it: carry it there and it turns, and
// stays in the lock (the door's open the rest of the run). Down below, the ring of old stones has a gap in it;
// carry the Mysterious Stone up to the socket and it goes home, and the ring wakes: Ael's warmth, under the city.
import { UNDERCROFT, UNDERCROFT_SAYS } from "../data/undercroft.ts";
import { HALF, T, type Rect } from "../data/world.ts";
import { makeItem } from "../items/items.ts";
import type { ExitDef } from "../world/area.ts";
import { FEET, blocked } from "../world/collision.ts";
import { ringPlan } from "../world/stonering.ts";
import { carryingCurio, spendCurio, spentCurios } from "./curios.ts";
import { toast, type Game } from "./game.ts";
import { sound } from "./sfx.ts";
import { dropLoot } from "./spawn.ts";

/** When a locked door last said so, per game: once every couple of seconds is plenty. */
const saidAt = new WeakMap<Game, number>();

/**
 * Walking into an exit: is it locked against him? A door locked with a curiosity he's carrying opens (it's spent:
 * it stays in the lock, and the door stays open); one he's already opened is open. Otherwise he's put back a step
 * and told so. True if he's kept out.
 */
export function lockedOut(g: Game, exit: ExitDef): boolean {
  const key = exit.locked;
  if (!key || spentCurios(g).has(key)) return false;
  if (carryingCurio(g, key)) {
    spendCurio(g, key);
    sound(g, "catch");
    toast(g, UNDERCROFT_SAYS.unlock, true);
    return false;
  }
  stepBack(g, exit.rect);
  const last = saidAt.get(g);
  if (last === undefined || g.clock - last > 2.5 || g.clock < last) { saidAt.set(g, g.clock); toast(g, UNDERCROFT_SAYS.locked); }
  return true;
}

/** Put him back a step out of the doorway, the way he came (by which half of it his feet are in), or else the other way: never into the wall. */
function stepBack(g: Game, r: Rect): void {
  const p = g.world.need(g.player, "transform"), above = r.y - FEET.y - FEET.h - 1, below = r.y + r.h - FEET.y + 1;
  const ways = p.y + FEET.y + FEET.h / 2 < r.y + r.h / 2 ? [above, below] : [below, above];
  p.y = ways.find(y => !blocked(g.map, p.x, y, true)) ?? ways[0]!;
}

/** Where the ring's socket is in this area, if it has the ring (game px, an entity's top-left). */
export function socketOf(g: Game): { x: number; y: number } | null {
  for (const p of g.area.layout.props) if (p.kind === "stoneRing") { const s = ringPlan(p).socket; return { x: s.x * T - HALF, y: s.z * T - HALF }; }
  return null;
}

/** The stone, back in the ring, if it's here. */
const ringstoneHere = (g: Game) => g.world.query("renderable").some(([, c]) => c.renderable.kind === "ringstone");

/** This run, per game: has he been down here yet (he's told where he is the first time), and been told the ring's warm? */
const runs = new WeakMap<Game, { visited: boolean; hinted: boolean }>();
function runOf(g: Game): { visited: boolean; hinted: boolean } {
  let r = runs.get(g);
  if (!r) {
    const fresh = { visited: false, hinted: false };
    runs.set(g, r = fresh);
    g.events.on("reset", () => { fresh.visited = fresh.hinted = false; });
  }
  return r;
}

/**
 * Every frame, in the Undercroft: the first time down, a word on where he is. If the stone's been set back, it's
 * standing in its socket. If he's carrying it and walks up to the socket, it goes home and the ring wakes.
 */
export function undercroftSystem(g: Game): void {
  const socket = socketOf(g);
  if (!socket) return;
  const run = runOf(g);
  if (!run.visited) { run.visited = true; toast(g, UNDERCROFT_SAYS.arrive, true); }
  const set = spentCurios(g).has("stone");
  if (set && !ringstoneHere(g)) setStone(g, socket);
  if (set || !carryingCurio(g, "stone")) return;
  const p = g.world.need(g.player, "transform");
  if (Math.hypot(p.x - socket.x, p.y - socket.y) > UNDERCROFT.reach) {
    if (!run.hinted && Math.hypot(p.x - socket.x, p.y - socket.y) < UNDERCROFT.hint) { run.hinted = true; toast(g, UNDERCROFT_SAYS.warm); }
    return;
  }
  // Home: out of the bag and into the socket, the ring wakes, and leaves him something of Ael's.
  spendCurio(g, "stone");
  setStone(g, socket);
  g.fx.push({ type: "burst", x: socket.x, y: socket.y, palette: "frost" });
  g.fx.push({ type: "toll", x: socket.x, y: socket.y, radius: UNDERCROFT.wake });
  g.shake = Math.max(g.shake, 3);
  sound(g, "toll", socket);
  for (const line of UNDERCROFT_SAYS.wake) toast(g, line, true);
  const r = UNDERCROFT.reward;
  const pendant = dropLoot(g, socket.x, socket.y + 12, makeItem(r.type, "rare", { ...r.mods }, r.name));
  g.world.remove(pendant, "despawn");                        // it'll wait for him, if his bag's full
  const health = g.world.need(g.player, "health");
  health.hp = health.maxHp;                                  // the warmth goes right through him
}

function setStone(g: Game, at: { x: number; y: number }): void {
  g.world.create({ transform: { ...at }, renderable: { kind: "ringstone" } });
}
