// Where a craft is worked out in the open, shared by the townsfolk who work there (src/game/townsfolk.ts)
// and the scenery drawn for it (src/render/castle.ts), so the smith and the anvil meet.
import { T, type Rect } from "../data/world.ts";
import type { TileXY } from "./walkways.ts";

/**
 * A smithy's anvil and where the smith stands to work it. The anvil stands out in front of the smithy (it faces
 * south), on its own stump just in the yard; the smith stands on the tile to its west, hammering east, so he's
 * side-on to the camera with the anvil in plain view. `x`, `y`: the anvil's middle, in tiles.
 */
export function anvilOf(rect: Rect): { stand: TileXY; x: number; y: number } {
  const tx = Math.floor((rect.x + rect.w / 2) / T), ty = Math.floor((rect.y + rect.h) / T);
  return { stand: [tx - 1, ty], x: tx + 0.15, y: ty + 0.45 };
}

/** Who works an anvil: smiths, armourers and farriers, not their apprentices or helpers (they fetch and carry). */
export const ANVIL_WORK = /^(master )?(armourer|blacksmith|smith|farrier)$/i;

/** Who plays to the market crowd at the fountain. */
export const MUSIC_WORK = /^(minstrel|bard)\b/i;
