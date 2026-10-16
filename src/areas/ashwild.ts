// The Ashwild: the first of the deep woods, down the old trail past the King's woodwardens. The same forest
// as the Witchwood, going wrong: the trees ash-grey, the grass grey, cold cracks across the ground with a
// faint wrong light in them, and the slimes thick. The trail winds south through it from glade to glade:
// past the woodcutters' huts, left in a hurry; through glades where the Ember mages hunt; down to the
// Greyed's first camp at the far end: a ring of burnt standing stones round a scorched circle, where Cinder waits.
// Off the cracked glade, a narrow track runs west to the Frozen Hollow, and Yssa stands in it (src/game/yssa.ts).
import { Rng } from "../core/rng.ts";
import { YSSA_TRACK } from "../data/ashwild.ts";
import { HALF, T, Tile } from "../data/world.ts";
import type { AreaDef, AreaLayout } from "../world/area.ts";
import { reachableFrom } from "../world/map.ts";
import { Town, px } from "../world/townkit.ts";

const W = 56, H = 72, SEED = 31;
/** The trail's west edge column, per row (two tiles wide), from the north edge (from the Witchwood) south to the camp. */
const trailX = (y: number) => 26 + Math.round(6 * Math.sin(y * 0.09) + 3 * Math.sin(y * 0.23 + 1));
/** The glades the trail passes through, north to south; the last is the Greyed's camp. */
const GLADES = [
  { x: trailX(13) + 7, y: 13, rx: 7, ry: 5 },                // the woodcutters' huts
  { x: trailX(29) - 8, y: 29, rx: 8, ry: 6 },                // a glade where the cracks run thick
  { x: trailX(45) + 7, y: 45, rx: 7.5, ry: 5.5 },
  { x: trailX(62), y: 62, rx: 9.5, ry: 8 },                  // the Greyed's camp, Cinder's arena
] as const;
const CAMP_AT = GLADES[3];
/** The ash stone's row, on the trail a few steps in from the north edge. */
const ASH_STONE_Y = 6;
/** The arena's ring of stones: how far out (tiles), and how many, one left out at the north for the trail. */
const ARENA = { radius: 6.5, pillars: 14 } as const;

