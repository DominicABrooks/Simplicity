// Where townsfolk can walk, and how they get about: a grid of the tiles a body fits on (open ground, not
// water or trees, nothing built in the way), each with a cost so the cheapest way keeps to the streets
// (grass costs more), and the doors of the buildings they live in.
import { T, Tile } from "../data/world.ts";
import type { Facing, Prop } from "./area.ts";
import { blocked } from "./collision.ts";
import type { TileMap } from "./map.ts";

export type TileXY = readonly [number, number];

export interface Walkways {
  W: number;
  H: number;
  /** Per tile (y * W + x): what a step onto it costs, 0 where nobody walks. */
  cost: Float32Array;
  /** The paved tiles anyone can walk to: places to wander. */
  streets: TileXY[];
}

/** What a step onto each kind of ground costs: people keep to streets and paths, cutting across grass only when it's much shorter. */
const COST: Partial<Record<Tile, number>> = { [Tile.Cobble]: 1, [Tile.Path]: 1.2, [Tile.Grass]: 3, [Tile.Flower]: 3.5 };

export function walkwaysOf(map: TileMap): Walkways {
  const W = map.width, H = map.height, cost = new Float32Array(W * H), streets: TileXY[] = [];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const base = COST[map.tiles[y]![x]!] ?? 0;
    if (!base || blocked(map, x * T, y * T, true)) continue;   // a body standing in the tile would touch something
    cost[y * W + x] = base;
    if (map.tiles[y]![x] === Tile.Cobble) streets.push([x, y]);
  }
  return { W, H, cost, streets };
}

export const walkable = (w: Walkways, x: number, y: number): boolean => x >= 0 && y >= 0 && x < w.W && y < w.H && w.cost[y * w.W + x]! > 0;

/** The walkable tile nearest (x, y), within `reach` tiles, or null. */
export function nearestWalkable(w: Walkways, x: number, y: number, reach = 10): TileXY | null {
  x = Math.round(x); y = Math.round(y);
  let best: TileXY | null = null, bestD = Infinity;
  for (let dy = -reach; dy <= reach; dy++) for (let dx = -reach; dx <= reach; dx++) {
    const d = dx * dx + dy * dy;
    if (d < bestD && walkable(w, x + dx, y + dy)) { best = [x + dx, y + dy]; bestD = d; }
  }
  return best;
}

/**
 * The cheapest way from one tile to another (both walkable), as the tiles to walk through, ending at `to`
 * (and not including `from`); null if there's no way. Diagonal steps are allowed where both sides are open,
 * so nobody cuts a corner through a wall.
 */
export function findPath(w: Walkways, from: TileXY, to: TileXY): TileXY[] | null {
  const { W, cost } = w, start = from[1] * W + from[0], goal = to[1] * W + to[0];
  if (!cost[start] || !cost[goal]) return null;
  if (start === goal) return [];
  const dist = new Float32Array(cost.length).fill(Infinity), prev = new Int32Array(cost.length).fill(-1);
  const heap = new MinHeap();
  dist[start] = 0;
  heap.push(start, 0);
  const tx = to[0], ty = to[1];
  while (heap.size) {
    const i = heap.pop(), x = i % W, y = (i - x) / W;
    if (i === goal) break;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      if (!dx && !dy) continue;
      const nx = x + dx, ny = y + dy;
      if (!walkable(w, nx, ny) || (dx && dy && (!walkable(w, x + dx, y) || !walkable(w, x, y + dy)))) continue;
      const j = ny * W + nx, d = dist[i]! + cost[j]! * (dx && dy ? Math.SQRT2 : 1);
      if (d >= dist[j]!) continue;
      dist[j] = d;
      prev[j] = i;
      heap.push(j, d + Math.hypot(nx - tx, ny - ty));     // A*: the straight line left is never more than the way
    }
  }
  if (prev[goal] === -1) return null;
  const out: TileXY[] = [];
  for (let i = goal; i !== start; i = prev[i]!) out.push([i % W, Math.floor(i / W)]);
  return out.reverse();
}

/** The side a building's door is on, if it has one people come and go by. */
function doorSide(p: Prop): Facing | null {
  if (p.kind === "house") return p.doorSide;
  if (p.kind === "hall" || p.kind === "cloister") return p.door;
  if (p.kind === "stable") return p.facing;
  if (p.kind === "keep") return "south";                    // its stair comes down on the south
  if (p.kind === "church") return "west";
  return null;
}

/**
 * The tile outside the door of whatever building stands on tile (x, y), where its people come out and go
 * in; or, if there's no building there with a door, the walkable tile nearest it. Null if nowhere's walkable.
 */
export function doorOf(w: Walkways, props: readonly Prop[], x: number, y: number): TileXY | null {
  const px = (x + 0.5) * T, py = (y + 0.5) * T;
  for (const p of props) {
    if (!("rect" in p)) continue;
    const r = p.rect, side = doorSide(p);
    if (!side || px < r.x || py < r.y || px > r.x + r.w || py > r.y + r.h) continue;
    const cx = Math.floor((r.x + r.w / 2) / T), cy = Math.floor((r.y + r.h / 2) / T);
    const at: TileXY = side === "south" ? [cx, Math.ceil((r.y + r.h) / T)] : side === "north" ? [cx, Math.floor(r.y / T) - 1]
      : side === "east" ? [Math.ceil((r.x + r.w) / T), cy] : [Math.floor(r.x / T) - 1, cy];
    return nearestWalkable(w, at[0], at[1], 4) ?? nearestWalkable(w, x, y);
  }
  return nearestWalkable(w, x, y);
}

/** A binary min-heap of tile indices by priority. */
class MinHeap {
  private items: number[] = [];
  private keys: number[] = [];
  get size(): number { return this.items.length; }
  push(item: number, key: number): void {
    const { items, keys } = this;
    let i = items.length;
    items.push(item); keys.push(key);
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (keys[parent]! <= key) break;
      items[i] = items[parent]!; keys[i] = keys[parent]!;
      i = parent;
    }
    items[i] = item; keys[i] = key;
  }
  pop(): number {
    const { items, keys } = this, top = items[0]!, item = items.pop()!, key = keys.pop()!;
    if (items.length) {
      let i = 0;
      for (;;) {
        const l = i * 2 + 1, r = l + 1;
        let c = i, ck = key;
        if (l < items.length && keys[l]! < ck) { c = l; ck = keys[l]!; }
        if (r < items.length && keys[r]! < ck) c = r;
        if (c === i) break;
        items[i] = items[c]!; keys[i] = keys[c]!;
        i = c;
      }
      items[i] = item; keys[i] = key;
    }
    return top;
  }
}
