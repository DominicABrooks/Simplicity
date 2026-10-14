// The townsfolk: the census's common people (src/world/residents.ts), each by name, out in the streets, going
// about their day by the hour (the day's clock: src/data/daylight.ts). In the morning they leave their own
// front doors for work: a stallholder stands behind their own stall, facing the aisle; a smith at the smithy.
// Through the day the rest go to market, standing at one stall and then another; gather round the fountain,
// the wells and the market cross to talk; run errands across town; look in at St Mary's. In the evening the
// grown-ups drift to the Crown and the Bell and stand about outside, or go home; by night the streets are
// all but empty. Children never wander off alone: they come out with a parent from their own house, walking
// in their steps and standing at their side, or in a band of children near their own age, off to play in
// the square. Royalty, nobles and the court stay indoors; the guards are guards (see spawnGuard). And you can
// knock at anyone's door: someone who's home comes and stands in the doorway, and you can talk to them.
import type { Entity } from "../core/ecs.ts";
import { Rng } from "../core/rng.ts";
import { loadArea } from "../areas/index.ts";
import { CRAFTS } from "../data/crafts.ts";
import { TOWNSFOLK } from "../data/townsfolk.ts";
import { HALF, T } from "../data/world.ts";
import type { Prop } from "../world/area.ts";
import { houseDoor } from "../world/plans.ts";
import { moveBy } from "../world/collision.ts";
import { layoutOf } from "../world/layouts.ts";
import { FAMILIES, type Where } from "../world/people.ts";
import { residentsOf, type Resident } from "../world/residents.ts";
import { ANVIL_WORK, MUSIC_WORK, anvilOf } from "../world/workplaces.ts";
import { doorOf, findPath, nearestWalkable, walkable, walkwaysOf, type TileXY, type Walkways } from "../world/walkways.ts";
import type { Errand, Task, Walker } from "./components.ts";
import { combatText } from "./combat.ts";
import { toast, type Game } from "./game.ts";
import { goInside } from "./interiors.ts";

// ---------- The census ----------
const CITY: readonly Where[] = ["capital", "castle", "kingsroad"];
let census: Resident[] | null = null;
let loading: Promise<Resident[]> | null = null;
let byId = new Map<number, Resident>();
let households = new Map<string, Resident[]>();
/** Everyone under one roof shares their home's place (a family's house, a folk household's, the almshouse...). */
const householdOf = (r: Resident) => `${r.home.area}|${r.home.place}`;

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
  households = new Map();
  for (const r of people) { const k = householdOf(r); households.set(k, [...(households.get(k) ?? []), r]); }
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

/** The hour of the day (0-24), from the day's clock where the game keeps one; midday otherwise. */
export const hourOf = (g: Game): number => (g as unknown as { hour?: number }).hour ?? 12;

/** Who'd stop at the inn of an evening, by their nature. */
const SOCIABLE = new Set(["cheerful", "chatty", "jolly", "loud", "easygoing", "romantic", "competitive", "mischievous", "lazy", "warm-hearted"]);

// ---------- The places in an area, and where to stand at them ----------
interface Standing { tile: TileXY; face: number | null; task?: Task }
/** Somewhere to gather round (tiles, its middle), standing `r` tiles out. */
interface Ring { x: number; y: number; r: number }
interface Places {
  /** Each stall: where its holder stands behind it (facing out over the counter), and where buyers stand in front (facing it). */
  stalls: { vendor: Standing[]; front: Standing[]; x: number; y: number }[];
  /** The fountain, the wells and the market cross. */
  rings: Ring[];
  /** Outside the inns' doors. */
  inns: Ring[];
  /** St Mary's door. */
  church: Standing | null;
  /** Where a minstrel plays: on the fountain's south rim, facing out over the square. */
  stage: Standing | null;
}

function placesOf(area: string, ways: Walkways, props: readonly Prop[], people: readonly Resident[]): Places {
  const stalls: Places["stalls"] = [], rings: Ring[] = [];
  let stage: Standing | null = null;
  for (const p of props) {
    if (p.kind === "stall") {
      const x0 = Math.round(p.rect.x / T), y = Math.round(p.rect.y / T), w = Math.max(1, Math.round(p.rect.w / T));
      const dy = p.facing === "south" ? 1 : -1, out = dy * (Math.PI / 2), vendor: Standing[] = [], front: Standing[] = [];
      for (let i = 0; i < w; i++) {
        if (walkable(ways, x0 + i, y - dy)) vendor.push({ tile: [x0 + i, y - dy], face: out });
        if (walkable(ways, x0 + i, y + dy)) front.push({ tile: [x0 + i, y + dy], face: -out });
      }
      stalls.push({ vendor, front, x: x0 + w / 2, y: y + 0.5 });
    }
    if (p.kind === "fountain") {
      rings.push({ x: p.x / T, y: p.y / T, r: p.radius * 1.05 + 1.1 });
      const tile = nearestWalkable(ways, p.x / T - 0.5, p.y / T + p.radius * 1.05 + 0.5, 2);
      if (tile) stage = { tile, face: Math.PI / 2, task: "lute" };
    }
    if (p.kind === "well") rings.push({ x: p.x / T, y: p.y / T, r: 1.6 });
    if (p.kind === "cross") rings.push({ x: p.x / T, y: p.y / T, r: 1.8 });
  }
  const inns: Ring[] = [];
  for (const id of ["maddox", "pike"]) {
    const keeper = people.find(r => r.family === id && r.home.area === area);
    const door = keeper && doorOf(ways, props, keeper.home.x, keeper.home.y);
    if (door) inns.push({ x: door[0] + 0.5, y: door[1] + 0.5, r: 1.3 });
  }
  const st = props.find(p => p.kind === "church");
  let church: Standing | null = null;
  if (st && "rect" in st) {
    const cx = (st.rect.x + st.rect.w / 2) / T, cy = (st.rect.y + st.rect.h / 2) / T, door = doorOf(ways, props, Math.floor(cx), Math.floor(cy));
    if (door) church = { tile: door, face: Math.atan2(cy - door[1] - 0.5, cx - door[0] - 0.5) };
  }
  return { stalls, rings, inns, church, stage };
}

