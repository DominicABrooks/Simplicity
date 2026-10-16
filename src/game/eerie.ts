// The city after dark (the story and the tuning are in src/data/eerie.ts). While the hero walks Kingsholm's
// streets at night, every so often something happens: a shutter bangs, footsteps follow him, someone watches him
// from the end of the street, a lamp gutters out, a well whispers, a little bell rings nine; and anyone still out near
// it takes fright and runs for home (src/game/townsfolk.ts scareFolk). Never by day, never
// indoors, never while he's busy (talking, resting, in a scene) and never anywhere near St Mary's churchyard,
// which belongs to the Grey Ringer (src/game/ghost.ts). Out in the wild at night, there's only the watcher, in the
// trees, and never by a boss's arena or while a boss is up. None of it can hurt him; it's only the city. And nothing
// tells the player about it: it's there to be seen and heard (the fx it raises, src/game/fx.ts), or missed.
import type { Entity } from "../core/ecs.ts";
import { isDay } from "../data/daylight.ts";
import { EERIE, FRIGHT, WHISPERS, type EerieArea, type EerieId } from "../data/eerie.ts";
import { HALF, T, Tile } from "../data/world.ts";
import { blocked, tileAt } from "../world/collision.ts";
import { bossHere } from "./bosses.ts";
import { cinderFight } from "./cinderfight.ts";
import { greatKoiOut } from "./greatkoi.ts";
import { rimeFight } from "./rimefight.ts";
import { combatText } from "./combat.ts";
import { carryingCurio, spentCurios } from "./curios.ts";
import { cutscene } from "./cutscene.ts";
import type { Game } from "./game.ts";
import { churchyardOf, ghostOut } from "./ghost.ts";
import { lampLit, lampsHere, snuffLamp, type Lamp } from "./lamps.ts";
import { resting } from "./resting.ts";
import { sound } from "./sfx.ts";
import { sleeping } from "./sleeping.ts";
import { talking } from "./talk.ts";
import { scareFolk } from "./townsfolk.ts";
import { rememberFright, tickFrights } from "./frights.ts";

type Spot = { x: number; y: number };
type Front = Spot & { facing: "north" | "south" | "east" | "west" };

/** What's going on now, if anything, and how far along it is. */
type Happening =
  | { id: "shutter"; t: number; at: Front; slammed: number }
  | { id: "footsteps"; t: number; next: number; from: Spot; heading: Spot; left: boolean }
  | { id: "watcher"; t: number; e: Entity }
  | { id: "lamp"; t: number; lamp: Lamp; next: number }
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

/** How it goes in this area, if it happens here at all. */
const areaOf = (g: Game): EerieArea | null => (Object.hasOwn(EERIE.areas, g.area.def.id) ? EERIE.areas[g.area.def.id]! : null);

/** Can it happen in this place at this hour: one of its areas (outdoors, not a house's inside), at night? */
export const eerieHere = (g: Game): boolean => areaOf(g) !== null && !g.area.def.indoors && !isDay(g.hour);

/** A boss is up (or a fight's going on): the night keeps its tricks to itself. */
const fightOn = (g: Game): boolean => bossHere(g) !== null || greatKoiOut(g) !== null || cinderFight(g) !== null || rimeFight(g) !== null;

/** Is this spot (px) in or by a boss's arena (its ring of stones or ice pillars, and EERIE.arena tiles round it)? */
function byArena(g: Game, at: Spot): boolean {
  return g.area.layout.props.some(p => (p.kind === "arena" || p.kind === "rimeStage") && Math.hypot(at.x - p.x, at.y - p.y) < (p.radius + EERIE.arena) * T);
}

/** Is the hero free for it: not busy, no ghost or boss about, and not by the churchyard or a boss's arena? */
function unbusy(g: Game): boolean {
  if (talking(g) || cutscene(g) || resting(g) || sleeping(g) || ghostOut(g) !== null || fightOn(g)) return false;
  if ((g.world.get(g.player, "health")?.hp ?? 0) <= 0) return false;
  const yard = churchyardOf(g), p = heroAt(g), m = EERIE.churchyard;
  if (byArena(g, p)) return false;
  return !yard || p.x < yard.x - m || p.x > yard.x + yard.w + m || p.y < yard.y - m || p.y > yard.y + yard.h + m;
}

