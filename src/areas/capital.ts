// Capital City: the seat of the greatest kingdom left, up the cave from Witchwood.
//
// Laid out like a real castle town. A moat rings an oval town wall with a tower every few dozen paces;
// you cross a bridge to the gatehouse. Inside, a winding main street climbs past packed town houses to
// the market square (a fountain, stalls, the guildhall and the cathedral), then a straight road leads to
// the castle: an inner ward with taller walls and its own gatehouse, and the keep on a rocky crag in the
// middle. Nothing hostile lives here.
//
// Everything built is a prop (drawn by src/render/props.ts) standing on Wall tiles, which block movement.
// The town's houses are placed by a deterministic generator, so the layout is the same every time.
import { HALF, T, Tile, type Rect } from "../data/world.ts";
import type { Point } from "../world/collision.ts";
import type { AreaDef, AreaLayout, Prop } from "../world/area.ts";
import type { TileMap } from "../world/map.ts";

const W = 88, H = 76;
/** The town's centre line: the gate, the main street's end, the castle road and the cave line up on it. */
const MID = 44;
/** The town wall follows an oval: centre and radii, in tiles. */
const CENTRE = { x: 44, y: 37 }, RADII = { x: 37, y: 29 };
/** Towers around the town wall; the gate is in the edge between the two southernmost. */
const TOWERS = 18;
/** The castle's inner ward (tiles, inclusive), and the keep's footprint inside it. */
const WARD = { x0: 32, y0: 11, x1: 56, y1: 27 };
const KEEP: TileRect = [37, 13, 14, 9];
const SQUARE = { x0: 37, y0: 39, x1: 51, y1: 48 };
const FOUNTAIN: TileRect = [43, 43, 2, 2];
const CATHEDRAL: TileRect = [55, 39, 13, 8];
const GUILDHALL: TileRect = [24, 40, 9, 5];
/** The barracks and the stables, in the castle courtyard. */
const BARRACKS: TileRect = [34, 23, 3, 2], STABLES: TileRect = [52, 23, 3, 2];

type TileRect = readonly [number, number, number, number];
const px = ([x, y, w, h]: TileRect): Rect => ({ x: x * T, y: y * T, w: w * T, h: h * T });

const ROOFS = ["#a8473a", "#4a5a7a", "#5a6b3a", "#b08a4a", "#8a4a3a", "#5d6a7d"] as const;
const AWNINGS = ["#c8423a", "#3f6fd0", "#5fb04a", "#e8963a", "#8a4fc0", "#f5d562"] as const;

const hash = (x: number, y: number, k: number) => { const s = Math.sin(x * 127.1 + y * 311.7 + k * 74.7) * 43758.5453; return s - Math.floor(s); };
/** How far a point is out along the town oval: under 1 is inside the wall. */
const ovalDistance = (x: number, y: number) => Math.hypot((x - CENTRE.x) / RADII.x, (y - CENTRE.y) / RADII.y);

/** The town wall's corners (tiles): its towers. Corner 0 to corner 1 is the south edge, with the gate. */
function wallPoints(): Point[] {
  return Array.from({ length: TOWERS }, (_, i) => {
    const a = Math.PI / 2 - Math.PI / TOWERS + (i * 2 * Math.PI) / TOWERS;
    const r = i < 2 ? 1 : 1 + 0.035 * Math.sin(i * 2.9);     // a little irregular, but the gate edge stays level
    return { x: CENTRE.x + RADII.x * r * Math.cos(a), y: CENTRE.y + RADII.y * r * Math.sin(a) };
  });
}
/** The castle ward's corners and mid-wall towers (tile centres), clockwise from the south-east; its gate is on edge 0. */
const wardPoints = (): Point[] => [
  { x: WARD.x1 + 0.5, y: WARD.y1 + 0.5 }, { x: WARD.x0 + 0.5, y: WARD.y1 + 0.5 }, { x: WARD.x0 + 0.5, y: (WARD.y0 + WARD.y1) / 2 + 0.5 },
  { x: WARD.x0 + 0.5, y: WARD.y0 + 0.5 }, { x: MID + 0.5, y: WARD.y0 + 0.5 }, { x: WARD.x1 + 0.5, y: WARD.y0 + 0.5 },
  { x: WARD.x1 + 0.5, y: (WARD.y0 + WARD.y1) / 2 + 0.5 },
];

/** The main street's west edge (tile column) at each row from the gate up to the square: it winds. */
const streetX = (y: number) => MID - 1 + Math.round(2.5 * Math.sin((64 - y) / 4.5));

interface Town {
  map: TileMap;
  gateY: number;
  bridge: TileRect;
  houses: { rect: TileRect; roof: string; storeys: number }[];
  lamps: Point[];
  stalls: { rect: TileRect; awning: string }[];
}

