// Movement and shot collision. Trees (and water, for things that can't swim) block by the tile; anything
// built blocks by its shapes (shapes.ts, made from its props by solids.ts), so walls, towers, stalls and
// posts are as solid as they look and no more.
import type { Rng } from "../core/rng.ts";
import { T, Tile } from "../data/world.ts";
import { isOpenGround, tileOf, type TileMap } from "./map.ts";
import { anyContains, anyOverlaps } from "./shapes.ts";

export interface Point {
  x: number;
  y: number;
}

/** The tile under a game-pixel position. Outside the map counts as forest. */
export const tileAt = (map: TileMap, px: number, py: number): Tile => tileOf(map, Math.floor(px / T), Math.floor(py / T));

/** The collision box inside the 8x8 cell at (x, y): centred on the cell, where the body is drawn,
 * 6 px wide and 4 deep, so you stand as close to a wall coming from the south as from the north. */
export const FEET = { x: 1, y: 2, w: 6, h: 4 } as const;

/** Does the feet box of the cell at (x, y) touch a solid shape (a building, a post, the camp's tent)? */
export const hitsSolid = (map: TileMap, x: number, y: number): boolean =>
  anyOverlaps(map.solids, { x0: x + FEET.x, y0: y + FEET.y, x1: x + FEET.x + FEET.w, y1: y + FEET.y + FEET.h });

/** Is there something solid at a point (for shots: arrows stick in it, bolts burst on it)? */
export const solidAt = (map: TileMap, px: number, py: number): boolean => tileAt(map, px, py) === Tile.Tree || anyContains(map.solids, px, py);

/** Does the feet box of the cell at (x, y) touch anything solid (or water, if `blocksWater`)? */
export function blocked(map: TileMap, x: number, y: number, blocksWater: boolean): boolean {
  const x0 = x + FEET.x, x1 = x + FEET.x + FEET.w - 0.01, y0 = y + FEET.y, y1 = y + FEET.y + FEET.h - 0.01;
  for (const [px, py] of [[x0, y0], [x1, y0], [x0, y1], [x1, y1]] as const) {
    const t = tileAt(map, px, py);
    if (t === Tile.Tree || (blocksWater && t === Tile.Water)) return true;
  }
  return hitsSolid(map, x, y);
}

/** The most a move goes in one step, so nothing fast (a dash, a slow frame) skips through a thin post. */
const STEP = 2;
/** How far to one side a mover is steered round what's in front of him (a trunk, a post, the corner of a
 * wall): up to this many px. A tree is a whole tile, so 5 of the 7 px either way that would clear it. */
const NUDGE = 5;
/** Steered round only when heading within about 27 degrees of straight at it (sideways no more than half
 * of forwards); more sideways than that and he already slides along it on his own. */
const NUDGE_ANGLE = 0.5;

/**
 * The shortest sideways shift, no more than NUDGE px, that clears a step of `fwd` px along one axis
 * (x if `alongX`, else y); its sign is the side. Ties go the way `lean` points (his own sideways push).
 * 0 if there's none.
 */
function sidestep(map: TileMap, p: Point, alongX: boolean, fwd: number, lean: number, blocksWater: boolean): number {
  const clear = (side: number) => alongX ? !blocked(map, p.x + fwd, p.y + side, blocksWater) : !blocked(map, p.x + side, p.y + fwd, blocksWater);
  const first = lean < 0 ? -1 : 1;
  for (let d = 0.5; d <= NUDGE; d += 0.5) {
    if (clear(first * d)) return first * d;
    if (clear(-first * d)) return -first * d;
  }
  return 0;
}

/**
 * Move by (dx, dy) in small steps, one axis at a time, so you slide along walls instead of sticking, and
 * come to rest right against whatever stops you. Heading (nearly) straight into the edge of something,
 * a tree, a post, a pillar, the end of a wall, you're steered sideways round it at the speed you were
 * going rather than stopped on it; head-on into its middle, or into a wall that runs on, you stop.
 * Not if `steer` is false: for someone headed for a spot just behind it, who'd only weave to and fro.
 */
export function moveBy(map: TileMap, p: Point, dx: number, dy: number, blocksWater: boolean, steer = true): void {
  const n = Math.max(1, Math.ceil(Math.max(Math.abs(dx), Math.abs(dy)) / STEP)), sx = dx / n, sy = dy / n, step = Math.hypot(sx, sy);
  for (let i = 0; i < n; i++) {
    const xOk = sx !== 0 && !blocked(map, p.x + sx, p.y, blocksWater);
    if (xOk) p.x += sx;
    const yOk = sy !== 0 && !blocked(map, p.x, p.y + sy, blocksWater);
    if (yOk) p.y += sy;
    if (xOk || yOk || !steer) {
      if ((xOk && yOk) || !steer) continue;
      // One axis moved, the other's blocked: steer round it only if that was nearly all the move.
      if (xOk ? Math.abs(sx) > NUDGE_ANGLE * Math.abs(sy) : Math.abs(sy) > NUDGE_ANGLE * Math.abs(sx)) continue;
      if (xOk) p.x -= sx; else p.y -= sy;                        // the steer takes over the little sideways part
    }
    // Blocked going forwards (the main axis): shift sideways towards the nearer way round.
    const alongX = Math.abs(sx) >= Math.abs(sy), fwd = alongX ? sx : sy, lean = alongX ? sy : sx;
    if (fwd === 0 || Math.abs(lean) > NUDGE_ANGLE * Math.abs(fwd)) continue;
    const side = sidestep(map, p, alongX, fwd, lean, blocksWater);
    if (side === 0) {                                             // nothing to steer round: keep any sideways part
      if (lean !== 0) { if (alongX) { if (!blocked(map, p.x, p.y + lean, blocksWater)) p.y += lean; } else if (!blocked(map, p.x + lean, p.y, blocksWater)) p.x += lean; }
      continue;
    }
    const shift = Math.sign(side) * Math.min(Math.abs(side), step);
    if (alongX) { if (!blocked(map, p.x, p.y + shift, blocksWater)) p.y += shift; }
    else if (!blocked(map, p.x + shift, p.y, blocksWater)) p.x += shift;
  }
}

/** Two cells overlap enough to touch (pickups, contact damage). */
export const overlap = (a: Point, b: Point): boolean => Math.abs(a.x - b.x) < 6 && Math.abs(a.y - b.y) < 6;

/** A random open-ground cell (or one of tile `on`) at least minDist px from `from`, or null after 200 tries. */
export function randomGroundSpot(map: TileMap, rng: Rng, from: Point, minDist: number, on?: Tile): Point | null {
  for (let i = 0; i < 200; i++) {
    const x = rng.int(1, map.width - 2) * T, y = rng.int(1, map.height - 2) * T, t = map.tiles[y / T]![x / T]!;
    if ((on === undefined ? isOpenGround(t) : t === on) && !hitsSolid(map, x, y) && Math.hypot(x - from.x, y - from.y) >= minDist) return { x, y };
  }
  return null;
}
