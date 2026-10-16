// The Koi Grotto: an ice cave under the Frozen Hollow's north rim (src/areas/hollow.ts), where the lake runs in under
// the rock. Its floor is ice, its walls rock sheathed in ice (src/render/grotto.ts), with a cold blue light in them;
// and in the middle someone has cut a hole in the ice. Fish through it and it's always the big one: a golden koi
// (src/systems/fishing.ts), or while the Great Koi's still down there, the Great Koi itself, and that's a fight, with
// room for it (src/game/greatkoi.ts). Nothing else comes in here: no slimes, no Frost mages, only the fishing.
import { HALF, T, Tile } from "../data/world.ts";
import type { AreaDef, AreaLayout, Prop } from "../world/area.ts";
import { Town } from "../world/townkit.ts";

const W = 26, H = 22;
/** The cave floor (tiles): wide enough for the Great Koi to leap about in. */
const FLOOR = { x: 13, y: 10, rx: 10.5, ry: 7.2 } as const;
/** The passage in from the Hollow: its two columns, from the cave floor down to the map's south edge. */
const PASSAGE = 12;
/** The hole in the ice (its top-left tile, and how many tiles across and down), out in the middle, ice all round it. */
export const ICE_HOLE = { x: 12, y: 8, w: 2, h: 2 } as const;

function build(): AreaLayout {
  const town = new Town(W, H, Tile.Wall);
  // The floor, its edge ragged where the rock comes out to meet it; the passage; and the hole in the middle.
  town.paint((x, y) => {
    const dx = (x + 0.5 - FLOOR.x) / FLOOR.rx, dy = (y + 0.5 - FLOOR.y) / FLOOR.ry, a = Math.atan2(dy, dx);
    return Math.hypot(dx, dy) < 1 + 0.1 * Math.sin(4 * a + 0.8) + 0.07 * Math.sin(9 * a + 2.3);
  }, Tile.Ice);
  town.fill([PASSAGE, FLOOR.y, 2, H - FLOOR.y], Tile.Ice);
  town.fill([ICE_HOLE.x, ICE_HOLE.y, ICE_HOLE.w, ICE_HOLE.h], Tile.Water);

  // The walls: every tile of rock, and the sides of it that face the floor.
  const floor = (x: number, y: number) => { const t = town.at(x, y); return t !== undefined && t !== Tile.Wall; };
  const cells: Extract<Prop, { kind: "iceWalls" }>["cells"] = [];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (town.at(x, y) === Tile.Wall)
    cells.push({ x, y, open: (floor(x, y - 1) ? 1 : 0) | (floor(x + 1, y) ? 2 : 0) | (floor(x, y + 1) ? 4 : 0) | (floor(x - 1, y) ? 8 : 0) });
  town.add({ kind: "iceWalls", cells, hole: ICE_HOLE });

  const layout = town.layout(
    // In from the Hollow, a few steps up the passage.
    { hollow: { x: (PASSAGE + 1) * T - HALF, y: (H - 3) * T } },
    // Back down the passage, out under the Hollow's rim.
    [{ rect: { x: PASSAGE * T, y: H * T - 6, w: 2 * T, h: 6 }, to: { area: "hollow", entry: "grotto" } }],
  );
  return { ...layout, map: { ...layout.map, look: "snow" } };
}

export const area: AreaDef = {
  id: "grotto",
  name: "The Koi Grotto",
  build,
  // Nothing lives in here but what's under the ice.
  life: { enemies: false, potions: false, ambient: false },
  indoors: true,
};
