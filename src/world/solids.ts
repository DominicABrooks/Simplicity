// What each prop is to collision: its solid shapes at foot level, in game pixels, made from the same
// ground plans the renderer builds from (plans.ts). An area adds its props' shapes to its map's
// solids; Wall tiles under buildings mark the map (for the map view, spawning and reachability) but
// don't block movement themselves, so you walk right up to a round tower or a diagonal wall, and
// under an arcade.
import { T, type Rect } from "../data/world.ts";
import type { Facing, Prop } from "./area.ts";
import {
  FACING_YAW, TOWER_FLARE, barbicanPlan, cathedralPlan, churchPlan, cloisterPlan, hallBody, houseBody, keepPlan, local, stallBody, wallPlan, type XZ,
} from "./plans.ts";
import type { Shape } from "./shapes.ts";

/** A box `w` by `d` world units centred on (x, z). */
const box = (x: number, z: number, w: number, d: number): Shape => ({ kind: "box", x: (x - w / 2) * T, y: (z - d / 2) * T, w: w * T, h: d * T });
const circle = (x: number, z: number, r: number): Shape => ({ kind: "circle", x: x * T, y: z * T, r: r * T });
const capsule = (a: XZ, b: XZ, r: number): Shape => ({ kind: "capsule", ax: a.x * T, ay: a.z * T, bx: b.x * T, by: b.z * T, r: r * T });
const rectCentre = (r: Rect): XZ => ({ x: (r.x + r.w / 2) / T, z: (r.y + r.h / 2) / T });
/** A rect shrunk by `by` world units on every side. */
const inset = (r: Rect, by: number): Shape => ({ kind: "box", x: r.x + by * T, y: r.y + by * T, w: r.w - 2 * by * T, h: r.h - 2 * by * T });

/** A box given in a thing's own frame (built facing south), placed at `at` and turned to `facing`. */
function localBox(at: XZ, facing: Facing, lx: number, lz: number, lw: number, ld: number): Shape {
  const c = local(at, FACING_YAW[facing], lx, lz), sideways = facing === "east" || facing === "west";
  return sideways ? box(c.x, c.z, ld, lw) : box(c.x, c.z, lw, ld);
}

export function propSolids(p: Prop): Shape[] {
  switch (p.kind) {
    case "curtainWall": {
      const plan = wallPlan(p), r = p.tower.radius * TOWER_FLARE;
      return [
        ...plan.runs.map(run => capsule(run.a, run.b, p.thickness / 2)),
        ...plan.towers.map(q => circle(q.x, q.z, r)),
        ...plan.gates.flatMap(g => g.towers.map(q => circle(q.x, q.z, g.towerR * TOWER_FLARE))),
      ];
    }
    case "house": { const h = houseBody(p.rect); return [box(h.x, h.z, h.w, h.d)]; }
    case "hall": {
      const h = hallBody(p.rect);
      if (!p.arcade) return [box(h.x, h.z, h.w, h.d)];
      return arcadePillars(h.w, h.d).map(([px, pz]) => circle(h.x + px, h.z + pz, 0.22));   // you walk under an arcade, between its pillars
    }
    case "church": {
      const c = churchPlan(p);
      return [
        ...(c.towerS ? [box(c.x + c.west + c.towerS / 2, c.z, c.towerS, c.towerS)] : []),
        box(c.x + (c.naveX0 + c.chancelX0) / 2, c.z, c.chancelX0 - c.naveX0, c.naveD),
        box(c.x + (c.chancelX0 + c.W / 2) / 2, c.z, c.W / 2 - c.chancelX0, c.chancelD),
      ];
    }
    case "cathedral": {
      const c = cathedralPlan(p.rect), half = c.body + c.buttress;
      return [
        box(c.x + (c.west + c.east) / 2, c.z, c.east - c.west, half * 2),                    // nave, aisles, choir and buttresses
        box(c.x + c.west + c.towerS / 2, c.z, c.towerS, (c.naveW / 2 + c.towerS) * 2),         // the west towers
        box(c.x + c.crossX, c.z, c.transW, c.D - 0.4),                                        // the transept
        circle(c.x + c.east, c.z, c.apseR + 0.6),                                              // the east end
      ];
    }
    case "cloister": return cloisterWalls(p);
    case "chapterHouse": return [circle(p.x / T, p.y / T, p.radius * 1.05)];
    case "graves": return gravePlan(p.rect).map(g => box(g.x, g.z, 0.5, 0.25));
    case "cross": return [circle(p.x / T, p.y / T, 1.1)];
    case "dovecote": return [circle(p.x / T, p.y / T, 1.15)];
    case "keep": {
      const k = keepPlan(p), z = k.z + k.back;
      return [box(k.x, z, k.baseW + k.boulders, k.baseD + k.boulders), box(k.x, z + k.baseD / 2 + k.stairD / 2, k.stairW, k.stairD)];
    }
    case "barbican": {
      const b = barbicanPlan(p), at = rectCentre(p.rect), yaw = FACING_YAW[p.facing];
      return [
        ...[-1, 1].map(s => localBox(at, p.facing, s * (b.gap / 2 + b.side / 2), -b.towerR * 0.35, b.side, b.deep - b.towerR * 0.7)),
        ...[-1, 1].map(s => { const t = local(at, yaw, s * b.towerX, b.towerZ); return circle(t.x, t.z, b.towerR * TOWER_FLARE); }),
      ];
    }
    case "stairs": return [inset(p.rect, 0.05)];
    case "stable": case "watermill": case "grandstand": return [inset(p.rect, 0.15)];
    case "fountain": return [circle(p.x / T, p.y / T, p.radius * TOWER_FLARE)];
    case "stall": { const s = stallBody(p.rect); return [box(s.x, s.z, s.w, s.d)]; }
    case "stock": return [circle(p.x / T, p.y / T, 0.45)];
    case "standard": return [box(p.x / T, p.y / T, 0.4, 0.4)];
    case "guard": case "brazier": case "dummy": return [circle(p.x / T, p.y / T, 0.3)];
    case "target": return [box(p.x / T, p.y / T, 0.95, 0.95)];
    case "well": return [circle(p.x / T, p.y / T, 0.72)];
    case "rack": case "smithy": case "trebuchet": case "cart": case "trough": return [inset(p.rect, 0.15)];
    case "horse": { const c = rectCentre(p.rect); return [p.rect.w >= p.rect.h ? box(c.x, c.z, 1.3, 0.5) : box(c.x, c.z, 0.5, 1.3)]; }
    case "windmill": return [circle(p.x / T, p.y / T, 1.3)];
    case "crane": return [circle(p.x / T, p.y / T, 0.9)];
    case "pavilion": return [circle(p.x / T, p.y / T, 1.15)];
    case "fence": return p.points.slice(1).map((q, i) => capsule({ x: p.points[i]!.x / T, z: p.points[i]!.y / T }, { x: q.x / T, z: q.y / T }, 0.12));
    case "bunting": return p.masts ? [circle(p.from.x / T, p.from.y / T, 0.08), circle(p.to.x / T, p.to.y / T, 0.08)] : [];
    // Flat, overhead, or on the water (which stops you anyway).
    case "camp": case "cave": case "bridge": case "stoneBridge": case "drawbridge": case "plaza": case "torch": case "field": case "boat": return [];
  }
}

