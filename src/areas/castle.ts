// Capital City: the Castle, the royal seat, built into the city wall at the city's northern edge.
//
// Castle Street comes up from the Market Quarter through a last block of houses to the barbican, over the
// drawbridge and the ditch, through the gatehouse into the outer bailey: the barracks, the armoury, a
// granary up on staddle stones, the training yard, the long stable, the smithy, the storehouse and a
// trebuchet, with kennels, mews, a dovecote and a kitchen garden along its sides and stairs up onto its
// walls. Through the inner gatehouse, the inner ward: the keep on its crag between burning braziers, the
// great hall and its kitchen, the chapel, the lodgings and the bakehouse round it, a well and gardens.
import { T, Tile } from "../data/world.ts";
import type { AreaDef, AreaLayout } from "../world/area.ts";
import { Town, at, corner, edgeExit, px, type TileRect } from "../world/townkit.ts";

const W = 96, H = 80;
/** The castle's line (its gates, Castle Street) and its walls: the city wall along the north, the outer
 * curtain round the outer bailey, the inner curtain round the inner ward. */
const MID = 48.5, CITY_WALL = 3, OUTER = { x0: 14, x1: 82, y1: 58 }, INNER = { x0: 22, x1: 74, y1: 34 };
const MOAT = { y0: 62, y1: 64 }, BARBICAN: TileRect = [43, 66, 11, 5], STREET = { x0: 46, x1: 50 };
const KEEP: TileRect = [36, 6, 25, 17];

