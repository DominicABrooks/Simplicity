// The Ringstone Pendant (src/data/undercroft.ts): a chip of the ring under St Mary's, warm the way the old stones are.
// Worn, it holds him up once when a blow would fell him, leaving him a heart; touching an old stone warms it again,
// once he's stepped away from where it caught him (or standing on a stone he'd never fall). A new run forgets it.
import { UNDERCROFT, UNDERCROFT_SAYS } from "../data/undercroft.ts";
import { T } from "../data/world.ts";
import { toast, type Game } from "./game.ts";
import { sound } from "./sfx.ts";

/** How far (px) he must go from where it caught him before a stone will warm it. */
const AWAY = 3 * T;

/** Per game: is it cold, where it caught him, and has he stepped away from there since. */
interface Pendant { cold: boolean; at: { x: number; y: number }; away: boolean }
const spent = new WeakMap<Game, Pendant>();
function state(g: Game): Pendant {
  let s = spent.get(g);
  if (!s) {
    const fresh: Pendant = { cold: false, at: { x: 0, y: 0 }, away: true };
    spent.set(g, s = fresh);
    g.events.on("reset", () => { fresh.cold = false; fresh.away = true; });
    g.events.on("area", () => { fresh.away = true; });     // gone somewhere else: he's away from where it caught him
  }
  return s;
}

/** Is he wearing it? */
export const wearingPendant = (g: Game): boolean => g.inventory.equip.amulet?.name === UNDERCROFT.reward.name;

/** Is it warm, ready to hold him up? */
export const pendantWarm = (g: Game): boolean => !state(g).cold;

/** A blow has just felled him: if he's wearing it and it's warm, it holds him up with a heart left, and goes cold. True if it did. */
export function pendantCatches(g: Game): boolean {
  const s = state(g), health = g.world.need(g.player, "health");
  if (s.cold || health.hp > 0 || !wearingPendant(g)) return false;
  const p = g.world.need(g.player, "transform");
  Object.assign(s, { cold: true, at: { x: p.x, y: p.y }, away: false });
  health.hp = 1;
  g.fx.push({ type: "burst", x: p.x, y: p.y, palette: "frost" });
  g.fx.push({ type: "toll", x: p.x, y: p.y, radius: 30 });
  sound(g, "toll");
  toast(g, UNDERCROFT_SAYS.catch, true);
  return true;
}

/** Every frame: once it's gone cold, has he stepped away from where it caught him? */
export function pendantSystem(g: Game): void {
  const s = state(g), p = g.world.get(g.player, "transform");
  if (s.cold && !s.away && p && Math.hypot(p.x - s.at.x, p.y - s.at.y) > AWAY) s.away = true;
}

/** He's at an old stone: the pendant, if it went cold and he's been away from where it did, is warm again. */
export function warmPendant(g: Game): void {
  const s = state(g);
  if (!s.cold || !s.away) return;
  s.cold = false;
  if (wearingPendant(g)) toast(g, UNDERCROFT_SAYS.rewarm);
}
