// Yssa of the Frost (src/game/yssa.ts): a Frost mage's body in its robes and hood, no sword, standing in the track
// west out of the Ashwild with her hands folded, turning to watch whoever comes, frost drifting off her.
import { SHADOW_Y, toWorld } from "./context.ts";
import { removeBody, type Body } from "./models/body.ts";
import { makeMageBody } from "./models/enemies.ts";
import type { EntityView } from "./views.ts";

interface YssaView extends Body { k: number }
export const yssa: EntityView<YssaView> = {
  create(ctx, e, g) {
    const b = makeMageBody(ctx, "frost");
    b.sword.visible = false;
    b.feet.forEach(f => { f.position.x = b.footX; });
    const t = g.world.need(e, "transform");
    return Object.assign(b, { k: (t.x * 3 + t.y * 7) % 10 });
  },
  update(ctx, v, e, g, f) {
    const o = g.world.need(e, "transform"), s = g.world.need(e, "sentry"), [x, z] = toWorld(o.x, o.y), t = f.t + v.k;
    v.group.position.set(x, 0, z);
    v.group.rotation.y = -s.look;
    v.shadow.position.set(x, SHADOW_Y, z);
    v.body.scale.y = 1 + Math.sin(t * 1.4) * 0.02;            // breathing, slow and very old
    v.hands.forEach((h, i) => h.position.set(0.3, 0.42 + Math.sin(t * 1.4 + i) * 0.015, i === 0 ? 0.08 : -0.08));   // folded before her
    v.eyes.forEach(eye => { eye.scale.y = t % 5.3 < 0.15 ? 0.15 : 1; });
    if (Math.random() < f.dt * 4) {                           // frost drifting off her, falling
      ctx.particles.spawn(Math.random() < 0.5 ? "ice" : "snow", x + (Math.random() - 0.5) * 0.6, 0.3 + Math.random() * 1.1, z + (Math.random() - 0.5) * 0.6,
        (Math.random() - 0.5) * 0.15, -0.2 - Math.random() * 0.2, (Math.random() - 0.5) * 0.15, 1.4);
    }
  },
  remove: removeBody,
};
