// What you find in the Frozen Hollow: Ael's old stone at its entrance, grey, flat and faintly warm, the snow
// melted off it in a ring; and out in the middle of the frozen lake, Rime's arena: a ring of frost runes scratched
// into the ice, breathing a cold blue light, inside a ring of pillars of ice. Low-poly, at the hero's scale.
import * as THREE from "three";
import { T } from "../data/world.ts";
import { softDisc } from "./camp.ts";
import { put } from "./castle.ts";
import { GROUND, onGround, type RenderContext } from "./context.ts";
import type { PropView } from "./props.ts";
import { hash } from "./terrain.ts";
import { arenaPlan } from "../world/arena.ts";
import type { PropOf } from "./town.ts";

/** An old stone: a low, flat slab of grey stone set in the ground, worn smooth, a faint warm glow in the cracks of it and a ring of bare ground where the snow won't lie. */
export function buildOldStone(ctx: RenderContext, parent: THREE.Group, p: PropOf<"oldStone">): PropView {
  const { lambert, glow, basic } = ctx, g = new THREE.Group(), quad = new THREE.PlaneGeometry(2, 2).rotateX(-Math.PI / 2);
  g.position.set(p.x / T, 0, p.y / T);
  const decal = { transparent: true, depthWrite: false, ...onGround(GROUND.stain) };
  put(g, quad, basic("#5d5448", { ...decal, map: softDisc(), opacity: 0.55 }), 0, 0.014, 0).scale.setScalar(1.15);   // the thawed ground round it
  const stone = lambert("#8d8a84"), dark = lambert("#6e6b66");
  put(g, new THREE.CylinderGeometry(0.46, 0.52, 0.14, 7), stone, 0, 0.07, 0, 0, 0.3, 0).scale.set(1.25, 1, 0.95);
  put(g, new THREE.CylinderGeometry(0.34, 0.4, 0.05, 6), dark, 0.05, 0.16, -0.02, 0, 1.1, 0).scale.set(1.2, 1, 0.9);
  // Its marks: a ring and three strokes cut into the top, warm in the cracks.
  const warm = glow("#ffcf7a", { transparent: true, opacity: 0.6 });
  put(g, new THREE.RingGeometry(0.17, 0.21, 16).rotateX(-Math.PI / 2), warm, 0.05, 0.191, -0.02);
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2 + 0.4;
    put(g, new THREE.PlaneGeometry(0.16, 0.035).rotateX(-Math.PI / 2), warm, 0.05 + Math.cos(a) * 0.3, 0.191, -0.02 + Math.sin(a) * 0.24, 0, -a, 0);
  }
  for (let i = 0; i < 4; i++) {                             // a few pebbles round it
    const a = hash(p.x, i, 401) * Math.PI * 2, r = 0.62 + hash(p.y, i, 402) * 0.2;
    put(g, new THREE.DodecahedronGeometry(0.06 + hash(i, p.x, 403) * 0.04, 0), dark, Math.cos(a) * r, 0.03, Math.sin(a) * r).scale.y = 0.6;
  }
  parent.add(g);
  const k = hash(p.x, p.y, 404) * 6;
  return { update: (t: number) => { warm.opacity = 0.45 + Math.sin(t * 0.9 + k) * 0.2; } };
}

/**
 * Rime's arena: out in the middle of the frozen lake, a ring of frost runes scratched into the ice, spokes running in
 * to a small inner ring and frost feathering out from it, all breathing a faint cold light; and round it, pillars of
 * ice, clear and blue-hearted, leaning out, tall at the back with a cold light at their tips and broken off short at
 * the front (so the fight shows), the one in the east left out for the way in.
 */
