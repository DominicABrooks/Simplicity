// Calder's fight, at the edge of the great crack in the Thunder Rift (the rules are CALDER_FIGHT, in src/data/rift.ts).
// He isn't there until the hero comes up close to the crack: then lightning comes down all round the glade, Calder
// turns from the edge, and nobody leaves until one of them falls. He's a Storm mage underneath (sparks, and three
// lightning strikes at a time), and over it, all the shapes lightning makes, in three moods as he weakens: his sparks
// forking as they fly, and strikes walking out at the hero in a line or bursting out from him in a star; then three
// iron rods driven into the ground with lightning running round the triangle between them, and him blinking from rod
// to rod, the air crackling behind him; at half his health, the storm proper, a cage of lightning round him in the
// middle of the ring while sparks spiral and ring out of it, walls of lightning sweep across and strikes come down
// under the hero, until it bursts and he staggers out; then the eye of the storm, the whole triangle at once, the rods arcing to him,
// and rings of strikes closing in on the hero. After every blink he stops to earth himself, the moment for a blade.
// His static turns any arrow short of a full draw. And the crack opens wider every time the hero's knocked back and
// closes a little every time he lands a hit, its cold dragging at him and its dark spreading across the ground the
// wider it gets. When he falls, the crack groans shut for the rest of the run. Drawn by the tempest view
// (src/render/tempest.ts), on an entity made for the fight at the glade's middle, and once he's fallen, on one that
// keeps the crack shut.
import type { Entity } from "../core/ecs.ts";
import { CALDER_FIGHT as F } from "../data/rift.ts";
import { MAGE } from "../data/enemies.ts";
import { COMBAT_COLORS } from "../data/ui.ts";
import { HALF, T } from "../data/world.ts";
import type { Prop } from "../world/area.ts";
import { moveBy } from "../world/collision.ts";
import { greatCrackSpine } from "../world/greatcrack.ts";
import { beaten, bossHere, bossWaiting, fellAt, summonBoss } from "./bosses.ts";
import { isFrozen } from "./cheats.ts";
import { combatText, damagePlayer } from "./combat.ts";
import { toast, type Game } from "./game.ts";
import { heroParts } from "./hero.ts";
import { sound } from "./sfx.ts";
import { spawnBolt, spawnStrike } from "./spawn.ts";

interface Point { x: number; y: number }
/** Lightning along a line from `a` to `b` (cell top-left): marked by a flicker (t < warn), then live (t < warn + live). */
export interface Arc { a: Point; b: Point; t: number; warn: number; live: number; hit: boolean }
/** His three moods: the storm walks, the rods, the eye of the storm. */
export type Mood = 0 | 1 | 2;
/** Which way a wall of lightning sweeps across the ring: east is from the west side across to the east. */
export type Sweep = "east" | "west" | "south" | "north";
/** The storm proper, while it lasts: seconds in; the spiral's angle; seconds to its next round, the next ring, wall and
 *  strike; how many rings there've been; the walls sweeping (each an arc whose ends move with it). */
export interface Storm {
  t: number; angle: number; next: number; nextRing: number; nextWall: number; nextStrike: number; rings: number;
  walls: { dir: Sweep; arc: Arc }[];
}

