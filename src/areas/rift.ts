// The Thunder Rift (STORY.md): the last and deepest of the woods, up the frozen stream out of the Frozen Hollow that
// Yssa keeps (src/game/yssa.ts). The oldest, darkest trees in the valley, a storm that never stops overhead, lightning
// striking all round out of a sky that is, if you look closely, perfectly clear (src/game/rift.ts), and the ground split
// by cracks that get thicker the higher you climb. The trail winds north from glade to glade, where the Storm mages
// hold the paths (and by the top, Ember and Frost mages with them), past the rift stone, one of Ael's old stones, up to
// the great crack: the deepest under the Witchwood, cold and humming, a door into the dark. Calder stands at its edge.
import { Rng } from "../core/rng.ts";
import { T, Tile } from "../data/world.ts";
import type { AreaDef, AreaLayout } from "../world/area.ts";
import { reachableFrom } from "../world/map.ts";
import { Town } from "../world/townkit.ts";

const W = 48, H = 64, SEED = 59;
/** The trail's west edge column, per row (two tiles wide), from the south edge (up from the Hollow) north to the crack. */
const trailX = (y: number) => 23 + Math.round(5 * Math.sin(y * 0.11 + 0.6) + 3 * Math.sin(y * 0.27 + 2));
/** The glades the trail climbs through, south to north; the last is the crack's edge. */
const GLADES = [
  { x: trailX(50) - 7, y: 50, rx: 7, ry: 5 },
  { x: trailX(37) + 7, y: 37, rx: 7.5, ry: 5.5 },
  { x: trailX(24) - 6, y: 24, rx: 7, ry: 5 },
  { x: 24, y: 9, rx: 15, ry: 6.5 },                           // the great crack's edge, where Calder stands
] as const;
const EDGE = GLADES[3];
/** The great crack, across the top of the last glade (tiles): its middle, how long, how wide at its widest. */
export const GREAT_CRACK = { x: EDGE.x, y: EDGE.y - 3, len: 22, wide: 2.6 } as const;
/** Where Calder will stand: the middle of the crack's edge, a few steps south of it (tile). */
export const CALDER_STAND = { x: EDGE.x, y: EDGE.y + 1 } as const;
/** The rift stone's row, on the trail just below the last glade. */
const RIFT_STONE_Y = 17;

function build(): AreaLayout {
  const rng = new Rng(SEED), town = new Town(W, H, Tile.Tree);
  const wobbly = (cx: number, cy: number, rx: number, ry: number, k: number) => {
    for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
      const dx = (x + 0.5 - cx) / rx, dy = (y + 0.5 - cy) / ry, a = Math.atan2(dy, dx);
      if (Math.hypot(dx, dy) < 1 + 0.13 * Math.sin(5 * a + k) + 0.07 * Math.sin(10 * a + k * 2)) town.set(x, y, Tile.Grass);
    }
  };
  // The trail, from the south edge up to the last glade, with a ragged margin of grass either side of it.
  const top = EDGE.y + 3;
  for (let y = top; y < H; y++) {
    const x = trailX(y);
    for (let dx = -2; dx <= 3; dx++) if (rng.next() < (dx === -2 || dx === 3 ? 0.5 : 1)) town.set(x + dx, y, Tile.Grass);
  }
  // The glades, a few old trees standing alone in the lower ones, and none at the crack's edge.
  GLADES.forEach((g, i) => wobbly(g.x, g.y, g.rx, g.ry, i * 1.9 + 0.3));
  for (let y = EDGE.y + EDGE.ry; y < H - 1; y++) for (let x = 1; x < W - 1; x++) if (town.open(x, y) && rng.next() < 0.03) town.set(x, y, Tile.Tree);
  // The trail itself, laid last: two tiles wide, no corner-only joins where it bends.
  for (let y = top; y < H; y++) {
    const x = trailX(y);
    town.set(x, y, Tile.Path); town.set(x + 1, y, Tile.Path);
    if (y > top && trailX(y - 1) !== x) town.set(trailX(y - 1), y, Tile.Path);
  }
  // Side trails out to the glades that sit off it.
  for (const g of GLADES.slice(0, 3)) {
    const from = trailX(g.y) + (g.x > trailX(g.y) ? 2 : -1), step = Math.sign(g.x - from);
    for (let x = from; x !== Math.round(g.x); x += step) town.set(x, g.y, Tile.Path);
  }
  // Only the trail meets the south edge.
  for (let x = 0; x < W; x++) if (x < trailX(H - 1) || x > trailX(H - 1) + 1) town.set(x, H - 1, Tile.Tree);

  // The great crack, across the top of the last glade, and the rift stone on the trail below it.
  town.add({ kind: "greatCrack", x: GREAT_CRACK.x * T, y: GREAT_CRACK.y * T, len: GREAT_CRACK.len, wide: GREAT_CRACK.wide, angle: 0 });
  town.add({ kind: "oldStone", x: (trailX(RIFT_STONE_Y) + 1) * T, y: (RIFT_STONE_Y + 0.5) * T, name: "The rift stone", entry: "stone" });

  // Cracks across the open ground: a few low down, thicker the higher up, thickest running out from the great one.
  for (let i = 0, tries = 0; i < 34 && tries < 600; tries++) {
    const x = 2 + rng.next() * (W - 4), y = 3 + rng.next() * (H - 6);
    if (!town.open(Math.floor(x), Math.floor(y)) || Math.abs(y - GREAT_CRACK.y) < GREAT_CRACK.wide) continue;
    if (rng.next() < y / H * 0.8) continue;                  // fewer, the further down
    const out = y < EDGE.y + EDGE.ry;                        // at the crack's edge: running out from it
    town.add({ kind: "crack", x: x * T, y: y * T, len: 1.4 + rng.next() * (out ? 3.4 : 2.2), angle: out ? Math.PI / 2 + (rng.next() - 0.5) * 0.9 : rng.next() * Math.PI });
    i++;
  }

  // Anywhere the trees have cut off from the trail is forest too.
  const reached = reachableFrom({ width: W, height: H, tiles: town.tiles, solids: [] }, trailX(H - 2), H - 2);
  town.paint((x, y) => town.open(x, y) && !reached.has(y * W + x), Tile.Tree);

  const layout = town.layout(
    {
      // Up the frozen stream from the Hollow, a few steps in from the edge.
      hollow: { x: (trailX(H - 4) + 0.5) * T, y: (H - 4) * T },
      // Waking by the rift stone: a couple of steps back down the trail from it.
      stone: { x: (trailX(RIFT_STONE_Y + 2) + 0.5) * T, y: (RIFT_STONE_Y + 2) * T },
    },
    [{ rect: { x: trailX(H - 1) * T, y: H * T - 6, w: 2 * T, h: 6 }, to: { area: "hollow", entry: "rift" } }],
  );
  return { ...layout, map: { ...layout.map, look: "storm" } };
}

export const area: AreaDef = {
  id: "rift",
  name: "The Thunder Rift",
  build,
  // Slimes, and mostly Storm mages, more of them than anywhere; Ember and Frost mages too, everything at once by the end.
  life: { enemies: true, potions: true, ambient: true, mages: { schools: ["storm", "storm", "storm", "ember", "frost"], extra: 2 } },
};