function build(): AreaLayout {
  const rng = new Rng(SEED), town = new Town(W, H, Tile.Tree);
  const wobbly = (cx: number, cy: number, rx: number, ry: number, k: number) => {
    for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
      const dx = (x + 0.5 - cx) / rx, dy = (y + 0.5 - cy) / ry, a = Math.atan2(dy, dx);
      if (Math.hypot(dx, dy) < 1 + 0.14 * Math.sin(4 * a + k) + 0.07 * Math.sin(9 * a + k * 2)) town.set(x, y, rng.next() < 0.04 ? Tile.Flower : Tile.Grass);
    }
  };
  // The trail, with a ragged margin of grey grass either side of it.
  const trailEnd = CAMP_AT.y - ARENA.radius + 1;
  for (let y = 0; y <= trailEnd; y++) {
    const x = trailX(y);
    for (let dx = -2; dx <= 3; dx++) if (rng.next() < (dx === -2 || dx === 3 ? 0.55 : 1)) town.set(x + dx, y, Tile.Grass);
  }
  // The glades, and a few lone trees standing in them.
  GLADES.forEach((g, i) => wobbly(g.x, g.y, g.rx, g.ry, i * 1.7 + 0.4));
  for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) if (town.open(x, y) && rng.next() < 0.035) town.set(x, y, Tile.Tree);
  // Nothing grows inside the stones, nor just outside them.
  for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
    if (Math.hypot(x + 0.5 - (CAMP_AT.x + 0.5), y + 0.5 - (CAMP_AT.y + 0.5)) < ARENA.radius + 1.5) town.set(x, y, Tile.Grass);
  }
  // Lay the trail itself last, over everything: two tiles wide, no corner-only joins where it bends.
  for (let y = 0; y <= trailEnd; y++) {
    const x = trailX(y);
    town.set(x, y, Tile.Path); town.set(x + 1, y, Tile.Path);
    if (y < trailEnd && trailX(y + 1) !== x) town.set(trailX(y + 1), y, Tile.Path);
  }
  // Side trails out to the glades that sit off it.
  for (const g of GLADES.slice(0, 3)) {
    const from = trailX(g.y) + (g.x > trailX(g.y) ? 2 : -1), step = Math.sign(g.x - from);
    for (let x = from; x !== Math.round(g.x); x += step) town.set(x, g.y, Tile.Path);
  }
  // Only the trail meets the north edge; the rest of the edge is forest.
  for (let x = 0; x < W; x++) if (x < trailX(0) || x > trailX(0) + 1) town.set(x, 0, Tile.Tree);

  // The woodcutters' huts, left in a hurry: two small timber huts in the first glade, a cart, a pile of logs.
  const huts = GLADES[0];
  town.add({ kind: "hall", rect: px([Math.round(huts.x) - 3, huts.y - 3, 3, 3]), door: "south", roof: "#6b6a64", storeys: 1, stone: false });
  town.add({ kind: "hall", rect: px([Math.round(huts.x) + 1, huts.y - 2, 3, 3]), door: "west", roof: "#5d5a54", storeys: 1, stone: false });
  town.add({ kind: "stock", x: (huts.x + 0.5) * T, y: (huts.y + 2) * T, what: "crates" });

  // The Greyed's camp: no tents, no fire, just the ring of burnt stones round a scorched circle, the gap in
  // it to the north where the trail comes in, and Cinder in the middle.
  const mid = { x: (CAMP_AT.x + 0.5) * T, y: (CAMP_AT.y + 0.5) * T };
  town.add({ kind: "arena", ...mid, ...ARENA, gap: 0 });
  town.add({ kind: "boss", ...mid, who: "cinder" });

  // The ash stone, on the trail just in from the barricade: one of Ael's old stones (src/game/stones.ts).
  town.add({ kind: "oldStone", x: (trailX(ASH_STONE_Y) + 1) * T, y: (ASH_STONE_Y + 0.5) * T, name: "The ash stone", entry: "stone" });

  // The cold cracks: across the open ground, thickest in the second glade and toward the camp.
  for (let i = 0, tries = 0; i < 26 && tries < 400; tries++) {
    const x = 2 + rng.next() * (W - 4), y = 4 + rng.next() * (H - 8);
    if (!town.open(Math.floor(x), Math.floor(y))) continue;
    if (Math.hypot(x - CAMP_AT.x, y - CAMP_AT.y) < ARENA.radius + 1) continue;     // the arena has its own
    const near = GLADES.some(g => Math.hypot(x - g.x, y - g.y) < 6);
    if (!near && rng.next() < 0.6) continue;
    town.add({ kind: "crack", x: x * T, y: y * T, len: 1.4 + rng.next() * 2.4, angle: rng.next() * Math.PI });
    i++;
  }

  // The track west to the Frozen Hollow: one tile wide, out of the cracked glade to the west edge, with a notch north
  // of it where Yssa steps aside once she's let him by.
  for (let x = 0; x <= Math.round(GLADES[1].x); x++) town.set(x, YSSA_TRACK.row, Tile.Path);
  town.set(YSSA_TRACK.post, YSSA_TRACK.row - 1, Tile.Grass);

  // Anywhere the trees have cut off from the trail is forest too.
  const reached = reachableFrom({ width: W, height: H, tiles: town.tiles, solids: [] }, trailX(1), 1);
  town.paint((x, y) => town.open(x, y) && !reached.has(y * W + x), Tile.Tree);

  const layout = town.layout(
    // Down the trail from the Witchwood, a few steps in from the edge.
    {
      witchwood: { x: (trailX(3) + 0.5) * T, y: 3 * T },
      // Back up the track from the Frozen Hollow, a few steps in from the edge.
      hollow: { x: 3 * T, y: YSSA_TRACK.row * T },
      // Waking by the ash stone: a couple of steps on down the trail from it.
      stone: { x: (trailX(ASH_STONE_Y + 2) + 0.5) * T, y: (ASH_STONE_Y + 2) * T },
    },
    [
      { rect: { x: trailX(0) * T, y: 0, w: 2 * T, h: 6 }, to: { area: "witchwood", entry: "ashwild" } },
      { rect: { x: 0, y: YSSA_TRACK.row * T, w: 6, h: T }, to: { area: "hollow", entry: "ashwild" } },
    ],
  );
  return { ...layout, map: { ...layout.map, look: "ash" } };
}

export const area: AreaDef = {
  id: "ashwild",
  name: "The Ashwild",
  build,
  // Slimes, and only Ember mages, from the start and more of them.
  life: { enemies: true, potions: true, ambient: true, mages: { schools: ["ember"], extra: 1 } },
};

/** Where Cinder waits (cell top-left), for the tests. */
export const CINDER_AT = { x: (CAMP_AT.x + 0.5) * T - HALF, y: (CAMP_AT.y + 0.5) * T - HALF } as const;
