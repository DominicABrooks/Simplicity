// Ground plans of the town's buildings, in world units (one per tile): where each wall, tower, hall
// and body stands at ground level. The renderer (src/render/*) builds on these and collision
// (solids.ts) is made from them, so what you see is what you bump into.
import { T, type Rect } from "../data/world.ts";
import type { Facing, Prop } from "./area.ts";

type PropOf<K extends Prop["kind"]> = Extract<Prop, { kind: K }>;
export interface XZ { x: number; z: number }

const centre = (r: Rect): XZ => ({ x: (r.x + r.w / 2) / T, z: (r.y + r.h / 2) / T });
/** The turn (about y, as three.js turns) that points a thing built facing south (+z) toward `facing`. */
export const FACING_YAW: Record<Facing, number> = { south: 0, north: Math.PI, east: Math.PI / 2, west: -Math.PI / 2 };
/** A facing as a direction on the ground (x east, z south). */
export const FACING_DIR: Record<Facing, XZ> = { east: { x: 1, z: 0 }, south: { x: 0, z: 1 }, west: { x: -1, z: 0 }, north: { x: 0, z: -1 } };

// ---------- Curtain walls ----------
/** Round towers are a little wider at the foot than the top. */
export const TOWER_FLARE = 1.06;

export interface WallRun {
  a: XZ;
  b: XZ;
  /** Which way is out (a unit vector square to the run). */
  out: XZ;
}
export interface Gatehouse {
  at: XZ;
  /** Its turn: local +x along the wall, local +z outward. */
  yaw: number;
  /** The gap between its towers. */
  gapW: number;
  towers: XZ[];
  towerR: number;
}
export interface WallPlan {
  towers: XZ[];
  runs: WallRun[];
  gates: Gatehouse[];
}

/** Turn local (x along, z out) into the world, for a turn of `yaw` about `at`. */
export const local = (at: XZ, yaw: number, x: number, z: number): XZ =>
  ({ x: at.x + x * Math.cos(yaw) + z * Math.sin(yaw), z: at.z - x * Math.sin(yaw) + z * Math.cos(yaw) });

export function wallPlan(p: PropOf<"curtainWall">): WallPlan {
  const pts = p.points.map(q => ({ x: q.x / T, z: q.y / T })), n = p.closed ? pts.length : pts.length - 1;
  const middle = { x: pts.reduce((s, q) => s + q.x, 0) / pts.length, z: pts.reduce((s, q) => s + q.z, 0) / pts.length };
  const runs: WallRun[] = [], gates: Gatehouse[] = [];
  for (let i = 0; i < n; i++) {
    const a = pts[i]!, b = pts[(i + 1) % pts.length]!, len = Math.hypot(b.x - a.x, b.z - a.z);
    const dx = (b.x - a.x) / len, dz = (b.z - a.z) / len;
    const ref = p.closed || !p.inside ? middle : { x: p.inside.x / T, z: p.inside.y / T };
    const away = { x: (a.x + b.x) / 2 - ref.x, z: (a.z + b.z) / 2 - ref.z };
    const out = -dz * away.x + dx * away.z >= 0 ? { x: -dz, z: dx } : { x: dz, z: -dx };
    // The gates on this run, by where they fall along it; the wall stops either side of each gatehouse.
    const cuts = p.gates.map(g => ({ g, s: (g.at.x / T - a.x) * dx + (g.at.y / T - a.z) * dz, off: Math.abs((g.at.x / T - a.x) * -dz + (g.at.y / T - a.z) * dx) }))
      .filter(c => c.off < 1.5 && c.s > 0 && c.s < len).sort((u, v) => u.s - v.s);
    const along = (s: number) => ({ x: a.x + dx * s, z: a.z + dz * s });
    let from = 0;
    for (const { g, s } of cuts) {
      const gapW = g.width / T + 2 * p.tower.radius * TOWER_FLARE + 0.2;   // the gatehouse's towers stand clear of the way through
      runs.push({ a: along(from), b: along(s - gapW / 2), out });
      from = s + gapW / 2;
      let yaw = Math.atan2(-dz, dx);
      if (Math.sin(yaw) * out.x + Math.cos(yaw) * out.z < 0) yaw += Math.PI;   // local +z must point out
      const at = along(s);
      gates.push({ at, yaw, gapW, towers: [local(at, yaw, -gapW / 2, p.thickness * 0.3), local(at, yaw, gapW / 2, p.thickness * 0.3)], towerR: p.tower.radius });
    }
    runs.push({ a: along(from), b: b, out });
  }
  return { towers: pts, runs: runs.filter(r => Math.hypot(r.b.x - r.a.x, r.b.z - r.a.z) >= 0.2), gates };
}

