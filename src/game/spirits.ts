// The spirits of the beaten lieutenants. Each of them says something the way on needs as they fall (Cinder, Yssa's
// name; Rime, the river's), and that's easy to miss in the moment; so once their last words are said, their spirit
// rises in the middle of their arena, the grey gone out of it, and stays there for the rest of the run. Talk to it
// and it tells the hero again. Drawn by src/render/spirit.ts.
import type { Entity } from "../core/ecs.ts";
import { CINDER_SPIRIT } from "../data/ashwild.ts";
import { RIME_SPIRIT } from "../data/hollow.ts";
import { FACING_ANGLE, type Prop } from "../world/area.ts";
import { HALF } from "../data/world.ts";
import { beaten, type Who } from "./bosses.ts";
import type { Game } from "./game.ts";
import { victoryOf } from "./victory.ts";

/** Who leaves a spirit behind: not Calder, whose spark flies home south as he falls. */
export type Spirited = Exclude<Who, "calder">;

/** What each spirit's called, and what it says. */
export const SPIRITS: Record<Spirited, { name: string; lines: readonly string[] }> = { cinder: CINDER_SPIRIT, rime: RIME_SPIRIT };

/** What the spirit says when he talks to it. */
export const spiritLines = (g: Game, e: Entity): string[] => [...SPIRITS[g.world.need(e, "spirit").who].lines];

/** The spirit in this area, if there is one. */
export const spiritHere = (g: Game): Entity | null => g.world.query("spirit")[0]?.[0] ?? null;

/**
 * Every frame: in a beaten lieutenant's lair (their "boss" prop marks the middle of the arena), once the victory's been
 * celebrated and nobody's talking (their last words come first), their spirit rises there, if it hasn't already this visit.
 */
export function spiritSystem(g: Game): void {
  const lair = g.area.layout.props.find((p): p is Extract<Prop, { kind: "boss" }> => p.kind === "boss");
  if (!lair || lair.who === "calder" || !beaten(g, lair.who) || spiritHere(g) !== null || victoryOf(g) || g.world.has(g.player, "conversation")) return;
  const x = lair.x - HALF, y = lair.y - HALF, look = FACING_ANGLE.south;
  g.world.create({
    transform: { x, y },
    targetable: { hostile: false, name: SPIRITS[lair.who].name, radius: 5, height: 1.6 },
    sentry: { post: look, look, want: look, next: 2 },
    spirit: { who: lair.who },
    renderable: { kind: "spirit" },
  });
  g.fx.push({ type: "burst", x, y, palette: lair.who === "cinder" ? "fire" : "frost" });
}