export interface CalderFight {
  /** The ring's middle (cell top-left), and how far out it is (px). */
  x: number; y: number; r: number;
  /** Seconds since the lightning shut the glade. */
  t: number;
  mood: Mood;
  /** How open the great crack is: 0 shut, 1 as wide as it goes. */
  open: number;
  /** Seconds to the next shape of strikes, and how many there've been (they take turns). */
  nextShape: number; shapes: number;
  /** The iron rods round the glade, once he's driven them in, and how long they've been going in (s). */
  rods: Point[]; planted: number;
  /** The lightning between the rods (and behind his blinks); seconds to the next, and which side of the triangle's next. */
  arcs: Arc[]; nextArc: number; side: number;
  /** Seconds to his next blink from rod to rod, and which rod he's at. */
  nextBlink: number; rod: number;
  /** Earthing himself after a blink (seconds left). */
  earth: number;
  /** The storm proper, while he's in his cage; and whether it's been yet (it comes once). */
  storm: Storm | null; stormed: boolean;
  /** His sparks still to fork: each one, and how long it's been flying. */
  forks: Map<Entity, number>;
  /** Where he stood last frame, his health and melee damage taken then, and the hero's hurt (to see blinks, hits and knocks). */
  last: { x: number; y: number; hp: number; melee: number; hurt: number };
  /** Seconds before the crack's cold pulls at him again, after it's bitten him. */
  letGo: number;
  /** Whether he's said yet that his static turns the arrows. */
  toldStatic: boolean;
  /** The entity it's drawn on. */
  view: Entity;
}

const fights = new WeakMap<Game, CalderFight>();
/** Once he's fallen: the entity the shut crack's drawn on, which arrival it was made in, and how far it's got shutting. */
const scars = new WeakMap<Game, { e: Entity; in: Game["area"]; t: number; from: number }>();
const listening = new WeakSet<Game>();

/** The fight in progress, if the lightning's shut the glade. */
export const calderFight = (g: Game): CalderFight | null => fights.get(g) ?? null;

/**
 * How wide the great crack is drawn and reaches, times its own width: as it was made before the fight; opening and
 * closing in it; and once he's fallen, groaning shut to a seam of grey stone.
 */
export function crackWidth(g: Game): number {
  const f = fights.get(g);
  if (f) return 1 + f.open * (F.crack.widest - 1);
  const s = scars.get(g), k = crackSealed(g);
  return s ? s.from + (F.crack.seam - s.from) * k : fellAt(g, "calder") ? F.crack.seam : 1;
}

/** How far the great crack has sealed over with grey stone since Calder fell (0 open, 1 shut for good). */
export function crackSealed(g: Game): number {
  const s = scars.get(g);
  if (!s) return fellAt(g, "calder") ? 1 : 0;
  const k = Math.min(1, s.t / F.crack.shut);
  return 1 - (1 - k) * (1 - k);
}

/** The crack open again and groaning shut from the start, on this arrival (the credits show it: src/game/credits.ts). */
export function reopenCrack(g: Game): void {
  const s = scars.get(g);
  if (s?.in === g.area) Object.assign(s, { t: 0, from: 1 });
}

/** Seconds since Calder fell, on this arrival in the Rift (counted from the crack's having shut, on any later one); null if he hasn't. */
export const calderGone = (g: Game): number | null => scars.get(g)?.t ?? null;

/** Every frame in his lair: shut the glade when the hero comes close, run the storm and the crack, and once he's fallen, keep it shut. */
export function calderFightSystem(g: Game, dt: number): void {
  if (!listening.has(g)) { listening.add(g); g.events.on("reset", () => { fights.delete(g); scars.delete(g); }); }
  if (g.area.def.id !== "rift") return;
  const at = fellAt(g, "calder");
  if (at) {                                                 // shut for the run
    const s = scars.get(g);
    if (s?.in !== g.area) scars.set(g, { e: g.world.create({ transform: { ...at }, renderable: { kind: "tempest" } }), in: g.area, t: s ? F.crack.shut : 0, from: s?.from ?? 1 });
    else s.t += dt;
  }
  const f = fights.get(g);
  if (!f) { if (bossWaiting(g) === "calder") shut(g); return; }
  const calder = bossHere(g);
  if (calder === null || (g.world.get(calder, "health")?.hp ?? 0) <= 0) { end(g, f, beaten(g, "calder")); return; }
  run(g, f, calder, dt);
}

/** Where he stands, at the crack's edge (cell top-left), from the area's props. */
function standOf(g: Game): Point | null {
  const p = g.area.layout.props.find((q): q is Extract<Prop, { kind: "boss" }> => q.kind === "boss" && q.who === "calder");
  return p ? { x: p.x - HALF, y: p.y - HALF } : null;
}

