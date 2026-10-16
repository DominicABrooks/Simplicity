// Cinder's fight in his arena (the rules are CINDER_FIGHT, in src/data/ashwild.ts). He isn't there until the
// hero steps in among the stones: then fire shuts the circle, Cinder steps out of it into the middle, and
// nobody leaves until one of them falls (so there's no picking at him from outside, or slipping out to heal).
// Then the ground erupts under the hero a few
// spots at a time, and walls of fire sweep across the circle for him to jump. Down to a quarter of his health, he
// steps out through the fire, out of reach, and the circle becomes a furnace for a while (the inferno): a wheel of fire
// turning from the middle, and fans of fire thrown across it from wherever he's pacing round outside; then he bursts
// back in. Drawn by the blaze view (src/render/blaze.ts), on an entity made for the fight at the circle's middle.
import type { Entity } from "../core/ecs.ts";
import { CINDER_FIGHT as F } from "../data/ashwild.ts";
import { MAGE } from "../data/enemies.ts";
import { HALF } from "../data/world.ts";
import type { Transform } from "./components.ts";
import { beaten, bossHere, bossWaiting, summonBoss } from "./bosses.ts";
import { isFrozen } from "./cheats.ts";
import { damagePlayer } from "./combat.ts";
import { toast, type Game } from "./game.ts";
import { heroParts } from "./hero.ts";
import { sound } from "./sfx.ts";
import { spawnBolt } from "./spawn.ts";

/** A spot about to erupt (t < warn), or burning (t < warn + burn). Cell top-left, like everything. */
export interface Flare { x: number; y: number; t: number; hit: boolean }
/** Which way a wall of fire sweeps: east is from the west side across to the east. */
export type Sweep = "east" | "west" | "south" | "north";
/** A wall of fire smouldering at its edge (t < warn), then sweeping across (t < warn + sweep). */
export interface Beam { dir: Sweep; t: number; hit: boolean }
/** A spoke of the inferno's wheel: where it stands on the wheel (radians from the wheel's angle), and how long it's been there (s). */
export interface Spoke { off: number; t: number }
/**
 * The inferno, while it lasts: seconds in; where he stands outside the fire (an angle round the circle); the wheel of
 * fire's angle, which way it turns first, and its spokes; and seconds to his next fan of fire.
 */
export interface Inferno { t: number; at: number; wheel: number; spin: 1 | -1; spokes: Spoke[]; nextFan: number }

export interface CinderFight {
  /** The circle's middle (cell top-left) and how far in it keeps you (px). */
  x: number; y: number; r: number;
  /** Seconds since the fire shut the circle. */
  t: number;
  angry: boolean;
  /** The inferno, while it's on; and whether it's been (it comes once). */
  inferno: Inferno | null;
  infernoDone: boolean;
  flares: Flare[];
  beams: Beam[];
  nextFlares: number;
  nextBeam: number;
  /** The entity it's drawn on. */
  view: Entity;
}

const fights = new WeakMap<Game, CinderFight>();
const listening = new WeakSet<Game>();

/** The fight in progress, if the circle's shut. */
export const cinderFight = (g: Game): CinderFight | null => fights.get(g) ?? null;

/** Where a wall of fire stands now, along its axis (cell top-left px): x for east/west, y for south/north. */
export function beamAt(f: CinderFight, b: Beam): number {
  const k = Math.min(1, Math.max(0, (b.t - F.beam.warn) / F.beam.sweep)), across = -f.r + 2 * f.r * k;
  return b.dir === "east" ? f.x + across : b.dir === "west" ? f.x - across : b.dir === "south" ? f.y + across : f.y - across;
}

/** Every frame: shut the circle (and summon Cinder) when the hero steps in, run the fire, open it when Cinder falls. */
export function cinderFightSystem(g: Game, dt: number): void {
  if (!listening.has(g)) { listening.add(g); g.events.on("reset", () => fights.delete(g)); }
  const f = fights.get(g);
  if (!f) { if (bossWaiting(g) === "cinder") shut(g); return; }
  const cinder = bossHere(g);
  if (cinder === null || (g.world.get(cinder, "health")?.hp ?? 0) <= 0) { open(g, f, beaten(g, "cinder")); return; }
  run(g, f, cinder, dt);
}

