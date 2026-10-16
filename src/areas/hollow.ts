// The Frozen Hollow (STORY.md): a sunken valley in the wood where it's always winter, down the narrow track west out of
// the Ashwild that Yssa keeps (src/game/yssa.ts). Snow on the ground and falling, the trees white with frost (the map's
// "snow" look: src/render/snow.ts). The track comes in from the east past the hollow stone, one of Ael's old stones
// (src/game/stones.ts), and winds down into the bowl of the valley to the shore of the lake at the bottom of it,
// frozen hard enough to walk on, where the Frost mages keep. Out in the middle, her arena: frost runes in a ring of
// ice pillars, where Rime waits under the ice (src/game/rimefight.ts), its way in facing the track. A trail runs
// round the north shore from the track to everything else: the hunter's hut on the rim, left empty but for his
// longbow inside the door (src/game/hunterhut.ts); the mouth of the ice cave under the rim, where someone has cut a
// hole in the ice and nothing else comes (src/areas/grotto.ts: fish through it and it's always the big one); and
// west of that, the way up and out: the frozen bed of the river Aurel, climbing north between the trees toward the
// Thunder Rift, with Yssa at the foot of it, waiting for the river's name (src/game/yssa.ts).
import { Rng } from "../core/rng.ts";
import { CLIMB } from "../data/hollow.ts";
import { HALF, T, Tile } from "../data/world.ts";
import type { AreaDef, AreaLayout } from "../world/area.ts";
import { reachableFrom } from "../world/map.ts";
import { Town, px } from "../world/townkit.ts";

const W = 48, H = 40, SEED = 47;
/** Is there a Thunder Rift to climb up to yet (src/areas/rift.ts)? Asked of the folder, not the area registry, which loads this module. */
const RIFT = Object.keys(import.meta.glob("./rift.ts")).length > 0;
/** The row the track comes in along, from the east edge (from the Ashwild). */
const TRACK = 17;
/** The valley's bowl, and the lake at the bottom of it (tiles). */
const BOWL = { x: 24, y: 21, rx: 16, ry: 13 } as const;
const LAKE = { x: 22, y: 23, rx: 11, ry: 8.5 } as const;
/** The hollow stone, on the track a little way in from the edge (its tile). */
export const HOLLOW_STONE = { x: W - 9, y: TRACK } as const;
/** Rime's arena, out in the middle of the lake: how far out its pillars of ice stand (tiles), how many, and the one left out (east, toward the track, for the way in). */
const STAGE = { radius: 6, pillars: 12, gap: 3 } as const;
/** The hunter's hut on the north rim (the tile in the middle of it). */
const HUT = { x: 30, y: 11 } as const;
/** The ice cave's mouth under the north rim (src/areas/grotto.ts): the line between the two tiles of its opening, and the row you walk up into it from. */
export const GROTTO_MOUTH = { x: 20, y: 9 } as const;
/**
 * The trails, as waypoints (tiles): the track from the east edge down to the lake's east shore, opposite the way in
 * to Rime's arena; and from it, round the north shore past the hut and the cave mouth to the foot of the climb.
 */
const TRAILS: readonly (readonly [number, number])[][] = [
  [[W - 1, TRACK], [36, TRACK], [34, 19], [33, 23]],
  [[35, TRACK], [32, 14], [HUT.x, HUT.y + 2], [25, 12], [GROTTO_MOUTH.x, GROTTO_MOUTH.y + 1], [16, 11], [CLIMB.x, 10], [CLIMB.x, CLIMB.post]],
];

