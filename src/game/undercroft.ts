// The Undercroft under St Mary's (src/areas/undercroft.ts; the story is in docs/CURIOSITIES.md). The low door at
// the foot of the tower is locked, and the Rusted Key is the one that opens it: carry it there and it turns, and
// stays in the lock (the door's open the rest of the run). Down below, the ring of old stones has a gap in it;
// carry the Mysterious Stone up to the socket and it goes home, and the ring wakes: Ael's warmth, under the city.
import { PENDANT, UNDERCROFT, UNDERCROFT_SAYS } from "../data/undercroft.ts";
import { HALF, T, type Rect } from "../data/world.ts";
import { makeItem } from "../items/items.ts";
import type { ExitDef } from "../world/area.ts";
import { FEET, blocked } from "../world/collision.ts";
import { ROOM_WALL } from "../world/plans.ts";
import { ringPlan } from "../world/stonering.ts";
import { carryingCurio, spendCurio, spentCurios } from "./curios.ts";
import { toast, type Game } from "./game.ts";
import { sound } from "./sfx.ts";
import { pendantCharged, wearingPendant } from "./pendant.ts";
import { lastStone, touchStone } from "./stones.ts";
import { dropLoot } from "./spawn.ts";

/** When a locked door last said so, per game: once every couple of seconds is plenty. */
const saidAt = new WeakMap<Game, number>();

/**
 * Walking into an exit: is it locked against him? A door locked with a curiosity he's carrying opens (it's spent:
 * it stays in the lock, and the door stays open); one he's already opened is open. Otherwise he's put back a step
 * and told so. True if he's kept out.
 */
export function lockedOut(g: Game, exit: ExitDef): boolean {
  if (exit.sealed) return sealedOut(g, exit);
  const key = exit.locked;
  if (!key || spentCurios(g).has(key)) return false;
  if (carryingCurio(g, key)) {
    spendCurio(g, key);
    sound(g, "catch");
    toast(g, UNDERCROFT_SAYS.unlock, true);
    return false;
  }
  stepBack(g, exit.rect);
  say(g, UNDERCROFT_SAYS.locked);
  return true;
}

/** Said at a shut door, but not every frame he leans on it. */
function say(g: Game, line: string): void {
  const last = saidAt.get(g);
  if (last === undefined || g.clock - last > 2.5 || g.clock < last) { saidAt.set(g, g.clock); toast(g, line); }
}

/**
 * The little door behind the ring: open, if the burning pendant's opened it this run. Otherwise, wearing it burning,
 * it opens: the pendant and the carved fires blaze, the last band snaps, the slab swings out, and he's put back a step
 * to see it. Otherwise it won't move. True if he's kept out.
 */
function sealedOut(g: Game, exit: ExitDef): boolean {
  const run = runOf(g);
  if (run.sealOpen && g.clock - run.openedAt > UNDERCROFT.swing) return false;
  stepBack(g, exit.rect);
  if (run.sealOpen) return true;                             // still swinging open
  if (!wearingPendant(g) || !pendantCharged(g)) { say(g, UNDERCROFT_SAYS.sealShut); return true; }
  run.sealOpen = true;
  run.openedAt = g.clock;
  const at = sealOf(g) ?? g.world.need(g.player, "transform");
  g.fx.push({ type: "burst", x: at.x, y: at.y - 6, palette: "frost" });
  g.fx.push({ type: "toll", x: at.x, y: at.y, radius: UNDERCROFT.wake });
  g.shake = Math.max(g.shake, 3);
  sound(g, "toll", at);
  for (const line of UNDERCROFT_SAYS.sealOpens) toast(g, line, true);
  return true;
}

/** Has the burning pendant opened the little door behind the ring, this run? */
export const sealOpen = (g: Game): boolean => runOf(g).sealOpen;

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

/** The spot just in front of the little sealed door behind the ring, if this area has it (game px, an entity's top-left). */
export function sealOf(g: Game): { x: number; y: number } | null {
  for (const p of g.area.layout.props) if (p.kind === "crypt") {
    const x0 = p.rect.x / T, z0 = p.rect.y / T, x1 = (p.rect.x + p.rect.w) / T, z1 = (p.rect.y + p.rect.h) / T, off = ROOM_WALL.thick + 1.15, a = p.seal.at;
    const [x, z] = { north: [x0 + a, z0 + off], south: [x0 + a, z1 - off], west: [x0 + off, z0 + a], east: [x1 - off, z0 + a] }[p.seal.side];
    return { x: x! * T - HALF, y: z! * T - HALF };
  }
  return null;
}

