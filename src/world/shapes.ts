// Solid shapes off the tile grid, in game pixels: what buildings, statues, stalls and lamp posts are
// to collision. A box, a circle (a tower, a post, a fountain) or a capsule (a thick line: a run of town
// wall at any angle). Movement tests the feet box against them; shots test a point.
//
// An area's shapes are bucketed into a coarse grid once (lazily, on first use), so a test only looks at
// the few shapes near it however many the area has.

export type Shape =
  | { kind: "box"; x: number; y: number; w: number; h: number }
  | { kind: "circle"; x: number; y: number; r: number }
  | { kind: "capsule"; ax: number; ay: number; bx: number; by: number; r: number };

interface Bounds { x0: number; y0: number; x1: number; y1: number }

export function boundsOf(s: Shape): Bounds {
  switch (s.kind) {
    case "box": return { x0: s.x, y0: s.y, x1: s.x + s.w, y1: s.y + s.h };
    case "circle": return { x0: s.x - s.r, y0: s.y - s.r, x1: s.x + s.r, y1: s.y + s.r };
    case "capsule": return { x0: Math.min(s.ax, s.bx) - s.r, y0: Math.min(s.ay, s.by) - s.r, x1: Math.max(s.ax, s.bx) + s.r, y1: Math.max(s.ay, s.by) + s.r };
  }
}

/** Distance from a point to a box (0 inside it). */
const toBox = (px: number, py: number, b: Bounds) => Math.hypot(Math.max(b.x0 - px, 0, px - b.x1), Math.max(b.y0 - py, 0, py - b.y1));

/** Distance from a point to the segment a-b. */
function toSegment(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {
  const dx = bx - ax, dy = by - ay, len2 = dx * dx + dy * dy;
  const t = len2 ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len2)) : 0;
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

/** Does the segment a-b pass through the box? (Liang-Barsky clipping.) */
function segmentCrosses(ax: number, ay: number, bx: number, by: number, b: Bounds): boolean {
  let t0 = 0, t1 = 1;
  const dx = bx - ax, dy = by - ay;
  for (const [p, q] of [[-dx, ax - b.x0], [dx, b.x1 - ax], [-dy, ay - b.y0], [dy, b.y1 - ay]] as const) {
    if (p === 0) { if (q < 0) return false; continue; }
    const r = q / p;
    if (p < 0) t0 = Math.max(t0, r); else t1 = Math.min(t1, r);
    if (t0 > t1) return false;
  }
  return true;
}

/** Does a shape overlap the box? (Touching edges don't count, so you can stand flush against a wall.) */
export function overlapsBox(s: Shape, b: Bounds): boolean {
  switch (s.kind) {
    case "box": return b.x0 < s.x + s.w && s.x < b.x1 && b.y0 < s.y + s.h && s.y < b.y1;
    case "circle": return toBox(s.x, s.y, b) < s.r;
    case "capsule": {
      if (segmentCrosses(s.ax, s.ay, s.bx, s.by, b)) return true;
      // Otherwise the nearest points are an end of the segment or a corner of the box.
      const d = Math.min(toBox(s.ax, s.ay, b), toBox(s.bx, s.by, b),
        ...[[b.x0, b.y0], [b.x1, b.y0], [b.x0, b.y1], [b.x1, b.y1]].map(([x, y]) => toSegment(x!, y!, s.ax, s.ay, s.bx, s.by)));
      return d < s.r;
    }
  }
}

/** Is a point inside a shape? */
export function contains(s: Shape, x: number, y: number): boolean {
  switch (s.kind) {
    case "box": return x >= s.x && x < s.x + s.w && y >= s.y && y < s.y + s.h;
    case "circle": return Math.hypot(x - s.x, y - s.y) < s.r;
    case "capsule": return toSegment(x, y, s.ax, s.ay, s.bx, s.by) < s.r;
  }
}

// ---------- The grid ----------
const CELL = 16;
const grids = new WeakMap<readonly Shape[], Map<number, Shape[]>>();
const key = (cx: number, cy: number) => cx * 65536 + cy;

function gridOf(shapes: readonly Shape[]): Map<number, Shape[]> {
  let grid = grids.get(shapes);
  if (grid) return grid;
  grid = new Map();
  for (const s of shapes) {
    const b = boundsOf(s);
    for (let cy = Math.floor(b.y0 / CELL); cy <= Math.floor(b.y1 / CELL); cy++)
      for (let cx = Math.floor(b.x0 / CELL); cx <= Math.floor(b.x1 / CELL); cx++) {
        const k = key(cx, cy), list = grid.get(k);
        if (list) list.push(s); else grid.set(k, [s]);
      }
  }
  grids.set(shapes, grid);
  return grid;
}

/** Does any of the shapes overlap the box? */
export function anyOverlaps(shapes: readonly Shape[], b: Bounds): boolean {
  if (!shapes.length) return false;
  const grid = gridOf(shapes);
  for (let cy = Math.floor(b.y0 / CELL); cy <= Math.floor(b.y1 / CELL); cy++)
    for (let cx = Math.floor(b.x0 / CELL); cx <= Math.floor(b.x1 / CELL); cx++)
      if (grid.get(key(cx, cy))?.some(s => overlapsBox(s, b))) return true;
  return false;
}

/** Is the point inside any of the shapes? */
export function anyContains(shapes: readonly Shape[], x: number, y: number): boolean {
  return !!shapes.length && !!gridOf(shapes).get(key(Math.floor(x / CELL), Math.floor(y / CELL)))?.some(s => contains(s, x, y));
}
