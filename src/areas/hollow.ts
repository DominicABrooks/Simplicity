// The Frozen Hollow (STORY.md): a sunken valley in the wood where it's always winter, down the narrow track west out of
// the Ashwild that Yssa keeps (src/game/yssa.ts). For now, only its first stretch: the track coming in from the east,
// the bowl of the valley, and the lake at the bottom of it, with the Frost mages about. Its snow and ice, the hollow
// stone and Rime are still to come.
import { Rng } from "../core/rng.ts";
import { T, Tile } from "../data/world.ts";
import type { AreaDef, AreaLayout } from "../world/area.ts";
import { reachableFrom } from "../world/map.ts";
import { Town } from "../world/townkit.ts";

const W = 44, H = 36, SEED = 47;
/** The row the track comes in along, from the east edge (from the Ashwild). */
const TRACK = 17;
/** The valley's bowl, and the lake at the bottom of it (tiles). */
const BOWL = { x: 20, y: 18, rx: 14, ry: 12 } as const;
const LAKE = { x: 18, y: 19, rx: 6, ry: 4 } as const;

function build(): AreaLayout {
  const rng = new Rng(SEED), town = new Town(W, H, Tile.Tree);
  const inside = (x: number, y: number, e: { x: number; y: number; rx: number; ry: number }, k: number) => {
    const dx = (x + 0.5 - e.x) / e.rx, dy = (y + 0.5 - e.y) / e.ry, a = Math.atan2(dy, dx);
    return Math.hypot(dx, dy) < 1 + 0.12 * Math.sin(5 * a + k) + 0.06 * Math.sin(11 * a + k * 3);
  };
  for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
    if (inside(x, y, BOWL, 0.7)) town.set(x, y, rng.next() < 0.04 ? Tile.Tree : Tile.Grass);
  }
  for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) if (inside(x, y, LAKE, 2.1)) town.set(x, y, Tile.Water);
  // The track in from the east edge, down into the bowl.
  for (let x = Math.round(BOWL.x + BOWL.rx * 0.6); x < W; x++) town.set(x, TRACK, Tile.Path);

  // Anywhere the trees have cut off from the track is forest too.
  const reached = reachableFrom({ width: W, height: H, tiles: town.tiles, solids: [] }, W - 2, TRACK);
  town.paint((x, y) => town.open(x, y) && !reached.has(y * W + x), Tile.Tree);

  const layout = town.layout(
    // Down the track from the Ashwild, a few steps in from the edge.
    { ashwild: { x: (W - 4) * T, y: TRACK * T } },
    [{ rect: { x: W * T - 6, y: TRACK * T, w: 6, h: T }, to: { area: "ashwild", entry: "hollow" } }],
  );
  return { ...layout, map: { ...layout.map, look: "ash" } };
}

export const area: AreaDef = {
  id: "hollow",
  name: "The Frozen Hollow",
  build,
  // Slimes, and only Frost mages.
  life: { enemies: true, potions: true, ambient: true, mages: { schools: ["frost"], extra: 1 } },
};