/** The great crack, as the area made it. */
const crackOf = (g: Game) => g.area.layout.props.find((p): p is Extract<Prop, { kind: "greatCrack" }> => p.kind === "greatCrack") ?? null;

/** The hero's come up close: down comes the lightning all round, and Calder turns from the edge. */
function shut(g: Game): void {
  const stand = standOf(g), p = g.world.need(g.player, "transform");
  if (!stand || Math.hypot(p.x - stand.x, p.y - stand.y) > F.shutAt) return;
  const A = F.arena, mid = { x: stand.x, y: stand.y + A.below * T };
  const view = g.world.create({ transform: { ...mid }, renderable: { kind: "tempest" } });
  const e = summonBoss(g);
  const hp = e === null ? 0 : g.world.need(e, "health").hp;
  fights.set(g, {
    ...mid, r: A.r * T, t: 0, mood: 0, open: F.crack.start, nextShape: F.shapes.first, shapes: 0,
    rods: [], planted: 0, arcs: [], nextArc: 0, side: 0, nextBlink: F.rods.blink, rod: 0, earth: 0, storm: null, stormed: false, forks: new Map(),
    last: { ...stand, hp, melee: 0, hurt: heroParts(g).status.hurt }, letGo: 0, toldStatic: false, view,
  });
  g.shake = Math.max(g.shake, 2.5);
  sound(g, "thunder", p);
  toast(g, F.say.shut, true);
  toast(g, F.say.rise);
}

/** He's down (or the hero's gone): the lightning goes out, and if he fell, the crack starts to groan shut. */
function end(g: Game, f: CalderFight, fell: boolean): void {
  if (g.world.isAlive(f.view)) g.world.destroy(f.view);
  fights.delete(g);
  if (!fell) return;
  const at = fellAt(g, "calder")!;
  scars.set(g, { e: g.world.create({ transform: { ...at }, renderable: { kind: "tempest" } }), in: g.area, t: 0, from: 1 + f.open * (F.crack.widest - 1) });
  toast(g, F.say.open);
  g.shake = Math.max(g.shake, 3);
  sound(g, "thunder", at);
  toast(g, F.say.shutCrack);
}

function run(g: Game, f: CalderFight, calder: Entity, dt: number): void {
  const h = heroParts(g), hp = g.world.need(calder, "health"), enemy = g.world.need(calder, "enemy"), brain = g.world.need(calder, "mage");
  const him = g.world.need(calder, "transform");
  f.t += dt;
  keepIn(f, h.pos);
  keepIn(f, him);

  // What happened since last frame: a blade caught him earthing himself; a hit landed (the crack closes a little);
  // the hero was knocked back (it opens wider).
  const melee = enemy.melee ?? 0, cut = melee - f.last.melee;
  if (cut > 0 && f.earth > 0) {
    hp.hp -= Math.round(cut * (F.cut - 1));
    combatText(g, him.x, him.y - 6, F.say.caught, COMBAT_COLORS.crit, true);
  }
  if (hp.hp < f.last.hp) f.open = Math.max(0, f.open - F.crack.hit);
  if (h.status.hurt > f.last.hurt + 0.01) widen(g, f);
  staticField(g, f, him);
  const remember = () => { f.last = { x: him.x, y: him.y, hp: hp.hp, melee, hurt: h.status.hurt }; };
  if (hp.hp <= 0 || isFrozen(g)) { remember(); return; }   // (playtesting: the storm holds still with him)

  // At half his health, the storm proper: nothing else while it lasts.
  const share = hp.hp / hp.maxHp;
  if (!f.stormed && share <= F.shield.at) startStorm(g, f, calder);
  if (f.storm) {
    theStorm(g, f, calder, dt);
    theCrack(g, f, brain, dt);
    arcs(g, f, dt);
    remember();
    return;
  }

  // His mood, as he weakens: at the rods' turn, in they go.
  const mood: Mood = share <= F.phases[1] ? 2 : share <= F.phases[0] ? 1 : 0;
  if (mood > f.mood) {
    if (f.mood === 0) plantRods(g, f);
    if (mood === 2) { toast(g, F.say.eye, true); g.shake = Math.max(g.shake, 2); sound(g, "thunder", him); f.nextShape = Math.min(f.nextShape, 1.5); }
    f.mood = mood;
  }

  // A blink (his own, or to the next rod): then he stops to earth himself.
  if (f.mood > 0) {
    brain.blinkCD = Math.max(brain.blinkCD, 1);              // he goes rod to rod now, not where a mage would
    if (f.planted >= F.rods.plant && f.earth <= 0 && (f.nextBlink -= dt) <= 0) blinkToRod(g, f, him);
  }
  if (Math.hypot(him.x - f.last.x, him.y - f.last.y) > F.jump && f.earth <= 0) f.earth = F.earth;
  if (f.earth > 0) {
    f.earth -= dt;
    brain.held = f.earth > 0;
    if (f.earth <= 0) brain.timer = Math.min(brain.timer, 0.3);
  }

  forkSparks(g, f, him, dt);
  theCrack(g, f, brain, dt);
  if (f.rods.length) theRods(g, f, him, dt);
  arcs(g, f, dt);
  if ((f.nextShape -= dt) <= 0) shape(g, f, him);
  remember();
}

