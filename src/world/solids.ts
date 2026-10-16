// What each prop is to collision: its solid shapes at foot level, in game pixels, made from the same
// ground plans the renderer builds from (plans.ts). An area adds its props' shapes to its map's
// solids; Wall tiles under buildings mark the map (for the map view, spawning and reachability) but
// don't block movement themselves, so you walk right up to a round tower or a diagonal wall, and
// under an arcade.
import { T, type Rect } from "../data/world.ts";
import type { Facing, Prop } from "./area.ts";
import {
  FACING_YAW, FURNITURE, TOWER_FLARE, roomWalls, barbicanPlan, cathedralPlan, churchPlan, cloisterPlan, hallBody, houseBody, keepPlan, local, stallBody, wallPlan, type XZ,
} from "./plans.ts";
import type { Shape } from "./shapes.ts";
import { ARENA_PILLAR_R, arenaPlan } from "./arena.ts";
import { greatCrackPlan } from "./greatcrack.ts";
import { RING_STONE_R, ringPlan } from "./stonering.ts";
import { anvilOf } from "./workplaces.ts";

/** How deep a lion's plinth is, along its facing (it's 1.2 across). */
export const LION_PLINTH = 1.5;
/** How thick a street lamp's post is at its foot (its radius). */
export const LAMP_POST = 0.14;

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
    case "graves": return gravePlan(p.rect).map(g => { const [dz, w, d] = GRAVE_FOOT[g.kind]; return box(g.x, g.z + dz, w, d); });
    case "cross": return [circle(p.x / T, p.y / T, 1.1)];
    case "lion": { const d = LION_PLINTH + 0.1; return [p.facing === "north" || p.facing === "south" ? box(p.x / T, p.y / T, 1.3, d) : box(p.x / T, p.y / T, d, 1.3)]; }
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
    case "guard": case "king": case "brazier": case "dummy": return [circle(p.x / T, p.y / T, 0.3)];
    case "target": return [box(p.x / T, p.y / T, 0.95, 0.95)];
    case "well": return [circle(p.x / T, p.y / T, 0.72)];
    case "smithy": { const anvil = anvilOf(p.rect); return [inset(p.rect, 0.15), box(anvil.x, anvil.y, 0.55, 0.45)]; }   // and its anvil, out front
    case "rack": case "trebuchet": case "cart": case "trough": return [inset(p.rect, 0.15)];
    case "horse": { const c = rectCentre(p.rect); return [p.rect.w >= p.rect.h ? box(c.x, c.z, 1.3, 0.5) : box(c.x, c.z, 0.5, 1.3)]; }
    case "windmill": return [circle(p.x / T, p.y / T, 1.3)];
    case "crane": return [circle(p.x / T, p.y / T, 0.9)];
    case "pavilion": return [circle(p.x / T, p.y / T, 1.15)];
    case "fence": return p.points.slice(1).map((q, i) => capsule({ x: p.points[i]!.x / T, z: p.points[i]!.y / T }, { x: q.x / T, z: q.y / T }, 0.12));
    case "bunting": return p.masts ? [circle(p.from.x / T, p.from.y / T, 0.08), circle(p.to.x / T, p.to.y / T, 0.08)] : [];
    // Flat, overhead, or on the water (which stops you anyway).
    case "stoneBridge": {                                    // its parapets, with their posts and pinnacles (the deck is road)
      const c = rectCentre(p.rect), w = p.rect.w / T + 0.6, len = p.rect.h / T + 1.2;
      return [-1, 1].map(s => box(c.x + s * (w / 2 - 0.35), c.z, 0.9, len));
    }
    case "room": return roomWalls(p).map(w => box(w.x, w.z, w.w, w.d));
    case "furniture": {                                      // its footprint, turned with it; a rug is just underfoot
      const [w, d] = FURNITURE[p.item];
      return w ? [localBox({ x: p.x / T, z: p.y / T }, p.facing, 0, 0, w, d)] : [];
    }
    case "lamp": return [circle(p.x / T, p.y / T, LAMP_POST)];
    case "cryptDoor": return [];                           // set into the wall, which is solid already
    case "tomb": return [localBox({ x: p.x / T, z: p.y / T }, p.facing, 0, 0, 0.9, 1.9)];
    case "stoneRing": return ringPlan(p).stones.map(s => circle(s.x, s.z, RING_STONE_R));
    case "arena": case "rimeStage": return arenaPlan(p).map(s => circle(s.x, s.z, ARENA_PILLAR_R));
    case "barricade": {                                      // the stakes, either side of the gate
      const x0 = p.rect.x / T, z = p.rect.y / T + p.rect.h / T / 2, w = p.rect.w / T, gx0 = x0 + p.gate, gx1 = gx0 + p.gateW;
      return [[x0, gx0], [gx1, x0 + w]].filter(([a, b]) => b! - a! > 0.1).map(([a, b]) => box((a! + b!) / 2, z, b! - a!, 0.5));
    }
    case "greatCrack": return greatCrackPlan(p).map(s => capsule(s.a, s.b, s.r));
    case "camp": case "cave": case "bridge": case "drawbridge": case "plaza": case "torch": case "field": case "boat": case "crack": case "boss": case "oldStone": case "fairyRing": return [];
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

/** What marks a grave: a tall headstone, a cross, a small pointed stone, a chest tomb, a wheel cross, or a wooden cross over fresh earth. */
export type GraveKind = 0 | 1 | 2 | 3 | 4 | 5;
/** Each kind's solid footprint: [offset back from the stone (z), width, depth]. A chest tomb covers its grave; the rest stand at its head. */
const GRAVE_FOOT: Record<GraveKind, [number, number, number]> = { 0: [0, 0.5, 0.25], 1: [0, 0.4, 0.3], 2: [0, 0.4, 0.2], 3: [0.35, 0.66, 1.06], 4: [0, 0.4, 0.3], 5: [0, 0.3, 0.15] };
const GRAVE_KINDS: readonly GraveKind[] = [0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 4, 4, 5, 5];

/** Graves in a churchyard: rows across the rect (world units), with the odd gap. */
export function gravePlan(rect: Rect): { x: number; z: number; kind: GraveKind }[] {
  const out: { x: number; z: number; kind: GraveKind }[] = [];
  const x0 = rect.x / T + 0.8, z0 = rect.y / T + 0.8, x1 = (rect.x + rect.w) / T - 0.8, z1 = (rect.y + rect.h) / T - 0.8;
  for (let z = z0, row = 0; z <= z1; z += 1.6, row++) for (let x = x0 + (row % 2) * 0.6; x <= x1; x += 1.3) {
    const h = Math.sin(x * 12.9898 + z * 78.233) * 43758.5453, k = h - Math.floor(h);
    if (k < 0.18) continue;
    out.push({ x, z, kind: GRAVE_KINDS[Math.floor(k * 1000) % GRAVE_KINDS.length]! });
  }
  return out;
}