// ---------- The streets of the area the hero is in ----------
interface Streets {
  area: string;
  ways: Walkways;
  props: readonly Prop[];
  places: Places;
  /** Where people come in from and go off to other districts. */
  exits: TileXY[];
  /** Everyone who might come out, in turn; and those of them who work here, who come out first in working hours. */
  queue: Resident[];
  workers: Resident[];
  out: Map<number, Entity>;
  /** Those gone in to work, and the door they went in by: they come back out of it when work's done. */
  atWork: Map<number, TileXY>;
  /** Spots someone's standing at (a stall's counter), so nobody else stands there too. */
  claims: Map<string, Entity>;
  timer: number;
  rng: Rng;
}
let here: Streets | null = null;

const between = (rng: Rng, [a, b]: readonly [number, number]) => a + rng.next() * (b - a);
const keyOf = (t: TileXY) => `${t[0]},${t[1]}`;
const centre = (t: TileXY): [number, number] => [(t[0] + 0.5) * T, (t[1] + 0.5) * T];

/** On arriving somewhere: fill its streets (as soon as the census is ready, the first time). */
export function enterTownsfolk(g: Game): void {
  here = null;
  const area = g.area.def.id;
  if (!TOWNSFOLK.out[area]) return;
  if (census) { populate(g, census); return; }
  void loadCensus().then(people => { if (g.area.def.id === area && !here) populate(g, people); }).catch(err => console.error(err));
}

/** How many should be out in the area now, by the hour. */
const capOf = (s: Streets, hour: number) => Math.round((TOWNSFOLK.out[s.area] ?? 0) * TOWNSFOLK.busy[Math.floor(hour) % 24]!);

/** Set up the area's streets and put people out on them, already partway along their ways. */
export function populate(g: Game, people: readonly Resident[]): void {
  const area = g.area.def.id, rng = new Rng(area.length * 7919 + 17), ways = walkwaysOf(g.map), props = g.area.layout.props;
  const exits = g.area.layout.exits.flatMap(e => {
    const t = nearestWalkable(ways, (e.rect.x + e.rect.w / 2) / T - 0.5, (e.rect.y + e.rect.h / 2) / T - 0.5, 6);
    return t ? [t] : [];
  });
  const queue = walkersOf(people, area);
  for (let i = queue.length - 1; i > 0; i--) { const j = rng.int(0, i); [queue[i], queue[j]] = [queue[j]!, queue[i]!]; }
  here = { area, ways, props, places: placesOf(area, ways, props, people), exits, queue, workers: [], atWork: new Map(), out: new Map(), claims: new Map(), timer: 0, rng };
  const s = here;
  s.workers = queue.filter(r => r.age >= 14 && workOf(s, r, null) !== null);
  // Those at work are at their posts already; everyone else is somewhere along their way.
  const cap = capOf(s, hourOf(g));
  for (let tries = 0; s.out.size < cap && tries < cap * 3; tries++) comeOut(g, s, 0.15 + rng.next() * 0.7);
  hangDoors(g, s, people);
  lastTalk = undefined;
}

// ---------- Where people go ----------
/** Where someone lives in this area (the tile outside their door), or a way out if they live elsewhere. */
function homeOf(s: Streets, r: Resident): TileXY | null {
  if (r.home.area === s.area) return doorOf(s.ways, s.props, r.home.x, r.home.y);
  return s.exits.length ? s.exits[s.rng.int(0, s.exits.length - 1)]! : null;
}

/** Built things people work at out in the open, standing beside them: not indoors. */
const OPEN_WORK = new Set<Prop["kind"]>(["smithy", "stable", "rack", "trough", "cart", "well", "target", "dummy", "stock", "crane"]);

/**
 * Where someone works in this area (if not at home), and whether they go in to do it: behind their own stall
 * (facing out over the counter); somewhere on the open ground they work on (the square, the bridge), spread
 * out and facing it; beside an open workshop (the smithy), facing it, the smith himself at the anvil;
 * a minstrel on the fountain's rim, playing to the square; or in at the door of the building they work
 * in (the church, the guildhall, the kitchen, a master's shop).
 */
function workOf(s: Streets, r: Resident, e: Entity | null): { stand: Standing; goIn: boolean } | null {
  if (r.day.area !== s.area || (r.day.x === r.home.x && r.day.y === r.home.y)) return null;
  const dx = r.day.x + 0.5, dy = r.day.y + 0.5, toward = (t: TileXY) => Math.atan2(dy - t[1] - 0.5, dx - t[0] - 0.5);
  const free = (t: TileXY) => { const c = s.claims.get(keyOf(t)); return c === undefined || c === e; };
  if (MUSIC_WORK.test(r.job) && s.places.stage && free(s.places.stage.tile)) return { stand: s.places.stage, goIn: false };
  const stall = s.places.stalls.find(st => Math.hypot(st.x - dx, st.y - dy) < 2.5 && st.vendor.length);
  if (stall) return { stand: stall.vendor.find(v => { const c = s.claims.get(keyOf(v.tile)); return c === undefined || c === e; }) ?? stall.vendor[0]!, goIn: false };
  if (walkable(s.ways, r.day.x, r.day.y)) {                  // open ground: somewhere about it, not all on the one spot
    const tile = nearestWalkable(s.ways, r.day.x + s.rng.int(-3, 3), r.day.y + s.rng.int(-3, 3), 3);
    return tile && { stand: { tile, face: tile[0] === r.day.x && tile[1] === r.day.y ? null : toward(tile) }, goIn: false };
  }
  const px = dx * T, py = dy * T;
  const at = s.props.find(p => "rect" in p && px >= p.rect.x && py >= p.rect.y && px <= p.rect.x + p.rect.w && py <= p.rect.y + p.rect.h);
  if (at && OPEN_WORK.has(at.kind)) {
    const anvil = at.kind === "smithy" ? anvilOf(at.rect) : null, spot = anvil && walkable(s.ways, ...anvil.stand) ? anvil.stand : null;
    if (anvil && spot && ANVIL_WORK.test(r.job) && free(spot)) {
      return { stand: { tile: spot, face: Math.atan2(anvil.y - spot[1] - 0.5, anvil.x - spot[0] - 0.5), task: "anvil" }, goIn: false };
    }
    // Everyone else stands about it, but not in the smith's way.
    const tile = nearestWalkable(s.ways, r.day.x, r.day.y, 3), off = tile && spot && keyOf(tile) === keyOf(spot) ? nearestWalkable(s.ways, spot[0] - 2, spot[1], 3) : tile;
    return off && { stand: { tile: off, face: toward(off) }, goIn: false };
  }
  const door = doorOf(s.ways, s.props, r.day.x, r.day.y);
  return door && { stand: { tile: door, face: null }, goIn: true };
}