/** Half his health gone: he blinks to the middle and wraps himself in lightning, and the storm proper begins. */
function startStorm(g: Game, f: CalderFight, calder: Entity): void {
  const S = F.shield, him = g.world.need(calder, "transform"), enemy = g.world.need(calder, "enemy"), brain = g.world.need(calder, "mage");
  f.stormed = true;
  g.fx.push({ type: "burst", x: him.x, y: him.y, palette: "arcane" });
  him.x = f.x; him.y = f.y;
  g.fx.push({ type: "burst", x: him.x, y: him.y, palette: "spark" });
  f.storm = { t: 0, angle: g.rng.next() * Math.PI * 2, next: 0.6, nextRing: S.rings.first, nextWall: S.walls.first, nextStrike: S.strikes.first, rings: 0, walls: [] };
  f.arcs = [];
  f.earth = 0;
  for (const [e] of g.world.query("strike")) g.world.destroy(e);
  Object.assign(brain, { casting: false, castK: 0, spell: null, melee: false, swing: null, held: true });
  enemy.warded = true;
  enemy.wardSay = F.say.warded;
  g.shake = Math.max(g.shake, 2.5);
  sound(g, "blink", him);
  sound(g, "thunder", him);
  toast(g, F.say.shield, true);
}

/** The storm proper: held in his cage in the middle, sparks pouring out of it, walls sweeping across, strikes under
 *  the hero; until it's done and the cage bursts. */
