// Rime's fight, in her arena out in the middle of the Frozen Hollow's lake (the rules are RIME_FIGHT, in
// src/data/hollow.ts). She isn't there until the hero steps in among her pillars of ice: then a wall of ice shoots up
// between them, she rises out of the ice in the middle, and nobody leaves until one of them falls. There's nowhere to
// hide in there: just her, and patches of frost creeping over the ice round him, one always under his feet, that
// freeze him solid if he's still standing in them when they set. When she falls, the lake thaws
// in a ring round where she stood, open water for the rest of the run. Drawn by the rimefrost view (src/render/rime.ts),
// on an entity made for the fight at the stage's middle, and once she's fallen, on one that keeps the thaw.
import type { Entity } from "../core/ecs.ts";
import { RIME_FIGHT as F } from "../data/hollow.ts";
import { HALF, T, Tile } from "../data/world.ts";
import type { TileMap } from "../world/map.ts";
import { beaten, bossHere, bossWaiting, fellAt, summonBoss } from "./bosses.ts";
import { isFrozen } from "./cheats.ts";
import { cancelActions } from "./combat.ts";
import { toast, type Game } from "./game.ts";
import { heroParts } from "./hero.ts";
import { sound } from "./sfx.ts";

/** A patch of frost creeping over the ice (t < warn), then frozen hard (t < warn + hold). Cell top-left, like everything. */
export interface Patch { x: number; y: number; t: number; hit: boolean }

export interface RimeFight {
  /** The stage's middle (cell top-left). */
  x: number; y: number;
  /** Seconds since she rose. */
  t: number;
  angry: boolean;
  patches: Patch[];
  nextPatches: number;
  /** The entity it's drawn on. */
  view: Entity;
}

const fights = new WeakMap<Game, RimeFight>();
/** The entity the thaw's drawn on, and which arrival it was made in (leaving the Hollow clears everything). */
const thawViews = new WeakMap<Game, { e: Entity; in: Game["area"] }>();
const listening = new WeakSet<Game>();

/** The fight in progress, if she's risen. */
export const rimeFight = (g: Game): RimeFight | null => fights.get(g) ?? null;

/** Every frame in her lair: raise her when the hero steps onto her stage, run the frost, and once she's fallen, the thaw. */
export function rimeFightSystem(g: Game, dt: number): void {
  if (!listening.has(g)) { listening.add(g); g.events.on("reset", () => { fights.delete(g); thawViews.delete(g); }); }
  if (g.area.def.id !== "hollow") return;
  const at = fellAt(g, "rime");
  if (at) {                                                 // the thaw stays for the run
    g.map = thawed(g.area.layout.map, at);
    if (thawViews.get(g)?.in !== g.area) thawViews.set(g, { e: g.world.create({ transform: { ...at }, renderable: { kind: "rimefrost" } }), in: g.area });
  }
  const f = fights.get(g);
  if (!f) { if (bossWaiting(g) === "rime") rise(g); return; }
  const rime = bossHere(g);
  if (rime === null || (g.world.get(rime, "health")?.hp ?? 0) <= 0) { end(g, f, beaten(g, "rime")); return; }
  run(g, f, rime, dt);
}

/** The middle of her stage (cell top-left), from the area's props. */
function stageOf(g: Game): { x: number; y: number } | null {
  const stage = g.area.layout.props.find(p => p.kind === "rimeStage");
  return stage?.kind === "rimeStage" ? { x: stage.x - HALF, y: stage.y - HALF } : null;
}

/** The hero's in among her pillars: up goes the ice between them, and up she comes out of the ice in the middle. */
function rise(g: Game): void {
  const at = stageOf(g), p = g.world.need(g.player, "transform");
  if (!at || Math.hypot(p.x - at.x, p.y - at.y) > F.shutAt) return;
  const view = g.world.create({ transform: { ...at }, renderable: { kind: "rimefrost" } });
  fights.set(g, { ...at, t: 0, angry: false, patches: [], nextPatches: 2, view });
  g.shake = Math.max(g.shake, 2);
  sound(g, "nova", at);
  toast(g, F.say.shut, true);
  summonBoss(g);
  toast(g, F.say.rise);
}

