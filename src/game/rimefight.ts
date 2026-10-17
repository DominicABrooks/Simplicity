// Rime's fight, in her arena out in the middle of the Frozen Hollow's lake (the rules are RIME_FIGHT, in
// src/data/hollow.ts). She isn't there until the hero steps in among her pillars of ice: then a wall of ice shoots up
// between them, she rises out of the ice in the middle, and nobody leaves until one of them falls. There's nowhere to
// hide in there: just her; patches of frost creeping over the ice round him, one always under his feet, that freeze
// him solid if he's still standing in them when they set; and every so often she stands still and throws icicles out
// across the ice in rings and spirals for him to weave through. Hit her twice in a row and she's had enough: as like
// as not she seals herself in a block of ice that nothing hurts, while the floor fills with frost and falling icicles,
// then bursts out of it in a nova that freezes anyone still at her side; or else she blinks away. When she falls, the lake thaws
// in a ring round where she stood, open water for the rest of the run. Drawn by the rimefrost view (src/render/rime.ts),
// on an entity made for the fight at the stage's middle, and once she's fallen, on one that keeps the thaw.
import type { Entity } from "../core/ecs.ts";
import { RIME_FIGHT as F } from "../data/hollow.ts";
import { MAGE } from "../data/enemies.ts";
import { HALF, T, Tile } from "../data/world.ts";
import type { TileMap } from "../world/map.ts";
import { beaten, bossHere, bossWaiting, fellAt, summonBoss } from "./bosses.ts";
import { isFrozen } from "./cheats.ts";
import { cancelActions, damagePlayer } from "./combat.ts";
import { toast, type Game } from "./game.ts";
import { heroParts } from "./hero.ts";
import { sound } from "./sfx.ts";
import { spawnBolt } from "./spawn.ts";
import { blinkMageTo, clearAt } from "../systems/mage.ts";

/** A patch of frost creeping over the ice (t < warn), then frozen hard (t < warn + hold). Cell top-left, like everything. */
export interface Patch { x: number; y: number; t: number; hit: boolean }
/** An icicle falling out of the cold while she's in her block: marked on the ice (t < warn), then shattered there (t < warn + shatter). */
export interface Fall { x: number; y: number; t: number; hit: boolean }
/** A volley of icicles: drawing the cold in (wind > 0), then firing round after round. */
export interface Volley { pattern: "rings" | "spiral"; wind: number; rounds: number; fired: number; next: number; base: number }

export interface RimeFight {
  /** The stage's middle (cell top-left). */
  x: number; y: number;
  /** Seconds since she rose. */
  t: number;
  angry: boolean;
  patches: Patch[];
  nextPatches: number;
  /** The volley she's throwing, if she is; seconds to the next; and which pattern that'll be. */
  volley: Volley | null;
  nextVolley: number;
  nextPattern: Volley["pattern"];
  /** Sealed in ice (seconds in), if she is; and seconds before she can be again. */
  block: { t: number } | null;
  /** Her last stand (seconds in, the spiral's angle and when the next round and ring go), while it lasts. */
  stand: { t: number; angle: number; next: number; nextRing: number } | null;
  blockCD: number;
  /** Hits on her in a row (F.crowded), seconds since the last, and her health last frame (to see them land). */
  hits: number; sinceHit: number; lastHp: number;
  falls: Fall[];
  nextFalls: number;
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
    if (g.map.tiles !== lake(g).tiles) g.map = lake(g);    // (once it's thawed, leave Yssa's solid in it be)
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
  fights.set(g, {
    ...at, t: 0, angry: false, patches: [], nextPatches: 2, view,
    volley: null, nextVolley: F.volley.first, nextPattern: "rings", block: null, blockCD: 0, hits: 0, sinceHit: 0, lastHp: Infinity, stand: null, falls: [], nextFalls: 0,
  });
  g.shake = Math.max(g.shake, 2);
  sound(g, "nova", at);
  toast(g, F.say.shut, true);
  const rime = summonBoss(g);
  if (rime !== null) fights.get(g)!.lastHp = g.world.need(rime, "health").hp;
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
  const h = heroParts(g), hp = g.world.need(rime, "health"), enemy = g.world.need(rime, "enemy"), brain = g.world.need(rime, "mage");
  f.t += dt;
  f.angry = hp.hp <= hp.maxHp * F.angry;
  keepIn(f, h.pos);
  const her = g.world.need(rime, "transform");
  keepIn(f, her);
  // Icicles shatter on the wall.
  for (const [, { bolt, transform: b }] of g.world.query("bolt", "transform"))
    if (bolt.kind === "icicle" && Math.hypot(b.x - f.x, b.y - f.y) > F.keepIn + 6) bolt.life = 0;
  if (isFrozen(g)) return;                                  // playtesting: the frost holds still with her
  const safe = h.motion.dash > 0 || h.motion.jump > 0;      // a dash or a jump gets him clear