function theStorm(g: Game, f: CalderFight, calder: Entity, dt: number): void {
  const S = F.shield, s = f.storm!, h = heroParts(g), him = g.world.need(calder, "transform"), o = MAGE.boltOffset;
  him.x = f.x; him.y = f.y;
  g.world.need(calder, "mage").held = true;
  s.t += dt;
  const safe = h.motion.dash > 0 || h.motion.jump > 0;
  const fire = (a: number, v: number) => {
    const spark = spawnBolt(g, "spark", him.x + Math.cos(a) * o, him.y + Math.sin(a) * o, Math.cos(a) * v, Math.sin(a) * v);
    g.world.need(spark, "bolt").lost = true;                 // flying straight out
  };
  // The cage: come too close and it throws him back.
  const d = Math.hypot(h.pos.x - him.x, h.pos.y - him.y);
  if (d < S.radius && h.status.hurt <= 0 && !safe) { damagePlayer(g, him.x, him.y, 1); toast(g, F.say.cage); }
  // Sparks shatter on the ring of lightning round the glade.
  for (const [, { bolt, transform: b }] of g.world.query("bolt", "transform"))
    if (bolt.kind === "spark" && Math.hypot(b.x - f.x, b.y - f.y) > f.r + 6) bolt.life = 0;
  if (s.t < S.hold) {
    // The spiral, turning one way and then back the other.
    if ((s.next -= dt) <= 0) {
      const P = S.spiral;
      s.next = P.gap;
      s.angle += P.turn * (Math.floor(s.t / P.flip) % 2 ? -1 : 1);
      for (let i = 0; i < P.arms; i++) fire(s.angle + (i / P.arms) * Math.PI * 2, P.speed);
      sound(g, "cast", him);
    }
    // Rings through it, each turned half a gap from the last.
    if ((s.nextRing -= dt) <= 0) {
      const R = S.rings;
      s.nextRing = R.every;
      for (let i = 0; i < R.count; i++) fire(((i + (s.rings % 2) / 2) / R.count) * Math.PI * 2, R.speed);
      s.rings++;
    }
    // A wall of lightning, from a side he isn't expecting.
    if ((s.nextWall -= dt) <= 0) {
      s.nextWall = S.walls.every;
      const dirs: Sweep[] = ["east", "west", "south", "north"], last = s.walls.at(-1)?.dir, pick = dirs.filter(x => x !== last);
      const dir = pick[Math.floor(g.rng.next() * pick.length)]!;
      const arc: Arc = { a: { x: 0, y: 0 }, b: { x: 0, y: 0 }, t: 0, warn: S.walls.warn, live: S.walls.sweep, hit: false };
      s.walls.push({ dir, arc });
      f.arcs.push(arc);
      sound(g, "cast", him);
    }
    // A strike marked under his feet.
    if ((s.nextStrike -= dt) <= 0) {
      s.nextStrike = S.strikes.every;
      spawnStrike(g, h.pos.x, h.pos.y, F.warn);
    }
  }
  // The walls, where they are now along their sweep.
  for (const w of s.walls) wallAt(f, w.dir, w.arc);
  s.walls = s.walls.filter(w => w.arc.t < w.arc.warn + w.arc.live);
  if (s.t < S.hold || s.walls.length) return;
  // Out of it: the cage bursts, and he staggers, spent.
  f.storm = null;
  const enemy = g.world.need(calder, "enemy");
  enemy.warded = false;
  g.world.need(calder, "mage").held = false;
  f.earth = S.after;
  f.nextShape = Math.max(f.nextShape, S.after + 1);
  f.nextArc = Math.max(f.nextArc, S.after);
  f.nextBlink = Math.max(f.nextBlink, S.after + 1);
  g.fx.push({ type: "nova", x: him.x, y: him.y, radius: S.burst });
  g.shake = Math.max(g.shake, 2.5);
  sound(g, "thunder", him);
  toast(g, F.say.shieldOut, true);
  if (!safe && Math.hypot(h.pos.x - him.x, h.pos.y - him.y) < S.burst) damagePlayer(g, him.x, him.y, 1);
}

/** Where a wall of lightning stands along its sweep: a chord of the ring, from one side across to the other. */
export function wallAt(f: Pick<CalderFight, "x" | "y" | "r">, dir: Sweep, arc: Arc): void {
  const k = Math.min(1, Math.max(0, (arc.t - arc.warn) / arc.live)), edge = 0.92 * f.r;
  const across = -edge + 2 * edge * k, half = Math.sqrt(Math.max(0, f.r * f.r - across * across));
  const along = dir === "east" || dir === "south" ? across : -across;
  if (dir === "east" || dir === "west") { arc.a = { x: f.x + along, y: f.y - half }; arc.b = { x: f.x + along, y: f.y + half }; }
  else { arc.a = { x: f.x - half, y: f.y + along }; arc.b = { x: f.x + half, y: f.y + along }; }
}

