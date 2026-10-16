// Cinder's fight in his arena (the rules are CINDER_FIGHT, in src/data/ashwild.ts). Once the hero steps in
// among the stones, fire shuts the circle until one of them falls; then the ground erupts under him a few
// spots at a time, and walls of fire sweep across the circle for him to jump. Drawn by the blaze view
// (src/render/blaze.ts), on an entity made for the fight at the circle's middle.
import type { Entity } from "../core/ecs.ts";
import { CINDER_FIGHT as F } from "../data/ashwild.ts";
import { HALF } from "../data/world.ts";
import type { Transform } from "./components.ts";
import { beaten, bossHere } from "./bosses.ts";
import { isFrozen } from "./cheats.ts";
import { damagePlayer } from "./combat.ts";
import { toast, type Game } from "./game.ts";
import { heroParts } from "./hero.ts";
import { sound } from "./sfx.ts";

/** A spot about to erupt (t < warn), or burning (t < warn + burn). Cell top-left, like everything. */
export interface Flare { x: number; y: number; t: number; hit: boolean }
/** Which way a wall of fire sweeps: east is from the west side across to the east. */
export type Sweep = "east" | "west" | "south" | "north";
/** A wall of fire smouldering at its edge (t < warn), then sweeping across (t < warn + sweep). */
export interface Beam { dir: Sweep; t: number; hit: boolean }

export interface CinderFight {
  /** The circle's middle (cell top-left) and how far in it keeps you (px). */
  x: number; y: number; r: number;
  /** Seconds since the fire shut the circle. */
  t: number;
  angry: boolean;
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

/** Every frame: shut the circle when the hero steps in, run the fire while he's in it, open it when Cinder falls. */
export function cinderFightSystem(g: Game, dt: number): void {
  if (!listening.has(g)) { listening.add(g); g.events.on("reset", () => fights.delete(g)); }
  const cinder = bossHere(g), f = fights.get(g);
  const alive = cinder !== null && (g.world.get(cinder, "health")?.hp ?? 0) > 0;
  if (f && !alive) { open(g, f, beaten(g, "cinder")); return; }
  if (!alive) return;
  const fight = f ?? shut(g);
  if (!fight) return;
  run(g, fight, cinder, dt);
}

/** The hero's far enough in among the stones: up goes the fire. */
function shut(g: Game): CinderFight | null {
  const arena = g.area.layout.props.find(p => p.kind === "arena");
  if (arena?.kind !== "arena") return null;
  const x = arena.x - HALF, y = arena.y - HALF, p = g.world.need(g.player, "transform");
  if (Math.hypot(p.x - x, p.y - y) > F.shutAt) return null;
  const view = g.world.create({ transform: { x, y }, renderable: { kind: "blaze" } });
  const f: CinderFight = { x, y, r: F.keepIn, t: 0, angry: false, flares: [], beams: [], nextFlares: 1.5, nextBeam: F.beam.first, view };
  fights.set(g, f);
  g.shake = Math.max(g.shake, 2);
  sound(g, "nova", p);
  toast(g, F.say.shut, true);
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
  if (at) keepIn(f, at);
  if (isFrozen(g)) return;                                  // playtesting: the fire holds still with him
  const safe = h.status.hurt > 0 || h.motion.dash > 0 || h.motion.jump > 0;   // a dash or a jump clears the fire

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

/** Nobody leaves the circle: kept within its fire. */
function keepIn(f: CinderFight, t: Transform): void {
  const dx = t.x - f.x, dy = t.y - f.y, d = Math.hypot(dx, dy);
  if (d <= f.r) return;
  t.x = f.x + (dx / d) * f.r;
  t.y = f.y + (dy / d) * f.r;
}
