// The city's dogs and cats, about the streets, the square and the yards. Dogs trot from place to place,
// nose down, sit and lie about, and now and then trot up to the hero to sit by them, wagging. Cats keep to
// the doorsteps and the foot of the walls, dozing, wake and slink off somewhere else, and bolt from anyone
// who comes too close, and from a dog (which gives chase). In the small hours they mostly lie about; in the
// rain the cats go to the doorsteps and curl up. Like the townsfolk, they only walk where people can
// (src/world/walkways.ts), so never through anything built or into the water.
import type { Entity } from "../core/ecs.ts";
import { Rng } from "../core/rng.ts";
import { PETS, type Species } from "../data/pets.ts";
import { HALF, T, Tile } from "../data/world.ts";
import { doorOf, findPath, nearestWalkable, walkable, walkwaysOf, type TileXY, type Walkways } from "../world/walkways.ts";
import type { Pet, PetPose } from "./components.ts";
import type { Game } from "./game.ts";

/** The area the hero is in, as the dogs and cats know it. */
interface Haunts {
  area: string;
  ways: Walkways;
  /** Doorsteps, out of the rain. */
  doors: TileXY[];
  /** Where cats like to lie: the doorsteps and the foot of the walls. */
  nooks: TileXY[];
  /** Its own dice, so the animals never shift the game's other rolls. */
  rng: Rng;
}
let here: Haunts | null = null;

const between = (rng: Rng, [a, b]: readonly [number, number]) => a + rng.next() * (b - a);
const pick = <X>(rng: Rng, list: readonly X[]): X | undefined => list[rng.int(0, list.length - 1)];
const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]] as const;
/** The tile a pet's centre is over. */
const tileOf = (x: number, y: number): [number, number] => [Math.floor((x + HALF) / T), Math.floor((y + HALF) / T)];

/** On arriving somewhere: find the doorsteps and nooks, and put its dogs and cats about. */
export function enterPets(g: Game): void {
  here = null;
  const area = g.area.def.id, counts = PETS.out[area];
  if (!counts) return;
  const ways = walkwaysOf(g.map), rng = new Rng(area.length * 104729 + 3), props = g.area.layout.props;
  const doors: TileXY[] = [];
  for (const p of props) {
    if (p.kind !== "house" && p.kind !== "hall" && p.kind !== "church") continue;
    const d = doorOf(ways, props, Math.floor((p.rect.x + p.rect.w / 2) / T), Math.floor((p.rect.y + p.rect.h / 2) / T));
    if (d) doors.push(d);
  }
  const walls: TileXY[] = [];
  for (let y = 0; y < ways.H; y++) for (let x = 0; x < ways.W; x++) {
    if (walkable(ways, x, y) && DIRS.some(([dx, dy]) => g.map.tiles[y + dy]?.[x + dx] === Tile.Wall)) walls.push([x, y]);
  }
  const nooks = [...doors, ...walls.filter(() => rng.next() < 0.25)];
  here = { area, ways, doors, nooks, rng };
  if (!ways.streets.length) return;
  for (const species of ["dog", "cat"] as const) {
    for (let i = 0; i < counts[species]; i++) {
      const at = species === "cat" && nooks.length ? pick(rng, nooks)! : pick(rng, ways.streets)!;
      spawnPet(g, here, species, at);
    }
  }
}

function spawnPet(g: Game, h: Haunts, species: Species, at: TileXY): Entity {
  const rng = h.rng, lane: [number, number] = [(rng.next() - 0.5) * 3, (rng.next() - 0.5) * 3];
  const pace = between(rng, PETS.speed[species].walk);
  const pet: Pet = {
    species, coat: rng.int(0, PETS.coats[species] - 1), path: [], lane, pace, speed: pace, moving: false, running: false,
    pose: "stand", wait: 0, facing: rng.next() * Math.PI * 2, greeting: false, calm: 0,
  };
  settle(h, pet, species === "cat" ? "lie" : pick(rng, ["sniff", "sit", "lie"] as const)!);
  pet.wait *= rng.next();                                   // already partway through it
  return g.world.create({
    transform: { x: (at[0] + 0.5) * T + lane[0] - HALF, y: (at[1] + 0.5) * T + lane[1] - HALF },
    pet,
    renderable: { kind: "pet" },
  });
}