/** She's down (or the hero's gone): the frost lets go, and if she fell, the lake thaws round where she stood. */
function end(g: Game, f: RimeFight, fell: boolean): void {
  if (g.world.isAlive(f.view)) g.world.destroy(f.view);
  fights.delete(g);
  if (!fell) return;
  toast(g, F.say.open);
  g.map = thawed(g.area.layout.map, fellAt(g, "rime")!);
  g.shake = Math.max(g.shake, 2);
  sound(g, "thunder", g.world.need(g.player, "transform"));   // the ice cracking
  toast(g, F.say.thaw);
}

function run(g: Game, f: RimeFight, rime: Entity, dt: number): void {
  const h = heroParts(g), hp = g.world.need(rime, "health");
  f.t += dt;
  f.angry = hp.hp <= hp.maxHp * F.angry;
  keepIn(f, h.pos);
  const her = g.world.get(rime, "transform");
  if (her) keepIn(f, her);
  if (isFrozen(g)) return;                                  // playtesting: the frost holds still with her
  const P = F.patch, safe = h.motion.dash > 0 || h.motion.jump > 0;   // a dash or a jump gets him clear as it sets

  // Frost creeps out over the ice: one patch right under the hero, the rest round about him.
  if ((f.nextPatches -= dt) <= 0) {
    f.nextPatches = P.every[f.angry ? 1 : 0];
    const n = P.count[f.angry ? 1 : 0];
    for (let i = 0; i < n; i++) {
      const a = g.rng.next() * Math.PI * 2, d = 14 + g.rng.next() * 30;
      const spot = i === 0 ? { x: h.pos.x, y: h.pos.y } : { x: h.pos.x + Math.cos(a) * d, y: h.pos.y + Math.sin(a) * d };
      keepIn(f, spot);                                       // all of it inside the wall
      f.patches.push({ ...spot, t: 0, hit: false });
    }
    if (f.patches.length <= n) toast(g, F.say.patch);       // only said when the ice was clear
  }
  for (const pa of f.patches) {
    const was = pa.t;
    pa.t += dt;
    if (was >= P.warn || pa.t < P.warn) continue;
    // It sets: anyone still in it is frozen solid.
    g.fx.push({ type: "burst", x: pa.x, y: pa.y, palette: "frost" });
    sound(g, "boltPop", pa);
    if (!safe && h.status.frozen <= 0 && Math.hypot(h.pos.x - pa.x, h.pos.y - pa.y) < P.radius) {
      h.status.frozen = P.freeze;
      cancelActions(h.actions);
      pa.hit = true;
      toast(g, "Frozen!");
    }
  }
  f.patches = f.patches.filter(pa => pa.t < P.warn + P.hold);
}

/** Nobody leaves the ring: kept within its wall of ice. */
function keepIn(f: RimeFight, t: { x: number; y: number }): void {
  const dx = t.x - f.x, dy = t.y - f.y, d = Math.hypot(dx, dy);
  if (d <= F.keepIn) return;
  t.x = f.x + (dx / d) * F.keepIn;
  t.y = f.y + (dy / d) * F.keepIn;
}

/** Is the tile at (x, y) in the thaw round (cx, cy) (tiles)? */
export function inThaw(x: number, y: number, cx: number, cy: number): boolean {
  const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy);
  return d >= F.thaw.inner && d <= F.thaw.outer;
}

/** The lake with the ring round where she fell (cell top-left) thawed to open water. */
const thaws = new WeakMap<TileMap, { key: string; map: TileMap }>();
export function thawed(map: TileMap, at: { x: number; y: number }): TileMap {
  const key = `${at.x},${at.y}`, done = thaws.get(map);
  if (done?.key === key) return done.map;
  const cx = (at.x + HALF) / T, cy = (at.y + HALF) / T;
  const tiles = map.tiles.map((row, y) => row.map((t, x) => (t === Tile.Ice && inThaw(x, y, cx, cy) ? Tile.Water : t)));
  const out = { ...map, tiles };
  thaws.set(map, { key, map: out });
  return out;
}