  // The blow that should have finished her: her last stand.
  if (enemy.lastStand === "taken" && !f.stand) lastStand(g, f, rime);
  if (f.stand) {
    standPhase(g, f, rime, dt, safe);
    brain.held = true;
    enemy.warded = !!f.stand;
    if (!f.stand) brain.held = false;
    fallsAndPatches(g, f, dt, safe, false);
    return;
  }
  // Hit twice in a row: into the ice she goes, or away she blinks, by the toss of a coin (the block, only when she can).
  // Never a mage's own blink away for the hero coming close.
  f.blockCD = Math.max(0, f.blockCD - dt);
  brain.blinkCD = Math.max(brain.blinkCD, 1);
  f.sinceHit += dt;
  if (hp.hp < f.lastHp) { f.hits = f.sinceHit <= F.crowded.within ? f.hits + 1 : 1; f.sinceHit = 0; }
  f.lastHp = hp.hp;
  if (!f.block && f.hits >= F.crowded.hits) {
    f.hits = 0;
    if (f.blockCD <= 0 && g.rng.next() < F.crowded.chance) seal(g, f, rime);
    else blinkAway(g, f, rime, h.pos);
  }
  if (f.block) blockPhase(g, f, rime, dt, safe);
  else volleys(g, f, rime, dt);
  brain.held = !!f.block || !!f.volley;
  enemy.warded = !!f.block;
  fallsAndPatches(g, f, dt, safe, true);
}

