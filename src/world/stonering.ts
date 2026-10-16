// The ring of old stones under St Mary's (see docs/CURIOSITIES.md): where each stone stands, shared by its
// solids (src/world/solids.ts), its look (src/render/undercroft.ts) and the game (src/game/undercroft.ts).
import { T } from "../data/world.ts";
import type { Prop } from "./area.ts";

type Ring = Extract<Prop, { kind: "stoneRing" }>;

/** Each stone's centre, in tiles, round the ring from the north, clockwise; `socket` is the gap's. */
export function ringPlan(p: Ring): { stones: { x: number; z: number; i: number }[]; socket: { x: number; z: number } } {
  const cx = p.x / T, cz = p.y / T, at = (i: number) => {
    const a = -Math.PI / 2 + (i / p.stones) * Math.PI * 2;
    return { x: cx + Math.cos(a) * p.radius, z: cz + Math.sin(a) * p.radius, i };
  };
  const all = Array.from({ length: p.stones }, (_, i) => at(i));
  return { stones: all.filter(s => s.i !== p.gap), socket: all[p.gap]! };
}

/** How wide a ring stone is (tiles), for its solid. */
export const RING_STONE_R = 0.3;