function buildTown(): Town {
  const tiles: Tile[][] = Array.from({ length: H }, () => Array.from({ length: W }, () => Tile.Grass as Tile));
  const at = (x: number, y: number) => tiles[y]?.[x];
  const set = (x: number, y: number, t: Tile) => { if (x >= 0 && y >= 0 && x < W && y < H) tiles[y]![x] = t; };
  const fill = ([x, y, w, h]: TileRect, t: Tile) => { for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) set(i, j, t); };
  const disc = (cx: number, cy: number, r: number, t: Tile) => {
    for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y++) for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++)
      if (Math.hypot(x + 0.5 - cx, y + 0.5 - cy) <= r) set(x, y, t);
  };
  const band = (a: Point, b: Point, r: number, t: Tile) => {
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    for (let s = 0; s <= len; s += 0.2) disc(a.x + ((b.x - a.x) * s) / len, a.y + ((b.y - a.y) * s) / len, r, t);
  };

  // Outside: meadows and the moat, thickening into forest toward the map's edges.
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const d = ovalDistance(x + 0.5, y + 0.5), edge = Math.min(x, y, W - 1 - x, H - 1 - y);
    if (d < 1) set(x, y, Tile.Cobble);                       // the town, paved
    else if (d > 1.06 && d < 1.15) set(x, y, Tile.Water);    // the moat
    else if (edge === 0 || (edge < 3 && hash(x, y, 1) < 0.7 - edge * 0.15)) set(x, y, Tile.Tree);
    else if (d > 1.22 && Math.abs(x + 0.5 - MID) > 4 && hash(x, y, 2) < 0.1) set(x, y, Tile.Tree);
    else if (hash(x, y, 3) < 0.07) set(x, y, Tile.Flower);
  }

  // The town wall, with a tower at every corner, and the gate in its south edge.
  const outer = wallPoints();
  outer.forEach((p, i) => band(p, outer[(i + 1) % outer.length]!, 0.75, Tile.Wall));
  for (const p of outer) disc(p.x, p.y, 1.45, Tile.Wall);
  const gateY = outer[0]!.y;
  for (let y = Math.floor(gateY) - 2; y <= Math.floor(gateY) + 2; y++) for (const x of [MID - 1, MID]) {
    if (at(x, y) === Tile.Wall) set(x, y, ovalDistance(x + 0.5, y + 0.5) < 1 ? Tile.Cobble : Tile.Path);
  }
  disc(MID - 2, gateY, 1.3, Tile.Wall);
  disc(MID + 2, gateY, 1.3, Tile.Wall);
  // The bridge over the moat, and the road from it down to the cave.
  let bridgeTop = H, bridgeBottom = 0;
  for (let y = Math.floor(gateY); y < H; y++) for (const x of [MID - 1, MID]) {
    if (at(x, y) === Tile.Water) { bridgeTop = Math.min(bridgeTop, y); bridgeBottom = Math.max(bridgeBottom, y); }
    if (at(x, y) !== Tile.Cobble && at(x, y) !== Tile.Wall) set(x, y, Tile.Path);
  }

  // The castle: an inner ward with its own taller wall, towers and gate; a dirt courtyard inside.
  fill([WARD.x0, WARD.y0, WARD.x1 - WARD.x0 + 1, WARD.y1 - WARD.y0 + 1], Tile.Path);
  const ward = wardPoints();
  ward.forEach((p, i) => band(p, ward[(i + 1) % ward.length]!, 0.6, Tile.Wall));
  for (const p of ward) disc(p.x, p.y, 1.5, Tile.Wall);
  fill([MID - 1, WARD.y1 - 1, 2, 3], Tile.Path);
  disc(MID - 2, WARD.y1 + 0.5, 1.3, Tile.Wall);
  disc(MID + 2, WARD.y1 + 0.5, 1.3, Tile.Wall);
  fill(KEEP, Tile.Wall);
  fill(BARRACKS, Tile.Wall);
  fill(STABLES, Tile.Wall);
  for (const [x, y] of [[34, 14], [54, 14], [35, 19], [53, 19]]) set(x!, y!, Tile.Tree);

  // The market square and its buildings.
  fill(FOUNTAIN, Tile.Wall);
  fill(CATHEDRAL, Tile.Wall);
  fill(GUILDHALL, Tile.Wall);
  const stalls: Town["stalls"] = [[38, 40], [48, 40], [38, 46], [48, 46], [41, 40], [45, 46]].map(([x, y], i) => ({ rect: [x!, y!, 2, 1] as TileRect, awning: AWNINGS[i]! }));
  for (const s of stalls) fill(s.rect, Tile.Wall);

  // Keep the streets clear: the main street, the castle road, the square and the ward's surroundings.
  const reserved = (x: number, y: number) =>
    (y >= SQUARE.y0 - 1 && y <= SQUARE.y1 + 1 && x >= SQUARE.x0 - 1 && x <= SQUARE.x1 + 1) ||
    (x >= WARD.x0 - 2 && x <= WARD.x1 + 2 && y >= WARD.y0 - 2 && y <= WARD.y1 + 2) ||
    (y > SQUARE.y1 && Math.abs(x - streetX(y) - 0.5) < 3.5) ||
    (y > WARD.y1 && y < SQUARE.y0 && Math.abs(x - MID + 0.5) < 3.5) ||
    (y >= gateY - 4 && Math.abs(x - MID + 0.5) < 4.5);

  // The town: terraces of houses packed along each street, one-tile alleys between them, varied in
  // width, depth, roof and height, with the odd garden.
  const houses: Town["houses"] = [];
  const fits = (x: number, y: number, w: number, h: number) => {
    if (ovalDistance(x + w / 2, y + h / 2) > 0.93) return false;
    for (let j = y - 1; j <= y + h; j++) for (let i = x - 1; i <= x + w; i++) if (at(i, j) !== Tile.Cobble || reserved(i, j)) return false;
    return true;
  };
  for (let y = 6; y < H - 8; y += 4) {
    for (let x = 4; x < W - 6;) {
      const w = 3 + Math.floor(hash(x, y, 11) * 2.4), h = hash(x, y, 15) < 0.35 ? 3 : 2;
      if (!fits(x, y, w, h)) { x++; continue; }
      if (hash(x, y, 12) < 0.08) {                           // a garden: grass and a tree
        fill([x, y, 2, 2], Tile.Grass);
        set(x, y, Tile.Tree);
        x += 3;
        continue;
      }
      fill([x, y, w, h], Tile.Wall);
      houses.push({ rect: [x, y, w, h], roof: ROOFS[Math.floor(hash(x, y, 13) * ROOFS.length)]!, storeys: hash(x, y, 14) < 0.22 ? 3 : 2 });
      x += w + 1 + (hash(x, y, 16) < 0.2 ? 1 : 0);
    }
  }

  // Lamps along the main street (alternating sides), round the square, up the castle road, and at the bridge.
  const lamps: Point[] = [];
  for (let y = SQUARE.y1 + 3; y < gateY - 2; y += 4) lamps.push({ x: (y % 8 < 4 ? streetX(y) - 1 : streetX(y) + 2) * T + HALF, y: y * T + HALF });
  for (const [x, y] of [[SQUARE.x0, SQUARE.y0], [SQUARE.x1, SQUARE.y0], [SQUARE.x0, SQUARE.y1], [SQUARE.x1, SQUARE.y1], [MID - 3, 31], [MID + 2, 31], [MID - 3, 35], [MID + 2, 35], [MID - 3, bridgeBottom + 2], [MID + 2, bridgeBottom + 2]])
    lamps.push({ x: x! * T + HALF, y: y! * T + HALF });

  return {
    map: { width: W, height: H, tiles, solids: [] },
    gateY, bridge: [MID - 1, bridgeTop, 2, bridgeBottom - bridgeTop + 1], houses, lamps, stalls,
  };
}

