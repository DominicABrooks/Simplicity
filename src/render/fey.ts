// What the fair folk leave: a fairy ring in a glade, pale mushrooms come up in a circle on a band of grass
// greener than the rest, the grass inside it a little paler; and by night their caps glow faintly and small
// lights drift slowly round above it. Low-poly, at the hero's scale.
import * as THREE from "three";
import { T } from "../data/world.ts";
import { put } from "./castle.ts";
import { GROUND, onGround, type RenderContext } from "./context.ts";
import type { PropView } from "./props.ts";
import { hash } from "./terrain.ts";
import type { PropOf } from "./town.ts";

/** How many lights drift round a fairy ring. */
const MOTES = 7;

/** A fairy ring: a circle of mushrooms `radius` tiles out round (x, y), and the lights that dance in it after dark. */
export function buildFairyRing(ctx: RenderContext, parent: THREE.Group, p: PropOf<"fairyRing">): PropView {
  const { lambert, glow, basic, light } = ctx, g = new THREE.Group(), R = p.radius;
  g.position.set(p.x / T, 0, p.y / T);
  const decal = (opacity: number) => ({ transparent: true, opacity, depthWrite: false, ...onGround(GROUND.stain) });
  // The band of lush grass the ring stands on, and the paler grass inside it.
  put(g, new THREE.RingGeometry(R - 0.32, R + 0.3, 40).rotateX(-Math.PI / 2), basic("#2f6e22", decal(0.7)), 0, 0.016, 0);
  put(g, new THREE.CircleGeometry(R - 0.32, 32).rotateX(-Math.PI / 2), basic("#c8d890", decal(0.16)), 0, 0.015, 0);

  // The mushrooms: one every so far round, a little in or out of true, big and small; the odd pair.
  const stem = lambert("#efe6d2"), cap = lambert("#e8d8b8"), spot = lambert("#fff8ea");
  ctx.glowAtNight(cap, spot);
  const stemGeo = new THREE.CylinderGeometry(0.045, 0.06, 0.22, 5).translate(0, 0.11, 0);
  const capGeo = new THREE.SphereGeometry(0.15, 7, 3, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, 0.6, 1).translate(0, 0.2, 0);
  const spotGeo = new THREE.SphereGeometry(0.05, 5, 2, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, 0.5, 1);
  const n = Math.round(R * 2 * Math.PI / 0.55);
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < (hash(p.x, i, 501) < 0.25 ? 2 : 1); j++) {
      const a = ((i + hash(i, j, 502) * 0.5) / n) * Math.PI * 2, r = R + (hash(i, j, 503) - 0.5) * 0.22;
      const k = 0.6 + hash(i, j, 504) * 0.8 - j * 0.25, x = Math.cos(a) * r, z = Math.sin(a) * r;
      put(g, stemGeo, stem, x, 0, z).scale.setScalar(k);
      const top = put(g, capGeo, cap, x, 0, z, (hash(i, j, 505) - 0.5) * 0.3, 0, (hash(i, j, 506) - 0.5) * 0.3);
      top.scale.setScalar(k);
      if (k > 0.9) put(top, spotGeo, spot, 0.03, 0.28, -0.02);
    }
  }

  // The lights: small soft motes going slowly round above the ring, each its own height and pace, rising and
  // falling. They only show as the light goes.
  const moteMat = glow("#d8f4a8", { transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending });
  const haloMat = glow("#a8e070", { transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending });
  const moteGeo = new THREE.OctahedronGeometry(0.04, 0), haloGeo = new THREE.OctahedronGeometry(0.11, 0);
  const motes = Array.from({ length: MOTES }, (_, i) => {
    const m = put(g, moteGeo, moteMat, 0, 0, 0);
    put(m, haloGeo, haloMat, 0, 0, 0);
    return { m, a: hash(p.x, i, 511) * Math.PI * 2, r: R * (0.55 + hash(p.y, i, 512) * 0.4), y: 0.35 + hash(i, p.x, 513) * 0.4,
      speed: (0.15 + hash(i, p.y, 514) * 0.2) * (i % 2 ? 1 : -1), bob: hash(i, i, 515) * 6 };
  });
  parent.add(g);
  return {
    update: (t: number) => {
      const dark = Math.min(1, Math.max(0, (1 - light.value) / 0.6));
      moteMat.opacity = dark * (0.75 + Math.sin(t * 2.3) * 0.15);
      haloMat.opacity = dark * 0.25;
      for (const s of motes) {
        const a = s.a + t * s.speed;
        s.m.position.set(Math.cos(a) * s.r, s.y + Math.sin(t * 1.1 + s.bob) * 0.12, Math.sin(a) * s.r);
        s.m.visible = dark > 0.02;
      }
    },
  };
}
