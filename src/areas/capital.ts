// Capital City: the seat of the greatest kingdom left, up the cave from Witchwood.
//
// Laid out like a real castle town. A moat rings an oval town wall with a tower every few dozen paces;
// you cross a bridge to the gatehouse. Inside, the streets come first: a ring road inside the wall, lanes
// running east-west, cross streets, and a winding high street climbing from the gate to
// the market square (a fountain, stalls, the guildhall and the cathedral), then a straight road leads to
// the castle: an inner ward with taller walls and its own gatehouse, and the keep on a rocky crag in the
// middle. Nothing hostile lives here.
//
// Between each pair of lanes, terraces of houses stand back to back, each with its door onto a street, and
// what's left behind them is yards and gardens.
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

/** The high street's west-middle column at each row from the gate up to the square: it winds. */
const streetX = (y: number) => MID - 1 + Math.round(2.5 * Math.sin((64 - y) / 4.5));
/** The lanes run east-west, two tiles wide, every LANES rows from LANE0; houses fill the blocks between. */
const LANE0 = 5, LANES = 8;
const isLane = (y: number) => (((y - LANE0) % LANES) + LANES) % LANES < 2;
/** Cross streets, two tiles wide, starting at these columns. */
const CROSS = [17, 29, 57, 69];

/** Is (x, y) a street? (Before the castle, square and buildings are laid over them.) */
function isStreet(x: number, y: number, gateY: number): boolean {
  const d = ovalDistance(x + 0.5, y + 0.5);
  return isLane(y) || CROSS.some(c => x === c || x === c + 1) ||
    (d > 0.85 && d < 0.9) ||                                                          // the ring road
    (y > SQUARE.y1 && Math.abs(x - streetX(y) - 0.5) < 2) ||                          // the high street
    (y > WARD.y1 && y < SQUARE.y0 && Math.abs(x - MID + 0.5) < 2) ||                  // the castle road
    (x >= WARD.x0 - 2 && x <= WARD.x1 + 2 && y >= WARD.y0 - 2 && y <= WARD.y1 + 2) || // round the castle
    (y >= SQUARE.y0 - 1 && y <= SQUARE.y1 + 1 && x >= SQUARE.x0 - 1 && x <= SQUARE.x1 + 1) ||
    (y >= gateY - 4 && Math.abs(x - MID + 0.5) < 3.5);                                // inside the gate
}

