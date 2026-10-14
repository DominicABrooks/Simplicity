// Building towns: what every town area (src/areas/*) lays out its streets, buildings and houses with.
//
// An area paints its ground on a tile grid (streets, water, grass), adds its buildings as props, and
// lets `houses` line its streets: deep, narrow town houses, gable end to the street, each with its door
// on the street, shops on the shopping streets. Adding a prop marks the tiles its solid shapes cover as
// Wall, so the map, spawning and the reachability checks agree with what actually stands in your way.
import { HALF, T, Tile, type Rect } from "../data/world.ts";
import type { AreaLayout, ExitDef, Facing, Goods, Prop } from "./area.ts";
import type { Point } from "./collision.ts";
import { propSolids } from "./solids.ts";
import { boundsOf, overlapsBox } from "./shapes.ts";

/** [x, y, w, h] in tiles. */
export type TileRect = readonly [number, number, number, number];
export const px = ([x, y, w, h]: TileRect): Rect => ({ x: x * T, y: y * T, w: w * T, h: h * T });
/** A point at a tile's centre (game px). */
export const at = (x: number, y: number): Point => ({ x: x * T + HALF, y: y * T + HALF });
/** A point at a tile corner (game px): for things centred between tiles. */
export const corner = (x: number, y: number): Point => ({ x: x * T, y: y * T });

/** A deterministic pseudo-random number in [0, 1) for (x, y, k). */
export const hash = (x: number, y: number, k: number) => { const s = Math.sin(x * 127.1 + y * 311.7 + k * 74.7) * 43758.5453; return s - Math.floor(s); };
const pick = <T>(list: readonly T[], k: number): T => list[Math.floor(k * list.length) % list.length]!;

export const ROOFS = ["#a8473a", "#4a5a7a", "#5a6b3a", "#b08a4a", "#8a4a3a", "#5d6a7d", "#7a3a2a"] as const;
export const AWNINGS = ["#c8423a", "#3f6fd0", "#5fb04a", "#e8963a", "#8a4fc0", "#f5d562"] as const;

export interface HouseRules {
  /** Streets a house can front onto. */
  street: (x: number, y: number) => boolean;
  /** Where houses may stand at all (besides on open ground). */
  allowed?: (x: number, y: number) => boolean;
  /** A shopping street: a shop's goods for a house fronting it here, or null for a home. */
  shop?: (x: number, y: number, k: number) => Goods | null;
  /** Frontage (along the street) and depth (back from it), tiles, [from, to]. */
  frontage: readonly [number, number];
  depth: readonly [number, number];
  storeys: readonly [number, number];
  /** Chance of a one-tile alley after a house. */
  alley: number;
  /** Share of houses with a stone ground floor: the richer the street, the more (default 0.3). */
  stone?: number;
  seed: number;
}

export class Town {
  readonly tiles: Tile[][];
  readonly props: Prop[] = [];

  constructor(readonly W: number, readonly H: number, ground: Tile = Tile.Grass) {
    this.tiles = Array.from({ length: H }, () => Array.from({ length: W }, () => ground));
  }