function props(town: Town): Prop[] {
  const toPx = (p: Point) => ({ x: p.x * T, y: p.y * T });
  const out: Prop[] = [
    { kind: "curtainWall", points: wallPoints().map(toPx), gate: { edge: 0, x: MID * T, width: 2 * T }, height: 3.0, tower: { radius: 1.15, height: 4.6, roof: "#4a5a7a" } },
    { kind: "curtainWall", points: wardPoints().map(toPx), gate: { edge: 0, x: MID * T, width: 2 * T }, height: 3.8, tower: { radius: 1.3, height: 6.0, roof: "#a8473a" } },
    { kind: "keep", rect: px(KEEP), plinth: 1.6 },
    { kind: "cathedral", rect: px(CATHEDRAL) },
    { kind: "house", rect: px(GUILDHALL), roof: "#4a5a7a", storeys: 3 },
    { kind: "fountain", x: (FOUNTAIN[0] + FOUNTAIN[2] / 2) * T, y: (FOUNTAIN[1] + FOUNTAIN[3] / 2) * T },
    { kind: "bridge", rect: px(town.bridge) },
    { kind: "cave", x: MID * T, y: H * T, facing: "north" },
    { kind: "house", rect: px(BARRACKS), roof: "#a8473a", storeys: 2 },
    { kind: "house", rect: px(STABLES), roof: "#a8473a", storeys: 2 },
  ];
  for (const h of town.houses) out.push({ kind: "house", rect: px(h.rect), roof: h.roof, storeys: h.storeys });
  for (const s of town.stalls) out.push({ kind: "stall", rect: px(s.rect), awning: s.awning });
  for (const l of town.lamps) out.push({ kind: "lamp", x: l.x, y: l.y });
  return out;
}

function build(): AreaLayout {
  const town = buildTown();
  return {
    map: town.map,
    // Coming up out of the cave: a few steps north of its mouth, on the road to the bridge.
    entries: { cave: { x: MID * T - HALF, y: (H - 4) * T } },
    exits: [{ rect: { x: MID * T - T, y: (H - 1) * T + 2, w: 2 * T, h: T - 2 }, to: { area: "witchwood", entry: "cave" } }],
    props: props(town),
  };
}

export const area: AreaDef = {
  id: "capital",
  name: "Capital City",
  build,
  life: { enemies: false, potions: false, ambient: true },
};