/** The hero's far enough in among the stones: up goes the fire, and out of it steps Cinder. */
function shut(g: Game): CinderFight | null {
  const arena = g.area.layout.props.find(p => p.kind === "arena");
  if (arena?.kind !== "arena") return null;
  const x = arena.x - HALF, y = arena.y - HALF, p = g.world.need(g.player, "transform");
  if (Math.hypot(p.x - x, p.y - y) > F.shutAt) return null;
  const view = g.world.create({ transform: { x, y }, renderable: { kind: "blaze" } });
  const f: CinderFight = { x, y, r: F.keepIn, t: 0, angry: false, inferno: null, infernoDone: false, flares: [], beams: [], nextFlares: 1.5, nextBeam: F.beam.first, view };
  fights.set(g, f);
  g.shake = Math.max(g.shake, 2);
  sound(g, "nova", p);
  toast(g, F.say.shut, true);
  summonBoss(g);
  toast(g, F.say.rise);
  return f;
}

/** Cinder's down (or the hero's gone): the fire goes out. */
function open(g: Game, f: CinderFight, fell: boolean): void {
  if (g.world.isAlive(f.view)) g.world.destroy(f.view);
  fights.delete(g);
  if (fell) toast(g, F.say.open);
}

function run(g: Game, f: CinderFight, cinder: Entity, dt: number): void {
  const h = heroParts(g), hp = g.world.need(cinder, "health");
  f.t += dt;
  f.angry = hp.hp <= hp.maxHp * F.angry;
  keepIn(f, h.pos);
  const at = g.world.get(cinder, "transform");
  if (at && !f.inferno) keepIn(f, at);
  if (isFrozen(g)) return;                                  // playtesting: the fire holds still with him
  const safe = h.status.hurt > 0 || h.motion.dash > 0 || h.motion.jump > 0;   // a dash or a jump clears the fire
  if (!f.infernoDone && hp.hp <= hp.maxHp * F.inferno.at) startInferno(g, f, cinder);
  if (f.inferno) { inferno(g, f, cinder, dt, safe); return; }

  // The ground erupts: one spot right under the hero, the rest anywhere in the circle.
  if ((f.nextFlares -= dt) <= 0) {
    f.nextFlares = F.flare.every[f.angry ? 1 : 0];
    const n = F.flare.count[f.angry ? 1 : 0];
    for (let i = 0; i < n; i++) {
      const a = g.rng.next() * Math.PI * 2, d = Math.sqrt(g.rng.next()) * (f.r - 4);
      f.flares.push(i === 0 ? { x: h.pos.x, y: h.pos.y, t: 0, hit: false } : { x: f.x + Math.cos(a) * d, y: f.y + Math.sin(a) * d, t: 0, hit: false });
    }
  }
  for (const fl of f.flares) {
    const was = fl.t;
    fl.t += dt;
    const near = Math.hypot(h.pos.x - fl.x, h.pos.y - fl.y);
    if (was < F.flare.warn && fl.t >= F.flare.warn) {
      g.fx.push({ type: "burst", x: fl.x, y: fl.y, palette: "fire" });
      sound(g, "boltPop", fl);
      if (!safe && near < F.flare.radius) { damagePlayer(g, fl.x, fl.y, F.flare.damage); fl.hit = true; }
    } else if (fl.t >= F.flare.warn && !fl.hit && !safe && near < F.flare.radius * 0.8) {
      damagePlayer(g, fl.x, fl.y, F.flare.damage);              // standing in it once it's burning
      fl.hit = true;
    }
  }
  f.flares = f.flares.filter(fl => fl.t < F.flare.warn + F.flare.burn);

  // A wall of fire, from a side he isn't expecting.
  if ((f.nextBeam -= dt) <= 0) {
    f.nextBeam = F.beam.every[f.angry ? 1 : 0];
    const dirs: Sweep[] = ["east", "west", "south", "north"], last = f.beams.at(-1)?.dir;
    const pick = dirs.filter(d => d !== last);
    f.beams.push({ dir: pick[Math.floor(g.rng.next() * pick.length)]!, t: 0, hit: false });
    sound(g, "cast", at ?? h.pos);
    toast(g, F.say.beam);
  }
  for (const b of f.beams) {
    const was = b.t;
    b.t += dt;
    if (was < F.beam.warn && b.t >= F.beam.warn) { sound(g, "nova", h.pos); g.shake = Math.max(g.shake, 1.5); }
    if (b.t < F.beam.warn || b.hit || safe) continue;
    const line = beamAt(f, b), across = b.dir === "east" || b.dir === "west";
    if (Math.abs((across ? h.pos.x : h.pos.y) - line) < F.beam.width) {
      // Shoved on ahead of it, the way it's going.
      const back = b.dir === "east" || b.dir === "south" ? -10 : 10;
      damagePlayer(g, across ? line + back : h.pos.x, across ? h.pos.y : line + back, F.beam.damage);
      b.hit = true;
    }
  }
  f.beams = f.beams.filter(b => b.t < F.beam.warn + F.beam.sweep);
}

