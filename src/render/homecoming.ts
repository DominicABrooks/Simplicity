// The end of the story path (src/game/ending.ts), drawn: the rift stone once Calder's gone, glowing brighter than any
// stone has before, a column of warm light standing up out of it and motes drifting up through it; and Calder's head
// set down at the King's feet, a round grey stone with the dark gone out of its face.
import * as THREE from "three";
import { put } from "./castle.ts";
import { GROUND, SHADOW_Y, addShadow, onGround, toWorld, type RenderContext } from "./context.ts";
import { softDisc } from "./camp.ts";
import { disposeTree } from "./dispose.ts";
import type { EntityView } from "./views.ts";

const WARM = "#ffcf7a", WHITE = "#fff4d6";
const additive = (ctx: RenderContext, c: string, opacity: number, ground = false) =>
  ctx.glow(c, { transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, ...(ground ? onGround(GROUND.marker) : {}) });

interface HomestoneView { group: THREE.Group; pool: THREE.MeshBasicMaterial; beam: THREE.MeshBasicMaterial; core: THREE.MeshBasicMaterial; light: THREE.PointLight; x: number; z: number; t: number }
export const homestone: EntityView<HomestoneView> = {
  create(ctx, e, g) {
    const t = g.world.need(e, "transform"), [x, z] = toWorld(t.x, t.y), group = new THREE.Group();
    group.position.set(x, 0, z);
    const pool = additive(ctx, WARM, 0, true), beam = additive(ctx, WARM, 0), core = additive(ctx, WHITE, 0);
    pool.map = softDisc();
    put(group, new THREE.PlaneGeometry(2, 2).rotateX(-Math.PI / 2), pool, 0, 0.04, 0).scale.setScalar(1.6);
    put(group, new THREE.CylinderGeometry(0.42, 0.6, 9, 12, 1, true).translate(0, 4.5, 0), beam, 0, 0, 0);
    put(group, new THREE.CylinderGeometry(0.16, 0.3, 9, 8, 1, true).translate(0, 4.5, 0), core, 0, 0, 0);
    const light = new THREE.PointLight(WARM, 0, 6, 1.4);
    light.position.set(0, 1.2, 0);
    group.add(light);
    ctx.scene.add(group);
    return { group, pool, beam, core, light, x, z, t: 0 };
  },
  update(ctx, v, _e, _g, f) {
    v.t += f.dt;
    const on = Math.min(1, v.t / 1.5), b = 0.85 + Math.sin(f.t * 2.2) * 0.15;   // comes up over a moment, then breathes
    v.pool.opacity = 0.9 * on * b;
    v.beam.opacity = 0.4 * on * b;
    v.core.opacity = 0.65 * on * b;
    v.light.intensity = 5 * on * b;
    if (Math.random() < f.dt * 24 * on) {
      const a = Math.random() * Math.PI * 2, r = Math.random() * 0.4;
      ctx.particles.spawn(Math.random() < 0.5 ? "spark" : "sparkLight", v.x + Math.cos(a) * r, 0.1, v.z + Math.sin(a) * r, 0, 1.4 + Math.random() * 1.2, 0, 1.2);
    }
  },
  remove(ctx, v) {
    ctx.scene.remove(v.group);
    disposeTree(v.group);
  },
};

/** Calder's head on the ground: round and grey, a brow, shut eyes and a mouth worn into it, at peace. */
interface HeadView { group: THREE.Group; shadow: THREE.Mesh }
export const head: EntityView<HeadView> = {
  create(ctx, e, g) {
    const group = new THREE.Group(), stone = ctx.lambert("#8d8a84", { map: ctx.tex.stone }), dark = ctx.lambert("#5e5b56");
    put(group, new THREE.IcosahedronGeometry(0.2, 1), stone, 0, 0.19, 0).scale.set(1, 1.08, 0.95);
    // The face, turned up the steps toward the King (north).
    put(group, new THREE.BoxGeometry(0.2, 0.03, 0.05), dark, 0, 0.27, -0.17);                        // the brow
    for (const s of [-1, 1]) put(group, new THREE.BoxGeometry(0.06, 0.012, 0.03), dark, s * 0.06, 0.22, -0.19);   // eyes, shut
    put(group, new THREE.BoxGeometry(0.035, 0.07, 0.04), stone, 0, 0.18, -0.2);                      // the nose
    put(group, new THREE.BoxGeometry(0.08, 0.014, 0.03), dark, 0, 0.12, -0.18);                     // the mouth
    put(group, new THREE.IcosahedronGeometry(0.14, 0), stone, 0, 0.08, 0.08).scale.set(1.1, 0.5, 1);   // what's left of the beard
    const shadow = addShadow(ctx, 0.5), t = g.world.need(e, "transform"), [x, z] = toWorld(t.x, t.y);
    group.position.set(x, 0, z);
    shadow.position.set(x, SHADOW_Y, z);
    ctx.scene.add(group, shadow);
    return { group, shadow };
  },
  update() {},
  remove(ctx, v) {
    ctx.scene.remove(v.group, v.shadow);
    disposeTree(v.group);
  },
};
