// The inside of a house, made when you're asked in (see src/game/townsfolk.ts, src/game/interiors.ts): one
// room, bigger than the house looks from the street (as insides are), its door in the middle of the south
// wall. A hearth on the far wall with a rug before it, a table and benches in the middle, beds down one
// side for the household (and a cradle if there's a baby), a chest and shelves, barrels in a corner, and
// whatever the house's trade wants: a loom, a workbench, an anvil. An inn is a hall instead: the counter,
// barrels behind it, long tables and benches. Out through the door, you're on the step outside it again.
import { HALF, T, Tile } from "../data/world.ts";
import type { AreaDef, AreaLayout, Facing, FurnitureItem, Prop } from "./area.ts";
import type { Resident } from "./residents.ts";
import { Town, doorKey, px } from "./townkit.ts";

type House = Extract<Prop, { kind: "house" }>;

/** The inns, by their keepers' families. */
const INNS = new Set(["maddox", "pike"]);
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

/** A house's inside's area id. */
export const insideId = (area: string, house: House): string => `inside:${area}:${doorKey(house).slice("door:".length)}`;

/** Where someone stands inside (tiles, the middle of where they stand) and which way they face (a game angle). */
export interface Spot { x: number; y: number; facing: number }

/** A house's inside: the area, and where its people stand about in it (by the fire first). */
export function interiorOf(area: string, house: House, household: readonly Resident[], name: string): { def: AreaDef; spots: Spot[] } {
  const inn = household.some(r => r.family !== undefined && INNS.has(r.family));
  const sideways = house.doorSide === "east" || house.doorSide === "west";
  const front = (sideways ? house.rect.h : house.rect.w) / T, deep = (sideways ? house.rect.w : house.rect.h) / T;
  const W = inn ? 16 : clamp(Math.round(front * 1.9) + 3, 9, 15), H = inn ? 12 : clamp(Math.round(deep * 1.5) + 3, 8, 12);
  const doorAt = Math.floor(W / 2) - 1, wall = 0.35;
  const N = -Math.PI / 2, S = Math.PI / 2, E = 0, Wt = Math.PI;
  const spots: Spot[] = [
    { x: W / 2 - 1.4, y: 2.1, facing: N }, { x: W / 2 + 1.4, y: 2.1, facing: N },              // warming their hands at the fire
  ];
  const build = (): AreaLayout => {
    const town = new Town(W, H, Tile.Cobble);
    town.add({ kind: "room", rect: px([0, 0, W, H]), floor: house.stone ? "flags" : "planks", wall: house.stone ? "#e8e0d0" : "#f2ead8", door: "south", doorAt });
    const add = (item: FurnitureItem, x: number, y: number, facing: Facing) => town.add({ kind: "furniture", item, x: x * T, y: y * T, facing });
    add("hearth", W / 2, wall + 0.4, "south");
    add("rug", W / 2, 2.3, "south");
    if (inn) {
      add("counter", W - 1.7, H / 2, "west");
      for (const dy of [-1.8, 1.8]) add("barrel", W - 0.75, H / 2 + dy, "west");
      for (const [tx, ty] of [[W / 2 - 3, 4.8], [W / 2 - 3, 8.2], [W / 2 + 1.2, 6.5]] as const) {
        add("table", tx, ty, "south");
        add("bench", tx, ty - 0.8, "south");
        add("bench", tx, ty + 0.8, "north");
      }
      add("shelf", wall + 0.2, 3, "east");
    } else {
      add("table", W / 2, H / 2 + 0.6, "south");
      add("bench", W / 2, H / 2 - 0.2, "south");
      add("bench", W / 2, H / 2 + 1.4, "north");
      const beds = clamp(Math.ceil(household.filter(r => r.age >= 2).length / 2), 1, 4);
      for (let i = 0, y = wall + 0.75; i < beds && y < H - 2; i++, y += 1.15) add("bed", wall + 0.95, y, "east");
      if (household.some(r => r.age < 2)) add("cradle", wall + 2.4, H - 2.3, "east");
      add("chest", W / 2 - 2.3, wall + 0.3, "south");
      add("shelf", W - wall - 0.2, 1.9, "west");
      add("barrel", W - 0.85, H - 1.6, "west");
      const trade = household.map(r => r.job.toLowerCase()).join(" ");
      const tool: FurnitureItem | null = /weav|spinn|spins/.test(trade) ? "loom" : /smith|armourer|farrier/.test(trade) ? "anvil"
        : /carpent|cooper|wright|joiner|cobbler|shoemaker|glover|saddler|tailor|harness|bowyer|fletcher|chandler|potter/.test(trade) ? "workbench" : null;
      if (tool) { add(tool, W - 2.2, H - 3.4, "west"); spots.push({ x: W - 3.3, y: H - 3.4, facing: E }); }   // someone at their work
    }
    return town.layout(
      { in: { x: (doorAt + 0.65) * T - HALF, y: (H - 1.6) * T - HALF } },
      [{ rect: { x: doorAt * T, y: (H - 1) * T + 3, w: 1.3 * T, h: T - 3 }, to: { area, entry: doorKey(house) } }],
    );
  };
  // About the table, then wherever there's room.
  spots.push({ x: W / 2 - 0.9, y: H / 2 - 0.6, facing: S }, { x: W / 2 + 0.9, y: H / 2 + 1.8, facing: N }, { x: W - 2.5, y: 2.6, facing: Wt });
  if (inn) spots.push({ x: W - 2.6, y: H / 2, facing: Wt }, { x: W / 2 - 1.5, y: 6.5, facing: E }, { x: W / 2 + 2.6, y: 7.4, facing: Wt });
  else spots.push({ x: 3, y: H - 2.2, facing: N }, { x: W / 2 + 2.5, y: H - 2.4, facing: Wt });
  return { def: { id: insideId(area, house), name, build, life: { enemies: false, potions: false, ambient: false }, indoors: true }, spots };
}