/** A place in a ring round something, facing its middle. */
function inRing(s: Streets, ring: Ring): Standing | null {
  const a = s.rng.next() * Math.PI * 2, tile = nearestWalkable(s.ways, ring.x + Math.cos(a) * ring.r - 0.5, ring.y + Math.sin(a) * ring.r - 0.5, 2);
  return tile && { tile, face: Math.atan2(ring.y - tile[1] - 0.5, ring.x - tile[0] - 0.5) };
}
const any = <V>(s: Streets, list: readonly V[]): V | undefined => (list.length ? list[s.rng.int(0, list.length - 1)] : undefined);

/** What someone does next, by the hour, who they are and what they've just done. */
function decide(g: Game, s: Streets, r: Resident, w: Walker | null, crowded: boolean): Errand {
  const h = hourOf(g), H = TOWNSFOLK.hours, p = s.places, roll = s.rng.next();
  const adult = r.age >= 16, old = r.age >= 60, works = workOf(s, r, null) !== null;
  const drinker = adult && p.inns.length > 0 && r.traits.some(t => SOCIABLE.has(t));
  if (r.age < 14) return h >= H.kidsIn || h < 7 ? "home" : "play";
  if (crowded) return "home";
  if (h >= H.bedtime || h < 6) return drinker && h >= H.bedtime && roll < 0.3 ? "drink" : "home";
  if (works && h >= H.workFrom && h < H.workTo) return w?.plan === "work" && roll < 0.2 ? (roll < 0.1 && p.stalls.length ? "shop" : "chat") : "work";
  if (h >= H.innFrom && p.inns.length && adult && roll < (drinker ? 0.55 : 0.18)) return "drink";
  if (h >= H.innFrom + 2 && roll < 0.55) return "home";
  if (w?.plan === "shop" && roll < 0.4 && p.stalls.length) return "shop";       // on to another stall
  const options: [Errand, number][] = [
    ["shop", p.stalls.length && h < H.workTo ? 0.35 : 0], ["chat", p.rings.length ? (old ? 0.35 : 0.2) : 0], ["errand", 0.15],
    ["church", p.church && (old || /priest|deacon|choir|sexton|chaplain/.test(r.job)) ? 0.12 : p.church ? 0.03 : 0], ["home", 0.2],
  ];
  let t = s.rng.next() * options.reduce((a, [, wt]) => a + wt, 0);
  for (const [plan, wt] of options) if ((t -= wt) <= 0) return plan;
  return "home";
}

/** Where to go for a plan, which way to face there, and whether they go in. */
function destination(s: Streets, r: Resident, e: Entity | null, plan: Errand): { stand: Standing; goIn: boolean } | null {
  const p = s.places, free = (st: Standing) => { const c = s.claims.get(keyOf(st.tile)); return c === undefined || c === e; };
  let stand: Standing | null | undefined = null;
  switch (plan) {
    case "home": { const door = homeOf(s, r); return door ? { stand: { tile: door, face: null }, goIn: true } : null; }
    case "work": { const w = workOf(s, r, e); if (w) return w; break; }
    case "shop": {
      const mine = workOf(s, r, e)?.stand, stalls = p.stalls.filter(st => st.front.some(free) && !(mine && st.vendor.some(v => keyOf(v.tile) === keyOf(mine.tile))));
      stand = any(s, any(s, stalls)?.front.filter(free) ?? []);
      break;
    }
    case "chat": { const ring = any(s, p.rings); stand = ring && inRing(s, ring); break; }
    case "drink": { const inn = any(s, p.inns); stand = inn && inRing(s, inn); break; }
    case "church": if (p.church) return { stand: p.church, goIn: s.rng.next() < 0.5 }; break;
    case "errand": { const t = any(s, s.ways.streets); stand = t && { tile: t, face: null }; break; }
    case "play": {
      const ring = any(s, p.rings), t = ring ? nearestWalkable(s.ways, ring.x + (s.rng.next() - 0.5) * 4, ring.y + ring.r + 1 + s.rng.next() * 2, 3) : any(s, s.ways.streets);
      stand = t && { tile: t, face: null };
      break;
    }
  }
  return stand ? { stand, goIn: false } : null;
}

/** Point someone on their way: a path from where they are (or `from`) to where their plan takes them. */
function setOff(s: Streets, e: Entity, w: Walker, r: Resident, plan: Errand, from: TileXY): boolean {
  const dest = destination(s, r, e, plan);
  const path = dest && findPath(s.ways, from, dest.stand.tile);
  if (!dest || !path) return false;
  release(s, e);
  if (plan === "work" || plan === "shop") s.claims.set(keyOf(dest.stand.tile), e);
  Object.assign(w, { plan, path, goIn: dest.goIn, face: dest.stand.face, task: dest.stand.task ?? null, moving: true, wait: 0, playAt: null, runTo: null });
  return true;
}
function release(s: Streets, e: Entity): void { for (const [k, c] of s.claims) if (c === e) s.claims.delete(k); }

// ---------- Coming out ----------
/** A grown-up of this child's house who could take them out. */
const parentOf = (s: Streets, r: Resident) =>
  (households.get(householdOf(r)) ?? []).find(a => a.age >= 16 && isCommoner(a) && !s.out.has(a.id) && (a.home.area === s.area || a.day.area === s.area));
/** The children of this grown-up's house who aren't out. */
const kidsOf = (s: Streets, r: Resident) => (households.get(householdOf(r)) ?? []).filter(k => k.age >= 4 && k.age < 14 && isCommoner(k) && !s.out.has(k.id));
/** Children near this one's age who live in the area and aren't out: playmates. */
const playmatesOf = (s: Streets, r: Resident) =>
  s.queue.filter(k => k !== r && k.age >= 5 && k.age < 14 && Math.abs(k.age - r.age) <= 3 && k.home.area === s.area && !s.out.has(k.id));