/** Stop and settle: how long for depends on how. */
function settle(h: Haunts, p: Pet, pose: PetPose, dozy = false): void {
  p.moving = p.running = false;
  p.path = [];
  p.pose = pose;
  p.speed = p.pace;
  p.wait = between(h.rng, PETS.stay[pose === "lie" && dozy ? "doze" : pose === "stand" ? "sniff" : pose]!);
}

/** Set off along a path (if there is one): at an easy pace, or running. */
function setOff(p: Pet, path: TileXY[] | null, run = false): boolean {
  if (!path?.length) return false;
  p.path = path;
  p.moving = true;
  p.running = run;
  p.pose = "stand";
  p.greeting = false;
  p.speed = run ? (PETS.speed[p.species].run[0] + PETS.speed[p.species].run[1]) / 2 : p.pace;
  return true;
}

const sleepy = (hour: number) => hour >= PETS.sleepy.from || hour < PETS.sleepy.to;
const raining = (g: Game) => g.weather.rain > 0.5;

/** Somewhere within reach of `from` to go next: a street (or for a cat, a nook), not too far off. */
function somewhere(h: Haunts, from: TileXY, species: Species): TileXY | null {
  const r = PETS.roam[species], near = (t: TileXY) => Math.abs(t[0] - from[0]) <= r && Math.abs(t[1] - from[1]) <= r && (t[0] !== from[0] || t[1] !== from[1]);
  const list = (species === "cat" ? h.rng.next() < 0.65 : h.rng.next() < 0.2) ? h.nooks : h.ways.streets;
  for (let i = 0; i < 12; i++) {
    const t = pick(h.rng, list);
    if (t && near(t)) return t;
  }
  return pick(h.rng, list.filter(near)) ?? null;
}

/** Done where it is: what next, by kind, the hour and the weather. */
function nextGoal(g: Game, h: Haunts, p: Pet, at: TileXY): void {
  const rng = h.rng;
  if (p.species === "cat" && raining(g)) {                  // in out of the rain, to the nearest doorstep
    const door = h.doors.reduce<TileXY | null>((best, d) => (!best || Math.hypot(d[0] - at[0], d[1] - at[1]) < Math.hypot(best[0] - at[0], best[1] - at[1]) ? d : best), null);
    if (!door || (door[0] === at[0] && door[1] === at[1]) || !setOff(p, findPath(h.ways, at, door))) settle(h, p, "lie", true);
    return;
  }
  if (sleepy(g.hour) && rng.next() < (p.species === "dog" ? 0.7 : 0.4)) { settle(h, p, "lie", true); return; }
  const to = somewhere(h, at, p.species);
  if (!to || !setOff(p, findPath(h.ways, at, to))) settle(h, p, p.species === "dog" ? "sniff" : "sit");
}

/** Got where it was going: settle there, as each likes. */
function arrive(g: Game, h: Haunts, p: Pet, at: TileXY): void {
  const roll = h.rng.next();
  if (p.species === "cat") {
    const nook = h.nooks.some(n => n[0] === at[0] && n[1] === at[1]);
    if (p.running) settle(h, p, "sit");                     // bolted: sits up, wary, then settles
    else if (nook || raining(g)) settle(h, p, "lie", roll < 0.7);
    else settle(h, p, roll < 0.6 ? "sit" : "lie");
    return;
  }
  if (sleepy(g.hour) || raining(g)) settle(h, p, roll < 0.6 ? "lie" : "sit", true);
  else settle(h, p, roll < 0.5 ? "sniff" : roll < 0.8 ? "sit" : "lie");
}

