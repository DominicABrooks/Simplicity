// Hover targeting: whatever targetable thing is under the cursor becomes the target, and stays the
// target until you hover something else or it's gone. While you're talking to someone, they stay the target.
import type { Entity } from "../core/ecs.ts";
import { T } from "../data/world.ts";
import type { Game } from "../game/game.ts";
import type { Projector } from "../render/projector.ts";
import type { Point } from "../world/collision.ts";

/** Distance from p to the segment a-b. */
function distToSegment(p: Point, a: Point, b: Point): number {
  const dx = b.x - a.x, dy = b.y - a.y, len2 = dx * dx + dy * dy;
  const k = len2 ? Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2)) : 0;
  return Math.hypot(p.x - (a.x + dx * k), p.y - (a.y + dy * k));
}

/**
 * The targetable entity under a screen point, or null. Each one is hit-tested on screen as a capsule
 * from its feet to its head, as wide as its ring, so hovering anywhere on its body counts.
 */
export function pickTarget(g: Game, view: Projector, mouse: Point): Entity | null {
  let best: Entity | null = null, bestD = Infinity;
  for (const [e, { transform: t, targetable }] of g.world.query("targetable", "transform")) {
    const base = view.gameToScreen(t.x, t.y, 0), top = view.gameToScreen(t.x, t.y, targetable.height);
    const side = view.gameToScreen(t.x + T, t.y, 0);
    const reach = Math.hypot(side.x - base.x, side.y - base.y) * (targetable.radius / T);   // the ring's radius, on screen
    const d = distToSegment(mouse, base, top);
    if (d <= reach && d < bestD) { best = e; bestD = d; }
  }
  return best;
}

/** Update the target from the cursor (skipped while it's over the UI), and drop targets that are gone. */
export function updateTarget(g: Game, view: Projector, mouse: Point | null, overUi: boolean): void {
  const talkingTo = g.world.get(g.player, "conversation")?.with;
  if (talkingTo !== undefined && g.world.has(talkingTo, "targetable")) { g.target = talkingTo; return; }
  if (g.target !== null && !g.world.has(g.target, "targetable")) g.target = null;
  if (!mouse || overUi || g.state !== "play") return;
  const hovered = pickTarget(g, view, mouse);
  if (hovered !== null) g.target = hovered;
}
