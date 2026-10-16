// What you find in the Frozen Hollow: Ael's old stone at its entrance, grey, flat and faintly warm, the snow
// melted off it in a ring; and out in the middle of the frozen lake, the ring of frost runes scratched into the
// ice where Rime will stand, breathing a cold blue light. Low-poly, at the hero's scale.
import * as THREE from "three";
import { T } from "../data/world.ts";
import { softDisc } from "./camp.ts";
import { put } from "./castle.ts";
import { GROUND, onGround, type RenderContext } from "./context.ts";
import type { PropView } from "./props.ts";
import { hash } from "./terrain.ts";
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
 * Rime's stage: out in the middle of the frozen lake, a ring of frost runes scratched into the ice, spokes running
 * in to a small inner ring, and frost feathering out across the ice from it, all breathing a faint cold light.
 */
export function buildRimeStage(ctx: RenderContext, parent: THREE.Group, p: PropOf<"rimeStage">): PropView {
  const { glow, basic } = ctx, g = new THREE.Group(), R = p.radius;
  g.position.set(p.x / T, 0, p.y / T);
  const decal = (layer: number) => ({ transparent: true, depthWrite: false, ...onGround(layer) });
  // Rime-frost: a pale bloom across the ice, whitest at the heart.
  put(g, new THREE.PlaneGeometry(2, 2).rotateX(-Math.PI / 2), basic("#f4fbff", { ...decal(GROUND.stain), map: softDisc(), opacity: 0.7 }), 0, 0.015, 0).scale.setScalar(R + 1.5);
  const line = glow("#9fe3ff", { ...decal(GROUND.marker), opacity: 0.6 });
  const ring = (r: number, w: number) => put(g, new THREE.RingGeometry(r - w, r, 48).rotateX(-Math.PI / 2), line, 0, 0.022, 0);
  ring(R, 0.07); ring(R - 0.55, 0.04); ring(1.2, 0.05);
  const runeGeo = new THREE.PlaneGeometry(0.14, 0.3).rotateX(-Math.PI / 2);
  for (let i = 0; i < 20; i++) {
    const a = (i / 20) * Math.PI * 2, r = R - 0.28, k = hash(i, 5, 411);
    put(g, runeGeo, line, Math.cos(a) * r, 0.022, Math.sin(a) * r, 0, -a + (k - 0.5) * 0.8, 0).scale.set(0.6 + k * 0.7, 1, 1);
  }
  for (let i = 0; i < 8; i++) {                             // spokes in to the inner ring
    const a = (i / 8) * Math.PI * 2, len = R - 0.55 - 1.2;
    put(g, new THREE.PlaneGeometry(len, 0.035).rotateX(-Math.PI / 2), line, Math.cos(a) * (1.2 + len / 2), 0.022, Math.sin(a) * (1.2 + len / 2), 0, -a, 0);
  }
  // Frost feathers: little forked strokes reaching out past the ring across the ice.
  const feather = basic("#ffffff", { ...decal(GROUND.marker), opacity: 0.55 });
  for (let i = 0; i < 16; i++) {
    let a = (i / 16) * Math.PI * 2 + hash(i, 6, 412) * 0.3, x = Math.cos(a) * (R + 0.1), z = Math.sin(a) * (R + 0.1);
    for (let s = 0; s < 3; s++) {
      const step = 0.35 + hash(i, s, 413) * 0.25;
      a += (hash(i, s, 414) - 0.5) * 0.9;
      put(g, new THREE.PlaneGeometry(step, 0.03).rotateX(-Math.PI / 2), feather, x + Math.cos(a) * step / 2, 0.021, z + Math.sin(a) * step / 2, 0, -a, 0);
      x += Math.cos(a) * step; z += Math.sin(a) * step;
    }
  }
  parent.add(g);
  return { update: (t: number) => { line.opacity = 0.45 + Math.sin(t * 0.7) * 0.18; } };
}
