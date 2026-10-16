// The end of the story path (src/game/ending.ts), drawn: the rift stone once Calder's gone, glowing brighter than any
// stone has before, a column of warm light standing up out of it and motes drifting up through it; and Calder's head
// set down at the King's feet, a round grey stone with the dark gone out of its face; the lantern of his own on the sill
// of his room at the Fells', last of all in the credits; and, before any of it, the Ranger's grey cloak hung from the
// Fells' window so he'll know the house when he comes home.
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

/**
 * The Ranger's grey cloak hung out of the window over the sill, flat against the house front: the hood bunched over the
 * sill, the cloth falling in two folds, the hem stirring a little in the wind.
 */
interface CloakView { group: THREE.Group; cloth: THREE.Group; k: number }
export const cloak: EntityView<CloakView> = {
  create(ctx, e, g) {
    const c = g.world.need(e, "cloak"), t = g.world.need(e, "transform"), [x, z] = toWorld(t.x, t.y);
    const group = new THREE.Group(), cloth = new THREE.Group(), grey = ctx.lambert("#7d8188"), dark = ctx.lambert("#5d6168");
    group.position.set(x, c.y - 0.22, z);
    group.rotation.y = c.yaw;
    group.add(cloth);
    put(cloth, new THREE.BoxGeometry(0.4, 0.08, 0.1), dark, 0, 0, 0.02);                  // the hood, over the sill
    put(cloth, new THREE.BoxGeometry(0.38, 0.62, 0.03).translate(0, -0.31, 0), grey, 0, -0.03, 0.0);
    for (const sx of [-0.09, 0.1]) put(cloth, new THREE.BoxGeometry(0.06, 0.6, 0.035).translate(0, -0.3, 0), dark, sx, -0.04, 0.01);   // the folds
    ctx.scene.add(group);
    return { group, cloth, k: (e * 0.61) % 10 };
  },
  update(_ctx, v, _e, _g, f) {
    v.cloth.rotation.x = 0.04 + Math.sin(f.t * 1.3 + v.k) * 0.03;   // stirring
  },
  remove(ctx, v) {
    ctx.scene.remove(v.group);
    disposeTree(v.group);
  },
};

/**
 * His own lantern, at the end of the credits (src/game/credits.ts): a little iron-framed lantern stood on the sill by his
 * bed in the top room of the Fells' house, its flame breathing warm light over the room.
 */
interface LanternView { group: THREE.Group; flame: THREE.MeshBasicMaterial; light: THREE.PointLight; k: number }
export const lantern: EntityView<LanternView> = {
  create(ctx, e, g) {
    const group = new THREE.Group(), iron = ctx.lambert("#2e2a28"), flame = ctx.glow(WARM, { transparent: true, opacity: 0.95 });
    put(group, new THREE.BoxGeometry(0.42, 0.12, 0.3), ctx.lambert("#6a4a30"), 0, 0.72, 0);                  // the sill
    put(group, new THREE.BoxGeometry(0.2, 0.03, 0.2), iron, 0, 0.8, 0);                                      // its foot
    put(group, new THREE.BoxGeometry(0.16, 0.22, 0.16), ctx.glow(WHITE, { transparent: true, opacity: 0.35 }), 0, 0.92, 0);   // the glass
    for (const [x, z] of [[-0.08, -0.08], [0.08, -0.08], [-0.08, 0.08], [0.08, 0.08]] as const) put(group, new THREE.BoxGeometry(0.02, 0.24, 0.02), iron, x, 0.92, z);
    put(group, new THREE.ConeGeometry(0.12, 0.08, 4).rotateY(Math.PI / 4), iron, 0, 1.07, 0);               // its cap
    put(group, new THREE.TorusGeometry(0.04, 0.01, 4, 8), iron, 0, 1.13, 0);                                 // and the ring to carry it by
    put(group, new THREE.IcosahedronGeometry(0.045, 0).scale(1, 1.6, 1), flame, 0, 0.91, 0);
    put(group, new THREE.PlaneGeometry(2, 2).rotateX(-Math.PI / 2), ctx.glow(WARM, { transparent: true, opacity: 0.35, depthWrite: false, map: softDisc(), ...onGround(GROUND.marker) }), 0, 0.02, 0).scale.setScalar(1.3);   // its light on the floor
    const light = new THREE.PointLight(WARM, 2.6, 6, 1.3);
    light.position.set(0, 1.1, 0);
    group.add(light);
    const t = g.world.need(e, "transform"), [x, z] = toWorld(t.x, t.y);
    group.position.set(x, 0, z);
    group.scale.setScalar(1.5);                              // big enough to see from across the room
    ctx.scene.add(group);
    return { group, flame, light, k: (t.x * 3 + t.y * 7) % 6 };
  },
  update(_ctx, v, _e, _g, f) {
    const b = Math.sin(f.t * 7 + v.k) * 0.5 + Math.sin(f.t * 13 + v.k) * 0.3;   // a candle's flicker
    v.flame.opacity = 0.85 + b * 0.1;
    v.light.intensity = 2.6 + b * 0.35;
  },
  remove(ctx, v) {
    ctx.scene.remove(v.group);
    disposeTree(v.group);
  },
};
