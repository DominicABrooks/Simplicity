// Going into someone's house, when they've asked you in (see the doors in src/game/townsfolk.ts): its
// inside is made then (src/world/interiors.ts), and whoever was home is in there, standing about by the
// fire, at the table, at their work. They turn to look at you as you come near, and you can talk to them.
// Out through the door, and you're on the step outside it.
import type { Entity } from "../core/ecs.ts";
import { registerArea } from "../areas/index.ts";
import { TOWNSFOLK } from "../data/townsfolk.ts";
import { HALF, T } from "../data/world.ts";
import type { Prop } from "../world/area.ts";
import { interiorOf, type Spot } from "../world/interiors.ts";
import { walkwaysOf } from "../world/walkways.ts";
import type { Resident } from "../world/residents.ts";
import type { Walker } from "./components.ts";
import { setState, type Game } from "./game.ts";

/** Each inside you've been asked into: who's in, and where they stand. */
const insides = new Map<string, { people: Resident[]; spots: Spot[] }>();
/** The people standing about inside the house the hero's in, and where they stand (px) facing which way. */
let standing: { e: Entity; x: number; y: number; facing: number }[] = [];

/** How near (px) the hero comes before someone inside turns to look; how many are about in a house, and in an inn's hall. */
const NOTICE = 30, ROOM_FOR = { house: 7, inn: 12 } as const;

/** Go into a house: make its inside (with these people in it) and set off through the door. */
export function goInside(g: Game, area: string, house: Extract<Prop, { kind: "house" }>, household: readonly Resident[], home: readonly Resident[], name: string): void {
  const { def, spots } = interiorOf(area, house, household, name);
  registerArea(def);
  insides.set(def.id, { people: [...home], spots });
  g.travel = { area: def.id, entry: "in" };
  setState(g, "travel");
}

/** On arriving somewhere: if it's a house's inside, put its people in it. */
export function enterInterior(g: Game): void {
  standing = [];
  const here = insides.get(g.area.def.id);
  if (!here || !g.area.def.indoors) return;
  // Room for so many: the rest are upstairs, or in the back. Past the set spots, about the open floor, spread out.
  const inn = g.area.layout.props.some(p => p.kind === "furniture" && p.item === "counter");
  const shown = here.people.slice(0, inn ? ROOM_FOR.inn : ROOM_FOR.house), ways = walkwaysOf(g.map);
  const key = (x: number, y: number) => x * 1000 + y, crowded = (x: number, y: number) => [-1, 0, 1].some(dx => [-1, 0, 1].some(dy => taken.has(key(x + dx, y + dy))));
  const taken = new Set(here.spots.map(s => key(Math.floor(s.x), Math.floor(s.y))));
  shown.forEach((r, i) => {
    const free = i < here.spots.length ? [] : ways.streets.filter(([x, y]) => y > 1 && y < g.map.height - 2 && !crowded(x, y));
    const spare = free.length ? free[Math.floor((i * 7.31 + 3) % free.length)]! : null;   // somewhere with nobody right next to it
    const s = i < here.spots.length || !spare ? here.spots[i % here.spots.length]! : { x: spare[0] + 0.5, y: spare[1] + 0.5, facing: ((i * 2.4) % 6.28) - Math.PI };
    taken.add(key(Math.floor(s.x), Math.floor(s.y)));
    standing.push({ e: standIn(g, r, s), x: s.x * T, y: s.y * T, facing: s.facing });
  });
}

/** One of the census's people standing at a spot indoors (tiles), facing its way, in their own body and clothes. */
export function standIn(g: Game, r: Resident, s: Spot): Entity {
  const x = s.x * T, y = s.y * T, scale = r.age < 14 ? 0.62 + (r.age / 14) * 0.25 : 1;
  const walker: Walker = {
    id: r.id, plan: "chat", path: [], lane: [0, 0], speed: 0, moving: false, wait: Infinity, blockedFor: 0, goIn: false,
    facing: s.facing, face: s.facing, follow: null, trail: [], playAt: null, runTo: null, holdFor: null, leaving: 0, catchingUp: false,
  };
  return g.world.create({
    transform: { x: x - HALF, y: y - HALF },
    targetable: { hostile: false, name: r.name, radius: TOWNSFOLK.radius, height: TOWNSFOLK.height * scale },
    walker,
    renderable: { kind: "townsfolk" },
  });
}

/** Every frame indoors: those near the hero look at them; the rest at what they were about. */
export function updateInterior(g: Game): void {
  if (!standing.length) return;
  const hero = g.world.need(g.player, "transform");
  for (const s of standing) {
    const w = g.world.get(s.e, "walker");
    if (!w) continue;
    const dx = hero.x + HALF - s.x, dy = hero.y + HALF - s.y;
    w.facing = Math.hypot(dx, dy) < NOTICE ? Math.atan2(dy, dx) : s.facing;
  }
}