/** A cat bolts away from (fx, fy) (px, centres), somewhere a good way off; a dog may give chase. */
function bolt(h: Haunts, p: Pet, x: number, y: number, fx: number, fy: number, at: TileXY): boolean {
  const away = Math.atan2(y - fy, x - fx);
  for (const turn of [0, 0.6, -0.6, 1.2, -1.2, 2]) {
    const a = away + turn, to = nearestWalkable(h.ways, at[0] + Math.cos(a) * PETS.shy.far, at[1] + Math.sin(a) * PETS.shy.far, 3);
    if (to && setOff(p, findPath(h.ways, at, to), true)) return true;
  }
  return false;
}

/** Every frame: dogs and cats go about, and take notice of the hero and of each other. */
export function petSystem(g: Game, dt: number): void {
  const h = here;
  if (!h || h.area !== g.area.def.id || g.state !== "play") return;
  const hero = g.world.need(g.player, "transform"), pets = g.world.query("pet", "transform");
  const dogs = pets.filter(([, { pet }]) => pet.species === "dog");
  for (const [, { pet: p, transform: t }] of pets) {
    p.calm = Math.max(0, p.calm - dt);
    const at = tileOf(t.x, t.y), hd = Math.hypot(hero.x - t.x, hero.y - t.y);

    if (p.species === "cat" && !p.running && p.calm <= 0) {   // too close: off it goes (a dozing cat lets you nearer)
      const near = p.pose === "lie" ? PETS.shy.near * 0.6 : PETS.shy.near;
      const dog = dogs.find(([, d]) => (d.pet.moving || d.pet.pose === "sniff") && Math.hypot(d.transform.x - t.x, d.transform.y - t.y) < PETS.shy.dogNear);
      const from = hd < near ? hero : dog?.[1].transform;
      if (from && bolt(h, p, t.x, t.y, from.x, from.y, at)) {
        p.calm = 3;
        if (dog && from === dog[1].transform && h.rng.next() < 0.6) {   // the dog gives chase, a little behind
          const d = dog[1].pet, dt0 = tileOf(from.x, from.y);
          if (setOff(d, findPath(h.ways, dt0, p.path[p.path.length - 1]!), true)) d.speed *= 0.85;
          d.calm = 6;
        }
      } else if (from) p.calm = 2;
    }

    if (p.species === "dog" && !p.running && !p.greeting && p.calm <= 0 && hd < PETS.greet.near) {   // the hero: come and say hello?
      p.calm = 10;
      if (h.rng.next() < PETS.greet.chance && !sleepy(g.hour)) {
        const to = tileOf(hero.x, hero.y);
        if (setOff(p, findPath(h.ways, at, to) ?? [], true)) p.greeting = true;
        else if (hd <= PETS.greet.gap * 2) { settle(h, p, "sit"); p.greeting = true; p.wait = between(h.rng, PETS.greet.bored); }
      }
    }

    if (p.greeting) {
      p.facing = Math.atan2(hero.y - t.y, hero.x - t.x);
      if (p.moving && hd <= PETS.greet.gap) { settle(h, p, "sit"); p.greeting = true; p.wait = between(h.rng, PETS.greet.bored); }
      else if (!p.moving && hd > PETS.greet.near * 2) p.wait = 0;   // walked off: never mind
      if (!p.moving) {
        if ((p.wait -= dt) <= 0) { p.greeting = false; nextGoal(g, h, p, at); }
        continue;
      }
    }

    if (!p.moving) {
      if ((p.wait -= dt) <= 0) nextGoal(g, h, p, at);
      continue;
    }
    const next = p.path[0];
    if (!next) { arrive(g, h, p, at); p.greeting = false; continue; }
    const cx = t.x + HALF, cy = t.y + HALF, tx = (next[0] + 0.5) * T + p.lane[0], ty = (next[1] + 0.5) * T + p.lane[1];
    const dx = tx - cx, dy = ty - cy, d = Math.hypot(dx, dy), step = p.speed * dt;
    if (d <= step) { t.x = tx - HALF; t.y = ty - HALF; p.path.shift(); }
    else { t.x += (dx / d) * step; t.y += (dy / d) * step; }
    if (d > 0.01 && !p.greeting) p.facing = Math.atan2(dy, dx);
  }
}
