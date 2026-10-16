// The deep places behind the Undercroft's little door (src/areas/sealchamber.ts). At the crack, the Vael's stitches
// across it, two snapped, an eye under it looking up; worn, the burning pendant pulls them tight and the eye shuts
// (once a run; not worn, a hint that it would). At the nest, what it was for and what that means now the eggs are warm
// over the crack upstairs, and a warden's wrap left by it. Nothing's said that can be seen.
import { CHAMBER, CHAMBER_SAYS } from "../data/undercroft.ts";
import { HALF, T } from "../data/world.ts";
import { makeItem } from "../items/items.ts";
import { toast, type Game } from "./game.ts";
import { cutscene, scenePlayed } from "./cutscene.ts";
import { wearingPendant } from "./pendant.ts";
import { sound } from "./sfx.ts";
import { dropLoot } from "./spawn.ts";

/** This run, per game: read the nest (and been given the wrap), mended the crack's stitches, been told how. */
interface Run { read: boolean; mended: boolean; unworn: boolean }
const runs = new WeakMap<Game, Run>();
/** The crack's middle, below the nest (tiles; it's drawn in src/render/undercroft.ts). */
const CRACK_Z = 1.4;
function runOf(g: Game): Run {
  let r = runs.get(g);
  if (!r) {
    const fresh = { read: false, mended: false, unworn: false };
    runs.set(g, r = fresh);
    g.events.on("reset", () => { fresh.read = fresh.mended = fresh.unworn = false; });
  }
  return r;
}

/** Where the nest is, and the middle of the crack below it (game px, an entity's top-left). */
export const nestAt = (): { x: number; y: number } => ({ x: CHAMBER.nest.x * T - HALF, y: CHAMBER.nest.y * T - HALF });
export const crackAt = (): { x: number; y: number } => ({ x: CHAMBER.nest.x * T - HALF, y: (CHAMBER.nest.y + CRACK_Z) * T - HALF });

/** Has the pendant pulled the stitches tight this run? */
export const stitchesMended = (g: Game): boolean => runOf(g).mended;

/** Every frame, in the chamber. */
export function sealChamberSystem(g: Game): void {
  if (g.area.def.id !== "sealchamber") return;
  const run = runOf(g);
  if (!g.world.query("renderable").some(([, c]) => c.renderable.kind === "stitches")) {
    g.world.create({ transform: crackAt(), renderable: { kind: "stitches" } });   // drawn by src/render/undercroft.ts
  }
  if (cutscene(g) || !scenePlayed(g, "eye")) return;        // the eye's scene first (he may come in still walking): he only watches
  const p = g.world.need(g.player, "transform"), nest = nestAt(), crack = crackAt();
  if (!run.mended && Math.hypot(p.x - crack.x, p.y - crack.y) < CHAMBER.crack) {
    if (wearingPendant(g)) {
      run.mended = true;
      g.fx.push({ type: "burst", x: crack.x, y: crack.y, palette: "frost" });
      g.fx.push({ type: "toll", x: crack.x, y: crack.y, radius: 40 });
      sound(g, "toll", crack);
    } else if (!run.unworn) { run.unworn = true; toast(g, CHAMBER_SAYS.unworn); }
  }
  if (run.read || Math.hypot(p.x - nest.x, p.y - nest.y) > CHAMBER.near) return;
  run.read = true;
  for (const line of CHAMBER_SAYS.nest) toast(g, line, true);
  const w = CHAMBER.gift;
  const wrap = dropLoot(g, nest.x + 1.7 * T, nest.y + 0.4 * T, { ...makeItem(w.type, w.rarity, { ...w.mods }, w.name), note: w.note });
  g.world.remove(wrap, "despawn");                           // it'll wait for him, if his bag's full
}
