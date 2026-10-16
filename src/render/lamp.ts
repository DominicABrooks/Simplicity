// A street lamp: an iron lantern on a post. Dark by day, its panes dull glass; once the lamplighter's lit
// it (src/game/lamps.ts) it burns, the flame flickering in its panes, and as the dark comes on it throws a
// soft pool of light on the stones round its foot (not a real light: there's only the sun and the sky).
import * as THREE from "three";
import { lampLit } from "../game/lamps.ts";
import { PAL } from "../data/palette.ts";
import { GROUND, box, onGround, type RenderContext } from "./context.ts";
import { at } from "./market.ts";
import type { PropView } from "./props.ts";
import { IRON, LIT, type PropOf } from "./town.ts";

/** How high the lantern hangs (its middle), world units: the lamplighter's pole reaches it from the street (render/work.ts). */
export const LAMP_HEAD = 2.25;
const DARK_GLASS = "#4a4f5c";

export function buildLamp(ctx: RenderContext, parent: THREE.Group, p: PropOf<"lamp">): PropView {
  const { lambert, basic, glow, particles, light } = ctx, g = new THREE.Group(), iron = lambert(IRON), [x, z] = at(p);
  const foot = new THREE.Mesh(box(0.34, 0.16, 0.34), lambert("#8a8378"));
  foot.position.y = 0.08;
  const post = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.07, LAMP_HEAD - 0.2, 6), iron);
  post.position.y = (LAMP_HEAD - 0.2) / 2 + 0.16;
  const collar = new THREE.Mesh(box(0.14, 0.06, 0.14), iron);
  collar.position.y = LAMP_HEAD - 0.2;
  // The lantern: four panes in an iron frame, a pyramid cap and a ring on top.
  const dark = basic(DARK_GLASS), lit = glow(LIT);
  const panes = new THREE.Mesh(box(0.24, 0.3, 0.24), dark);
  panes.position.y = LAMP_HEAD;
  const flame = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.14, 5), glow(PAL.O));
  flame.position.y = LAMP_HEAD - 0.04;
  const base = new THREE.Mesh(box(0.28, 0.04, 0.28), iron);
  base.position.y = LAMP_HEAD - 0.17;
  const cap = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.18, 4), iron);
  cap.position.y = LAMP_HEAD + 0.24;
  cap.rotation.y = Math.PI / 4;
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.015, 4, 6), iron);
  ring.position.y = LAMP_HEAD + 0.37;
  g.add(foot, post, collar, panes, flame, base, cap, ring);
  for (const [sx, sz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]] as const) {   // the frame's corner bars
    const bar = new THREE.Mesh(box(0.03, 0.32, 0.03), iron);
    bar.position.set(sx * 0.125, LAMP_HEAD, sz * 0.125);
    g.add(bar);
  }
  // The pool of light on the ground, stronger the darker it is.
  const poolMat = glow(LIT, { transparent: true, opacity: 0, depthWrite: false, ...onGround(GROUND.stain) });
  const pool = new THREE.Mesh(new THREE.CircleGeometry(1.3, 10).rotateX(-Math.PI / 2), poolMat);
  pool.position.y = 0.02;
  g.add(pool);
  g.position.set(x, 0, z);
  parent.add(g);
  let was = false;
  return {
    update(t) {
      const on = lampLit(p);
      if (on !== was) {
        was = on;
        panes.material = on ? lit : dark;
        if (on) for (let i = 0; i < 5; i++) particles.spawn("fire", x, LAMP_HEAD + 0.1, z, (Math.random() - 0.5) * 0.5, 0.6 + Math.random() * 0.5, (Math.random() - 0.5) * 0.5, 0.4);   // it catches
      }
      flame.visible = on;
      if (on) flame.scale.y = 0.85 + Math.sin(t * 11 + x) * 0.12 + Math.sin(t * 23 + z) * 0.06;
      pool.visible = on && light.value < 0.95;
      poolMat.opacity = on ? 0.2 * THREE.MathUtils.clamp((1 - light.value) / 0.6, 0, 1) : 0;
    },
  };
}
