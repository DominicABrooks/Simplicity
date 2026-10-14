// The townsfolk: the census's common people (src/world/residents.ts), each by name, out in the streets.
// They come out of their own front doors (or in by the area's ways in, if they live in another district),
// walk the streets to where they spend the day (a stall, the square, the smithy, the castle kitchen...),
// stand about a while, wander, and go back in; as each goes in, another comes out. Royalty, nobles and the
// court stay indoors; the guards are guards (see spawnGuard).
import type { Entity } from "../core/ecs.ts";
import { Rng } from "../core/rng.ts";
import { loadArea } from "../areas/index.ts";
import { TOWNSFOLK } from "../data/townsfolk.ts";
import { HALF, T } from "../data/world.ts";
import type { Prop } from "../world/area.ts";
import { layoutOf } from "../world/layouts.ts";
import { FAMILIES, type Where } from "../world/people.ts";
import { residentsOf, type Resident } from "../world/residents.ts";
import { doorOf, findPath, nearestWalkable, walkwaysOf, type TileXY, type Walkways } from "../world/walkways.ts";
import type { Walker } from "./components.ts";
import type { Game } from "./game.ts";

// ---------- The census ----------
const CITY: readonly Where[] = ["capital", "castle", "kingsroad"];
let census: Resident[] | null = null;
let loading: Promise<Resident[]> | null = null;
let byId = new Map<number, Resident>();

/** Everyone in the city, worked out (once) from the city's areas as built. */
export function loadCensus(): Promise<Resident[]> {
  loading ??= Promise.all(CITY.map(id => loadArea(id))).then(defs => {
    const [capital, castle, kingsroad] = defs.map(d => layoutOf(d).props) as [Prop[], Prop[], Prop[]];
    return setCensus(residentsOf({ capital, castle, kingsroad }));
  });
  return loading;
}

/** Use these people as the census (loadCensus does; tests can too). */
export function setCensus(people: Resident[]): Resident[] {
  census = people;
  byId = new Map(people.map(r => [r.id, r]));
  return people;
}

export const residentById = (id: number): Resident | undefined => byId.get(id);

/** Royalty and the nobility, whose own family members don't walk the streets (their servants do). */
const HIGHBORN = new Set(FAMILIES.filter(f => f.rank === "royal" || f.rank === "noble").map(f => f.id));
export const isCommoner = (r: Resident): boolean =>
  !r.prisoner && r.age >= 4 && r.role !== "soldier" && r.role !== "courtier" && !(r.role === "family" && r.family !== undefined && HIGHBORN.has(r.family));

/** Who might be out in an area: the commoners who live or spend the day there, and on the bridge, travellers. */
export const walkersOf = (people: readonly Resident[], area: string): Resident[] =>
  people.filter(r => isCommoner(r) && (r.home.area === area || r.day.area === area || (area === "kingsroad" && r.role === "guest")));

// ---------- The streets of the area the hero is in ----------
interface Streets {
  area: string;
  ways: Walkways;
  props: readonly Prop[];
  /** Where people come in from and go off to other districts. */
  exits: TileXY[];
  /** Everyone who might come out, in turn. */
  queue: Resident[];
  out: Map<number, Entity>;
  timer: number;
  rng: Rng;
}
let here: Streets | null = null;

const between = (rng: Rng, [a, b]: readonly [number, number]) => a + rng.next() * (b - a);

/** On arriving somewhere: fill its streets (as soon as the census is ready, the first time). */
export function enterTownsfolk(g: Game): void {
  here = null;
  const area = g.area.def.id;
  if (!TOWNSFOLK.out[area]) return;
  if (census) { populate(g, census); return; }
  void loadCensus().then(people => { if (g.area.def.id === area && !here) populate(g, people); }).catch(err => console.error(err));
}

/** Set up the area's streets and put people out on them, already partway along their ways. */
export function populate(g: Game, people: readonly Resident[]): void {
  const area = g.area.def.id, rng = new Rng(area.length * 7919 + 17), ways = walkwaysOf(g.map);
  const exits = g.area.layout.exits.flatMap(e => {
    const t = nearestWalkable(ways, (e.rect.x + e.rect.w / 2) / T - 0.5, (e.rect.y + e.rect.h / 2) / T - 0.5, 6);
    return t ? [t] : [];
  });
  const queue = walkersOf(people, area);
  for (let i = queue.length - 1; i > 0; i--) { const j = rng.int(0, i); [queue[i], queue[j]] = [queue[j]!, queue[i]!]; }
  here = { area, ways, props: g.area.layout.props, exits, queue, out: new Map(), timer: 0, rng };
  for (let i = 0, n = Math.min(TOWNSFOLK.out[area] ?? 0, queue.length); i < n; i++) comeOut(g, here, 0.15 + rng.next() * 0.7);
}

/** Where someone lives in this area (the tile outside their door), or a way out if they live elsewhere. */
function homeOf(s: Streets, r: Resident): TileXY | null {
  if (r.home.area === s.area) return doorOf(s.ways, s.props, r.home.x, r.home.y);
  return s.exits.length ? s.exits[s.rng.int(0, s.exits.length - 1)]! : null;
}
/** Where someone spends the day, if it's in this area and not at home. */
function workOf(s: Streets, r: Resident): TileXY | null {
  if (r.day.area !== s.area || (r.day.x === r.home.x && r.day.y === r.home.y)) return null;
  return nearestWalkable(s.ways, r.day.x, r.day.y);
}
const wander = (s: Streets): TileXY | null => (s.ways.streets.length ? s.ways.streets[s.rng.int(0, s.ways.streets.length - 1)]! : null);

