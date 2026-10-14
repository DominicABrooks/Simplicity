// What each prop is to collision: its solid shapes at foot level, in game pixels, made from the same
// ground plans the renderer builds from (plans.ts). An area adds its props' shapes to its map's
// solids; Wall tiles under buildings mark the map (for the map view, spawning and reachability) but
// don't block movement themselves, so you walk right up to a round tower or a diagonal wall.
import { T } from "../data/world.ts";
import type { Prop } from "./area.ts";
import { TOWER_FLARE, WALL_D, benchLength, cathedralPlan, houseBody, keepPlan, stallBody, wallPlan, type XZ } from "./plans.ts";
import type { Shape } from "./shapes.ts";

/** A box `w` by `d` world units centred on (x, z). */
const box = (x: number, z: number, w: number, d: number): Shape => ({ kind: "box", x: (x - w / 2) * T, y: (z - d / 2) * T, w: w * T, h: d * T });
const circle = (x: number, z: number, r: number): Shape => ({ kind: "circle", x: x * T, y: z * T, r: r * T });
const capsule = (a: XZ, b: XZ, r: number): Shape => ({ kind: "capsule", ax: a.x * T, ay: a.z * T, bx: b.x * T, by: b.z * T, r: r * T });

export function propSolids(p: Prop): Shape[] {
  switch (p.kind) {
    case "curtainWall": {
      const plan = wallPlan(p), r = p.tower.radius * TOWER_FLARE;
      return [
        ...plan.runs.map(([a, b]) => capsule(a, b, WALL_D / 2)),
        ...plan.towers.map(q => circle(q.x, q.z, r)),
        ...plan.gate.towers.map(q => circle(q.x, q.z, plan.gate.towerR * TOWER_FLARE)),
      ];
    }
    case "house": { const h = houseBody(p.rect); return [box(h.x, h.z, h.w, h.d)]; }
    case "keep": {
      const k = keepPlan(p), z = k.z + k.back;
      return [box(k.x, z, k.baseW + k.boulders, k.baseD + k.boulders), box(k.x, z + k.baseD / 2 + k.stairD / 2, k.stairW, k.stairD)];
    }
    case "cathedral": {
      const c = cathedralPlan(p.rect);
      return [
        box(c.x + (c.west + c.east) / 2, c.z, c.east - c.west, c.naveD + c.buttress * 2),   // nave and buttresses
        circle(c.x + c.east, c.z, c.naveD / 2),                                             // the apse
        box(c.x + c.crossX, c.z, c.transW, c.transD),                                       // the transept
        box(c.x + c.towerX, c.z, c.towerS, c.towerS),                                       // the bell tower
      ];
    }
    case "fountain": return [circle(p.x / T, p.y / T, p.radius * TOWER_FLARE)];
    case "stall": { const s = stallBody(p.rect); return [box(s.x, s.z, s.w, s.d)]; }
    case "statue": return [box(p.x / T, p.y / T, 0.96, 0.96)];
    case "planter": return [box(p.x / T, p.y / T, 1.0, 1.0)];
    case "bench": {
      const len = benchLength(p.rect), x = (p.rect.x + p.rect.w / 2) / T, z = (p.rect.y + p.rect.h / 2) / T;
      return [p.rect.w >= p.rect.h ? box(x, z, len, 0.45) : box(x, z, 0.45, len)];
    }
    case "stock": return [circle(p.x / T, p.y / T, 0.45)];
    case "lamp": return [circle(p.x / T, p.y / T, 0.12)];
    case "standard": return [box(p.x / T, p.y / T, 0.4, 0.4)];
    // The camp's tent and fire are in its area's map already; the rest are flat or overhead.
    case "camp": case "cave": case "bridge": case "bunting": case "plaza": return [];
  }
}