/** The next in the queue comes out (with whoever they keep with), `along` of the way to where they're going. */
function comeOut(g: Game, s: Streets, along = 0): void {
  // In working hours, someone who works here and isn't at it yet goes first: stalls don't stand empty all day.
  const h = hourOf(g), working = h >= TOWNSFOLK.hours.workFrom && h < TOWNSFOLK.hours.workTo;
  // After hours, those who went in to work come back out first, on their way home.
  const due = working ? s.workers.filter(r => !s.out.has(r.id) && !s.atWork.has(r.id)) : [...s.atWork.keys()].flatMap(id => (s.out.has(id) ? [] : [byId.get(id)!]));
  // Before anyone, the work you can see and hear: the smith to his anvil, the minstrel to the fountain.
  let showing = working ? due.find(r => workOf(s, r, null)?.stand.task) : undefined;
  for (let tries = 0; tries < Math.min(s.queue.length, 60); tries++) {
    let r: Resident;
    if (showing) { r = showing; due.splice(due.indexOf(showing), 1); showing = undefined; }
    else if (due.length && s.rng.next() < 0.6) r = due.splice(s.rng.int(0, due.length - 1), 1)[0]!;
    else { r = s.queue.shift()!; s.queue.push(r); }      // round the queue in turn
    if (s.out.has(r.id)) continue;
    const fromWork = s.atWork.get(r.id);
    if (fromWork && working) continue;                     // still at it
    // Who goes out together: a child with a parent, or a band of children; a grown-up maybe with their children.
    let party: Resident[] = [r];
    if (r.age < 14) {
      const parent = parentOf(s, r);
      if (parent) party = [parent, r, ...kidsOf(s, parent).filter(k => k !== r).slice(0, s.rng.int(0, 1))];
      else {
        const mates = playmatesOf(s, r).slice(0, s.rng.int(1, 3));
        if (!mates.length) continue;                         // nobody to go out with: they stay in
        party = [r, ...mates].sort((a, b) => b.age - a.age);
      }
    } else if (!fromWork && s.rng.next() < 0.45) party = [r, ...kidsOf(s, r).slice(0, s.rng.int(1, 2))];
    const leader = party[0]!, kids = party.length > 1 && leader.age < 14;
    let plan = kids ? "play" : decide(g, s, leader, null, false);
    if (fromWork) plan = plan === "drink" ? "drink" : "home";   // done for the day: home (or the inn)
    else if (plan === "home") continue;                       // they'd only go straight back in
    if (party.length > 1 && plan === "drink") plan = "shop";   // not with the children
    const from = fromWork ?? homeOf(s, leader);
    if (!from) continue;
    s.atWork.delete(leader.id);
    const e = spawn(g, s, leader, centre(from));
    const w = g.world.need(e, "walker");
    if (!setOff(s, e, w, leader, plan, from) || !w.path.length) { g.world.destroy(e); s.out.delete(leader.id); release(s, e); continue; }
    // Partway along already, for those out when the hero arrives.
    const skip = plan === "work" && along > 0 ? w.path.length : Math.min(w.path.length - 1, Math.floor(w.path.length * along));
    if (skip > 0) {
      const [x, y] = centre(w.path[skip - 1]!), t = g.world.need(e, "transform");
      t.x = x + w.lane[0] - HALF; t.y = y + w.lane[1] - HALF;
      w.path = w.path.slice(skip);
    }
    const t = g.world.need(e, "transform");
    w.trail = [[t.x + HALF, t.y + HALF]];
    party.slice(1).forEach((k, i) => {
      // A step beside the leader, unless that's in a wall: then on the leader's own spot.
      const bx = t.x + HALF + (i + 1) * 2, by = t.y + HALF + 3, ok = walkable(s.ways, Math.floor(bx / T), Math.floor(by / T));
      const f = spawn(g, s, k, ok ? [bx, by] : [t.x + HALF, t.y + HALF]);
      Object.assign(g.world.need(f, "walker"), { follow: { leader: e, slot: i }, plan: w.plan, moving: true });
    });
    return;
  }
}

function spawn(g: Game, s: Streets, r: Resident, [x, y]: [number, number]): Entity {
  const kind = r.age < 14 ? "child" : r.age >= 65 ? "old" : "adult", lane: [number, number] = [(s.rng.next() - 0.5) * 3, (s.rng.next() - 0.5) * 3];
  const scale = r.age < 14 ? 0.62 + (r.age / 14) * 0.25 : 1;
  const walker: Walker = {
    id: r.id, plan: "errand", path: [], lane, speed: between(s.rng, TOWNSFOLK.speed[kind]), moving: true, wait: 0, blockedFor: 0, goIn: false,
    facing: 0, face: null, follow: null, trail: [], playAt: null, runTo: null, holdFor: null, leaving: 0, catchingUp: false,
  };
  const e = g.world.create({
    transform: { x: x - HALF, y: y - HALF },
    targetable: { hostile: false, name: r.name, radius: TOWNSFOLK.radius, height: TOWNSFOLK.height * scale },
    walker,
    renderable: { kind: "townsfolk" },
  });
  s.out.set(r.id, e);
  return e;
}

// ---------- At the door ----------
const nightNow = (g: Game) => { const h = hourOf(g); return h >= TOWNSFOLK.hours.bedtime || h < 6; };
const GRUMPY = ["grumpy", "impatient", "gloomy", "stingy", "sarcastic", "proud"], CHEERY = ["cheerful", "jolly", "chatty", "kind", "generous", "easygoing"];
const NERVY = ["nervous", "shy", "superstitious", "jumpy", "worried"];

/**
 * What someone says at their own front door: how they greet whoever knocked (by the hour, their nature, and
 * whether it's their house, an inn, or a noble house they serve), whether anyone you might be after is in
 * (and if not, where they are), a wary word if they inform for the Marshal, and goodbye as they shut it.
 */
