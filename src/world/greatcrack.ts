// The great crack's shape (src/areas/rift.ts): a jagged spine from end to end, widest in the middle and closing to
// nothing at the ends. Shared by what blocks the way (src/world/solids.ts) and what's drawn (src/render/wild.ts), so
// you stop at the edge you can see. Tiles throughout.
import { T } from "../data/world.ts";
import type { Prop } from "./area.ts";

type GreatCrack = Extract<Prop, { kind: "greatCrack" }>;
export interface XZ { x: number; z: number }
/** One stretch of it: from `a` to `b` along the spine, `r` either side of it. */
export interface Stretch { a: XZ; b: XZ; r: number }

/** How many stretches a tile of its length is cut into. */
const PER_TILE = 1.2;

/** Its spine's points, end to end, and how far it gapes either side at each. */
export function greatCrackSpine(p: GreatCrack): { at: XZ; half: number }[] {
  const n = Math.max(6, Math.round(p.len * PER_TILE)), cx = p.x / T, cz = p.y / T, c = Math.cos(p.angle), s = Math.sin(p.angle);
  return Array.from({ length: n + 1 }, (_, i) => {
    const k = i / n, along = (k - 0.5) * p.len;
    const off = i === 0 || i === n ? 0 : 0.45 * Math.sin(i * 2.3 + 0.7) + 0.25 * Math.sin(i * 5.1);   // the jag, side to side
    const half = (p.wide / 2) * Math.pow(Math.sin(k * Math.PI), 0.6) * (0.85 + 0.15 * Math.sin(i * 3.7));
    return { at: { x: cx + along * c - off * s, z: cz + along * s + off * c }, half };
  });
}

/** What blocks the way: each stretch of the spine, as wide as the narrower end of it. */
export function greatCrackPlan(p: GreatCrack): Stretch[] {
  const spine = greatCrackSpine(p);
  return spine.slice(1).map((q, i) => ({ a: spine[i]!.at, b: q.at, r: Math.max(0.15, Math.min(spine[i]!.half, q.half)) }));
}
