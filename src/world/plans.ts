// Ground plans of the town's buildings, in world units (one per tile): where each wall, tower, hall
// and body stands at ground level. The renderer (src/render/town.ts, market.ts) builds on these and
// collision (solids.ts) is made from them, so what you see is what you bump into.
import { T, type Rect } from "../data/world.ts";
import type { Prop } from "./area.ts";

type PropOf<K extends Prop["kind"]> = Extract<Prop, { kind: K }>;
export interface XZ { x: number; z: number }

const centre = (r: Rect): XZ => ({ x: (r.x + r.w / 2) / T, z: (r.y + r.h / 2) / T });

// ---------- Curtain walls ----------
/** How thick a run of town wall is. */
export const WALL_D = 0.9;
/** Round towers are a little wider at the foot than the top. */
export const TOWER_FLARE = 1.06;

export interface WallPlan {
  /** The polygon's middle (the gatehouse faces away from it). */
  middle: XZ;
  /** The corners, each with a round tower. */
  towers: XZ[];
  /** The runs of wall between towers, the gate's edge split either side of the gatehouse. */
  runs: [XZ, XZ][];
  /** The gatehouse: where it stands, its turn (local +z outward), the gap you walk through, and its two towers. */
  gate: { at: XZ; yaw: number; gapW: number; towers: XZ[]; towerR: number };
}

export function wallPlan(p: PropOf<"curtainWall">): WallPlan {
  const towers = p.points.map(q => ({ x: q.x / T, z: q.y / T }));
  const middle = { x: towers.reduce((s, q) => s + q.x, 0) / towers.length, z: towers.reduce((s, q) => s + q.z, 0) / towers.length };
  const runs: [XZ, XZ][] = [];
  let gate: WallPlan["gate"] | null = null;
  towers.forEach((a, i) => {
    const b = towers[(i + 1) % towers.length]!;
    if (i !== p.gate.edge) { runs.push([a, b]); return; }
    const len = Math.hypot(b.x - a.x, b.z - a.z), dx = (b.x - a.x) / len, dz = (b.z - a.z) / len;
    const s0 = ((p.gate.x / T - a.x) / (b.x - a.x)) * len, half = p.gate.width / T / 2 + 1;
    const along = (s: number) => ({ x: a.x + dx * s, z: a.z + dz * s });
    runs.push([a, along(s0 - half)], [along(s0 + half), b]);
    // Local +x runs along the edge; turn so local +z points outward.
    const at = along(s0), out = { x: -dz, z: dx };
    let yaw = Math.atan2(-dz, dx);
    if (out.x * (at.x - middle.x) + out.z * (at.z - middle.z) < 0) yaw += Math.PI;
    const local = (x: number, z: number) => ({ x: at.x + x * Math.cos(yaw) + z * Math.sin(yaw), z: at.z - x * Math.sin(yaw) + z * Math.cos(yaw) });
    const gapW = half * 2;
    gate = { at, yaw, gapW, towers: [local(-gapW / 2, 0.5), local(gapW / 2, 0.5)], towerR: p.tower.radius * 0.92 };
  });
  return { middle, towers, runs: runs.filter(([a, b]) => Math.hypot(b.x - a.x, b.z - a.z) >= 0.2), gate: gate! };
}

// ---------- The cathedral ----------
/** Along x from the middle: the bell tower at the west end, the nave, the transept crossing, the apse east. */
export function cathedralPlan(rect: Rect) {
  const W = rect.w / T, D = rect.h / T, naveD = Math.min(4.4, D - 2.6);
  const towerS = 3.0, west = -W / 2 + towerS, east = W / 2 - 2.4, naveL = east - west;
  const naveX = (west + east) / 2, crossX = naveX + naveL * 0.12;
  return {
    ...centre(rect), W, D, naveD, naveL, naveX, west, east, towerS, crossX,
    transW: 2.8, transD: D - 0.4, towerX: -W / 2 + towerS / 2,
    /** How far the buttresses stand out from the nave's walls. */
    buttress: 0.68,
  };
}

// ---------- The keep ----------
/** The crag (stone-faced, ringed with boulders) set back in the footprint, and the stair down its front. */
export function keepPlan(p: PropOf<"keep">) {
  const w = p.rect.w / T - 2.4, d = p.rect.h / T - 3.4, back = -0.6;
  const baseW = w + 1.4, baseD = d + 1.4;
  return { ...centre(p.rect), w, d, back, baseW, baseD, stairW: 2.6, stairD: 1.3, boulders: 0.25 + 0.45 };
}

// ---------- Smaller things ----------
/** A house's ground floor (upper floors jetty out over the street, above your head). */
export const houseBody = (r: Rect) => ({ ...centre(r), w: r.w / T - 0.2, d: r.h / T - 0.25 });
/** A stall's footprint, posts to posts. */
export const stallBody = (r: Rect) => ({ ...centre(r), w: r.w / T - 0.2, d: r.h / T - 0.15 });
/** A bench: its length, along the rect's long side. */
export const benchLength = (r: Rect) => Math.max(r.w, r.h) / T - 0.4;