interface Town {
  map: TileMap;
  gateY: number;
  bridge: TileRect;
  houses: { rect: TileRect; roof: string; storeys: number; doorSide: "north" | "south" }[];
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
    if (d < 1) { if (hash(x, y, 3) < 0.04) set(x, y, Tile.Flower); }   // the town: yards, until it's built on
    else if (d > 1.06 && d < 1.15) set(x, y, Tile.Water);    // the moat
    else if (edge === 0 || (edge < 3 && hash(x, y, 1) < 0.7 - edge * 0.15)) set(x, y, Tile.Tree);
    else if (d > 1.22 && Math.abs(x + 0.5 - MID) > 4 && hash(x, y, 2) < 0.1) set(x, y, Tile.Tree);
    else if (hash(x, y, 3) < 0.07) set(x, y, Tile.Flower);
  }

  // The town wall, with a tower at every corner, and the gate in its south edge.
  const outer = wallPoints();
  // As thick as the wall is drawn: any tile it crosses the middle of. (Still unbroken: a line has a tile
  // centre within half a tile of it in every column or row it crosses.)
  outer.forEach((p, i) => band(p, outer[(i + 1) % outer.length]!, 0.55, Tile.Wall));
  for (const p of outer) disc(p.x, p.y, 1.3, Tile.Wall);
  const gateY = outer[0]!.y;
  for (let y = Math.floor(gateY) - 2; y <= Math.floor(gateY) + 2; y++) for (const x of [MID - 1, MID]) {
    if (at(x, y) === Tile.Wall) set(x, y, ovalDistance(x + 0.5, y + 0.5) < 1 ? Tile.Cobble : Tile.Path);
  }
  // The gatehouse's towers stand half a tile out from the wall line.
  disc(MID - 2, gateY + 0.5, 1.1, Tile.Wall);
  disc(MID + 2, gateY + 0.5, 1.1, Tile.Wall);
  // The bridge over the moat, and the road from it down to the cave.
  let bridgeTop = H, bridgeBottom = 0;
  for (let y = Math.floor(gateY); y < H; y++) for (const x of [MID - 1, MID]) {
    if (at(x, y) === Tile.Water) { bridgeTop = Math.min(bridgeTop, y); bridgeBottom = Math.max(bridgeBottom, y); }
    if (at(x, y) !== Tile.Cobble && at(x, y) !== Tile.Wall) set(x, y, Tile.Path);
  }

  // The streets.
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++)
    if (ovalDistance(x + 0.5, y + 0.5) < 0.97 && at(x, y) !== Tile.Wall && isStreet(x, y, gateY)) set(x, y, Tile.Cobble);

  // The castle: an inner ward with its own taller wall, towers and gate; a dirt courtyard inside.
  fill([WARD.x0, WARD.y0, WARD.x1 - WARD.x0 + 1, WARD.y1 - WARD.y0 + 1], Tile.Path);
  const ward = wardPoints();
  ward.forEach((p, i) => band(p, ward[(i + 1) % ward.length]!, 0.6, Tile.Wall));
  for (const p of ward) disc(p.x, p.y, 1.5, Tile.Wall);
  fill([MID - 1, WARD.y1 - 1, 2, 3], Tile.Path);
  disc(MID - 2, WARD.y1 + 1, 1.2, Tile.Wall);
  disc(MID + 2, WARD.y1 + 1, 1.2, Tile.Wall);
  // The keep's crag fills its footprint but the front row, where only the stair comes down.
  fill([KEEP[0], KEEP[1], KEEP[2], KEEP[3] - 1], Tile.Wall);
  fill([MID - 1, KEEP[1] + KEEP[3] - 1, 2, 1], Tile.Wall);
  fill(BARRACKS, Tile.Wall);
  fill(STABLES, Tile.Wall);
  for (const [x, y] of [[34, 14], [54, 14], [35, 19], [53, 19]]) set(x!, y!, Tile.Tree);

  // The market square and its buildings, with paving in front of their doors.
  fill([CATHEDRAL[0] - 1, CATHEDRAL[1] + CATHEDRAL[3], CATHEDRAL[2] + 2, 2], Tile.Cobble);
  fill([GUILDHALL[0] - 1, GUILDHALL[1] + GUILDHALL[3], GUILDHALL[2] + 2, 2], Tile.Cobble);
  fill(FOUNTAIN, Tile.Wall);
  // The cathedral's shape: the nave (with its buttresses) and apse down the middle, the transept
  // crossing it full depth, and the bell tower at the west end, narrower than the nave.
  const [cx0, cy0, cw, ch] = CATHEDRAL;
  fill([cx0 + 3, cy0 + 1, cw - 3, ch - 2], Tile.Wall);
  fill([cx0 + 6, cy0, 3, ch], Tile.Wall);
  fill([cx0, cy0 + 2, 3, ch - 4], Tile.Wall);
  fill(GUILDHALL, Tile.Wall);
  const stalls: Town["stalls"] = [[38, 40], [48, 40], [38, 46], [48, 46], [41, 40], [45, 46]].map(([x, y], i) => ({ rect: [x!, y!, 2, 1] as TileRect, awning: AWNINGS[i]! }));
  for (const s of stalls) fill(s.rect, Tile.Wall);

  // The houses: in each block between two lanes, a terrace along the north side with doors onto the lane
  // above, and one along the south side with doors onto the lane below, back to back. A house only goes
  // where its whole frontage is street, so every door opens onto one.
  const houses: Town["houses"] = [];
  const open = (t: Tile | undefined) => t === Tile.Grass || t === Tile.Flower;
  const fits = (x: number, y: number, w: number, h: number, front: number) => {
    for (let i = x; i < x + w; i++) {
      if (at(i, front) !== Tile.Cobble) return false;
      for (let j = y; j < y + h; j++) if (!open(at(i, j)) || ovalDistance(i + 0.5, j + 0.5) > 0.9) return false;
    }
    return true;
  };
  for (let lane = LANE0; lane < H; lane += LANES) for (const side of ["north", "south"] as const) {
    for (let x = 1; x < W - 1;) {
      const k = x * 7 + lane + (side === "north" ? 0 : 1000);
      const w = 3 + Math.floor(hash(k, lane, 11) * 2.4), h = hash(k, lane, 15) < 0.4 ? 3 : 2;
      const y = side === "north" ? lane + 2 : lane + LANES - h, front = side === "north" ? y - 1 : y + h;
      if (!fits(x, y, w, h, front)) { x++; continue; }
      fill([x, y, w, h], Tile.Wall);
      houses.push({ rect: [x, y, w, h], roof: ROOFS[Math.floor(hash(k, lane, 13) * ROOFS.length)]!, storeys: hash(k, lane, 14) < 0.22 ? 3 : 2, doorSide: side });
      x += w + (hash(k, lane, 16) < 0.45 ? 1 : 0);           // terraced, with the odd alley through to the yards
    }
  }
  // The yards behind them: grass, and here and there a tree, clear of doors and alleys.
  for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
    if (!open(at(x, y)) || ovalDistance(x + 0.5, y + 0.5) > 0.85 || hash(x, y, 20) > 0.14) continue;
    let clear = true;
    for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) if (!open(at(x + i, y + j)) && at(x + i, y + j) !== Tile.Wall) clear = false;
    if (clear) set(x, y, Tile.Tree);
  }

  // Lamps along the high street (alternating sides), round the square, up the castle road, and at the bridge.
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
  for (const h of town.houses) out.push({ kind: "house", rect: px(h.rect), roof: h.roof, storeys: h.storeys, doorSide: h.doorSide });
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