/** Down to a quarter: he steps out through the fire, out of reach, and the furnace begins. */
function startInferno(g: Game, f: CinderFight, cinder: Entity): void {
  const I = F.inferno, him = g.world.need(cinder, "transform"), enemy = g.world.need(cinder, "enemy");
  f.infernoDone = true;
  f.flares = []; f.beams = [];
  const at = Math.atan2(him.y - f.y, him.x - f.x) + Math.PI;  // out the far side from where he was
  const spokes = Array.from({ length: I.wheel.spokes }, (_, i) => ({ off: (i / I.wheel.spokes) * Math.PI * 2, t: 0 }));
  f.inferno = { t: 0, at, wheel: g.rng.next() * Math.PI * 2, spin: g.rng.next() < 0.5 ? 1 : -1, spokes, nextFan: I.fan.first };
  g.fx.push({ type: "burst", x: him.x, y: him.y, palette: "arcane" });
  standOutside(f, him);
  g.fx.push({ type: "burst", x: him.x, y: him.y, palette: "fire" });
  Object.assign(g.world.need(cinder, "mage"), { casting: false, castK: 0, spell: null, melee: false, swing: null, held: true });
  enemy.warded = true;
  enemy.wardSay = I.warded;
  g.shake = Math.max(g.shake, 2.5);
  sound(g, "blink", him);
  sound(g, "nova", him);
  toast(g, F.say.inferno, true);
}

/** Where he stands in the inferno: out past the fire, at his angle round the circle. */
function standOutside(f: CinderFight, him: Transform): void {
  const d = f.r + F.inferno.orbit, a = f.inferno!.at;
  him.x = f.x + Math.cos(a) * d;
  him.y = f.y + Math.sin(a) * d;
}

/** The wheel's spokes of fire now: each one's angle, whether it burns yet, and how far up it's smouldered (0-1). */
export function spokesOf(f: CinderFight): { a: number; live: boolean; up: number }[] {
  const inf = f.inferno, warn = F.inferno.wheel.warn;
  if (!inf) return [];
  return inf.spokes.map(s => ({ a: inf.wheel + s.off, live: s.t >= warn, up: Math.min(1, s.t / warn) }));
}

/** When the wheel turns back: the moments it starts to slow, stands still, and starts again (seconds into the inferno). */
const turnBack = () => {
  const B = F.inferno.wheel.turnBack, still = B.at + B.slow, again = still + B.hold;
  return { slowing: B.at, still, again, full: again + B.rise };
};

/** Whether the wheel's standing still, turning back (for its spokes to flicker in warning). */
export function wheelStill(f: CinderFight): boolean {
  const t = f.inferno?.t ?? -1, T = turnBack();
  return t >= T.still && t < T.again;
}

/** How fast the wheel turns now (radians a second, signed): nothing while it smoulders; slowing, still, gathering speed back. */
function wheelSpeed(inf: Inferno): number {
  const W = F.inferno.wheel, T = turnBack(), t = inf.t, v = inf.spin * W.turn;
  if (t < W.warn) return 0;
  if (t < T.slowing) return v;
  if (t < T.still) return v * (1 - (t - T.slowing) / (T.still - T.slowing));
  if (t < T.again) return 0;
  if (t < T.full) return -v * ((t - T.again) / (T.full - T.again));
  return -v;
}

/** One more spoke, as the wheel stands still: in its widest gap, on the side away from the hero; the others stay put. */
function addSpoke(f: CinderFight, inf: Inferno, hero: { x: number; y: number }): void {
  const offs = inf.spokes.map(s => s.off).sort((a, b) => a - b), gaps = offs.map((o, i) => {
    const next = i + 1 < offs.length ? offs[i + 1]! : offs[0]! + Math.PI * 2;
    return { mid: (o + next) / 2, size: next - o };
  });
  const widest = Math.max(...gaps.map(g => g.size)), facing = Math.atan2(hero.y - f.y, hero.x - f.x);
  const away = (m: number) => Math.abs(Math.atan2(Math.sin(inf.wheel + m - facing), Math.cos(inf.wheel + m - facing)));
  const pick = gaps.filter(g => g.size > widest - 1e-6).sort((a, b) => away(b.mid) - away(a.mid))[0]!;
  inf.spokes.push({ off: pick.mid, t: 0 });
}