function build(): AreaLayout {
  const town = new Town(W, H, Tile.Grass);

  // The ground: the outer bailey's trodden yard, the inner ward's paving, the city beyond the castle's
  // sides and below it, and the ditch before the outer curtain.
  town.fill([OUTER.x0 + 1, CITY_WALL + 1, OUTER.x1 - OUTER.x0 - 1, OUTER.y1 - CITY_WALL - 1], Tile.Path);
  town.fill([INNER.x0 + 1, CITY_WALL + 1, INNER.x1 - INNER.x0 - 1, INNER.y1 - CITY_WALL - 1], Tile.Cobble);
  town.fill([OUTER.x0 - 3, MOAT.y0, OUTER.x1 - OUTER.x0 + 7, MOAT.y1 - MOAT.y0 + 1], Tile.Water);
  for (const r of [[6, CITY_WALL + 1, 2, H], [88, CITY_WALL + 1, 2, H], [0, 74, W, 2], [STREET.x0, BARBICAN[1] + BARBICAN[3], 5, H]] as TileRect[]) town.fill(r, Tile.Cobble);
  town.fill([STREET.x0 + 1, OUTER.y1 - 2, 3, BARBICAN[1] + BARBICAN[3] - OUTER.y1 + 2], Tile.Cobble);   // through the gates
  town.fill([STREET.x0 + 1, INNER.y1 - 3, 3, 7], Tile.Cobble);
  town.fill([STREET.x0 + 1, MOAT.y0, 3, MOAT.y1 - MOAT.y0 + 1], Tile.Path);

  // The walls: the city wall, the outer curtain built onto it, and the inner curtain inside that.
  town.add({
    kind: "curtainWall", closed: false, inside: corner(MID, 40), gates: [],
    points: [-2, 30, 66, 98].map(x => corner(x, CITY_WALL)), height: 7, thickness: 2.2, tower: { radius: 2.2, height: 11, roof: "#4a5a7a" },
  });
  town.add({
    kind: "curtainWall", closed: false, inside: corner(MID, 30), gates: [{ at: corner(MID, OUTER.y1), width: 3 * T }],
    points: [[OUTER.x0, CITY_WALL], [OUTER.x0, 30], [OUTER.x0, OUTER.y1], [OUTER.x1, OUTER.y1], [OUTER.x1, 30], [OUTER.x1, CITY_WALL]].map(([x, y]) => corner(x!, y!)),
    height: 7, thickness: 2.2, tower: { radius: 2.2, height: 11, roof: "#4a5a7a" },
  });
  town.add({
    kind: "curtainWall", closed: false, inside: corner(MID, 18), gates: [{ at: corner(MID, INNER.y1), width: 3 * T }],
    points: [[INNER.x0, CITY_WALL], [INNER.x0, INNER.y1], [INNER.x1, INNER.y1], [INNER.x1, CITY_WALL]].map(([x, y]) => corner(x!, y!)),
    height: 8.5, thickness: 2.4, tower: { radius: 2.5, height: 13, roof: "#a8473a" },
  });
  // The approach: the barbican and the drawbridge over the ditch.
  town.add({ kind: "drawbridge", rect: px([STREET.x0 + 1, MOAT.y0 - 1, 3, MOAT.y1 - MOAT.y0 + 2]) });
  town.add({ kind: "barbican", rect: px(BARBICAN), facing: "south", height: 6 });
  for (const x of [STREET.x0 + 0.7, STREET.x1 + 0.3]) town.add({ kind: "torch", x: x * T, y: (BARBICAN[1] + BARBICAN[3] - 0.55) * T, facing: "south", height: 2.8 });
  for (const x of [STREET.x0 - 1, STREET.x1 + 1]) town.add({ kind: "guard", ...at(x, BARBICAN[1] + BARBICAN[3] + 1), facing: "south" });

  // The outer bailey. West: the barracks, the armoury and the granary; middle: the training yard;
  // east: the stable, the smithy and the storehouse, with a trebuchet in the corner.
  town.add({ kind: "hall", rect: px([17, 37, 14, 6]), door: "south", roof: "#4a5a7a", storeys: 2, stone: true, chimneys: 2 });
  town.add({ kind: "hall", rect: px([17, 46, 9, 6]), door: "east", roof: "#5d6a7d", storeys: 2, stone: true });
  town.add({ kind: "hall", rect: px([28, 47, 8, 5]), door: "south", roof: "#b08a4a", storeys: 1, stone: false, raised: true });
  for (const x of [35, 38]) town.add({ kind: "target", ...at(x, 38), facing: "south" });
  for (const [x, y] of [[36, 43], [39, 45], [42, 43]] as const) town.add({ kind: "dummy", ...at(x, y), facing: "south" });
  town.add({ kind: "rack", rect: px([41, 38, 2, 1]), facing: "south" });
  town.add({ kind: "rack", rect: px([36, 50, 1, 2]), facing: "east" });
  town.add({ kind: "stable", rect: px([55, 37, 22, 4]), facing: "south" });
  town.add({ kind: "trough", rect: px([57, 42, 3, 1]) });
  town.add({ kind: "horse", rect: px([62, 42, 2, 1]), facing: "west" });
  town.add({ kind: "horse", rect: px([67, 43, 2, 1]), facing: "east" });
  town.add({ kind: "cart", rect: px([72, 42, 1, 2]), facing: "south" });
  town.add({ kind: "smithy", rect: px([55, 47, 4, 3]) });
  town.add({ kind: "hall", rect: px([62, 47, 12, 5]), door: "north", roof: "#8a4a3a", storeys: 2, stone: false });
  town.add({ kind: "trebuchet", rect: px([75, 52, 4, 3]), facing: "west" });
  for (const [x, y, what] of [[53, 45, "barrels"], [53, 52, "crates"], [77, 44, "hay"], [33, 54, "sacks"]] as const) town.add({ kind: "stock", ...at(x, y), what });
  town.add({ kind: "well", ...at(44, 52) });
  // Along its sides: a kitchen garden and the dovecote west, kennels and mews east; stairs onto the walls.
  town.paint((x, y) => x >= 16 && x <= 20 && y >= 6 && y <= 30 && (y % 3 !== 0), Tile.Flower);
  town.add({ kind: "dovecote", ...at(18, 12) });
  town.add({ kind: "hall", rect: px([76, 8, 5, 6]), door: "west", roof: "#8a4a3a", storeys: 1, stone: false });
  town.add({ kind: "hall", rect: px([76, 18, 5, 5]), door: "west", roof: "#5a6b3a", storeys: 1, stone: false });
  for (const x of [OUTER.x0 + 1.3, OUTER.x1 - 2.3]) town.add({ kind: "stairs", rect: { x: x * T, y: 40 * T, w: T, h: 6 * T }, rises: "north", height: 7 });
  for (const x of [STREET.x0 - 1, STREET.x1 + 1]) town.add({ kind: "guard", ...at(x, INNER.y1 + 4), facing: "south" });

  // The inner ward: the keep on its crag, braziers either side of its stair and guards at its foot; the
  // great hall and its kitchen west; the chapel, the lodgings and the bakehouse east; a well and gardens.
  town.add({ kind: "keep", rect: px(KEEP), plinth: 2.4, height: 9 });
  for (const x of [STREET.x0 - 1, STREET.x1 + 1]) town.add({ kind: "brazier", ...at(x, KEEP[1] + KEEP[3]) });
  for (const x of [STREET.x0 - 2, STREET.x1 + 2]) town.add({ kind: "guard", ...at(x, KEEP[1] + KEEP[3] + 2), facing: "south" });
  town.add({ kind: "hall", rect: px([24, 9, 10, 19]), door: "east", roof: "#4a5a7a", storeys: 2, stone: true, chimneys: 2 });
  town.add({ kind: "hall", rect: px([25, 28, 6, 4]), door: "east", roof: "#7a3a2a", storeys: 1, stone: true, louvre: true });
  town.add({ kind: "church", rect: px([62, 6, 11, 6]), tower: "bellcote" });
  town.add({ kind: "hall", rect: px([63, 14, 9, 8]), door: "west", roof: "#a8473a", storeys: 3, stone: false, chimneys: 2 });
  town.add({ kind: "hall", rect: px([64, 25, 6, 5]), door: "west", roof: "#7a3a2a", storeys: 1, stone: true, louvre: true });
  town.add({ kind: "well", ...at(39, 28) });
  for (const r of [[35, 26, 3, 6], [54, 26, 6, 6]] as TileRect[]) town.fill(r, Tile.Flower);
  for (const [x, y] of [[35, 26], [59, 26], [35, 31], [59, 31]] as const) town.set(x, y, Tile.Tree);

  // The city round the castle: houses along the lanes either side of it and below it.
  town.houses({
    street: (x, y) => town.at(x, y) === Tile.Cobble,
    allowed: (x, y) => (x < OUTER.x0 - 3 || x > OUTER.x1 + 3 || y > MOAT.y1 + 1) && !(x >= BARBICAN[0] - 1 && x < BARBICAN[0] + BARBICAN[2] + 1 && y < BARBICAN[1] + BARBICAN[3] + 1),
    shop: (x, _y, k) => (x >= STREET.x0 && x <= STREET.x1 && k < 0.6 ? (["bread", "meat", "cloth"] as const)[Math.floor(k * 5) % 3]! : null),
    frontage: [3, 4], depth: [4, 7], storeys: [3, 4], alley: 0.2, seed: 401,
  });
  town.yards(0.06, (x, y) => x < OUTER.x0 - 3 || x > OUTER.x1 + 3 || y > MOAT.y1 + 1);

  return town.layout(
    { town: { x: 48 * T, y: (H - 4) * T } },
    [edgeExit("south", STREET.x0, STREET.x1, W, H, { area: "capital", entry: "castle" })],
  );
}

export const area: AreaDef = {
  id: "castle",
  name: "Capital City: the Castle",
  build,
  life: { enemies: false, potions: false, ambient: true },
};
