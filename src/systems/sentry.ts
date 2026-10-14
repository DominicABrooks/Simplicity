// Guards at their posts. A guard faces out from their post and stays put; every few seconds they glance
// a little to one side or the other, or back ahead, turning slowly. When the hero comes close in front
// of them, they turn to watch the hero (never turning their back on their post), and go back to
// keeping watch when the hero moves on.
import { angleDiff, clamp, turn } from "../core/math.ts";
import { GUARD } from "../data/npcs.ts";
import type { Game } from "../game/game.ts";

export function sentrySystem(g: Game, dt: number): void {
  const hero = g.world.need(g.player, "transform");
  for (const [, { transform: t, sentry: s }] of g.world.query("transform", "sentry")) {
    const dx = hero.x - t.x, dy = hero.y - t.y, toHero = Math.atan2(dy, dx), off = angleDiff(toHero, s.post);
    const sees = Math.hypot(dx, dy) < GUARD.notice && Math.abs(off) < GUARD.fieldOfView;
    if (sees) {
      s.want = s.post + clamp(off, -GUARD.maxTurn, GUARD.maxTurn);
      s.next = GUARD.glance[0];                              // look ahead again a moment after they leave
    } else if ((s.next -= dt) <= 0) {
      s.next = GUARD.glance[0] + g.rng.next() * (GUARD.glance[1] - GUARD.glance[0]);
      const r = g.rng.next();                                // mostly straight ahead, sometimes a look aside
      s.want = s.post + (r < 0.5 ? 0 : (r < 0.75 ? 1 : -1) * (0.3 + g.rng.next() * 0.35));
    }
    s.look = turn(s.look, s.want, dt, sees ? GUARD.turnRate * 1.5 : GUARD.turnRate);
  }
}
