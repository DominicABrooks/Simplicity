// The hunter's hut on the Frozen Hollow's rim (STORY.md: the bow, "found in an abandoned hunter's hut at the Hollow's
// edge"): his longbow lies in the doorway, waiting, once a run. It doesn't fade like dropped loot; once the hero
// has picked it up, it's gone for the rest of the run.
import type { Entity } from "../core/ecs.ts";
import { HUNTERS_LONGBOW, HUT_FIND } from "../data/hollow.ts";
import { HALF, T } from "../data/world.ts";
import { makeItem } from "../items/items.ts";
import { toast, type CurrentArea, type Game } from "./game.ts";

/** Taken this run; and the bow lying in the hut now, in which arrival (each trip into the Hollow is a fresh one). */
interface Hut { taken: boolean; bow: Entity | null; laidIn: CurrentArea | null }
const huts = new WeakMap<Game, Hut>();
function hutOf(g: Game): Hut {
  let h = huts.get(g);
  if (!h) {
    const fresh: Hut = { taken: false, bow: null, laidIn: null };
    huts.set(g, h = fresh);
    g.events.on("reset", () => { fresh.taken = false; fresh.bow = fresh.laidIn = null; });
  }
  return h;
}

/** Where the bow lies: in the hut's doorway (the area's hall, its door on the south: centre, game px). */
export function bowSpot(g: Game): { x: number; y: number } | null {
  const hut = g.area.layout.props.find(p => p.kind === "hall");
  return hut?.kind === "hall" ? { x: hut.rect.x + hut.rect.w / 2, y: hut.rect.y + hut.rect.h + 0.4 * T } : null;
}

/** Has the hero taken the hunter's longbow this run? */
export const tookBow = (g: Game): boolean => hutOf(g).taken;

/** Every frame in the Hollow: the bow's in the hut until he picks it up; then it's taken for the run, and he knows whose it was. */
export function hunterHutSystem(g: Game): void {
  if (g.area.def.id !== "hollow") return;
  const h = hutOf(g);
  if (h.taken) return;
  if (h.laidIn !== g.area) {                                 // just arrived: there it is
    h.laidIn = g.area;
    const at = bowSpot(g);
    if (!at) return;
    h.bow = g.world.create({
      transform: { x: at.x - HALF, y: at.y - HALF },
      pickup: { kind: "loot", item: makeItem(...HUNTERS_LONGBOW), ignore: false },
      renderable: { kind: "loot" },
    });
    return;
  }
  if (h.bow === null || g.world.isAlive(h.bow)) return;
  h.taken = true;
  h.bow = null;
  toast(g, HUT_FIND, true);
}
