// The deep places behind the Undercroft's little door (src/areas/sealchamber.ts): the first time in, a word on where he
// is. At the crack, the Vael's stitches across it, two snapped, an eye under it looking up; worn, the burning pendant
// pulls them tight and the eye shuts (once a run; not worn, it says it would). At the nest, what it was, what that
// means now the eggs are warm over the crack upstairs, and a warden's wrap left by it.
import { NEST } from "../areas/sealchamber.ts";
import { CHAMBER, CHAMBER_SAYS } from "../data/undercroft.ts";
import { HALF, T } from "../data/world.ts";
import { makeItem } from "../items/items.ts";
import { toast, type Game } from "./game.ts";
import { wearingPendant } from "./pendant.ts";
import { sound } from "./sfx.ts";
import { dropLoot } from "./spawn.ts";

/** This run, per game: been in, read the nest (and been given the wrap), seen the crack, mended its stitches. */
interface Run { arrived: boolean; read: boolean; crack: boolean; mended: boolean; unworn: boolean }
const runs = new WeakMap<Game, Run>();
/** The crack's middle, below the nest (tiles; it's drawn in src/render/undercroft.ts). */
const CRACK_Z = 1.4;
function runOf(g: Game): Run {
  let r = runs.get(g);
  if (!r) {
    const fresh = { arrived: false, read: false, crack: false, mended: false, unworn: false };
    runs.set(g, r = fresh);
    g.events.on("reset", () => { fresh.arrived = fresh.read = fresh.crack = fresh.mended = fresh.unworn = false; });
  }
  return r;
}

/** Where the nest is, and the middle of the crack below it (game px, an entity's top-left). */
export const nestAt = (): { x: number; y: number } => ({ x: NEST.x * T - HALF, y: NEST.y * T - HALF });
export const crackAt = (): { x: number; y: number } => ({ x: NEST.x * T - HALF, y: (NEST.y + CRACK_Z) * T - HALF });

/** Has the pendant pulled the stitches tight this run? */
export const stitchesMended = (g: Game): boolean => runOf(g).mended;

/** Every frame, in the chamber. */
export function sealChamberSystem(g: Game): void {
  if (g.area.def.id !== "sealchamber") return;
  const run = runOf(g);
  if (!run.arrived) { run.arrived = true; toast(g, CHAMBER_SAYS.arrive, true); }
  if (!g.world.query("renderable").some(([, c]) => c.renderable.kind === "stitches")) {
    g.world.create({ transform: crackAt(), renderable: { kind: "stitches" } });   // drawn by src/render/undercroft.ts
  }
  const p = g.world.need(g.player, "transform"), nest = nestAt(), crack = crackAt();
  if (!run.mended && Math.hypot(p.x - crack.x, p.y - crack.y) < CHAMBER.crack) {
    if (!run.crack) { run.crack = true; toast(g, CHAMBER_SAYS.crack); }
    if (wearingPendant(g)) {
      run.mended = true;
      g.fx.push({ type: "burst", x: crack.x, y: crack.y, palette: "frost" });
      g.fx.push({ type: "toll", x: crack.x, y: crack.y, radius: 40 });
      sound(g, "toll", crack);
      toast(g, CHAMBER_SAYS.mend, true);
    } else if (!run.unworn) { run.unworn = true; toast(g, CHAMBER_SAYS.unworn); }
  }
  if (run.read || Math.hypot(p.x - nest.x, p.y - nest.y) > CHAMBER.near) return;
  run.read = true;
  for (const line of CHAMBER_SAYS.nest) toast(g, line, true);
  const w = CHAMBER.gift;
  const wrap = dropLoot(g, nest.x + 1.7 * T, nest.y + 0.4 * T, { ...makeItem(w.type, w.rarity, { ...w.mods }, w.name), note: w.note });
  g.world.remove(wrap, "despawn");                           // it'll wait for him, if his bag's full
  toast(g, CHAMBER_SAYS.gift, true);
}
