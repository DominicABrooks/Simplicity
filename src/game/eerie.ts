// The city after dark (the story and the tuning are in src/data/eerie.ts). While the hero walks Kingsholm's
// streets at night, every so often something happens: a shutter bangs, footsteps follow him, someone watches him
// from the end of the street, a lamp gutters out, a well whispers, a little bell rings nine. Never by day, never
// indoors, never while he's busy (talking, resting, in a scene) and never anywhere near St Mary's churchyard,
// which belongs to the Grey Ringer (src/game/ghost.ts). None of it can hurt him; it's only the city.
import type { Entity } from "../core/ecs.ts";
import { isDay } from "../data/daylight.ts";
import { EERIE, EERIE_SAYS, type EerieId } from "../data/eerie.ts";
import { HALF } from "../data/world.ts";
import { blocked } from "../world/collision.ts";
import { combatText } from "./combat.ts";
import { carryingCurio, spentCurios } from "./curios.ts";
import { cutscene } from "./cutscene.ts";
import { toast, type Game } from "./game.ts";
import { churchyardOf, ghostOut } from "./ghost.ts";
import { lampLit, lampsHere, snuffLamp, type Lamp } from "./lamps.ts";
import { resting } from "./resting.ts";
import { sound } from "./sfx.ts";
import { sleeping } from "./sleeping.ts";
import { talking } from "./talk.ts";

type Spot = { x: number; y: number };

/** What's going on now, if anything, and how far along it is. */
type Happening =
  | { id: "footsteps"; t: number; next: number; from: Spot; heading: Spot }
  | { id: "watcher"; t: number; e: Entity }
  | { id: "lamp"; t: number; lamp: Lamp }
  | { id: "well"; t: number; at: Spot; said: number; next: number; lines: string[] }
  | { id: "curfew"; t: number; at: Spot | null; rung: number; next: number };

/**
 * How the night stands, per game: the area it's counting for, seconds till the next roll, how many there have been
 * tonight, the last one (it won't happen twice running), whether the bell's rung tonight, and what's going on now.
 */
interface Unease {
  area: string;
  wait: number;
  tonight: number;
  last: EerieId | null;
  rung: boolean;
  now: Happening | null;
}

const states = new WeakMap<Game, Unease>();
export function uneaseOf(g: Game): Unease {
  let s = states.get(g);
  if (!s) states.set(g, s = { area: g.area.def.id, wait: EERIE.settle, tonight: 0, last: null, rung: false, now: null });
  return s;
}

/** What's happening now, if anything. */
export const eerieNow = (g: Game): EerieId | null => states.get(g)?.now?.id ?? null;

const between = (g: Game, [a, b]: readonly [number, number]) => a + g.rng.next() * (b - a);
/** The hero's middle (px). */
const heroAt = (g: Game): Spot => { const p = g.world.need(g.player, "transform"); return { x: p.x + HALF, y: p.y + HALF }; };
const dist = (a: Spot, b: Spot) => Math.hypot(a.x - b.x, a.y - b.y);

/** Can it happen in this place at this hour: the city's streets (not a house's inside), at night? */
export const eerieHere = (g: Game): boolean =>
  EERIE.areas.includes(g.area.def.id) && !g.area.def.indoors && !isDay(g.hour);

/** Is the hero free for it: not busy, the ghost not out, and not by the churchyard? */
function unbusy(g: Game): boolean {
  if (talking(g) || cutscene(g) || resting(g) || sleeping(g) || ghostOut(g) !== null) return false;
  if ((g.world.get(g.player, "health")?.hp ?? 0) <= 0) return false;
  const yard = churchyardOf(g), p = heroAt(g), m = EERIE.churchyard;
  return !yard || p.x < yard.x - m || p.x > yard.x + yard.w + m || p.y < yard.y - m || p.y > yard.y + yard.h + m;
}

/** The house fronts this near (in EERIE.shutter.near), the middle of their street side. */
function shutterSpots(g: Game): Spot[] {
  const p = heroAt(g), [lo, hi] = EERIE.shutter.near;
  return g.area.layout.props.flatMap(h => {
    if (h.kind !== "house") return [];
    const r = h.rect, at = { x: r.x + r.w / 2, y: r.y + r.h / 2 }, d = dist(at, p);
    return d >= lo && d <= hi ? [at] : [];
  });
}

/** The nearest lamp burning this near the hero, if one is. */
function lampNear(g: Game): Lamp | null {
  const p = heroAt(g);
  let best: Lamp | null = null, bestD: number = EERIE.lamp.near;
  for (const l of lampsHere()) {
    const d = dist(l, p);
    if (d <= bestD && lampLit(l)) { best = l; bestD = d; }
  }
  return best;
}