function doorstepLines(g: Game, s: Streets, r: Resident, door: Door): string[] {
  const D = TOWNSFOLK.atTheDoor, pick = (list: readonly string[]) => list[s.rng.int(0, list.length - 1)]!, has = (set: string[]) => r.traits.some(t => set.includes(t));
  const night = nightNow(g), child = r.age < 14, inn = /^The (Crown|Bell)/.test(door.name);
  const noble = door.household.some(p => p.role === "family" && !isCommoner(p));
  const open = night ? D.open.night : child ? D.open.child : inn ? D.open.inn : noble && r.role === "servant" ? D.open.servant
    : has(GRUMPY) ? D.open.grumpy : has(NERVY) ? D.open.nervous : has(CHEERY) ? D.open.cheerful : D.open.day;
  const lines = [pick(open)];
  if (!inn) {
    // Who's out, of the grown-ups of the house, and where: at their work, or just out.
    const out = door.household.filter(p => p !== r && p.age >= 14 && !homeNow(g, s, p) && (isCommoner(p) || !noble));
    if (out.length) {
      const p = out[s.rng.int(0, out.length - 1)]!, he = p.sex === "f" ? "she" : "he", him = p.sex === "f" ? "her" : "him";
      const atWork = p.day.area !== p.home.area || p.day.x !== p.home.x || p.day.y !== p.home.y;
      const place = s.out.has(p.id) || !atWork ? "out and about somewhere" : /^(playing|at |in |on )/.test(p.day.place) ? p.day.place : `at ${p.day.place}`;
      lines.push(pick(D.away).replace("{name}", p.name.split(" ")[0]!).replace("{he}", he).replace("{him}", him)
        .replace("{Place}", place.charAt(0).toUpperCase() + place.slice(1)).replace("{place}", place));
    } else if (!night && door.household.filter(p => homeNow(g, s, p)).length <= 1) lines.push(pick(D.alone));
  }
  if (r.stance === "informer" && !child && !night) lines.push(pick(D.wary));
  const I = TOWNSFOLK.invite, servant = noble && r.role === "servant";
  const welcome = night || child || servant || r.stance === "informer" || open === D.open.grumpy ? 0
    : inn ? I.inn : open === D.open.cheerful ? I.cheerful : open === D.open.nervous ? I.nervous : I.day;
  if (s.rng.next() < welcome) {
    lines.push(pick(inn ? D.comeInn : D.come));
    door.invitedUntil = g.clock + I.stands;
    for (const [e, d] of doors) if (d === door) { const t = g.world.get(e, "targetable"); if (t) t.name = `${door.name} (go in)`; }
    return lines;                                            // no goodbye: they're holding the door for you
  }
  lines.push(pick(night ? D.bye.night : child ? D.bye.child : open === D.open.grumpy ? D.bye.grumpy : open === D.open.cheerful ? D.bye.cheerful : open === D.open.nervous ? D.bye.nervous : D.bye.day));   // in the same mood
  return lines;
}

/** Is this someone who's come to a door? */
export const atTheDoor = (e: Entity): boolean => answering.has(e);

// ---------- Parties ----------
/** Who the hero was talking to last frame, to notice when a new conversation starts. */
let lastTalk: Entity | undefined;

/**
 * The hero's started talking to someone. If they're running to catch up with their party, they won't stop:
 * it's over before it starts. If they're one of a party on the move, the party mostly waits for them (the
 * leader stops and turns to watch); otherwise it goes on without them, and they say they've got to go and,
 * a moment later, run after it.
 */
function talkStarted(g: Game, s: Streets, e: Entity): void {
  const w = g.world.get(e, "walker"), t = g.world.get(e, "transform");
  if (!w || !t) return;
  const at = answering.get(e), said = g.world.get(g.player, "conversation"), r = byId.get(w.id);
  if (at && said && r) { said.lines = doorstepLines(g, s, r, at.door); said.line = 0; said.t = 0; at.talked = true; return; }
  if (w.catchingUp) {
    g.world.remove(g.player, "conversation");
    combatText(g, t.x, t.y - 4, TOWNSFOLK.brushOff[s.rng.int(0, TOWNSFOLK.brushOff.length - 1)]!, "#e8dcc4");
    lastTalk = undefined;
    return;
  }
  const lw = w.follow && g.world.get(w.follow.leader, "walker");
  if (!w.follow || !lw || (!lw.moving && !lw.runTo)) return;            // not going anywhere: no hurry
  if (s.rng.next() < TOWNSFOLK.party.wait) { lw.holdFor = e; return; }
  const kid = byId.get(w.id), leader = byId.get(lw.id), c = g.world.get(g.player, "conversation");
  if (!kid || !leader || !c) return;
  const parent = leader.age >= 16, who = leader.sex === "f" ? "Mum" : "Da";
  const lines = parent ? TOWNSFOLK.gotToGo.parent : TOWNSFOLK.gotToGo.band;
  const own = parent && householdOf(leader) === householdOf(kid) && ["head", "spouse", "family"].includes(leader.role);
  c.lines = [lines[s.rng.int(0, lines.length - 1)]!.replace("{who}", own ? who : leader.name.split(" ")[0]!)];
  c.line = 0;
  c.t = 0;
  w.leaving = TOWNSFOLK.party.sayBye;
}

/** Run after the party: along a way round anything in the way, faster than they walk, till alongside again. */
function catchUp(g: Game, s: Streets, w: Walker, t: { x: number; y: number }, lx: number, ly: number, pace: number, dt: number): void {
  const cx = t.x + HALF, cy = t.y + HALF, gap = Math.hypot(lx - cx, ly - cy);
  if (gap < TOWNSFOLK.follow.gap * 1.5) { w.catchingUp = false; w.path = []; return; }
  w.catchingUp = true;
  const at: TileXY = [Math.floor(cx / T), Math.floor(cy / T)], goal = nearestWalkable(s.ways, lx / T - 0.5, ly / T - 0.5, 2);
  const last = w.path[w.path.length - 1];
  if (goal && (!last || Math.hypot(last[0] - goal[0], last[1] - goal[1]) > 1.5)) w.path = findPath(s.ways, nearestWalkable(s.ways, at[0], at[1], 2) ?? at, goal) ?? [];
  const next = w.path[0];
  const [tx, ty] = next ? centre(next) : [lx, ly], dx = tx - cx, dy = ty - cy, d = Math.hypot(dx, dy);
  const step = Math.min(d, pace * TOWNSFOLK.party.run * dt);
  if (d <= step + 0.01 && next) w.path.shift();
  if (d > 0.01) { moveBy(g.map, t, (dx / d) * step, (dy / d) * step, true); w.facing = Math.atan2(dy, dx); }
  w.moving = true;
}