function build(): AreaLayout {
  const rng = new Rng(SEED), town = new Town(W, H, Tile.Tree);
  const inside = (x: number, y: number, e: { x: number; y: number; rx: number; ry: number }, k: number) => {
    const dx = (x + 0.5 - e.x) / e.rx, dy = (y + 0.5 - e.y) / e.ry, a = Math.atan2(dy, dx);
    return Math.hypot(dx, dy) < 1 + 0.12 * Math.sin(5 * a + k) + 0.06 * Math.sin(11 * a + k * 3);
  };
  const shore = (x: number, y: number) => Math.hypot((x + 0.5 - LAKE.x) / LAKE.rx, (y + 0.5 - LAKE.y) / LAKE.ry);
  // The bowl: snow over open ground, a few white trees standing alone in it, thicker toward the rim, none right on the shore.
  for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
    if (!inside(x, y, BOWL, 0.7)) continue;
    const rim = Math.hypot((x + 0.5 - BOWL.x) / BOWL.rx, (y + 0.5 - BOWL.y) / BOWL.ry);
    town.set(x, y, shore(x, y) > 1.35 && rng.next() < (rim > 0.8 ? 0.1 : 0.04) ? Tile.Tree : Tile.Grass);
  }
  // The lake, frozen over.
  for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) if (inside(x, y, LAKE, 2.1)) town.set(x, y, Tile.Ice);

  // The trails, trodden through the snow (never across the ice), with the ground cleared round the stone.
  for (const trail of TRAILS) for (let i = 1; i < trail.length; i++) {
    const [x0, y0] = trail[i - 1]!, [x1, y1] = trail[i]!, n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
    let last: readonly [number, number] | null = null;
    for (let s = 0; s <= n; s++) {
      const x = Math.round(x0 + ((x1 - x0) * s) / n), y = Math.round(y0 + ((y1 - y0) * s) / n);
      if (last && last[0] !== x && last[1] !== y && town.at(last[0], y) !== Tile.Ice) town.set(last[0], y, Tile.Path);   // no corners cut: always a step you can take
      if (town.at(x, y) !== Tile.Ice) town.set(x, y, Tile.Path);
      last = [x, y];
    }
  }
  for (let y = TRACK - 1; y <= TRACK + 1; y++) for (let x = HOLLOW_STONE.x - 1; x <= HOLLOW_STONE.x + 1; x++) if (y !== TRACK) town.set(x, y, Tile.Grass);

  // The hunter's hut on the north rim, and a woodpile by it.
  const hut = HUT;
  town.paint((x, y) => Math.abs(x - hut.x) <= 3 && Math.abs(y - hut.y) <= 2 && town.at(x, y) !== Tile.Path, Tile.Grass);
  town.add({ kind: "hall", rect: px([hut.x - 1, hut.y - 1, 3, 3]), door: "south", roof: "#dfe6ea", storeys: 1, stone: false });
  town.add({ kind: "stock", x: (hut.x + 2.5) * T, y: (hut.y + 1.5) * T, what: "crates" });

  // The ice cave's mouth under the rim: open ground before it, and the rim's rock and trees behind and round it.
  const cave = GROTTO_MOUTH;
  town.paint((x, y) => x >= cave.x - 3 && x <= cave.x + 2 && y >= cave.y && y <= cave.y + 1 && town.at(x, y) !== Tile.Path, Tile.Grass);
  town.fill([cave.x - 3, cave.y - 3, 6, 3], Tile.Tree);
  town.fill([cave.x - 1, cave.y - 1, 2, 1], Tile.Wall);    // the rock the opening's cut into (hidden under its boulders)
  town.fill([cave.x - 1, cave.y, 2, 1], Tile.Path);        // trodden right up into it
  town.add({ kind: "cave", x: cave.x * T, y: cave.y * T, facing: "south" });

  // The climb: the frozen stream north from the bowl's rim to the map's edge, and the notch Yssa steps aside into.
  for (let y = 0; y <= CLIMB.post; y++) town.set(CLIMB.x, y, Tile.Path);
  town.set(CLIMB.x - 1, CLIMB.post, Tile.Grass);

  // The hollow stone, and Rime's stage in the middle of the ice.
  town.add({ kind: "oldStone", x: (HOLLOW_STONE.x + 0.5) * T, y: (HOLLOW_STONE.y + 0.5) * T, name: "The hollow stone", entry: "stone" });
  town.add({ kind: "rimeStage", x: LAKE.x * T, y: LAKE.y * T, ...STAGE });
  // Ice under the pillars, not the paving a Wall tile gets (their shapes block, as everything built does).
  town.paint((x, y) => town.at(x, y) === Tile.Wall && Math.hypot(x + 0.5 - LAKE.x, y + 0.5 - LAKE.y) < STAGE.radius + 1, Tile.Ice);
  town.add({ kind: "boss", x: LAKE.x * T, y: LAKE.y * T, who: "rime" });

  // Anywhere the trees have cut off from the track is forest too.
  const reached = reachableFrom({ width: W, height: H, tiles: town.tiles, solids: [] }, W - 2, TRACK);
  town.paint((x, y) => (town.open(x, y) || town.at(x, y) === Tile.Ice) && !reached.has(y * W + x), Tile.Tree);

  const layout = town.layout(
    {
      // Down the track from the Ashwild, a few steps in from the edge.
      ashwild: { x: (W - 4) * T, y: TRACK * T },
      // Waking by the hollow stone (just west of it, so he isn't standing on it).
      stone: { x: (HOLLOW_STONE.x - 1) * T, y: TRACK * T },
      // Down the climb from the Thunder Rift, a couple of steps below the top.
      rift: { x: CLIMB.x * T, y: 2 * T },
      // Back out of the ice cave, a step out from its mouth.
      grotto: { x: cave.x * T - HALF, y: (cave.y + 1) * T },
    },
    [
      { rect: { x: W * T - 6, y: TRACK * T, w: 6, h: T }, to: { area: "ashwild", entry: "hollow" } },
      // Into the ice cave, walking up into its mouth.
      { rect: { x: (cave.x - 1) * T, y: cave.y * T, w: 2 * T, h: 6 }, to: { area: "grotto", entry: "hollow" } },
      // Up the climb to the Thunder Rift, once there is one (src/areas/rift.ts); until then it ends at the trees.
      ...(RIFT ? [{ rect: { x: CLIMB.x * T, y: 0, w: T, h: 6 }, to: { area: "rift", entry: "hollow" } }] : []),
    ],
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

/** Where Rime rises (cell top-left): the middle of the frozen lake, the middle of her stage. */
export const RIME_AT = { x: LAKE.x * T - HALF, y: LAKE.y * T - HALF } as const;