/** His static: anything short of a full draw is turned aside. */
function staticField(g: Game, f: CalderFight, him: Point): void {
  for (const [e, { arrow, transform: a }] of g.world.query("arrow", "transform")) {
    if (arrow.power || arrow.dud || arrow.stuck > 0 || Math.hypot(a.x - him.x, a.y - him.y) > F.static) continue;
    g.fx.push({ type: "burst", x: a.x, y: a.y, palette: "spark" });
    sound(g, "dud", a);
    g.world.destroy(e);
    if (!f.toldStatic) { f.toldStatic = true; toast(g, F.say.static); }
  }
}

/** His sparks fork as they fly: each one he throws splits in three a moment out. */
function forkSparks(g: Game, f: CalderFight, him: Point, dt: number): void {
  const K = F.fork;
  for (const [e, { bolt, transform: b }] of g.world.query("bolt", "transform")) {
    if (bolt.kind !== "spark" || bolt.lost || f.forks.has(e) || Math.hypot(b.x - him.x, b.y - him.y) > MAGE.boltOffset + 4) continue;
    f.forks.set(e, 0);
  }
  for (const [e, t] of f.forks) {
    const b = g.world.get(e, "transform"), bolt = g.world.get(e, "bolt");
    if (!b || !bolt) { f.forks.delete(e); continue; }
    if (t + dt < K.after) { f.forks.set(e, t + dt); continue; }
    f.forks.delete(e);
    const a = Math.atan2(bolt.vy, bolt.vx), v = Math.hypot(bolt.vx, bolt.vy);
    g.world.destroy(e);
    for (let i = 0; i < K.count; i++) {
      const o = a + (i - (K.count - 1) / 2) * K.spread;
      const spark = spawnBolt(g, "spark", b.x, b.y, Math.cos(o) * v, Math.sin(o) * v);
      g.world.need(spark, "bolt").lost = true;               // the forks fly straight
    }
    g.fx.push({ type: "burst", x: b.x, y: b.y, palette: "spark" });
  }
}

/** The crack: the wider it is, the faster he goes, the harder it pulls, and the further its dark reaches. */
function theCrack(g: Game, f: CalderFight, brain: { timer: number; blinkCD: number; specialCD: number }, dt: number): void {
  const h = heroParts(g), more = dt * f.open * F.crack.hurry;
  brain.timer -= more;
  brain.blinkCD = Math.max(0, brain.blinkCD - more);
  brain.specialCD = Math.max(0, brain.specialCD - more);
  const crack = crackOf(g);
  if (!crack) return;
  const safe = h.motion.dash > 0 || h.motion.jump > 0;
  const near = nearestOnCrack(crack, h.pos, crackWidth(g)), d = Math.hypot(near.x - h.pos.x, near.y - h.pos.y) || 1;
  f.letGo = Math.max(0, f.letGo - dt);
  if (!safe && h.status.hurt <= 0 && f.letGo <= 0) {
    const pull = F.crack.pull * f.open * dt;                // a drag, not a hand: it can't pull him into a tree
    moveBy(g.map, h.pos, ((near.x - h.pos.x) / d) * pull, ((near.y - h.pos.y) / d) * pull, false);
  }
  if (near.inside && !safe && h.status.hurt <= 0) {
    damagePlayer(g, near.x, near.y - 2 * T, 1);            // thrown back out of the dark, away from the crack
    f.letGo = F.crack.letGo;
    toast(g, F.say.cold);
  }
}

/** Knocked back: the crack opens wider. */
function widen(g: Game, f: CalderFight): void {
  const was = f.open;
  f.open = Math.min(1, f.open + F.crack.knock);
  g.shake = Math.max(g.shake, 1);
  if (f.open >= 1 && was < 1) toast(g, F.say.widest, true);
  else if (Math.floor(f.open * 3) > Math.floor(was * 3)) toast(g, F.say.wider);
}