// ---------- Doors ----------
/** A house's front door: who lives behind it, and someone knocking. */
interface Door {
  tile: TileXY;
  name: string;
  /** The house it's the door of, and until when (the game clock) you've been asked in. */
  house: Extract<Prop, { kind: "house" }>;
  invitedUntil: number;
  household: Resident[];
  /** Seconds till whoever's coming gets to the door (0: nobody's knocked), and who that is (null: nobody's home). */
  knocked: number;
  who: Resident | null;
}
const doors = new Map<Entity, Door>();
/** Whoever's come to a door: which door, whether the hero's talked to them, and how long they've stood waiting. */
const answering = new Map<Entity, { door: Door; talked: boolean; idle: number }>();

/** What a house is called, from where its people live: "the Mallow house" is The Mallow house, "The Crown, on the square..." the Crown. */
const houseName = (place: string) => { const n = place.split(",")[0]!.replace(/ \(a guest\)$/, ""); return n.charAt(0).toUpperCase() + n.slice(1); };

/** Every house with people living in it gets its front door as something to target (and knock at), named for the house. */
function hangDoors(g: Game, s: Streets, people: readonly Resident[]): void {
  doors.clear();
  answering.clear();
  for (const house of s.props) {
    if (house.kind !== "house") continue;
    const r = house.rect, inside = (p: Resident) => {
      const px = (p.home.x + 0.5) * T, py = (p.home.y + 0.5) * T;
      return p.home.area === s.area && px >= r.x && py >= r.y && px <= r.x + r.w && py <= r.y + r.h;
    };
    const household = people.filter(p => !p.prisoner && inside(p));      // everyone who lives here, and only them
    if (!household.length) continue;
    const tile = doorOf(s.ways, s.props, Math.floor((r.x + r.w / 2) / T), Math.floor((r.y + r.h / 2) / T));
    if (!tile) continue;
    const name = houseName(household.find(p => p.role === "head" || p.role === "family")?.home.place ?? household[0]!.home.place);
    const at = houseDoor(house).at;                         // the ring goes on the door itself, as the house is drawn
    const e = g.world.create({ transform: { x: at.x * T - HALF, y: at.z * T - HALF }, targetable: { hostile: false, name, radius: 4, height: 1.6 } });
    doors.set(e, { tile, name, house, invitedUntil: 0, household, knocked: 0, who: null });
  }
}

/** Is this a door? */
export const isDoor = (e: Entity | null): e is Entity => e !== null && doors.has(e);

/**
 * Is someone at home right now? Not if they're out in the streets, or gone in to work somewhere; nor, in
 * the hours they spend somewhere else (work for the grown-ups, school or the square for children), if they
 * spend them somewhere else. Otherwise, yes: in the evening, at night, or if they work from home.
 */
function homeNow(g: Game, s: Streets, r: Resident): boolean {
  if (r.prisoner || s.out.has(r.id) || s.atWork.has(r.id)) return false;
  const h = hourOf(g), H = TOWNSFOLK.hours;
  const elsewhere = r.day.area !== r.home.area || r.day.x !== r.home.x || r.day.y !== r.home.y;
  return !(elsewhere && h >= H.workFrom && h < (r.age < 14 ? H.kidsIn : H.workTo));
}

/** Who's at home behind a door right now (none, if it isn't a door). */
export function whoIsHome(g: Game, e: Entity): Resident[] {
  const s = here, door = doors.get(e);
  return s && door ? door.household.filter(r => homeNow(g, s, r)) : [];
}

/** Who'd come to the door, of those at home: at a noble house a servant, otherwise a grown-up, otherwise anyone old enough; nobody if nobody's in. */
function answererOf(g: Game, s: Streets, door: Door): Resident | null {
  const home = door.household.filter(r => r.age >= 10 && homeNow(g, s, r));
  const serving = home.filter(r => r.role === "servant"), grown = home.filter(r => r.age >= 16);
  const noble = door.household.some(r => r.role === "family" && !isCommoner(r));
  const pool = noble && serving.length ? serving : grown.length ? grown : home;
  return pool.length ? pool[s.rng.int(0, pool.length - 1)]! : null;
}

/** Knock at a door, if it is one and the hero's close enough. Returns whether it was a door at all. */
export function knock(g: Game, e: Entity | null): boolean {
  const s = here, door = e !== null ? doors.get(e) : undefined;
  if (!s || !door || e === null) return false;
  g.target = e;
  const hero = g.world.need(g.player, "transform"), d = g.world.need(e, "transform"), dx = d.x + HALF, dy = d.y + HALF;
  if (Math.hypot(hero.x - d.x, hero.y - d.y) > TOWNSFOLK.knock.reach) { toast(g, "Too far away to knock"); return true; }
  if (door.invitedUntil > g.clock) {                         // they asked you in: in you go
    const answerers = new Set([...answering].flatMap(([a, at]) => (at.door === door ? [g.world.get(a, "walker")?.id] : [])));
    const home = door.household.filter(r => homeNow(g, s, r) || answerers.has(r.id));
    goInside(g, s.area, door.house, door.household, home, door.name);
    return true;
  }
  if (door.knocked > 0 || door.household.some(r => { const w = s.out.get(r.id); return w !== undefined && g.world.get(w, "walker")?.plan === "answer"; })) return true;
  combatText(g, dx - HALF, dy - HALF - 4, "Knock knock", "#e8dcc4");
  const h = hourOf(g), night = h >= TOWNSFOLK.hours.bedtime || h < 6;
  door.who = night && s.rng.next() < TOWNSFOLK.knock.asleep ? null : answererOf(g, s, door);
  door.knocked = TOWNSFOLK.knock.answer;
  return true;
}

