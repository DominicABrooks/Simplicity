// A boss's arena: where each standing stone (Cinder's, burnt) or pillar of ice (Rime's) round its ring stands, shared
// by its solids (src/world/solids.ts) and its look (src/render/wild.ts, src/render/hollow.ts).
import { T } from "../data/world.ts";
import type { Prop } from "./area.ts";

type Arena = Pick<Extract<Prop, { kind: "arena" | "rimeStage" }>, "x" | "y" | "radius" | "pillars" | "gap">;

/** Each pillar's centre, in tiles, round the ring from the north, clockwise, and how far round it is (0 north, 0.5 south). */
export function arenaPlan(p: Arena): { x: number; z: number; i: number; round: number }[] {
  const cx = p.x / T, cz = p.y / T;
  return Array.from({ length: p.pillars }, (_, i) => {
    const a = -Math.PI / 2 + (i / p.pillars) * Math.PI * 2;
    return { x: cx + Math.cos(a) * p.radius, z: cz + Math.sin(a) * p.radius, i, round: i / p.pillars };
  }).filter(s => s.i !== p.gap);
}

/** How wide an arena pillar is (tiles), for its solid. */
export const ARENA_PILLAR_R = 0.32;