/** In go the rods: three of them round the glade's middle, a triangle turned any which way. */
function plantRods(g: Game, f: CalderFight): void {
  const base = g.rng.next() * Math.PI * 2, out = F.rods.out;
  f.rods = [0, 1, 2].map(i => {
    const a = base + (i * Math.PI * 2) / 3;
    return { x: f.x + Math.cos(a) * f.r * out, y: f.y + Math.sin(a) * f.r * out };
  });
  f.planted = 0;
  f.nextArc = 0;                                            // (counted once they're in)
  f.nextBlink = 1;
  for (const r of f.rods) g.fx.push({ type: "burst", x: r.x, y: r.y, palette: "spark" });
  g.shake = Math.max(g.shake, 2);
  sound(g, "thunder", f);
  toast(g, F.say.rods, true);
}

/** The lightning between the rods: a side of the triangle at a time, round and round; then (the eye) the whole of it,
 *  or each rod arcing to where he stands, turn about. */
function theRods(g: Game, f: CalderFight, him: Point, dt: number): void {
  f.planted += dt;
  if (f.planted < F.rods.plant || (f.nextArc -= dt) > 0) return;
  const A = F.rods.arc, r = f.rods;
  f.nextArc = F.rods.every[f.mood === 2 ? 1 : 0];
  const arc = (a: Point, b: Point) => f.arcs.push({ a: { ...a }, b: { ...b }, t: 0, warn: A.warn, live: A.live, hit: false });
  if (f.mood < 2) arc(r[f.side % 3]!, r[(f.side + 1) % 3]!);
  else if (f.side % 2 === 0) for (let i = 0; i < 3; i++) arc(r[i]!, r[(i + 1) % 3]!);
  else for (const rod of r) arc(rod, him);
  f.side++;
  sound(g, "cast", r[f.side % 3]!);
}

/** He blinks to the next rod round; the air he went through crackles behind him. */
function blinkToRod(g: Game, f: CalderFight, him: Point): void {
  f.nextBlink = F.rods.blink;
  f.rod = (f.rod + 1) % 3;
  const to = f.rods[f.rod]!, from = { x: him.x, y: him.y };
  g.fx.push({ type: "burst", x: from.x, y: from.y, palette: "arcane" });
  him.x = to.x; him.y = to.y;
  g.fx.push({ type: "burst", x: to.x, y: to.y, palette: "spark" });
  const R = F.rods.trail;
  f.arcs.push({ a: from, b: { ...to }, t: 0, warn: R.warn, live: R.live, hit: false });
  sound(g, "blink", to);
}

/** Lightning along the lines: anyone on one once it's live is struck, unless he's jumping or dashing over it. */
function arcs(g: Game, f: CalderFight, dt: number): void {
  const h = heroParts(g), safe = h.motion.dash > 0 || h.motion.jump > 0;
  for (const a of f.arcs) {
    const was = a.t;
    a.t += dt;
    if (was < a.warn && a.t >= a.warn) { sound(g, "thunder", a.a); g.shake = Math.max(g.shake, 0.6); }
    if (a.t < a.warn || a.hit || safe || h.status.hurt > 0) continue;
    const near = onSegment(h.pos, a.a, a.b);
    if (Math.hypot(near.x - h.pos.x, near.y - h.pos.y) < F.rods.arc.width) {
      damagePlayer(g, near.x, near.y, 1);
      a.hit = true;
    }
  }
  f.arcs = f.arcs.filter(a => a.t < a.warn + a.live);
}

/** The nearest point to `p` on the line from `a` to `b`. */
export function onSegment(p: Point, a: Point, b: Point): Point {
  const ex = b.x - a.x, ey = b.y - a.y, len2 = ex * ex + ey * ey || 1;
  const k = Math.max(0, Math.min(1, ((p.x - a.x) * ex + (p.y - a.y) * ey) / len2));
  return { x: a.x + ex * k, y: a.y + ey * k };
}