/** The stone, back in the ring, if it's here. */
const ringstoneHere = (g: Game) => g.world.query("renderable").some(([, c]) => c.renderable.kind === "ringstone");

/** This run, per game: has he been down here yet (he's told where he is the first time), been told the ring's warm, seen the sealed door? */
interface Run { visited: boolean; hinted: boolean; sealSeen: boolean; sealCalm: boolean; sealOpen: boolean; openedAt: number }
const runs = new WeakMap<Game, Run>();
function runOf(g: Game): Run {
  let r = runs.get(g);
  if (!r) {
    const fresh = { visited: false, hinted: false, sealSeen: false, sealCalm: false, sealOpen: false, openedAt: -Infinity };
    runs.set(g, r = fresh);
    g.events.on("reset", () => { fresh.visited = fresh.hinted = fresh.sealSeen = fresh.sealCalm = fresh.sealOpen = false; });
  }
  return r;
}

/**
 * Every frame, in the Undercroft: the first time down, a word on where he is; the first time up by the sealed door
 * behind the ring, a word on that (and once the ring's whole, that it's quiet). If the stone's been set back, it's
 * standing in its socket, and the ring's an old stone: walking up to it, he touches it. If he's carrying the stone
 * and walks up to the socket, it goes home and the ring wakes.
 */
export function undercroftSystem(g: Game): void {
  const socket = socketOf(g);
  if (!socket) return;
  const run = runOf(g);
  if (!run.visited) { run.visited = true; toast(g, UNDERCROFT_SAYS.arrive, true); }
  const seal = sealOf(g), me = g.world.need(g.player, "transform"), set = spentCurios(g).has("stone");
  if (seal && Math.hypot(me.x - seal.x, me.y - seal.y) < UNDERCROFT.seal) {
    if (!run.sealSeen) {
      run.sealSeen = true;
      if (set) { run.sealCalm = true; toast(g, UNDERCROFT_SAYS.seal[0]); toast(g, UNDERCROFT_SAYS.sealCalm); }
      else for (const line of UNDERCROFT_SAYS.seal) toast(g, line);
    } else if (set && !run.sealCalm) { run.sealCalm = true; toast(g, UNDERCROFT_SAYS.sealCalm); }
  }
  if (set && !ringstoneHere(g)) setStone(g, socket);
  if (seal && !g.world.query("renderable").some(([, c]) => c.renderable.kind === "sealdoor")) {
    g.world.create({ transform: { ...seal }, renderable: { kind: "sealdoor" } });   // its slab, shut or swung open (src/render/undercroft.ts)
  }
  if (set) {
    const ring = ringStone(g);
    if (Math.hypot(me.x - socket.x, me.y - socket.y) < UNDERCROFT.stone.touch) {
      if (!sameStone(lastStone(g), ring)) touchStone(g, ring, socket.x, socket.y);
    }
    return;
  }
  if (!carryingCurio(g, "stone")) return;
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
  const pendant = dropLoot(g, socket.x, socket.y + 12, { ...makeItem(r.type, r.rarity, { ...r.mods }, r.name), note: PENDANT.note(0) });
  g.world.remove(pendant, "despawn");                        // it'll wait for him, if his bag's full
  const health = g.world.need(g.player, "health");
  health.hp = health.maxHp;                                  // the warmth goes right through him
  touchStone(g, ringStone(g), socket.x, socket.y, true);     // and it knows him: he'll wake here (it's just said so)
}

/** The woken ring, as an old stone: he wakes at the ring's entry, just in from the socket. */
const ringStone = (g: Game) => ({ area: g.area.def.id, entry: "ring", name: UNDERCROFT.stone.name });
const sameStone = (a: { area: string; entry: string } | null, b: { area: string; entry: string }) => a?.area === b.area && a.entry === b.entry;

function setStone(g: Game, at: { x: number; y: number }): void {
  g.world.create({ transform: { ...at }, renderable: { kind: "ringstone" } });
}
