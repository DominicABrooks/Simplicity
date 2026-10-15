// The haunting of St Mary's churchyard (the story is in src/data/ghost.ts). Every time the hero hears the
// Grey Ringer's rumour, the chance goes up that she rises. Once a night, when he comes to the churchyard in
// the dark, the dice are rolled; if she rises, she fights him there until one of them falls, or until dawn
// sends her back into the grass. Laying her to rest quiets the rumour: he'd have to hear it all again.
// What she does once she's up is src/systems/ghost.ts; the townsfolk running from her, src/game/townsfolk.ts.
import type { Entity } from "../core/ecs.ts";
import { isDay } from "../data/daylight.ts";
import { GHOST, GHOST_NAME, GHOST_SAYS, ghostChance, ghostHp } from "../data/ghost.ts";
import type { Rect } from "../data/world.ts";
import type { Point } from "../world/collision.ts";
import { toast, type Game } from "./game.ts";

/**
 * How the haunting stands. `heard` is how many times the hero's heard the rumour (it carries across runs, like
 * the hour: the city doesn't forget). `night` is tonight's: not yet tried, quiet, risen, or laid to rest.
 */
export interface Haunting {
  heard: number;
  night: "waiting" | "quiet" | "risen" | "laid";
}

const haunts = new WeakMap<Game, Haunting>();
export function hauntingOf(g: Game): Haunting {
  let h = haunts.get(g);
  if (!h) haunts.set(g, h = { heard: 0, night: "waiting" });
  return h;
}

/** The hero just heard the rumour told: she's a little more likely to rise. */
export function heardRumour(g: Game): void {
  hauntingOf(g).heard++;
}

/** The chance she rises tonight, from what the hero's heard. */
export const riseChance = (g: Game): number => ghostChance(hauntingOf(g).heard);

/** The churchyard she haunts in this area (its graves), if it has one. */
export function churchyardOf(g: Game): Rect | null {
  for (const p of g.area.layout.props) if (p.kind === "graves") return p.rect;
  return null;
}

/** The ghost, if she's out. */
export const ghostOut = (g: Game): Entity | null => g.world.query("ghost")[0]?.[0] ?? null;

/** Is this point within `margin` px of the churchyard? */
const near = (yard: Rect, p: Point, margin: number) =>
  p.x + 4 > yard.x - margin && p.x + 4 < yard.x + yard.w + margin && p.y + 4 > yard.y - margin && p.y + 4 < yard.y + yard.h + margin;

/**
 * Every frame: by day the night's roll is reset (and, at first light, she goes). At night, the first time the
 * hero comes to the churchyard, roll for her; if she's risen tonight and isn't out (he left and came back), she's waiting.
 */
export function hauntSystem(g: Game): void {
  const yard = churchyardOf(g);
  if (!yard) return;
  const h = hauntingOf(g), ghost = ghostOut(g);
  if (isDay(g.hour)) {
    if (ghost !== null) {
      const at = g.world.need(ghost, "transform");
      g.fx.push({ type: "burst", x: at.x, y: at.y, palette: "frost" });
      g.world.destroy(ghost);
      toast(g, GHOST_SAYS.dawn);
    }
    h.night = "waiting";
    return;
  }
  if (ghost !== null || h.night === "quiet" || h.night === "laid") return;
  if (!near(yard, g.world.need(g.player, "transform"), GHOST.wake)) return;
  if (h.night === "waiting") {
    if (g.rng.next() >= ghostChance(h.heard)) {
      h.night = "quiet";
      if (h.heard > 0) toast(g, GHOST_SAYS.quiet);
      return;
    }
    h.night = "risen";
  }
  riseGhost(g, yard);
}

/** She rises from her grave in the churchyard's far corner, by the hero. */
export function riseGhost(g: Game, yard: Rect): Entity {
  const level = g.world.get(g.player, "hero")?.level ?? 1, hp = ghostHp(level);
  const home = { x: yard.x + yard.w - 16, y: yard.y + yard.h / 2 - 4 };   // the far (east) end, where there's no stone
  const e = g.world.create({
    transform: { ...home },
    knockback: { vx: 0, vy: 0 },
    health: { hp, maxHp: hp },
    ghost: { home, act: "rise", t: 0, next: GHOST.every[1], angry: false, hidden: false },
    renderable: { kind: "ghost" },
  });
  g.shake = Math.max(g.shake, 2);
  toast(g, GHOST_SAYS.rise);
  return e;
}

/** She's up out of the ground: now she can be hit, and targeted. */
export function ghostSolid(g: Game, e: Entity, solid: boolean): void {
  if (solid) {
    g.world.add(e, "enemy", { kind: "ghost", flash: 0, face: 1 });
    g.world.add(e, "targetable", { name: GHOST_NAME, hostile: true, radius: GHOST.radius, height: GHOST.height });
  } else {
    g.world.remove(e, "enemy");
    g.world.remove(e, "targetable");
    if (g.target === e) g.target = null;
  }
}

/** She's beaten: at rest for tonight, and the rumour dies down (the hero would have to hear it all again). */
export function laidToRest(g: Game): void {
  const h = hauntingOf(g);
  h.night = "laid";
  h.heard = 0;
  toast(g, GHOST_SAYS.laid, true);
}
