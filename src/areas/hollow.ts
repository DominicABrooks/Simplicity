// The Frozen Hollow (STORY.md): a sunken valley in the wood where it's always winter, down the narrow track west out of
// the Ashwild that Yssa keeps (src/game/yssa.ts). Snow on the ground and falling, the trees white with frost (the map's
// "snow" look: src/render/snow.ts). The track comes in from the east past the hollow stone, one of Ael's old stones
// (src/game/stones.ts), and down into the bowl of the valley; at the bottom of it the lake, frozen hard enough to
// walk on, where the Frost mages keep. Off to one side of the lake someone has cut a hole in the ice (fish through it
// and it's always the big one, a golden koi: src/systems/fishing.ts); out in the middle, the ring of frost runes where
// Rime will stand. On the bowl's north rim, a hunter's hut, left empty.
import { Rng } from "../core/rng.ts";
import { HALF, T, Tile } from "../data/world.ts";
import type { AreaDef, AreaLayout } from "../world/area.ts";
import { reachableFrom } from "../world/map.ts";
import { Town, px } from "../world/townkit.ts";

const W = 48, H = 40, SEED = 47;
/** The row the track comes in along, from the east edge (from the Ashwild). */
const TRACK = 17;
/** The valley's bowl, and the lake at the bottom of it (tiles). */
const BOWL = { x: 22, y: 20, rx: 16, ry: 14 } as const;
const LAKE = { x: 20, y: 21, rx: 10, ry: 7 } as const;
/** The hollow stone, on the track a little way in from the edge (its tile). */
export const HOLLOW_STONE = { x: W - 9, y: TRACK } as const;
/** The hole in the ice (its top-left tile; two by two), off to the west of the lake's middle, ice all round it. */
export const ICE_HOLE = { x: LAKE.x - 7, y: LAKE.y - 2 } as const;
/** Rime's stage, out in the middle of the lake: how far across its ring of runes is (tiles). */
const STAGE_R = 3.5;

function build(): AreaLayout {
  const rng = new Rng(SEED), town = new Town(W, H, Tile.Tree);
  const inside = (x: number, y: number, e: { x: number; y: number; rx: number; ry: number }, k: number) => {
    const dx = (x + 0.5 - e.x) / e.rx, dy = (y + 0.5 - e.y) / e.ry, a = Math.atan2(dy, dx);
    return Math.hypot(dx, dy) < 1 + 0.12 * Math.sin(5 * a + k) + 0.06 * Math.sin(11 * a + k * 3);
  };
  // The bowl: snow over open ground, a few white trees standing alone in it, thicker toward the rim.
  for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
    if (!inside(x, y, BOWL, 0.7)) continue;
    const rim = Math.hypot((x + 0.5 - BOWL.x) / BOWL.rx, (y + 0.5 - BOWL.y) / BOWL.ry);
    town.set(x, y, rng.next() < (rim > 0.8 ? 0.09 : 0.03) ? Tile.Tree : Tile.Grass);
  }
  // The lake, frozen over, and the hole in the ice.
  for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) if (inside(x, y, LAKE, 2.1)) town.set(x, y, Tile.Ice);
  town.fill([ICE_HOLE.x, ICE_HOLE.y, 2, 2], Tile.Water);
  // The track in from the east edge, down into the bowl, with the ground cleared round the stone.
  for (let x = Math.round(BOWL.x + BOWL.rx * 0.6); x < W; x++) town.set(x, TRACK, Tile.Path);
  for (let y = TRACK - 1; y <= TRACK + 1; y++) for (let x = HOLLOW_STONE.x - 1; x <= HOLLOW_STONE.x + 1; x++) if (y !== TRACK) town.set(x, y, Tile.Grass);

  // The hunter's hut on the north rim, and a woodpile by it.
  const hut = { x: BOWL.x + 3, y: BOWL.y - BOWL.ry + 3 };
  town.fill([hut.x - 2, hut.y - 1, 6, 5], Tile.Grass);
  town.add({ kind: "hall", rect: px([hut.x - 1, hut.y - 1, 3, 3]), door: "south", roof: "#dfe6ea", storeys: 1, stone: false });
  town.add({ kind: "stock", x: (hut.x + 2.5) * T, y: (hut.y + 1.5) * T, what: "crates" });

  // The hollow stone, and Rime's stage in the middle of the ice.
  town.add({ kind: "oldStone", x: (HOLLOW_STONE.x + 0.5) * T, y: (HOLLOW_STONE.y + 0.5) * T, name: "The hollow stone", entry: "stone" });
  town.add({ kind: "rimeStage", x: LAKE.x * T, y: LAKE.y * T, radius: STAGE_R });

  // Anywhere the trees have cut off from the track is forest too.
  const reached = reachableFrom({ width: W, height: H, tiles: town.tiles, solids: [] }, W - 2, TRACK);
  town.paint((x, y) => (town.open(x, y) || town.at(x, y) === Tile.Ice) && !reached.has(y * W + x), Tile.Tree);

  const layout = town.layout(
    {
      // Down the track from the Ashwild, a few steps in from the edge.
      ashwild: { x: (W - 4) * T, y: TRACK * T },
      // Waking by the hollow stone (just west of it, so he isn't standing on it).
      stone: { x: (HOLLOW_STONE.x - 1) * T, y: TRACK * T },
    },
    [{ rect: { x: W * T - 6, y: TRACK * T, w: 6, h: T }, to: { area: "ashwild", entry: "hollow" } }],
  );
  return { ...layout, map: { ...layout.map, look: "snow" } };
}

export const area: AreaDef = {
  id: "hollow",
  name: "The Frozen Hollow",
  build,
  // Slimes, and only Frost mages, more of them, out on the ice. No critters or grass: it's under the snow.
  life: { enemies: true, potions: true, ambient: false, mages: { schools: ["frost"], extra: 2, on: Tile.Ice } },
};

/** Where Rime will stand (cell top-left): the middle of the frozen lake, the middle of her stage. */
export const RIME_AT = { x: LAKE.x * T - HALF, y: LAKE.y * T - HALF } as const;
