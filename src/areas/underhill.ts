// Under the Hill: where the fair folk's acorn takes the hero if he follows it (src/game/underhill.ts). A round glade
// deep under the hill, thick with flowers, under a violet that isn't a sky; fairy rings in the grass, a great one
// round the middle of it; and at its head, against the dark trees, the Erl-King's throne of moss. The only way out is
// the path south through the trees, which comes up beside the fairy ring in the Witchwood.
import { Rng } from "../core/rng.ts";
import { GLADE_MID as MID, THRONE } from "../data/underhill.ts";
import { HALF, T, Tile } from "../data/world.ts";
import type { AreaDef, AreaLayout, Prop } from "../world/area.ts";
import type { TileMap } from "../world/map.ts";

const W = 32, H = 28, SEED = 31;
/** How far the glade reaches across and down from its middle (tiles). */
const RX = 9.5, RY = 8.2;
/** Where he comes to, in front of the throne (cell top-left, game px). */
const ARRIVE = { x: MID.x * T - HALF, y: 12.6 * T - HALF };
/** The path out, its west column (it's two wide), from the glade's foot to the map's south edge. */
const PATH_X = 15;

function buildMap(): TileMap {
  const rng = new Rng(SEED), tiles: Tile[][] = [];
  for (let y = 0; y < H; y++) {
    const row: Tile[] = [];
    for (let x = 0; x < W; x++) {
      const dx = (x + 0.5 - MID.x) / RX, dy = (y + 0.5 - MID.y) / RY, a = Math.atan2(dy, dx);
      const inside = Math.hypot(dx, dy) < 1 + 0.07 * Math.sin(4 * a + 0.6) + 0.04 * Math.sin(9 * a + 2);
      row.push(!inside ? Tile.Tree : rng.next() < 0.28 ? Tile.Flower : Tile.Grass);
    }
    tiles.push(row);
  }
  for (let y = Math.floor(MID.y); y < H; y++) for (const x of [PATH_X, PATH_X + 1]) if (tiles[y]![x] === Tile.Tree || y > MID.y + RY - 2) tiles[y]![x] = Tile.Path;
  for (let x = 0; x < W; x++) { tiles[0]![x] = Tile.Tree; if (x < PATH_X || x > PATH_X + 1) tiles[H - 1]![x] = Tile.Tree; }
  for (let y = 0; y < H; y++) { tiles[y]![0] = Tile.Tree; tiles[y]![W - 1] = Tile.Tree; }
  // The throne stands in the way, whether he's on it or not.
  return { width: W, height: H, tiles, solids: [{ kind: "circle", x: THRONE.x * T, y: THRONE.y * T, r: THRONE.r * T }] };
}

/** The fair folk's rings in the grass, a great one round the middle. Theirs, here: none of them casts its spell on him. */
const PROPS: Prop[] = [
  { kind: "fairyRing", x: MID.x * T, y: 13 * T, radius: 4.2, quiet: true },
  { kind: "fairyRing", x: 8.5 * T, y: 15 * T, radius: 1.1, quiet: true },
  { kind: "fairyRing", x: 23.5 * T, y: 11.5 * T, radius: 1.3, quiet: true },
  { kind: "fairyRing", x: 10.5 * T, y: 19.5 * T, radius: 0.9, quiet: true },
  { kind: "fairyRing", x: 22 * T, y: 19 * T, radius: 1, quiet: true },
];

function build(): AreaLayout {
  return {
    map: buildMap(),
    entries: {
      arrive: ARRIVE,
      // Coming back the way out, from the Witchwood end (only ever in development: nobody walks in).
      path: { x: (PATH_X + 0.5) * T, y: (H - 3) * T },
    },
    // South down the path through the trees, and up beside the fairy ring in the Witchwood.
    exits: [{ rect: { x: PATH_X * T, y: (H - 1) * T + 2, w: 2 * T, h: T - 2 }, to: { area: "witchwood", entry: "ring" } }],
    props: PROPS,
  };
}

export const area: AreaDef = {
  id: "underhill",
  name: "Under the Hill",
  build,
  life: { enemies: false, potions: false, ambient: true },
  indoors: true,
};