/** The next shape of strikes: a line walking at the hero, or a star from him (the storm walks, and the rods); a
 *  bullseye round the hero, or a star (the eye). */
export type Shape = "walk" | "star" | "bullseye";
const SHAPES: Record<Mood, readonly Shape[]> = { 0: ["walk", "star"], 1: ["walk", "walk", "star"], 2: ["bullseye", "star", "bullseye", "walk"] };
function shape(g: Game, f: CalderFight, him: Point): void {
  const turn = SHAPES[f.mood], kind = turn[f.shapes % turn.length]!, h = heroParts(g).pos;
  f.shapes++;
  f.nextShape = F.shapes.every[f.mood];
  const mark = (x: number, y: number, delay: number) => {
    const at = { x, y };
    if (!inside(f, at)) return;
    spawnStrike(g, at.x, at.y, F.warn + delay);
  };
  if (kind === "walk") {
    const W = F.walk, a = Math.atan2(h.y - him.y, h.x - him.x);
    for (let i = 1; i <= W.count; i++) mark(him.x + Math.cos(a) * W.step * i, him.y + Math.sin(a) * W.step * i, (i - 1) * W.gap);
  } else if (kind === "star") {
    const S = F.star, base = g.rng.next() * Math.PI;
    for (let arm = 0; arm < S.arms; arm++) {
      const a = base + (arm / S.arms) * Math.PI * 2;
      for (let i = 1; i <= S.count; i++) mark(him.x + Math.cos(a) * S.step * i, him.y + Math.sin(a) * S.step * i, (i - 1) * S.gap);
    }
  } else {
    const B = F.bullseye, base = g.rng.next() * Math.PI, at = { x: h.x, y: h.y };
    B.rings.forEach((ring, k) => {
      for (let i = 0; i < ring.count; i++) {
        const a = base + (i / ring.count) * Math.PI * 2;
        mark(at.x + Math.cos(a) * ring.r, at.y + Math.sin(a) * ring.r, k * B.between);
      }
    });
    mark(at.x, at.y, B.rings.length * B.between);
  }
  sound(g, "cast", him);
}

/** The nearest point on the great crack's spine to `p` (cell top-left px), and whether `p` is in its dark, drawn `wide` times its width. */
export function nearestOnCrack(crack: Extract<Prop, { kind: "greatCrack" }>, p: Point, wide: number): { x: number; y: number; inside: boolean } {
  const spine = greatCrackSpine(crack), px = (p.x + HALF) / T, py = (p.y + HALF) / T;
  let best = { x: px, y: py, d: Infinity, half: 0 };
  for (let i = 1; i < spine.length; i++) {
    const a = spine[i - 1]!, b = spine[i]!, q = onSegment({ x: px, y: py }, { x: a.at.x, y: a.at.z }, { x: b.at.x, y: b.at.z });
    const len = Math.hypot(b.at.x - a.at.x, b.at.z - a.at.z) || 1, k = Math.hypot(q.x - a.at.x, q.y - a.at.z) / len;
    const d = Math.hypot(px - q.x, py - q.y);
    if (d < best.d) best = { ...q, d, half: a.half + (b.half - a.half) * k };
  }
  return { x: best.x * T - HALF, y: best.y * T - HALF, inside: wide > 1 && best.d < best.half * wide - 0.15 };
}

/** Whether `p` is inside the ring. */
const inside = (f: CalderFight, p: Point): boolean => Math.hypot(p.x - f.x, p.y - f.y) <= f.r;

/** Nobody leaves the glade: kept within its ring of lightning. */
function keepIn(f: CalderFight, t: Point): void {
  const dx = t.x - f.x, dy = t.y - f.y, d = Math.hypot(dx, dy);
  if (d <= f.r) return;
  t.x = f.x + (dx / d) * f.r;
  t.y = f.y + (dy / d) * f.r;
}
