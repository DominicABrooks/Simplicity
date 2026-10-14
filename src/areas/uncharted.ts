// Uncharted: the land beyond the cave north of Greenhollow. Blank for now: an empty meadow ringed by
// forest and mountains, with the cave back down to Greenhollow on its southern edge.
import { HALF, T, Tile } from "../data/world.ts";
import type { AreaDef, AreaLayout } from "../world/area.ts";
import type { TileMap } from "../world/map.ts";

const W = 40, H = 30;
/** The cave mouth's column (the boundary between the two path tiles). */
const CAVE_TX = 20;
const CAVE_X = CAVE_TX * T, CAVE_Y = H * T;

function buildMap(): TileMap {
  const tiles: Tile[][] = [];
  const cx = W / 2, cy = H / 2 - 1, rx = W / 2 - 2, ry = H / 2 - 2.5;
  const wobble = (a: number) => 0.95 + 0.08 * Math.sin(3 * a + 1.9) + 0.05 * Math.sin(7 * a + 0.4);
  for (let y = 0; y < H; y++) {
    const row: Tile[] = [];
    for (let x = 0; x < W; x++) {
      const dx = (x + 0.5 - cx) / rx, dy = (y + 0.5 - cy) / ry;
      const edge = x === 0 || y === 0 || x === W - 1 || y === H - 1;
      row.push(edge || Math.hypot(dx, dy) > wobble(Math.atan2(dy, dx)) ? Tile.Tree : Tile.Grass);
    }
    tiles.push(row);
  }
  // A short path up from the cave into the meadow.
  for (let y = H - 1; y >= H - 7; y--) { tiles[y]![CAVE_TX - 1] = Tile.Path; tiles[y]![CAVE_TX] = Tile.Path; }
  return { width: W, height: H, tiles, solids: [] };
}

function build(): AreaLayout {
  return {
    map: buildMap(),
    // Coming up out of the cave: a few steps north of its mouth.
    entries: { cave: { x: CAVE_X - HALF, y: (H - 4) * T } },
    exits: [{ rect: { x: CAVE_X - T, y: (H - 1) * T + 2, w: 2 * T, h: T - 2 }, to: { area: "greenhollow", entry: "cave" } }],
    props: [{ kind: "cave", x: CAVE_X, y: CAVE_Y, facing: "north" }],
  };
}

export const area: AreaDef = { id: "uncharted", name: "Uncharted", build };