/** A cloister's outer wall (with a doorway on its door side) and the arcade's low wall round the garth (open mid-side). */
function cloisterWalls(p: Extract<Prop, { kind: "cloister" }>): Shape[] {
  const c = cloisterPlan(p.rect), out: Shape[] = [], hw = c.W / 2, hd = c.D / 2, iw = hw - c.walk - c.wall, id = hd - c.walk - c.wall;
  const sides = [["north", 0, -1], ["south", 0, 1], ["west", -1, 0], ["east", 1, 0]] as const;
  // A wall `len` long along a side, centred at `at`, leaving a gap `gap` wide in its middle.
  const wall = (at: XZ, horizontal: boolean, len: number, thick: number, gap: number) => {
    if (!gap) { out.push(horizontal ? box(at.x, at.z, len, thick) : box(at.x, at.z, thick, len)); return; }
    const part = (len - gap) / 2;
    for (const s of [-1, 1]) out.push(horizontal ? box(at.x + s * (gap / 2 + part / 2), at.z, part, thick) : box(at.x, at.z + s * (gap / 2 + part / 2), thick, part));
  };
  for (const [side, sx, sz] of sides) {
    const horizontal = sz !== 0;
    wall({ x: c.x + sx * (hw - c.wall / 2), z: c.z + sz * (hd - c.wall / 2) }, horizontal, horizontal ? c.W : c.D, c.wall, side === p.door ? c.doorW : 0);
    wall({ x: c.x + sx * iw, z: c.z + sz * id }, horizontal, (horizontal ? iw : id) * 2, 0.4, 2);
  }
  return out;
}

/** Where an arcade's pillars stand, from its middle: round its edge and down its middle, about 2 apart. */
export function arcadePillars(w: number, d: number): [number, number][] {
  const out: [number, number][] = [], nx = Math.max(2, Math.round(w / 2.2)), nz = Math.max(1, Math.round(d / 2.2));
  for (let i = 0; i <= nx; i++) for (let j = 0; j <= nz; j++) out.push([-w / 2 + 0.3 + (i * (w - 0.6)) / nx, -d / 2 + 0.3 + (j * (d - 0.6)) / nz]);
  return out;
}

/** Headstones in a churchyard: rows across the rect (world units), with the odd gap. */
export function gravePlan(rect: Rect): { x: number; z: number; kind: number }[] {
  const out: { x: number; z: number; kind: number }[] = [];
  const x0 = rect.x / T + 0.8, z0 = rect.y / T + 0.8, x1 = (rect.x + rect.w) / T - 0.8, z1 = (rect.y + rect.h) / T - 0.8;
  for (let z = z0, row = 0; z <= z1; z += 1.6, row++) for (let x = x0 + (row % 2) * 0.6; x <= x1; x += 1.3) {
    const h = Math.sin(x * 12.9898 + z * 78.233) * 43758.5453, k = h - Math.floor(h);
    if (k < 0.18) continue;
    out.push({ x, z, kind: Math.floor(k * 100) % 3 });
  }
  return out;
}