/**
 * The house fronts this near (in EERIE.shutter.near): the middle of their street side, and which way it faces. Not
 * those facing north: the hero sees the city from the south, and would only see their backs.
 */
function shutterSpots(g: Game): Front[] {
  const p = heroAt(g), [lo, hi] = EERIE.shutter.near;
  return g.area.layout.props.flatMap(h => {
    if (h.kind !== "house" || h.doorSide === "north") return [];
    const r = h.rect, f = h.doorSide;
    const at = { x: f === "east" ? r.x + r.w : f === "west" ? r.x : r.x + r.w / 2, y: f === "south" ? r.y + r.h : r.y + r.h / 2, facing: f };
    const d = dist(at, p), { wide, up } = EERIE.shutter;
    return d >= lo && d <= hi && Math.abs(at.x - p.x) <= wide && at.y >= p.y - up ? [at] : [];
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

/** Is (x, y) (px) among trees: a tree's tile? */
const inTrees = (g: Game, at: Spot) => tileAt(g.map, at.x, at.y) === Tile.Tree;

/**
 * Where the watcher stands, in plain sight of the hero, the way he's facing if it can be (or any way, failing that),
 * and never by a boss's arena. In the city, at the end of the street. In the wild, just inside the treeline: among
 * the trees, with open ground between him and the hero right up to the first trunk.
 */
export function watcherSpot(g: Game): Spot | null {
  const p = heroAt(g), aim = g.world.need(g.player, "motion").aim, trees = areaOf(g)?.watcher === "trees";
  const turns = [0, 0.35, -0.35, 0.7, -0.7, 1.2, -1.2, 1.8, -1.8, Math.PI];
  const { wide, deep, steps } = EERIE.watcher;
  for (const k of steps) for (const turn of turns) {
    const a = aim + turn, at = { x: p.x + Math.cos(a) * wide * k, y: p.y + Math.sin(a) * deep * k };
    if (byArena(g, at)) continue;
    if (!trees) { if (clearLine(g, p, at)) return at; continue; }
    // Back along the line from there toward the hero to the edge of the trees: he stands a step inside it.
    const d = dist(p, at), ux = (at.x - p.x) / d, uy = (at.y - p.y) / d;
    for (let r = d; r > EERIE.watcher.near; r -= 2) {
      const spot = { x: p.x + ux * r, y: p.y + uy * r }, edge = { x: spot.x - ux * T, y: spot.y - uy * T };
      if (!inTrees(g, spot) || inTrees(g, edge)) continue;
      if (clearLine(g, p, edge)) return spot;
      break;
    }
  }
  return null;
}

/** Can this one happen here and now? (Not counting whose turn it is: see eerieSystem.) */
export function eerieCan(g: Game, id: EerieId): boolean {
  if (!(id in (areaOf(g)?.weights ?? {}))) return false;                // not one this place has
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
  const weights = areaOf(g)?.weights ?? {}, weight = (id: EerieId) => weights[id] ?? 0;
  const ids = (Object.keys(weights) as EerieId[]).filter(id => weight(id) > 0 && eerieCan(g, id));
  const fresh = ids.filter(id => id !== last), from = fresh.length ? fresh : ids;
  const total = from.reduce((n, id) => n + weight(id), 0);
  let roll = g.rng.next() * total;
  for (const id of from) if ((roll -= weight(id)) < 0) return id;
  return from[from.length - 1] ?? null;
}

/**
 * Every frame: after dark in the city's streets, count down to the next, and when it's time, something happens
 * (if the hero's free for it). By day, indoors, or anywhere else, nothing does, and anything going on stops.
 */
export function eerieSystem(g: Game, dt: number): void {
  tickFrights(g, dt);
  const s = uneaseOf(g);
  if (s.area !== g.area.def.id) { stop(g, s); s.area = g.area.def.id; s.wait = EERIE.settle; }
  if (isDay(g.hour)) { s.tonight = 0; s.rung = false; }
  if (!eerieHere(g) || (s.now && fightOn(g))) { stop(g, s); s.wait = EERIE.settle; return; }
  if (s.now) { go(g, s, s.now, dt); if (s.now) fright(g, s.now); return; }
  if (!unbusy(g) || s.tonight >= EERIE.most || (s.wait -= dt) > 0) return;
  s.wait = between(g, areaOf(g)!.every);
  const id = pickEerie(g, s.last);
  if (id) startEerie(g, id);
}

/** Make this one happen now, if it can (at night, in one of its places, no boss about, and here): for eerieSystem, and for playtesting. Whether it did. */
export function startEerie(g: Game, id: EerieId): boolean {
  const s = uneaseOf(g);
  if (s.now || !eerieHere(g) || fightOn(g) || !eerieCan(g, id)) return false;
  s.tonight++;
  s.last = id;
  const p = heroAt(g);
  switch (id) {
    case "shutter": {
      const spots = shutterSpots(g), at = spots[g.rng.int(0, spots.length - 1)]!;
      g.fx.push({ type: "shutter", x: at.x - HALF, y: at.y - HALF, facing: at.facing });
      s.now = { id, t: 0, at, slammed: 0 };
      return true;
    }
    case "footsteps":
      s.now = { id, t: 0, next: EERIE.footsteps.gap, from: p, heading: { x: 0, y: 1 }, left: false };
      return true;
    case "watcher": {
      const at = watcherSpot(g)!;
      const e = g.world.create({ transform: { x: at.x - HALF, y: at.y - HALF }, watcher: { shown: 0, going: false }, renderable: { kind: "watcher" } });
      s.now = { id, t: 0, e };
      return true;
    }
    case "lamp": {
      s.now = { id, t: 0, lamp: lampNear(g)!, next: 0 };
      return true;
    }
    case "well": {
      const all: string[] = [...WHISPERS.lines], lines: string[] = [];
      while (lines.length < EERIE.well.lines && all.length) lines.push(all.splice(g.rng.int(0, all.length - 1), 1)[0]!);
      s.now = { id, t: 0, at: wellNear(g)!, said: 0, next: 0.4, lines };
      return true;
    }
    case "curfew": {
      s.rung = true;
      // Carried, it rings in the bag; otherwise far off toward the river, where it went in.
      const at = carryingCurio(g, "bell") ? null : { x: p.x, y: p.y + EERIE.curfew.away };
      s.now = { id, t: 0, at, rung: 0, next: 0 };
      return true;
    }
  }
}

/** Keep what's happening going, until it's over. */
function go(g: Game, s: Unease, h: Happening, dt: number): void {
  h.t += dt;
  const p = heroAt(g);
  switch (h.id) {
    case "shutter": {
      // It slams, and slams, and slams: the street jolts each time.
      const slams = EERIE.shutter.slams;
      if (h.slammed < slams.length && h.t >= slams[h.slammed]!) {
        h.slammed++;
        sound(g, "shutter", h.at);
        g.shake = Math.max(g.shake, EERIE.shutter.jolt);
      }
      if (h.slammed >= slams.length) s.now = null;
      return;
    }
    case "footsteps": {
      // Somebody a few steps behind him, the way he's come, keeping pace; when he stops, they stop.
      const F = EERIE.footsteps, dx = p.x - h.from.x, dy = p.y - h.from.y, d = Math.hypot(dx, dy);
      if (d > 0.5) { h.heading = { x: dx / d, y: dy / d }; h.from = p; }
      if ((!g.world.need(g.player, "motion").moving && h.t >= F.least) || h.t >= F.last) { s.now = null; return; }
      if ((h.next -= dt) <= 0 && g.world.need(g.player, "motion").moving) {
        // A step, and a print where it fell: on his own track, a little to the side for each foot.
        h.next = F.gap;
        h.left = !h.left;
        const side = h.left ? -1.2 : 1.2, at = { x: p.x - h.heading.x * F.behind - h.heading.y * side, y: p.y - h.heading.y * F.behind + h.heading.x * side };
        sound(g, "footstep", at);
        g.fx.push({ type: "footprint", x: at.x - HALF, y: at.y - HALF, angle: Math.atan2(h.heading.y, h.heading.x), left: h.left });
      }
      return;
    }
    case "watcher": {
      const W = EERIE.watcher, w = g.world.get(h.e, "watcher"), at = g.world.get(h.e, "transform");
      if (!w || !at) { s.now = null; return; }
      if (!w.going && (h.t >= W.last || dist({ x: at.x + HALF, y: at.y + HALF }, p) < W.near)) {
        w.going = true;
        g.fx.push({ type: "puff", x: at.x, y: at.y, n: 12 });
      }
      // In slowly; out all at once, before he can get a proper look.
      w.shown = w.going ? Math.max(0, w.shown - dt * 4) : Math.min(1, w.shown + dt / W.fade);
      if (w.going && w.shown <= 0) { g.world.destroy(h.e); s.now = null; }
      return;
    }
    case "lamp": {
      // It sputters, goes out, stays out a while, and sputters back.
      const L = EERIE.lamp, back = L.gutter + L.out;
      if (h.t >= back + L.catch) { snuffLamp(h.lamp, false); s.now = null; return; }
      if (h.t >= L.gutter && h.t < back) { snuffLamp(h.lamp, true); return; }
      if ((h.next -= dt) > 0) return;
      h.next = between(g, L.flicker);
      snuffLamp(h.lamp, !h.lamp.snuffed);
      return;
    }
    case "well":
      if ((h.next -= dt) > 0) return;
      if (h.said >= h.lines.length) { s.now = null; return; }
      sound(g, "whisper", h.at);
      g.fx.push({ type: "puff", x: h.at.x - HALF, y: h.at.y - HALF, n: 6 });
      combatText(g, h.at.x, h.at.y - 6, h.lines[h.said++]!, WHISPERS.color, false, 1.8);
      h.next = EERIE.well.gap;
      return;
    case "curfew":
      if ((h.next -= dt) > 0) return;
      if (h.rung >= EERIE.curfew.strokes) { s.now = null; return; }
      h.rung++;
      h.next = EERIE.curfew.gap;
      // Heard from the river's side, and seen as a faint ring of sound coming up the street from there (or from his bag).
      if (h.at) sound(g, "handbell", { x: p.x, y: p.y + EERIE.curfew.away });
      else sound(g, "handbell");
      g.fx.push({ type: "chime", x: p.x - HALF, y: p.y - HALF + (h.at ? EERIE.curfew.ring.at : 0), radius: EERIE.curfew.ring.radius });
      return;
  }
}

/** Where it's happening, for anyone nearby to take fright at: the shutter, the hero (followed, or hearing the bell), the watcher, the lamp, the well. */
function fright(g: Game, h: Happening): void {
  let at: Spot;
  switch (h.id) {
    case "shutter": at = h.at; break;
    case "watcher": { const t = g.world.get(h.e, "transform"); if (!t) return; at = { x: t.x + HALF, y: t.y + HALF }; break; }
    case "lamp": at = h.lamp; break;
    case "well": at = h.at; break;
    default: at = heroAt(g);
  }
  const ran = scareFolk(g, at, FRIGHT.radius, FRIGHT.shouts, FRIGHT.run);
  if (ran.length) rememberFright(g, ran, h.id, at);           // and they'll want to tell the hero about it
}

/** Day's come, or he's gone in or away: whatever was going on stops, and leaves nothing behind. */
function stop(g: Game, s: Unease): void {
  const h = s.now;
  s.now = null;
  if (h?.id === "watcher" && g.world.has(h.e, "transform")) g.world.destroy(h.e);
  if (h?.id === "lamp") snuffLamp(h.lamp, false);
}