/** The next one in the queue comes out of their door (or in from another district), `along` of the way to where they're going. */
function comeOut(g: Game, s: Streets, along = 0): void {
  for (let tries = 0; tries < s.queue.length; tries++) {
    const r = s.queue.shift()!;
    s.queue.push(r);
    if (s.out.has(r.id)) continue;
    const from = homeOf(s, r), work = workOf(s, r), to = work ?? wander(s);
    if (!from || !to) continue;
    const path = findPath(s.ways, from, to);
    if (!path?.length) continue;
    const skip = Math.min(path.length - 1, Math.floor(path.length * along)), start = skip ? path[skip - 1]! : from;
    const kind = r.age < 14 ? "child" : r.age >= 65 ? "old" : "adult", lane: [number, number] = [(s.rng.next() - 0.5) * 3, (s.rng.next() - 0.5) * 3];
    const scale = r.age < 14 ? 0.62 + (r.age / 14) * 0.25 : 1;
    const e = g.world.create({
      transform: { x: (start[0] + 0.5) * T + lane[0] - HALF, y: (start[1] + 0.5) * T + lane[1] - HALF },
      targetable: { hostile: false, name: r.name, radius: TOWNSFOLK.radius, height: TOWNSFOLK.height * scale },
      walker: { id: r.id, path: path.slice(skip), lane, speed: between(s.rng, TOWNSFOLK.speed[kind]), moving: true, wait: 0, blockedFor: 0, then: work ? "work" : "stop", facing: 0 },
      renderable: { kind: "townsfolk" },
    });
    s.out.set(r.id, e);
    return;
  }
}

/** Where they go next, having stood about: home (or off to another district), somewhere else, or back to work. */
function nextGoal(g: Game, s: Streets, e: Entity, w: Walker): void {
  const r = byId.get(w.id), t = g.world.need(e, "transform");
  if (!r) return;
  const at = nearestWalkable(s.ways, (t.x + HALF) / T - 0.5, (t.y + HALF) / T - 0.5, 2);
  const roll = s.rng.next(), work = workOf(s, r);
  const [to, then]: [TileXY | null, Walker["then"]] = (w.then === "work" ? roll < 0.45 : roll < 0.4) ? [homeOf(s, r), "in"]
    : roll < 0.8 || !work ? [wander(s), "stop"] : [work, "work"];
  const path = at && to ? findPath(s.ways, at, to) : null;
  if (!path) { w.wait = between(s.rng, TOWNSFOLK.stop); return; }   // nowhere to get to from here: stay put a while longer
  w.path = path;
  w.then = then;
  w.moving = true;
}

/** Every frame: everyone walks on (stepping aside for nobody, but waiting for the hero), and the streets refill. */
export function updateTownsfolk(g: Game, dt: number): void {
  const s = here;
  if (!s || s.area !== g.area.def.id || g.state !== "play") return;
  const hero = g.world.need(g.player, "transform"), talkingTo = g.world.get(g.player, "conversation")?.with;
  for (const [id, e] of s.out) {
    const w = g.world.get(e, "walker"), t = g.world.get(e, "transform");
    if (!w || !t) { s.out.delete(id); continue; }
    const cx = t.x + HALF, cy = t.y + HALF;
    if (talkingTo === e) { w.moving = false; w.facing = Math.atan2(hero.y - t.y, hero.x - t.x); continue; }   // they stop to talk
    if (!w.moving) {
      if ((w.wait -= dt) <= 0) nextGoal(g, s, e, w);
      continue;
    }
    const next = w.path[0];
    if (!next) {                                             // there
      w.moving = false;
      if (w.then === "in") { g.world.destroy(e); s.out.delete(id); continue; }
      w.wait = between(s.rng, w.then === "work" ? TOWNSFOLK.work : TOWNSFOLK.stop);
      continue;
    }
    const tx = (next[0] + 0.5) * T + w.lane[0], ty = (next[1] + 0.5) * T + w.lane[1], dx = tx - cx, dy = ty - cy, d = Math.hypot(dx, dy);
    // The hero right in front of them: they wait a moment, then carry on (past, or through, the hero).
    const hx = hero.x - t.x, hy = hero.y - t.y, hd = Math.hypot(hx, hy);
    if (hd < TOWNSFOLK.personal && d > 0 && (hx * dx + hy * dy) / (hd * d || 1) > 0.3 && w.blockedFor < TOWNSFOLK.patience) { w.blockedFor += dt; continue; }
    if (hd >= TOWNSFOLK.personal) w.blockedFor = 0;
    const step = w.speed * dt;
    if (d <= step) { t.x = tx - HALF; t.y = ty - HALF; w.path.shift(); }
    else { t.x += (dx / d) * step; t.y += (dy / d) * step; }
    if (d > 0.01) w.facing = Math.atan2(dy, dx);
  }
  if (s.out.size < (TOWNSFOLK.out[s.area] ?? 0) && (s.timer -= dt) <= 0) {
    s.timer = between(s.rng, TOWNSFOLK.every);
    comeOut(g, s);
  }
}