/** A well this near the hero, if there is one. */
function wellNear(g: Game): Spot | null {
  const p = heroAt(g);
  for (const w of g.area.layout.props) if (w.kind === "well" && dist(w, p) <= EERIE.well.near) return { x: w.x, y: w.y };
  return null;
}

/** Can the hero see from here to there, down open street (nothing solid in between)? */
function clearLine(g: Game, from: Spot, to: Spot): boolean {
  const d = dist(from, to), n = Math.ceil(d / 6);
  for (let i = 1; i <= n; i++) {
    const x = from.x + ((to.x - from.x) * i) / n - HALF, y = from.y + ((to.y - from.y) * i) / n - HALF;
    if (blocked(g.map, x, y, true)) return false;
  }
  return true;
}

/** Somewhere at the end of the street the hero's facing (or any street, failing that), in plain sight of him. */
function watcherSpot(g: Game): Spot | null {
  const p = heroAt(g), aim = g.world.need(g.player, "motion").aim;
  const turns = [0, 0.35, -0.35, 0.7, -0.7, 1.2, -1.2, 1.8, -1.8, Math.PI];
  const { wide, deep, steps } = EERIE.watcher;
  for (const k of steps) for (const turn of turns) {
    const a = aim + turn, at = { x: p.x + Math.cos(a) * wide * k, y: p.y + Math.sin(a) * deep * k };
    if (clearLine(g, p, at)) return at;
  }
  return null;
}

/** Can this one happen here and now? (Not counting whose turn it is: see eerieSystem.) */
export function eerieCan(g: Game, id: EerieId): boolean {
  switch (id) {
    case "shutter": return shutterSpots(g).length > 0;
    case "footsteps": return g.world.need(g.player, "motion").moving;
    case "watcher": return watcherSpot(g) !== null;
    case "lamp": return lampNear(g) !== null;
    case "well": return wellNear(g) !== null;
    case "curfew": {
      // The little handbell rings at nine, wherever it is: unless it's been given back to Ismay, and only once a night.
      const { from, to } = EERIE.curfew;
      return g.hour >= from && g.hour < to && !states.get(g)?.rung && !spentCurios(g).has("bell");
    }
  }
}

/** Which one, by the weights, of those that can happen now (and not the same as last time, if anything else can). */
export function pickEerie(g: Game, last: EerieId | null = null): EerieId | null {
  const ids = (Object.keys(EERIE.weights) as EerieId[]).filter(id => EERIE.weights[id] > 0 && eerieCan(g, id));
  const fresh = ids.filter(id => id !== last), from = fresh.length ? fresh : ids;
  const total = from.reduce((n, id) => n + EERIE.weights[id], 0);
  let roll = g.rng.next() * total;
  for (const id of from) if ((roll -= EERIE.weights[id]) < 0) return id;
  return from[from.length - 1] ?? null;
}

/**
 * Every frame: after dark in the city's streets, count down to the next, and when it's time, something happens
 * (if the hero's free for it). By day, indoors, or anywhere else, nothing does, and anything going on stops.
 */
export function eerieSystem(g: Game, dt: number): void {
  const s = uneaseOf(g);
  if (s.area !== g.area.def.id) { stop(g, s); s.area = g.area.def.id; s.wait = EERIE.settle; }
  if (isDay(g.hour)) { s.tonight = 0; s.rung = false; }
  if (!eerieHere(g)) { stop(g, s); s.wait = EERIE.settle; return; }
  if (s.now) { go(g, s, s.now, dt); return; }
  if (!unbusy(g) || s.tonight >= EERIE.most || (s.wait -= dt) > 0) return;
  s.wait = between(g, EERIE.every);
  const id = pickEerie(g, s.last);
  if (id) startEerie(g, id);
}