// ---------- The cathedral ----------
/**
 * West to east along x: twin towers either side of the west front, the nave (a tall middle vessel
 * between lower aisles), the crossing with its tower and the transept reaching the rect's full depth,
 * the choir, and the rounded east end. Local coordinates from the rect's middle.
 */
export function cathedralPlan(rect: Rect) {
  const W = rect.w / T, D = rect.h / T;
  const naveW = Math.round(D * 0.3), aisleW = Math.round(D * 0.17), body = naveW / 2 + aisleW;
  const towerS = aisleW + 2, west = -W / 2, transW = naveW + 2, crossX = west + W * 0.58;
  const apseR = body, east = W / 2 - apseR;
  return {
    ...centre(rect), W, D, naveW, aisleW, body, towerS, west, east, transW, crossX, apseR,
    /** Heights: aisles, the nave's vessel, the west towers and the crossing tower (each before its spire). */
    aisleH: 7, naveH: 13, towerH: 24, crossH: 21,
    /** How far the flying buttresses' piers stand out beyond the aisles. */
    buttress: 1.4,
  };
}

// ---------- Churches ----------
/** West to east: a square tower at the west end (unless it has a bell-cote instead), the nave, then a narrower, lower chancel. */
export function churchPlan(p: PropOf<"church">) {
  const rect = p.rect, W = rect.w / T, D = rect.h / T, towerS = p.tower === "bellcote" ? 0 : Math.min(D - 0.6, 4.2), chancelL = Math.max(3, W * 0.28);
  const west = -W / 2, naveX0 = west + Math.max(0, towerS - 0.4), chancelX0 = W / 2 - chancelL;
  return { ...centre(rect), W, D, towerS, west, naveX0, chancelX0, naveD: D - 0.6, chancelD: (D - 0.6) * 0.72, naveH: 5.5, chancelH: 4.4 };
}

// ---------- The keep ----------
/** The crag (stone-faced, ringed with boulders) set back in the footprint, and the stair down its front. */
export function keepPlan(p: PropOf<"keep">) {
  const w = p.rect.w / T - 2.4, d = p.rect.h / T - 3.4, back = -0.6;
  const baseW = w + 1.4, baseD = d + 1.4;
  return { ...centre(p.rect), w, d, back, baseW, baseD, stairW: 3.2, stairD: Math.max(1.3, p.plinth * 0.9), boulders: 0.7 };
}

// ---------- Gates and passages ----------
/**
 * A barbican, in local coordinates (passage along z, open toward +z): side walls either side of a
 * 3-wide passage running its whole depth, and a round tower at each front corner.
 */
export function barbicanPlan(p: PropOf<"barbican">) {
  const across = p.facing === "north" || p.facing === "south" ? p.rect.w / T : p.rect.h / T;
  const deep = p.facing === "north" || p.facing === "south" ? p.rect.h / T : p.rect.w / T;
  const gap = p.gap ?? 3, side = (across - gap) / 2, towerR = Math.min(1.8 + (gap - 3) * 0.3, side * 0.62);   // a wider gate, bigger towers
  return { ...centre(p.rect), across, deep, gap, side, towerR, towerX: gap / 2 + towerR * 1.12, towerZ: deep / 2 - towerR * 0.7 };
}

/** A cloister: a covered walk `walk` wide inside its outer wall, round an open garth. */
export function cloisterPlan(rect: Rect) {
  return { ...centre(rect), W: rect.w / T, D: rect.h / T, walk: 2, wall: 0.5, doorW: 2 };
}

// ---------- Smaller things ----------
/** A house's ground floor (upper floors jetty out over the street, above your head). */
export const houseBody = (r: Rect) => ({ ...centre(r), w: r.w / T - 0.22, d: r.h / T - 0.22 });
/** A hall's walls. */
export const hallBody = (r: Rect) => ({ ...centre(r), w: r.w / T - 0.3, d: r.h / T - 0.3 });
/** A stall's footprint, posts to posts. */
export const stallBody = (r: Rect) => ({ ...centre(r), w: r.w / T - 0.2, d: r.h / T - 0.15 });
