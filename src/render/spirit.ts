// A beaten lieutenant's spirit (src/game/spirits.ts): their own body, as it was in the fight (models/cinder.ts,
// models/rime.ts), but see-through and lit from inside in their school's colour, floating a little off the ground and
// bobbing there, turned to the hero, with a faint ring under it and their fire or frost drifting up off it.
import * as THREE from "three";
import { GROUND, onGround, toWorld } from "./context.ts";
import { dressBody, removeBody, type Body } from "./models/body.ts";
import { makeMageBody } from "./models/enemies.ts";
import { animateCinder, makeCinder, type CinderParts } from "./models/cinder.ts";
import { animateRime, makeRime, type RimeParts } from "./models/rime.ts";
import type { EntityView } from "./views.ts";

/** Each one's school, glow, and what drifts off them. */
const LOOK = {
  cinder: { school: "ember", tint: "#ff9a4a", drift: ["fire", "ember"] },
  rime: { school: "frost", tint: "#9fe3ff", drift: ["snow", "ice"] },
} as const;
/** How see-through (its materials' opacity, times their own), and how high it floats (world units) and bobs. */
const OPACITY = 0.45, FLOAT = 0.22, BOB = 0.07;

interface SpiritView extends Body {
  who: keyof typeof LOOK;
  parts: { cinder: CinderParts } | { rime: RimeParts };
  mats: [THREE.Material, number][];
  k: number;
}

export const spirit: EntityView<SpiritView> = {
  create(ctx, e, g) {
    const who = g.world.need(e, "spirit").who, look = LOOK[who], b = makeMageBody(ctx, look.school);
    dressBody(ctx, b, { helm: null, armor: null, boots: null, weapon: null, ring: null, amulet: null, weaponType: null });
    const parts = who === "cinder" ? { cinder: makeCinder(ctx, b) } : { rime: makeRime(ctx, b) };
    // Its own see-through copies of every material (the living boss's are shared), lit from inside.
    const copies = new Map<THREE.Material, THREE.Material>(), tint = new THREE.Color(look.tint);
    b.group.traverse(o => {
      if (!(o instanceof THREE.Mesh)) return;
      const copy = (m: THREE.Material) => {
        let c = copies.get(m);
        if (!c) {
          c = m.clone();
          Object.assign(c, { transparent: true, opacity: m.opacity * OPACITY, depthWrite: false });
          if (c instanceof THREE.MeshLambertMaterial) c.emissive.copy(tint).multiplyScalar(0.55);
          copies.set(m, c);
        }
        return c;
      };
      o.material = Array.isArray(o.material) ? o.material.map(copy) : copy(o.material);
    });
    b.shadow.visible = false;                                 // it floats: a ring of light under it instead
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.42, 0.55, 28).rotateX(-Math.PI / 2),
      ctx.glow(look.tint, { transparent: true, opacity: 0.35, depthWrite: false, ...onGround(GROUND.stain) }));
    ring.position.y = 0.015;
    b.group.add(ring);
    const t = g.world.need(e, "transform");
    return Object.assign(b, { who, parts, mats: [...copies.values()].map(m => [m, m.opacity] as [THREE.Material, number]), k: (t.x * 3 + t.y * 7) % 10 });
  },
  update(ctx, v, e, g, f) {
    const o = g.world.need(e, "transform"), hero = f.hero, [x, z] = toWorld(o.x, o.y), t = f.t + v.k;
    v.group.position.set(x, 0, z);
    v.body.position.y = FLOAT + Math.sin(t * 1.6) * BOB;
    v.group.rotation.y = -Math.atan2(hero.y - o.y, hero.x - o.x);   // turned to the hero
    if ("cinder" in v.parts) animateCinder(v.parts.cinder, t, 0);
    else animateRime(v.parts.rime, t, 0, 0);
    const pulse = 0.85 + Math.sin(t * 2.2) * 0.15;
    for (const [m, base] of v.mats) m.opacity = base * pulse;
    if (Math.random() < f.dt * 5) {
      const drift = LOOK[v.who].drift;
      ctx.particles.spawn(drift[Math.random() < 0.5 ? 0 : 1], x + (Math.random() - 0.5) * 0.5, 0.4 + Math.random() * 1, z + (Math.random() - 0.5) * 0.5,
        (Math.random() - 0.5) * 0.15, 0.4 + Math.random() * 0.4, (Math.random() - 0.5) * 0.15, 1);
    }
  },
  remove: removeBody,
};