/** Make this one happen now, if it can (at night, in the streets, and here): for eerieSystem, and for playtesting. Whether it did. */
export function startEerie(g: Game, id: EerieId): boolean {
  const s = uneaseOf(g);
  if (s.now || !eerieHere(g) || !eerieCan(g, id)) return false;
  s.tonight++;
  s.last = id;
  const p = heroAt(g);
  switch (id) {
    case "shutter": {
      const spots = shutterSpots(g), at = spots[g.rng.int(0, spots.length - 1)]!;
      sound(g, "shutter", at);
      toast(g, EERIE_SAYS.shutter[g.rng.int(0, EERIE_SAYS.shutter.length - 1)]!);
      return true;
    }
    case "footsteps":
      s.now = { id, t: 0, next: EERIE.footsteps.gap, from: p, heading: { x: 0, y: 1 } };
      toast(g, EERIE_SAYS.footsteps);
      return true;
    case "watcher": {
      const at = watcherSpot(g)!;
      const e = g.world.create({ transform: { x: at.x - HALF, y: at.y - HALF }, watcher: { shown: 0, going: false }, renderable: { kind: "watcher" } });
      s.now = { id, t: 0, e };
      toast(g, EERIE_SAYS.watcher);
      return true;
    }
    case "lamp": {
      const lamp = lampNear(g)!;
      snuffLamp(lamp, true);
      s.now = { id, t: 0, lamp };
      toast(g, EERIE_SAYS.lamp);
      return true;
    }
    case "well": {
      const all = [...EERIE_SAYS.whispers], lines: string[] = [];
      while (lines.length < EERIE.well.lines && all.length) lines.push(all.splice(g.rng.int(0, all.length - 1), 1)[0]!);
      s.now = { id, t: 0, at: wellNear(g)!, said: 0, next: 0.4, lines };
      toast(g, EERIE_SAYS.well);
      return true;
    }
    case "curfew": {
      s.rung = true;
      // Carried, it rings in the bag; otherwise far off toward the river, where it went in.
      const at = carryingCurio(g, "bell") ? null : { x: p.x, y: p.y + EERIE.curfew.away };
      s.now = { id, t: 0, at, rung: 0, next: 0 };
      toast(g, at ? EERIE_SAYS.curfew : EERIE_SAYS.curfewBag);
      return true;
    }
  }
}

/** Keep what's happening going, until it's over. */
function go(g: Game, s: Unease, h: Happening, dt: number): void {
  h.t += dt;
  const p = heroAt(g);
  switch (h.id) {
    case "footsteps": {
      // Somebody a few steps behind him, the way he's come, keeping pace; when he stops, they stop.
      const F = EERIE.footsteps, dx = p.x - h.from.x, dy = p.y - h.from.y, d = Math.hypot(dx, dy);
      if (d > 0.5) { h.heading = { x: dx / d, y: dy / d }; h.from = p; }
      if (!g.world.need(g.player, "motion").moving && h.t >= F.least) { toast(g, EERIE_SAYS.footstepsStop); s.now = null; return; }
      if (h.t >= F.last) { toast(g, EERIE_SAYS.footstepsFade); s.now = null; return; }
      if ((h.next -= dt) <= 0 && g.world.need(g.player, "motion").moving) {
        h.next = F.gap;
        sound(g, "footstep", { x: p.x - h.heading.x * F.behind, y: p.y - h.heading.y * F.behind });
      }
      return;
    }
    case "watcher": {
      const W = EERIE.watcher, w = g.world.get(h.e, "watcher"), at = g.world.get(h.e, "transform");
      if (!w || !at) { s.now = null; return; }
      if (!w.going && dist({ x: at.x + HALF, y: at.y + HALF }, p) < W.near) { w.going = true; toast(g, EERIE_SAYS.watcherGone); }
      else if (!w.going && h.t >= W.last) { w.going = true; toast(g, EERIE_SAYS.watcherLeft); }
      // In slowly; out all at once, before he can get a proper look.
      w.shown = w.going ? Math.max(0, w.shown - dt * 4) : Math.min(1, w.shown + dt / W.fade);
      if (w.going && w.shown <= 0) { g.world.destroy(h.e); s.now = null; }
      return;
    }
    case "lamp":
      if (h.t < EERIE.lamp.out) return;
      snuffLamp(h.lamp, false);
      toast(g, EERIE_SAYS.lampBack);
      s.now = null;
      return;
    case "well":
      if ((h.next -= dt) > 0) return;
      if (h.said >= h.lines.length) { s.now = null; return; }
      sound(g, "whisper", h.at);
      combatText(g, h.at.x, h.at.y - 6, h.lines[h.said++]!, EERIE_SAYS.whisperColor, false, 1.8);
      h.next = EERIE.well.gap;
      return;
    case "curfew":
      if ((h.next -= dt) > 0) return;
      if (h.rung >= EERIE.curfew.strokes) { s.now = null; return; }
      h.rung++;
      h.next = EERIE.curfew.gap;
      if (h.at) sound(g, "handbell", { x: p.x, y: p.y + EERIE.curfew.away });
      else sound(g, "handbell");
      return;
  }
}

/** Day's come, or he's gone in or away: whatever was going on stops, and leaves nothing behind. */
function stop(g: Game, s: Unease): void {
  const h = s.now;
  s.now = null;
  if (h?.id === "watcher" && g.world.has(h.e, "transform")) g.world.destroy(h.e);
  if (h?.id === "lamp") snuffLamp(h.lamp, false);
}
