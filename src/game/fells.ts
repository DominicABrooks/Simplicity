// The Fells' house in the Wallside (src/data/fells.ts): Meg Fell's own lines, and her husband's grey cloak hung from
// the window, as the Ranger's note says, so whoever has the note can find the house. It hangs there till the King lets
// Wystan out (src/game/ending.ts: the head laid at his feet); then Meg takes it in for good. Inside, his bow leans by
// the chest, for the hero to take.
import { MEG_TALK, RANGERS_BOW, RANGERS_BOW_SAYS } from "../data/fells.ts";
import { HALF, T } from "../data/world.ts";
import { makeItem, type Item } from "../items/items.ts";
import type { Prop } from "../world/area.ts";
import { blocked } from "../world/collision.ts";
import { FACING_YAW, houseBody, houseDoor, local } from "../world/plans.ts";
import type { Resident } from "../world/residents.ts";
import { beaten } from "./bosses.ts";
import { headLaid } from "./ending.ts";
import { toast, type Game } from "./game.ts";
import { householdHere } from "./interiors.ts";
import { dropLoot } from "./spawn.ts";
import { loadCensus } from "./townsfolk.ts";

/** Is this Meg Fell: the Ranger's wife, the grown woman of the Fells at home? */
export const isMeg = (r: Resident): boolean => r.family === "fell" && !r.prisoner && r.name.startsWith("Meg ");

/** What she says: all of it the first time; after, a line at a time; and once Calder's beaten, the news. */
export function megLines(g: Game, visits: number): string[] {
  if (beaten(g, "calder")) return [...MEG_TALK.quiet];
  if (visits === 0) return [...MEG_TALK.first];
  return [MEG_TALK.again[(visits - 1) % MEG_TALK.again.length]!];
}

/** How high the cloak hangs (world units): from the sill of a window upstairs; downstairs, if there's no upstairs. How far
 *  the upstairs is jettied out over the street, and how far off the wall the cloak hangs, clear of the beam and shutters. */
const UP = 1.85, DOWN = 0.75, JETTY = 0.12, CLEAR = 0.11;

/** Hang the cloak at the Fells' window whenever he comes into the part of the city they live in, till Wystan's home. */
export function watchFells(g: Game): void {
  g.events.on("area", () => {
    if (headLaid(g)) return;
    const area = g.area.def.id;
    void loadCensus().then(people => {
      if (g.area.def.id !== area || headLaid(g)) return;
      const home = people.find(r => r.family === "fell" && !r.prisoner)?.home;
      if (!home || home.area !== area) return;
      const px = (home.x + 0.5) * T, py = (home.y + 0.5) * T;
      const house = g.area.layout.props.find((p): p is Extract<Prop, { kind: "house" }> =>
        p.kind === "house" && px >= p.rect.x && py >= p.rect.y && px <= p.rect.x + p.rect.w && py <= p.rect.y + p.rect.h);
      if (!house) return;
      // On the front, at a window as far from the door as there is (the cloak hanging down clear of it): upstairs, out
      // on the jetty, the windows where the renderer puts them (src/render/town.ts: from 0.5 in, 0.85 apart); or, on a
      // single storey, a step along from the door. Stood off the wall past the jetty's beam and the shutters.
      const body = houseBody(house.rect), sideways = house.doorSide === "east" || house.doorSide === "west";
      const w = sideways ? body.d : body.w, d = sideways ? body.w : body.d, door = houseDoor(house).along, up = house.storeys > 1, yaw = FACING_YAW[house.doorSide];
      const windows: number[] = [];
      for (let x = -w / 2 + 0.5; x < w / 2 - 0.3; x += 0.85) windows.push(x);
      const along = up ? windows.reduce((a, b) => (Math.abs(b - door) > Math.abs(a - door) ? b : a), windows[0] ?? 0) : door + 0.85;
      const at = local({ x: body.x, z: body.z }, yaw, along, d / 2 + (up ? JETTY : 0) + CLEAR);
      g.world.create({ transform: { x: at.x * T - HALF, y: at.z * T - HALF }, cloak: { yaw, y: up ? UP : DOWN }, renderable: { kind: "cloak" } });
    });
  });
}

/** Is this the Fells' house: the Ranger's family's? */
export const isFells = (household: readonly Resident[]): boolean => household.some(r => r.family === "fell" && !r.prisoner);

/** Is the Ranger's bow his already: in the bag, in hand or in his hand? */
const hasBow = (g: Game): boolean => {
  const inv = g.inventory, is = (i: Item | null | undefined) => i?.name === RANGERS_BOW.name;
  return inv.grid.some(e => is(e.item)) || is(inv.held) || Object.values(inv.equip).some(is);
};

/** The Ranger's bow, lying here, if it is. */
const bowHere = (g: Game): boolean => g.world.query("pickup").some(([, c]) => c.pickup.kind === "loot" && c.pickup.item.name === RANGERS_BOW.name);

/** Whether he's been told this run that the bow's there (once is enough). */
const seen = new WeakMap<Game, { told: boolean }>();
function seenBow(g: Game): { told: boolean } {
  let s = seen.get(g);
  if (!s) {
    const fresh = { told: false };
    seen.set(g, s = fresh);
    g.events.on("reset", () => { fresh.told = false; });
  }
  return s;
}

/**
 * Every frame: in the Fells' house, the Ranger's bow leans by the chest (where src/world/interiors.ts puts it: on the
 * hearth's wall, left of the fire), on the floor just in front of it where he can get at it, till he has it; the first
 * time each run, he's told so.
 */
export function rangersBowSystem(g: Game): void {
  if (!isFells(householdHere(g)) || bowHere(g) || hasBow(g)) return;
  const { x, y } = byTheChest(g);
  const bow = makeItem(RANGERS_BOW.type, RANGERS_BOW.rarity, { ...RANGERS_BOW.mods }, RANGERS_BOW.name);
  bow.note = RANGERS_BOW.note;
  g.world.remove(dropLoot(g, x, y, bow), "despawn");          // it's waited this long
  if (!seenBow(g).told) { seenBow(g).told = true; toast(g, RANGERS_BOW_SAYS); }
}

/** Where the bow lies (an entity's top-left, game px): the nearest open floor to the front of the chest, a step out at most. */
function byTheChest(g: Game): { x: number; y: number } {
  const cx = (g.map.width / 2 - 2.3) * T - HALF, cy = 1.4 * T - HALF;
  for (let r = 0; r <= 2 * T; r += 2) {
    for (let a = 0; a < 16; a++) {
      const x = cx + Math.round(Math.cos((a / 16) * Math.PI * 2) * r), y = cy + Math.abs(Math.round(Math.sin((a / 16) * Math.PI * 2) * r));
      if (!blocked(g.map, x, y, true)) return { x, y };
      if (r === 0) break;
    }
  }
  return { x: cx, y: cy + T };
}