  at(x: number, y: number): Tile | undefined { return this.tiles[y]?.[x]; }
  set(x: number, y: number, t: Tile): void { if (x >= 0 && y >= 0 && x < this.W && y < this.H) this.tiles[y]![x] = t; }
  fill([x, y, w, h]: TileRect, t: Tile): void { for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) this.set(i, j, t); }
  /** Every tile whose centre is within `r` of (cx, cy) (tile units). */
  disc(cx: number, cy: number, r: number, t: Tile): void {
    for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y++) for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++)
      if (Math.hypot(x + 0.5 - cx, y + 0.5 - cy) <= r) this.set(x, y, t);
  }
  /** Paint where `test` holds. */
  paint(test: (x: number, y: number) => boolean, t: Tile): void {
    for (let y = 0; y < this.H; y++) for (let x = 0; x < this.W; x++) if (test(x, y)) this.set(x, y, t);
  }
  /** Open ground a house or yard can take: grass or flowers. */
  open(x: number, y: number): boolean { const t = this.at(x, y); return t === Tile.Grass || t === Tile.Flower; }

  /** Add a prop, and mark the tiles its solid shapes cover (their middle half) as Wall. */
  add(prop: Prop): Prop {
    this.props.push(prop);
    for (const s of propSolids(prop)) {
      const b = boundsOf(s);
      for (let y = Math.max(0, Math.floor(b.y0 / T)); y <= Math.min(this.H - 1, Math.floor(b.y1 / T)); y++) for (let x = Math.max(0, Math.floor(b.x0 / T)); x <= Math.min(this.W - 1, Math.floor(b.x1 / T)); x++) {
        if (this.at(x, y) === Tile.Water) continue;
        if (overlapsBox(s, { x0: (x + 0.25) * T, y0: (y + 0.25) * T, x1: (x + 0.75) * T, y1: (y + 0.75) * T })) this.set(x, y, Tile.Wall);
      }
    }
    return prop;
  }

  /**
   * Line the streets with houses: for each side a street can be on, every run of street frontage gets
   * houses fronting it, as deep as fits (up to the rules' depth), in terraces with the odd alley.
   */
  houses(rules: HouseRules): number {
    const before = this.props.length, { W, H } = this;
    const free = (x: number, y: number) => this.open(x, y) && (rules.allowed?.(x, y) ?? true);
    const fits = ([x, y, w, h]: TileRect) => { for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) if (!free(i, j)) return false; return true; };
    const frontOk = (cells: [number, number][]) => cells.every(([x, y]) => rules.street(x, y));
    for (const side of ["south", "north", "east", "west"] as const) {
      const vertical = side === "east" || side === "west";
      for (let row = 0; row < (vertical ? W : H); row++) for (let k = 0; k < (vertical ? H : W);) {
        const r = hash(row * 31 + k, rules.seed, side.length), fw = rules.frontage[0] + Math.floor(r * (rules.frontage[1] - rules.frontage[0] + 1));
        let placed = 0;
        for (let fd = rules.depth[0] + Math.floor(hash(k, row, rules.seed + 1) * (rules.depth[1] - rules.depth[0] + 1)); fd >= rules.depth[0] && !placed; fd--) {
          // `row` is the house's front row (or column), next to the street; `k` runs along the street.
          const rect: TileRect = side === "north" ? [k, row, fw, fd] : side === "south" ? [k, row - fd + 1, fw, fd] : side === "west" ? [row, k, fd, fw] : [row - fd + 1, k, fd, fw];
          const front: [number, number][] = Array.from({ length: fw }, (_, i) => side === "north" ? [k + i, row - 1] : side === "south" ? [k + i, row + 1] : side === "west" ? [row - 1, k + i] : [row + 1, k + i]);
          if (!frontOk(front) || !fits(rect)) continue;
          this.addHouse(rect, side, rules, front[0]!);
          placed = fw;
        }
        k += placed ? placed + (hash(k, row, rules.seed + 2) < rules.alley ? 1 : 0) : 1;
      }
    }
    return this.props.length - before;
  }

  private addHouse(rect: TileRect, doorSide: Facing, rules: HouseRules, [fx, fy]: [number, number]): void {
    const k = hash(rect[0], rect[1], rules.seed + 3), shop = rules.shop?.(fx, fy, k) ?? null;
    this.add({
      kind: "house", rect: px(rect), doorSide, roof: pick(ROOFS, hash(rect[0], rect[1], rules.seed + 4)),
      storeys: rules.storeys[0] + Math.floor(hash(rect[1], rect[0], rules.seed + 5) * (rules.storeys[1] - rules.storeys[0] + 1)),
      ...(shop ? { shop } : {}),
      ...(shop && k < 0.45 ? { sign: pick(AWNINGS, k * 2) } : {}),
      ...(shop || k > 0.82 ? { lantern: true } : {}),
      ...(hash(rect[0], rect[1], rules.seed + 6) < (rules.stone ?? 0.3) ? { stone: true } : {}),
    });
  }

  /** Yards and gardens: here and there a tree, where nothing's crowding it. */
  yards(density: number, allowed: (x: number, y: number) => boolean = () => true, seed = 20): void {
    for (let y = 1; y < this.H - 1; y++) for (let x = 1; x < this.W - 1; x++) {
      if (!this.open(x, y) || !allowed(x, y) || hash(x, y, seed) > density) continue;
      let clear = true;
      for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) { const t = this.at(x + i, y + j); if (t !== Tile.Grass && t !== Tile.Flower && t !== Tile.Wall) clear = false; }
      if (clear) this.set(x, y, Tile.Tree);
    }
  }

  /** The finished layout: the map (with every prop's solid shapes) and its ways in and out. */
  layout(entries: Record<string, Point>, exits: ExitDef[]): AreaLayout {
    return { map: { width: this.W, height: this.H, tiles: this.tiles, solids: this.props.flatMap(propSolids) }, entries, exits, props: this.props };
  }
}

/** An exit across a street at the map's edge, `from`..`to` tiles along it. */
export function edgeExit(edge: Facing, from: number, to: number, W: number, H: number, dest: ExitDef["to"]): ExitDef {
  const len = (to - from + 1) * T;
  const rect = edge === "north" ? { x: from * T, y: 0, w: len, h: T - 2 } : edge === "south" ? { x: from * T, y: (H - 1) * T + 2, w: len, h: T - 2 }
    : edge === "west" ? { x: 0, y: from * T, w: T - 2, h: len } : { x: (W - 1) * T + 2, y: from * T, w: T - 2, h: len };
  return { rect, to: dest };
}