/** Knocks waiting on an answer: whoever's coming opens up and stands in the doorway, facing the hero; or nobody comes. */
function answerDoors(g: Game, s: Streets, dt: number): void {
  for (const [e, door] of doors) {
    if (door.invitedUntil && door.invitedUntil <= g.clock) { door.invitedUntil = 0; const t = g.world.get(e, "targetable"); if (t) t.name = door.name; }
    if (door.knocked <= 0 || (door.knocked -= dt) > 0) continue;
    door.knocked = 0;
    const r = door.who;
    if (!r || !homeNow(g, s, r)) {
      const h = hourOf(g);
      toast(g, h >= TOWNSFOLK.hours.bedtime || h < 6 ? `No answer at ${door.name}. They must be asleep.` : `No answer at ${door.name}.`);
      continue;
    }
    const a = spawn(g, s, r, centre(door.tile)), w = g.world.need(a, "walker"), t = g.world.need(a, "transform");
    Object.assign(w, { plan: "answer", moving: false, wait: TOWNSFOLK.knock.wait, goIn: true });
    answering.set(a, { door, talked: false, idle: 0 });
    if (g.target === e) g.target = a;                        // the ring's on whoever came to the door
    toast(g, `${r.name} comes to the door.`, true);
    const D = TOWNSFOLK.atTheDoor, mood = nightNow(g) ? D.peek.night : r.age < 14 ? D.peek.child : D.peek.day;
    combatText(g, t.x, t.y - 4, mood[s.rng.int(0, mood.length - 1)]!, "#e8dcc4");   // a word as they open it
  }
}

// ---------- Every frame ----------
/** Everyone walks on, stays at what they're doing, keeps with their party; the streets fill and empty with the hour. */
/** Seconds to each minstrel's next note. */
const tunes = new Map<Entity, number>();
/** A minstrel at his playing: now and then a note floats up over the square. */
function play(g: Game, s: Streets, e: Entity, t: { x: number; y: number }, dt: number): void {
  const left = (tunes.get(e) ?? 0) - dt;
  if (left > 0) { tunes.set(e, left); return; }
  tunes.set(e, between(s.rng, CRAFTS.notes));
  combatText(g, t.x + s.rng.int(-3, 3), t.y - 6, s.rng.next() < 0.5 ? "♪" : "♫", CRAFTS.note);
}

export function updateTownsfolk(g: Game, dt: number): void {
  const s = here;
  if (!s || s.area !== g.area.def.id || g.state !== "play") return;
  const hero = g.world.need(g.player, "transform"), conversation = g.world.get(g.player, "conversation"), talkingTo = conversation?.with;
  if (talkingTo !== lastTalk) { lastTalk = talkingTo; if (talkingTo !== undefined) talkStarted(g, s, talkingTo); }
  const cap = capOf(s, hourOf(g)), crowded = s.out.size > cap * 1.15;
  answerDoors(g, s, dt);
  for (const [id, e] of [...s.out]) {
    const w = g.world.get(e, "walker"), t = g.world.get(e, "transform");
    if (!w || !t) { s.out.delete(id); release(s, e); tunes.delete(e); continue; }
    if (talkingTo === e && g.world.get(g.player, "conversation")) {                     // they stop to talk
      w.moving = false; w.runTo = null; w.facing = Math.atan2(hero.y - t.y, hero.x - t.x);
      if (w.leaving > 0 && (w.leaving -= dt) <= 0) { g.world.remove(g.player, "conversation"); w.catchingUp = true; }   // said it: off they run
      continue;
    }
    if (w.holdFor !== null) {                                // waiting for one of their party the hero's talking to
      const them = g.world.get(w.holdFor, "transform");
      if (talkingTo !== w.holdFor || !them) w.holdFor = null;
      else { w.facing = Math.atan2(them.y - t.y, them.x - t.x); continue; }
    }
    if (w.follow) { keepUp(g, s, e, w, t, dt); continue; }
    if (w.plan === "answer") {                               // in the doorway: facing the hero, then back in and the door shut
      const hd = Math.hypot(hero.x - t.x, hero.y - t.y), at = answering.get(e);
      w.facing = Math.atan2(hero.y - t.y, hero.x - t.x);
      if (at?.talked && w.wait > TOWNSFOLK.doorstep.shut) w.wait = TOWNSFOLK.doorstep.shut;   // said their piece
      if (at && !at.talked && (at.idle += dt) >= TOWNSFOLK.doorstep.idle) {                  // knocked, and then nothing
        const idle = TOWNSFOLK.atTheDoor.idle;
        combatText(g, t.x, t.y - 4, idle[s.rng.int(0, idle.length - 1)]!, "#e8dcc4");
        at.talked = true;
        w.wait = TOWNSFOLK.doorstep.shut * 2;
      }
      if ((w.wait -= dt) <= 0 || hd > TOWNSFOLK.knock.leave) { answering.delete(e); goIn(g, s, e, w); }
      continue;
    }
    if (!w.moving) {
      if (w.plan === "play" && w.playAt) runAbout(g, s, w, t, w.playAt, dt);
      if (w.plan === "work" && w.task === "lute") play(g, s, e, t, dt);
      if ((w.wait -= dt) <= 0) next(g, s, e, w, t, crowded);
      continue;
    }
    walk(g, s, e, w, t, dt, hero);
  }
  if (s.out.size < cap && (s.timer -= dt) <= 0) {
    s.timer = between(s.rng, TOWNSFOLK.every);
    comeOut(g, s);
  }
}

/** Along the path; on getting there, go in, or settle to what they came for. */
function walk(g: Game, s: Streets, e: Entity, w: Walker, t: { x: number; y: number }, dt: number, hero: { x: number; y: number }): void {
  const next = w.path[0], cx = t.x + HALF, cy = t.y + HALF;
  if (!next) {
    if (w.goIn) { goIn(g, s, e, w); return; }
    w.moving = false;
    w.wait = between(s.rng, TOWNSFOLK.stay[w.plan] ?? [3, 6]);
    if (w.face !== null) w.facing = w.face;
    if (w.plan === "play") w.playAt = [Math.floor(cx / T), Math.floor(cy / T)];
    return;
  }
  const [px, py] = centre(next), tx = px + w.lane[0], ty = py + w.lane[1], dx = tx - cx, dy = ty - cy, d = Math.hypot(dx, dy);
  // The hero right in front of them: they wait a moment, then carry on.
  const hx = hero.x - t.x, hy = hero.y - t.y, hd = Math.hypot(hx, hy);
  if (hd < TOWNSFOLK.personal && d > 0 && (hx * dx + hy * dy) / (hd * d || 1) > 0.3 && w.blockedFor < TOWNSFOLK.patience) { w.blockedFor += dt; return; }
  if (hd >= TOWNSFOLK.personal) w.blockedFor = 0;
  const step = w.speed * dt;
  if (d <= step) { t.x = tx - HALF; t.y = ty - HALF; w.path.shift(); }
  else { t.x += (dx / d) * step; t.y += (dy / d) * step; }
  if (d > 0.01) w.facing = Math.atan2(dy, dx);
  const last = w.trail[w.trail.length - 1];                  // breadcrumbs, for any children following
  if (!last || Math.hypot(last[0] - t.x - HALF, last[1] - t.y - HALF) >= 3) { w.trail.push([t.x + HALF, t.y + HALF]); if (w.trail.length > 40) w.trail.shift(); }
}