/** How far the hero (cell top-left) is from a spoke of fire running out from the middle at `a` (px). */
function fromSpoke(f: CinderFight, a: number, p: { x: number; y: number }): number {
  const dx = p.x - f.x, dy = p.y - f.y, along = Math.max(0, Math.min(f.r, dx * Math.cos(a) + dy * Math.sin(a)));
  return Math.hypot(dx - Math.cos(a) * along, dy - Math.sin(a) * along);
}

/** The furnace: the wheel turning, fans of fire thrown across it, him pacing outside; then back in he bursts. */
function inferno(g: Game, f: CinderFight, cinder: Entity, dt: number, safe: boolean): void {
  const I = F.inferno, W = I.wheel, inf = f.inferno!, h = heroParts(g), him = g.world.need(cinder, "transform");
  const was = inf.t;
  inf.t += dt;
  inf.at += I.pace * dt;
  standOutside(f, him);
  g.world.need(cinder, "mage").held = true;
  // The wheel: smouldering first, then turning; then slowing to a stop, standing still while one more spoke smoulders
  // up, and gathering speed back the other way. Only a spoke that's done smouldering burns.
  const T = turnBack();
  for (const s of inf.spokes) s.t += dt;
  inf.wheel += wheelSpeed(inf) * dt;
  if (was < W.warn && inf.t >= W.warn) sound(g, "nova", h.pos);
  if (was < T.slowing && inf.t >= T.slowing) sound(g, "spell", him);                       // it's slowing: something's coming
  if (was < T.still && inf.t >= T.still) { addSpoke(f, inf, h.pos); sound(g, "cast", him); g.shake = Math.max(g.shake, 1.5); }
  if (was < T.again && inf.t >= T.again) sound(g, "nova", h.pos);                          // and off it goes, the other way
  if (!safe && spokesOf(f).some(s => s.live && fromSpoke(f, s.a, h.pos) < W.width)) damagePlayer(g, f.x, f.y, W.damage);
  // His fans of fire, aimed at the hero from wherever he stands; held while the wheel turns back.
  const turning = inf.t >= T.slowing && inf.t < T.again;
  if (turning) inf.nextFan = Math.max(inf.nextFan, 0.6);
  if ((inf.nextFan -= dt) <= 0) {
    inf.nextFan = I.fan.every;
    const aim = Math.atan2(h.pos.y - him.y, h.pos.x - him.x), o = MAGE.boltOffset;
    for (let i = 0; i < I.fan.count; i++) {
      const a = aim + (i / (I.fan.count - 1) - 0.5) * I.fan.spread;
      flame(g, him.x + Math.cos(a) * o, him.y + Math.sin(a) * o, a, I.fan.speed);
    }
    sound(g, "cast", him);
  }
  if (inf.t >= I.last) endInferno(g, f, cinder);
}

/** A bolt of fire flying straight out at `a`, long-lived enough to cross the circle from outside it. */
function flame(g: Game, x: number, y: number, a: number, speed: number): void {
  const b = g.world.need(spawnBolt(g, "fire", x, y, Math.cos(a) * speed, Math.sin(a) * speed), "bolt");
  b.lost = true;
  b.life = F.inferno.fan.life;
}

/** The furnace is spent: he bursts back into the middle, a ring of fire flying out round him, and the fight goes on. */
function endInferno(g: Game, f: CinderFight, cinder: Entity): void {
  const B = F.inferno.burst, him = g.world.need(cinder, "transform"), enemy = g.world.need(cinder, "enemy");
  f.inferno = null;
  g.fx.push({ type: "burst", x: him.x, y: him.y, palette: "arcane" });
  him.x = f.x; him.y = f.y;
  g.fx.push({ type: "burst", x: him.x, y: him.y, palette: "fire" });
  const turn = g.rng.next() * Math.PI * 2;
  for (let i = 0; i < B.count; i++) flame(g, him.x, him.y, turn + (i / B.count) * Math.PI * 2, B.speed);
  g.world.need(cinder, "mage").held = false;
  enemy.warded = false;
  enemy.wardSay = undefined;
  f.nextFlares = 2; f.nextBeam = 4;
  g.shake = Math.max(g.shake, 3);
  sound(g, "blink", him);
  sound(g, "nova", him);
  toast(g, F.say.back, true);
}

/** Nobody leaves the circle: kept within its fire. */
function keepIn(f: CinderFight, t: Transform): void {
  const dx = t.x - f.x, dy = t.y - f.y, d = Math.hypot(dx, dy);
  if (d <= f.r) return;
  t.x = f.x + (dx / d) * f.r;
  t.y = f.y + (dy / d) * f.r;
}