export function buildRimeStage(ctx: RenderContext, parent: THREE.Group, p: PropOf<"rimeStage">): PropView {
  const { glow, basic, lambert } = ctx, g = new THREE.Group(), R = p.radius, cx = p.x / T, cz = p.y / T;
  g.position.set(cx, 0, cz);
  const decal = (layer: number) => ({ transparent: true, depthWrite: false, ...onGround(layer) });
  // Rime-frost: a pale bloom across the ice, whitest at the heart.
  put(g, new THREE.PlaneGeometry(2, 2).rotateX(-Math.PI / 2), basic("#f4fbff", { ...decal(GROUND.stain), map: softDisc(), opacity: 0.7 }), 0, 0.015, 0).scale.setScalar(R + 1.2);
  const line = glow("#9fe3ff", { ...decal(GROUND.marker), opacity: 0.6 });
  const ring = (r: number, w: number) => put(g, new THREE.RingGeometry(r - w, r, 48).rotateX(-Math.PI / 2), line, 0, 0.022, 0);
  const runeR = R - 1.3;
  ring(runeR + 0.3, 0.07); ring(runeR - 0.3, 0.04); ring(1.3, 0.05);
  const runeGeo = new THREE.PlaneGeometry(0.14, 0.3).rotateX(-Math.PI / 2);
  for (let i = 0; i < 24; i++) {
    const a = (i / 24) * Math.PI * 2, k = hash(i, 5, 411);
    put(g, runeGeo, line, Math.cos(a) * runeR, 0.022, Math.sin(a) * runeR, 0, -a + (k - 0.5) * 0.8, 0).scale.set(0.6 + k * 0.7, 1, 1);
  }
  for (let i = 0; i < 8; i++) {                             // spokes in to the inner ring
    const a = (i / 8) * Math.PI * 2, len = runeR - 0.3 - 1.3;
    put(g, new THREE.PlaneGeometry(len, 0.035).rotateX(-Math.PI / 2), line, Math.cos(a) * (1.3 + len / 2), 0.022, Math.sin(a) * (1.3 + len / 2), 0, -a, 0);
  }
  // Frost feathers: little forked strokes reaching out from the runes toward the pillars.
  const feather = basic("#ffffff", { ...decal(GROUND.marker), opacity: 0.55 });
  for (let i = 0; i < 18; i++) {
    let a = (i / 18) * Math.PI * 2 + hash(i, 6, 412) * 0.3, x = Math.cos(a) * (runeR + 0.4), z = Math.sin(a) * (runeR + 0.4);
    for (let s = 0; s < 3; s++) {
      const step = 0.3 + hash(i, s, 413) * 0.2;
      a += (hash(i, s, 414) - 0.5) * 0.9;
      put(g, new THREE.PlaneGeometry(step, 0.03).rotateX(-Math.PI / 2), feather, x + Math.cos(a) * step / 2, 0.021, z + Math.sin(a) * step / 2, 0, -a, 0);
      x += Math.cos(a) * step; z += Math.sin(a) * step;
    }
  }

  // The pillars of ice: clear outside, a deep blue heart, a glint up the inner edge; leaning out, the back ones
  // tall with a cold light at the tip, the front ones broken off to stumps.
  const clear = lambert("#d8eef7", { transparent: true, opacity: 0.82 }), heart = lambert("#5f93b3"), edge = glow("#c9f3ff");
  const tipMat = glow("#9fe3ff", { transparent: true, opacity: 0.9 }), tips: THREE.Mesh[] = [];
  ctx.glowAtNight(clear, heart);
  for (const s of arenaPlan(p)) {
    const x = s.x - cx, z = s.z - cz, back = (Math.cos(s.round * Math.PI * 2) + 1) / 2, k = hash(s.x, s.z, 421);
    const h = 0.45 + back * back * (1.8 + k * 0.5), pil = new THREE.Group();
    pil.position.set(x, 0, z);
    pil.rotation.y = -Math.atan2(z, x);
    put(pil, new THREE.CylinderGeometry(0.11, 0.17, h * 0.92, 5), heart, 0, h * 0.46, 0, 0, k * 2, 0.06);
    put(pil, new THREE.CylinderGeometry(0.2, 0.31, h, 6), clear, 0, h / 2, 0, 0, k * 2, 0.06);
    put(pil, new THREE.BoxGeometry(0.03, h * 0.8, 0.04), edge, -0.26, h * 0.42, 0.03, 0, 0, 0.05);      // the glint, toward the middle
    if (back > 0.55) tips.push(put(pil, new THREE.ConeGeometry(0.2, 0.55 + k * 0.25, 6).translate(0, (0.55 + k * 0.25) / 2, 0), tipMat, 0.02, h, 0, 0, k, 0));
    else put(pil, new THREE.ConeGeometry(0.21, 0.22 + k * 0.15, 6), clear, 0.03, h + 0.06, 0, 0.25 * (k - 0.5), k * 2, 0.4);   // snapped off
    for (let j = 0; j < 3; j++) {                            // shards at its foot
      const a = hash(s.x, j, 422) * Math.PI * 2;
      put(pil, new THREE.OctahedronGeometry(0.07 + hash(j, s.z, 423) * 0.05, 0), clear, Math.cos(a) * 0.32, 0.04, Math.sin(a) * 0.32).scale.y = 1.6;
    }
    pil.rotation.z = 0.06;                                    // leaning out
    g.add(pil);
  }
  const light = new THREE.PointLight(0x9fe3ff, 3, R * 1.6, 1.3);
  light.position.set(0, 1.4, 0);
  g.add(light);
  parent.add(g);
  return {
    update: (t: number) => {
      line.opacity = 0.45 + Math.sin(t * 0.7) * 0.18;
      tipMat.opacity = 0.7 + Math.sin(t * 1.3) * 0.2;
      tips.forEach((tip, i) => { tip.scale.setScalar(0.9 + Math.sin(t * 1.1 + i) * 0.1); });
      light.intensity = 3 + Math.sin(t * 0.7) * 0.6;
    },
  };
}
