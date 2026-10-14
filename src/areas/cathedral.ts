// Capital City: the Cathedral Close, where the kingdom crowns its kings.
//
// Minster Lane runs east from the Market Quarter through the gate in the close wall onto the cathedral's
// forecourt. The cathedral fills the close: twin west towers with spires, a nave high over its aisles on
// flying buttresses, the transept, the crossing tower with the tallest spire in the kingdom, and the
// rounded east end ringed by chapels. Off the nave's north side, the cloister round its garth and the
// eight-sided chapter house; to the north-west, the bishop's palace above its orchard; along the east
// side, the canons' houses; and all along the south, the churchyard.
import { T, Tile } from "../data/world.ts";
import type { AreaDef, AreaLayout } from "../world/area.ts";
import { Town, at, corner, edgeExit, hash, px, type TileRect } from "../world/townkit.ts";

const W = 96, H = 80;
/** The close wall's rectangle, Minster Lane's rows, the cathedral's footprint and the walk round it. */
const CLOSE = { x0: 10, y0: 4, x1: 92, y1: 76 }, LANE = { y0: 39, y1: 42 };
const CATHEDRAL: TileRect = [22, 29, 56, 24];

function build(): AreaLayout {
  const town = new Town(W, H, Tile.Grass);
  const inClose = (x: number, y: number) => x > CLOSE.x0 + 1 && x < CLOSE.x1 - 1 && y > CLOSE.y0 + 1 && y < CLOSE.y1 - 1;

  // Outside the close: Minster Lane in from the west, a lane along the wall, and houses along both.
  town.fill([0, LANE.y0, CLOSE.x0 + 12, 4], Tile.Cobble);
  town.fill([5, 0, 2, H], Tile.Cobble);
  // Inside: the forecourt, the walk round the cathedral and the canons' street, paved; the bishop's path
  // and the churchyard's paths, trodden earth.
  const paved: TileRect[] = [[11, 26, 11, 30], [11, 26, 72, 2], [11, 54, 72, 2], [81, 6, 2, 50]];
  const paths: TileRect[] = [[18, 13, 2, 13], [12, 65, 79, 2], [45, 56, 2, 19]];
  for (const r of paved) town.fill(r, Tile.Cobble);
  for (const r of paths) town.fill(r, Tile.Path);

  // The close wall, its gate on Minster Lane.
  town.add({
    kind: "curtainWall", closed: true, gates: [{ at: corner(CLOSE.x0, (LANE.y0 + LANE.y1 + 1) / 2), width: 4 * T }],
    points: [[CLOSE.x0, CLOSE.y0], [51, CLOSE.y0], [CLOSE.x1, CLOSE.y0], [CLOSE.x1, 40], [CLOSE.x1, CLOSE.y1], [51, CLOSE.y1], [CLOSE.x0, CLOSE.y1], [CLOSE.x0, 58], [CLOSE.x0, 22]].map(([x, y]) => corner(x!, y!)),
    height: 3.6, thickness: 1.2, tower: { radius: 1.2, height: 5.5, roof: "#4a5a7a" },
  });
  town.fill([CLOSE.x0 - 3, LANE.y0, 7, 4], Tile.Cobble);

  // The cathedral.
  town.add({ kind: "cathedral", rect: px(CATHEDRAL) });
  for (const x of [13, 19]) for (const y of [33, 49]) town.add({ kind: "brazier", ...at(x, y) });

  // The cloister off the nave's north side, a well in its garth, and the chapter house beside it.
  town.add({ kind: "cloister", rect: px([30, 8, 18, 17]), door: "south" });
  town.add({ kind: "well", ...at(38, 16) });
  town.add({ kind: "chapterHouse", ...corner(56, 15.5), radius: 3.6 });

  // The bishop's palace and its garden: an orchard and flower beds.
  town.add({ kind: "hall", rect: px([12, 6, 15, 7]), door: "south", roof: "#4a5a7a", storeys: 2, stone: true, chimneys: 2 });
  town.paint((x, y) => x >= 12 && x <= 26 && y >= 15 && y <= 24 && town.open(x, y), Tile.Flower);
  for (let y = 15; y <= 24; y += 3) for (let x = 12; x <= 26; x += 3) if (town.open(x, y)) town.set(x, y, Tile.Tree);

  // The churchyard: four plots of graves between its paths, yews along its edges.
  for (const r of [[13, 57, 31, 7], [48, 57, 31, 7], [13, 67, 31, 8], [48, 67, 31, 8]] as TileRect[]) town.add({ kind: "graves", rect: px(r) });
  for (let x = 12; x < 90; x++) for (const y of [56, 75]) if (town.open(x, y) && hash(x, y, 4) < 0.35) town.set(x, y, Tile.Tree);

  // Houses: outside the close along the lanes, and the canons' houses inside along their street.
  town.houses({
    street: (x, y) => town.at(x, y) === Tile.Cobble,
    allowed: (x, y) => x < CLOSE.x0 - 2 || (inClose(x, y) && x > 82 && y < 55),
    frontage: [3, 4], depth: [4, 7], storeys: [3, 4], alley: 0.2, seed: 301,
  });
  town.yards(0.05, (x, y) => !inClose(x, y) || y < 26);

  return town.layout(
    { town: { x: 2 * T, y: (LANE.y0 + 1) * T } },
    [edgeExit("west", LANE.y0, LANE.y1, W, H, { area: "capital", entry: "close" })],
  );
}

export const area: AreaDef = {
  id: "cathedral",
  name: "Capital City: the Cathedral Close",
  build,
  life: { enemies: false, potions: false, ambient: true },
};
