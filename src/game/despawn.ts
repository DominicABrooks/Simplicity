import { LOOT_DESPAWN } from "../data/items.ts";

/**
 * Whether something about to despawn is shown this instant: solid until the last few seconds,
 * then blinking, faster and faster as time runs out.
 */
export function blinkVisible(left: number): boolean {
  if (left > LOOT_DESPAWN.blinkFor) return true;
  const rate = 4 + 8 * (1 - left / LOOT_DESPAWN.blinkFor);   // blinks per second: 4 -> 12
  return Math.floor(left * rate * 2) % 2 === 0;
}