/** The frost patches (when `creeping`: not in her last stand, where it's all icicles) and the falling icicles. */
function fallsAndPatches(g: Game, f: RimeFight, dt: number, safe: boolean, creeping: boolean): void {
  const h = heroParts(g), B = F.block;

  // Frost creeps out over the ice: one patch right under the hero, the rest round about him (faster, and all over, in the block).
  const P = F.patch;
  if (creeping && !f.volley && (f.nextPatches -= dt) <= 0) {   // not while she's throwing icicles: one thing at a time
    f.nextPatches = f.block ? B.patches.every : P.every[f.angry ? 1 : 0];
    const n = f.block ? B.patches.count : P.count[f.angry ? 1 : 0];
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

  // Icicles falling out of the cold (only while she's in the block, but the last of them still land).
  const L = B.falls;
  for (const fa of f.falls) {
    const was = fa.t;
    fa.t += dt;
    if (was >= L.warn || fa.t < L.warn) continue;
    g.fx.push({ type: "burst", x: fa.x, y: fa.y, palette: "frost" });
    sound(g, "boltPop", fa);
    if (!safe && h.status.hurt <= 0 && Math.hypot(h.pos.x - fa.x, h.pos.y - fa.y) < L.radius) { damagePlayer(g, fa.x, fa.y, L.damage); fa.hit = true; }
  }
  f.falls = f.falls.filter(fa => fa.t < L.warn + L.shatter);
}

/** Every so often she stands still, draws the cold in, and throws a volley of icicles: rings, or a spiral, turn about. */
function volleys(g: Game, f: RimeFight, rime: Entity, dt: number): void {
  const V = F.volley, k = f.angry ? 1 : 0, at = g.world.need(rime, "transform");
  if (!f.volley) {
    if ((f.nextVolley -= dt) > 0) return;
    const pattern = f.nextPattern;
    f.nextPattern = pattern === "rings" ? "spiral" : "rings";
    f.volley = { pattern, wind: V.wind, rounds: pattern === "rings" ? V.rings.waves[k] : V.spiral.shots[k], fired: 0, next: 0, base: g.rng.next() * Math.PI * 2 };
    const brain = g.world.need(rime, "mage");
    Object.assign(brain, { casting: false, castK: 0, spell: null, melee: false, swing: null });
    sound(g, "spell", at);
    return;
  }
  const v = f.volley;
  if (v.wind > 0) { v.wind -= dt; return; }
  if ((v.next -= dt) > 0) return;
  // A round: a whole ring, each turned half a gap from the last; or each arm of the spiral, a little further round.
  const o = MAGE.boltOffset;
  const shots = v.pattern === "rings"
    ? Array.from({ length: V.rings.count[k] }, (_, i) => v.base + ((i + (v.fired % 2) / 2) / V.rings.count[k]) * Math.PI * 2)
    : Array.from({ length: V.spiral.arms[k] }, (_, i) => v.base + v.fired * V.spiral.turn + (i / V.spiral.arms[k]) * Math.PI * 2);
  for (const a of shots) spawnBolt(g, "icicle", at.x + Math.cos(a) * o, at.y + Math.sin(a) * o, Math.cos(a) * V.speed, Math.sin(a) * V.speed);
  sound(g, "cast", at);
  v.fired++;
  v.next = v.pattern === "rings" ? V.rings.gap : V.spiral.gap;
  if (v.fired >= v.rounds) { f.volley = null; f.nextVolley = V.every[f.angry ? 1 : 0]; }
}

/** The blow that should have finished her didn't: she blinks to the middle and seals herself in, and the icicles come. */
function lastStand(g: Game, f: RimeFight, rime: Entity): void {
  const at = g.world.need(rime, "transform"), brain = g.world.need(rime, "mage");
  g.fx.push({ type: "burst", x: at.x, y: at.y, palette: "arcane" });
  at.x = f.x; at.y = f.y;                                   // to the middle of the ring
  g.fx.push({ type: "burst", x: at.x, y: at.y, palette: "frost" });
  f.stand = { t: 0, angle: g.rng.next() * Math.PI * 2, next: 1, nextRing: 2 };
  f.block = null; f.volley = null; f.patches = []; f.nextFalls = 1.5;
  for (const [e, { bolt }] of g.world.query("bolt")) if (bolt.kind === "icicle") g.world.destroy(e);
  Object.assign(brain, { casting: false, castK: 0, spell: null, melee: false, swing: null });
  g.shake = Math.max(g.shake, 2.5);
  sound(g, "blink", at);
  sound(g, "nova", at);
  toast(g, F.say.stand, true);
}

/** Her last stand: held in her block in the middle, icicles pouring out of it, until it's done and out she staggers. */
function standPhase(g: Game, f: RimeFight, rime: Entity, dt: number, safe: boolean): void {
  const S = F.lastStand, s = f.stand!, at = g.world.need(rime, "transform"), h = heroParts(g), o = MAGE.boltOffset;
  at.x = f.x; at.y = f.y;
  s.t += dt;
  const fire = (a: number) => spawnBolt(g, "icicle", at.x + Math.cos(a) * o, at.y + Math.sin(a) * o, Math.cos(a) * S.speed, Math.sin(a) * S.speed);
  // The spiral, turning one way and then back the other.
  if ((s.next -= dt) <= 0) {
    s.next = S.spiral.gap;
    s.angle += S.spiral.turn * (Math.floor(s.t / S.spiral.flip) % 2 ? -1 : 1);
    for (let i = 0; i < S.spiral.arms; i++) fire(s.angle + (i / S.spiral.arms) * Math.PI * 2);
    sound(g, "cast", at);
  }
  // Rings through it.
  if (S.rings.count > 0 && (s.nextRing -= dt) <= 0) {
    s.nextRing = S.rings.every;
    const base = g.rng.next() * Math.PI * 2;
    for (let i = 0; i < S.rings.count; i++) fire(base + (i / S.rings.count) * Math.PI * 2);
  }
  // Now and then an icicle drops out of the cold, one of them on him.
  if ((f.nextFalls -= dt) <= 0) {
    f.nextFalls = S.falls.every;
    for (let i = 0; i < S.falls.count; i++) {
      const a = g.rng.next() * Math.PI * 2, d = Math.sqrt(g.rng.next()) * (F.keepIn - 4);
      f.falls.push(i === 0 ? { x: h.pos.x, y: h.pos.y, t: 0, hit: false } : { x: f.x + Math.cos(a) * d, y: f.y + Math.sin(a) * d, t: 0, hit: false });
    }
  }
  if (s.t < S.hold) return;
  // Out she staggers, spent: the next blow that should finish her will.
  f.stand = null;
  const enemy = g.world.need(rime, "enemy");
  enemy.lastStand = "spent";
  enemy.warded = false;
  enemy.melee = 0;
  f.blockCD = F.block.cooldown;
  f.nextVolley = Math.max(f.nextVolley, 3);
  g.fx.push({ type: "nova", x: at.x, y: at.y, radius: F.block.burst.radius });
  g.shake = Math.max(g.shake, 2);
  sound(g, "nova", at);
  toast(g, F.say.standOut, true);
  if (!safe && Math.hypot(h.pos.x - at.x, h.pos.y - at.y) < F.block.burst.radius) {
    h.status.frozen = F.block.burst.freeze;
    cancelActions(h.actions);
  }
}

/**
 * Hit twice in a row, and the coin came down for the blink: away she goes, somewhere inside her ring of ice and well
 * in from it (never into the wall, to be pushed back out of it), and away from the hero; of the spots she looks at,
 * the furthest from him that's clear.
 */
function blinkAway(g: Game, f: RimeFight, rime: Entity, hero: { x: number; y: number }): void {
  const B = F.blink, reach = F.keepIn - B.wall;
  let best: { x: number; y: number; d: number } | null = null;
  for (let i = 0; i < MAGE.blinkTries; i++) {
    const a = g.rng.next() * Math.PI * 2, r = Math.sqrt(g.rng.next()) * reach;
    const x = Math.round(f.x + Math.cos(a) * r), y = Math.round(f.y + Math.sin(a) * r), d = Math.hypot(x - hero.x, y - hero.y);
    if (!clearAt(g, x, y) || (best && d <= best.d)) continue;
    best = { x, y, d };
    if (d >= B.away) break;
  }
  if (best) blinkMageTo(g, g.world.need(rime, "transform"), g.world.need(rime, "mage"), g.world.need(rime, "knockback"), best.x, best.y);
}

/** Hit twice in a row, and the coin came down for it: into a block of ice she goes. */
function seal(g: Game, f: RimeFight, rime: Entity): void {
  const at = g.world.need(rime, "transform"), brain = g.world.need(rime, "mage");
  f.block = { t: 0 };
  f.volley = null;
  f.nextFalls = 0.3;
  g.world.need(rime, "enemy").melee = 0;
  Object.assign(brain, { casting: false, castK: 0, spell: null, melee: false, swing: null });
  g.fx.push({ type: "burst", x: at.x, y: at.y, palette: "frost" });
  g.shake = Math.max(g.shake, 1.5);
  sound(g, "nova", at);
  toast(g, F.say.block, true);
}

/** Sealed in: the cold comes down all over the ring, and when it's done she bursts out. */
function blockPhase(g: Game, f: RimeFight, rime: Entity, dt: number, safe: boolean): void {
  const B = F.block, h = heroParts(g), at = g.world.need(rime, "transform"), block = f.block!;
  block.t += dt;
  if ((f.nextFalls -= dt) <= 0) {
    f.nextFalls = B.falls.every;
    for (let i = 0; i < B.falls.count; i++) {               // anywhere in the ring, and now and then right on him
      const a = g.rng.next() * Math.PI * 2, d = Math.sqrt(g.rng.next()) * (F.keepIn - 4);
      const spot = i === 0 && g.rng.next() < 0.4 ? { x: h.pos.x, y: h.pos.y } : { x: f.x + Math.cos(a) * d, y: f.y + Math.sin(a) * d };
      f.falls.push({ ...spot, t: 0, hit: false });
    }
  }
  if (block.t < B.hold) return;
  // Out she bursts: a nova all round her.
  f.block = null;
  f.blockCD = B.cooldown;
  f.nextVolley = Math.max(f.nextVolley, 1.5);
  g.fx.push({ type: "nova", x: at.x, y: at.y, radius: B.burst.radius });
  g.shake = Math.max(g.shake, 2);
  sound(g, "nova", at);
  toast(g, F.say.burst);
  if (!safe && Math.hypot(h.pos.x - at.x, h.pos.y - at.y) < B.burst.radius) {
    h.status.frozen = B.burst.freeze;
    cancelActions(h.actions);
    toast(g, "Frozen!");
  }
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

/** The Hollow's lake as it stands this run: thawed round where she fell, once she has (Yssa's built on it: src/game/yssa.ts). */
export function lake(g: Game): TileMap {
  const at = g.area.def.id === "hollow" ? fellAt(g, "rime") : null;
  return at ? thawed(g.area.layout.map, at) : g.area.layout.map;
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