/** Done here: what next, and off they go (or, if there's nowhere to get to from here, they stay a while longer). */
function next(g: Game, s: Streets, e: Entity, w: Walker, t: { x: number; y: number }, crowded: boolean): void {
  const r = byId.get(w.id);
  if (!r) return;
  const at = nearestWalkable(s.ways, (t.x + HALF) / T - 0.5, (t.y + HALF) / T - 0.5, 2);
  const plan = w.plan === "play" && r.age < 14 && !crowded && hourOf(g) < TOWNSFOLK.hours.kidsIn && s.rng.next() < 0.5 ? "play" : decide(g, s, r, w, crowded);
  if (!at || !setOff(s, e, w, r, plan, at)) { w.wait = 2 + s.rng.next() * 3; return; }
  w.trail = [[t.x + HALF, t.y + HALF]];
}

/** In at the door (or off out of the area): gone. Children with them go in with them, or home to their own houses. */
function goIn(g: Game, s: Streets, e: Entity, w: Walker): void {
  const leader = byId.get(w.id);
  if (w.plan === "work") { const at = g.world.get(e, "transform"); if (at) s.atWork.set(w.id, [Math.floor((at.x + HALF) / T), Math.floor((at.y + HALF) / T)]); }
  for (const [, f] of s.out) {
    const fw = g.world.get(f, "walker"), ft = g.world.get(f, "transform"), kid = fw && byId.get(fw.id);
    if (!fw?.follow || fw.follow.leader !== e || !ft || !kid) continue;
    fw.follow = null;
    if (leader && householdOf(kid) === householdOf(leader)) { fw.goIn = true; fw.path = []; fw.moving = true; continue; }   // same door: in they go
    const at = nearestWalkable(s.ways, (ft.x + HALF) / T - 0.5, (ft.y + HALF) / T - 0.5, 2);
    if (!at || !setOff(s, f, fw, kid, "home", at)) { fw.goIn = true; fw.path = []; }
  }
  g.world.destroy(e);
  s.out.delete(w.id);
  release(s, e);
}

/** A child keeping with their leader: in their steps while they walk, at their side while they stand, at play with them. */
function keepUp(g: Game, s: Streets, e: Entity, w: Walker, t: { x: number; y: number }, dt: number): void {
  const F = TOWNSFOLK.follow, leader = w.follow!.leader, lw = g.world.get(leader, "walker"), lt = g.world.get(leader, "transform");
  if (!lw || !lt) {                                          // lost them: home on their own
    w.follow = null;
    const r = byId.get(w.id), at = nearestWalkable(s.ways, (t.x + HALF) / T - 0.5, (t.y + HALF) / T - 0.5, 2);
    if (!r || !at || !setOff(s, e, w, r, "home", at)) { g.world.destroy(e); s.out.delete(w.id); }
    return;
  }
  if (lw.plan === "play" && !lw.moving && lw.playAt) { runAbout(g, s, w, t, lw.playAt, dt); return; }
  w.runTo = null;
  const slot = w.follow!.slot, lx = lt.x + HALF, ly = lt.y + HALF;
  let to: [number, number];
  if (lw.moving) {
    const trail = lw.trail, back = Math.round((F.gap * (slot + 1)) / 3);
    to = trail[Math.max(0, trail.length - 1 - back)] ?? [lx, ly];
  } else {
    const f = lw.facing, side = slot % 2 ? -1 : 1, d = F.beside * Math.ceil((slot + 1) / 2);
    to = [lx - Math.sin(f) * side * d - Math.cos(f) * 2, ly + Math.cos(f) * side * d - Math.sin(f) * 2];
    if (!walkable(s.ways, Math.floor(to[0] / T), Math.floor(to[1] / T))) to = [lx - Math.cos(f) * F.beside, ly - Math.sin(f) * F.beside];
  }
  const dx = to[0] - t.x - HALF, dy = to[1] - t.y - HALF, d = Math.hypot(dx, dy);
  if (d > 24 || w.catchingUp) { catchUp(g, s, w, t, lx, ly, lw.speed, dt); return; }   // fallen behind: run to catch them up
  if (d > 0.8) {
    const step = Math.min(d, (lw.speed * 1.35 + (d > 16 ? 20 : 0)) * dt);
    moveBy(g.map, t, (dx / d) * step, (dy / d) * step, true);
    w.moving = true;
    w.facing = Math.atan2(dy, dx);
  } else {
    w.moving = false;
    if (!lw.moving) w.facing = lw.face ?? lw.facing;       // looking where their parent looks: at the stall, the fountain
  }
}

/** Children at play: running about near where they play, now here, now there. */
function runAbout(g: Game, s: Streets, w: Walker, t: { x: number; y: number }, at: readonly [number, number], dt: number): void {
  const cx = t.x + HALF, cy = t.y + HALF, R = TOWNSFOLK.follow.play;
  if (!w.runTo || Math.hypot(w.runTo[0] - cx, w.runTo[1] - cy) < 1.5 || s.rng.next() < dt * 0.4) {
    for (let i = 0; i < 6; i++) {
      const tx = at[0] + 0.5 + (s.rng.next() * 2 - 1) * R, ty = at[1] + 0.5 + (s.rng.next() * 2 - 1) * R;
      if (walkable(s.ways, Math.floor(tx), Math.floor(ty))) { w.runTo = [tx * T, ty * T]; break; }
    }
  }
  if (!w.runTo) return;
  const dx = w.runTo[0] - cx, dy = w.runTo[1] - cy, d = Math.hypot(dx, dy);
  if (d < 0.5) return;
  const step = Math.min(d, w.speed * 1.25 * dt);
  moveBy(g.map, t, (dx / d) * step, (dy / d) * step, true);
  w.facing = Math.atan2(dy, dx);
}
