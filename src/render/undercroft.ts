// Under St Mary's (see docs/CURIOSITIES.md): the low iron-banded door at the foot of the tower, the chest tombs
// of the church's dead with their effigies, and the ring of old grey stones on the temple floor beneath it all,
// faintly warm, breathing a little light, one stone missing. Low-poly, at the hero's scale.
import * as THREE from "three";
import { T } from "../data/world.ts";
import { FACING_YAW } from "../world/plans.ts";
import { ringPlan } from "../world/stonering.ts";
import { put } from "./castle.ts";
import { GROUND, box, onGround, toWorld, type RenderContext } from "./context.ts";
import { disposeTree } from "./dispose.ts";
import type { PropView } from "./props.ts";
import { hash } from "./terrain.ts";
import { DARK_WOOD, IRON, type PropOf } from "./town.ts";
import type { EntityView } from "./views.ts";

const STONE = "#8f8a80", PALE_STONE = "#b9b2a4", AEL = "#7fd8c4";

/** The door: a low pointed arch of dressed stone, a heavy door in it banded with iron, a big lock, a worn step before it. */
export function buildCryptDoor(ctx: RenderContext, parent: THREE.Group, p: PropOf<"cryptDoor">): PropView {
  const { lambert } = ctx, g = new THREE.Group(), stone = lambert(PALE_STONE, { map: ctx.tex.stone }), wood = lambert(DARK_WOOD), iron = lambert(IRON);
  // The arch's jambs and its pointed head, standing proud of the wall.
  for (const s of [-1, 1]) put(g, box(0.18, 1.05, 0.16), stone, s * 0.46, 0.52, 0.04);
  for (const s of [-1, 1]) put(g, box(0.18, 0.5, 0.16), stone, s * 0.24, 1.18, 0.04, 0, 0, s * 0.7);
  // The door, and its bands, studs and lock.
  put(g, box(0.74, 1.0, 0.06), wood, 0, 0.5, 0.06);
  put(g, new THREE.CylinderGeometry(0.37, 0.37, 0.06, 10, 1, false, -Math.PI / 2, Math.PI).rotateX(Math.PI / 2), wood, 0, 1.0, 0.06, 0, 0, -Math.PI / 2);
  for (const y of [0.22, 0.55, 0.88]) put(g, box(0.76, 0.05, 0.02), iron, 0, y, 0.1);
  put(g, box(0.14, 0.18, 0.03), iron, 0.22, 0.5, 0.11);
  put(g, box(0.03, 0.06, 0.01), ctx.basic("#0a0808"), 0.22, 0.48, 0.13);
  // The step, worn hollow in the middle, and a little moss.
  put(g, box(1.1, 0.08, 0.36), stone, 0, 0.04, 0.24);
  put(g, new THREE.PlaneGeometry(0.4, 0.14).rotateX(-Math.PI / 2), lambert("#4f6a35", onGround(GROUND.stain)), -0.36, 0.085, 0.3);
  g.position.set(p.x / T, 0, p.y / T);
  g.rotation.y = FACING_YAW[p.facing];
  parent.add(g);
}

/** A chest tomb: a long stone box on a plinth, the sides panelled, the lid moulded, and on it, if it's old enough, its effigy. */
export function buildTomb(ctx: RenderContext, parent: THREE.Group, p: PropOf<"tomb">): PropView {
  const { lambert } = ctx, g = new THREE.Group(), k = hash(p.x, p.y, 501);
  const stone = lambert(k < 0.5 ? STONE : PALE_STONE, { map: ctx.tex.stone }), dark = lambert("#5d5850"), cut = lambert("#3e3a35");
  put(g, box(0.95, 0.12, 1.95), dark, 0, 0.06, 0);
  put(g, box(0.8, 0.5, 1.8), stone, 0, 0.37, 0);
  for (const s of [-1, 1]) for (const z of [-0.55, 0, 0.55]) put(g, box(0.01, 0.3, 0.42), cut, s * 0.405, 0.37, z);   // the panels down its sides
  put(g, box(0.9, 0.09, 1.9), stone, 0, 0.665, 0);
  // The Kellets' mark on its foot: every one of them carved one.
  put(g, box(0.16, 0.03, 0.01), cut, 0, 0.42, 0.905);
  put(g, box(0.03, 0.16, 0.01), cut, 0, 0.42, 0.905, 0, 0, 0.5);
  if (p.effigy) {                                             // lying on the lid, hands together, feet toward the room
    const pale = lambert("#c9c2b4");
    put(g, box(0.36, 0.14, 1.2), pale, 0, 0.78, 0.08);
    put(g, new THREE.SphereGeometry(0.14, 7, 5), pale, 0, 0.8, -0.62);
    put(g, box(0.38, 0.06, 0.24), pale, 0, 0.73, -0.68);   // the cushion under its head
    put(g, box(0.1, 0.12, 0.1), pale, 0, 0.9, -0.15);       // its hands, at prayer
    put(g, box(0.3, 0.16, 0.16), pale, 0, 0.8, 0.75);       // a little dog at its feet
  }
  g.position.set(p.x / T, 0, p.y / T);
  g.rotation.y = FACING_YAW[p.facing];
  parent.add(g);
}

/**
 * The ring: grey standing stones, rough and leaning, older than anything above them, a faint warm light breathing
 * along their feet; in the gap, a socket cut in the floor for the one that's missing (the Mysterious Stone: when it's
 * set there, it's the game's ringstone entity, drawn by its own view).
 */
export function buildStoneRing(ctx: RenderContext, parent: THREE.Group, p: PropOf<"stoneRing">): PropView {
  const { lambert } = ctx, g = new THREE.Group(), plan = ringPlan(p), cx = p.x / T, cz = p.y / T;
  const greys = ["#a8a398", "#b5b0a5", "#9a958b"].map(c => lambert(c, { map: ctx.tex.stone }));
  const glow = ctx.glow(AEL, { transparent: true, opacity: 0.25, depthWrite: false, ...onGround(GROUND.marker) });
  // The temple floor: a disc of older, rougher flags under the ring.
  put(g, new THREE.CircleGeometry(p.radius + 0.9, 24).rotateX(-Math.PI / 2), lambert("#5a564e", onGround(GROUND.stain)), 0, 0.01, 0);
  put(g, new THREE.RingGeometry(p.radius - 0.12, p.radius + 0.12, 32).rotateX(-Math.PI / 2), glow, 0, 0.02, 0);
  for (const s of plan.stones) {
    const k = hash(s.x, s.z, 502), h = 1.05 + k * 0.5, a = Math.atan2(s.z - cz, s.x - cx);
    const stone = put(g, new THREE.DodecahedronGeometry(0.32, 0).scale(0.9, h / 0.64, 0.6), greys[s.i % greys.length]!, s.x - cx, h / 2 - 0.05, s.z - cz);
    stone.rotation.set((k - 0.5) * 0.15, -a + Math.PI / 2, (hash(s.x, s.z, 503) - 0.5) * 0.2);
  }
  // The socket where the missing one stood: a dark round hole, smoothed by something once turning in it.
  const at = plan.socket;
  put(g, new THREE.CircleGeometry(0.26, 10).rotateX(-Math.PI / 2), ctx.basic("#141210", onGround(GROUND.marker)), at.x - cx, 0.03, at.z - cz);
  put(g, new THREE.RingGeometry(0.26, 0.34, 10).rotateX(-Math.PI / 2), lambert("#4a4640", onGround(GROUND.marker)), at.x - cx, 0.03, at.z - cz);
  g.position.set(cx, 0, cz);
  parent.add(g);
  const k = hash(p.x, p.y, 504) * 6;
  return { update: (t: number) => { glow.opacity = 0.18 + Math.sin(t * 0.9 + k) * 0.1; } };
}

/** The Mysterious Stone, set back in its socket: upright, slowly turning, glowing blue-green, its light breathing. */
interface RingstoneView { group: THREE.Group; glow: THREE.MeshBasicMaterial; light: THREE.PointLight; k: number }
export const ringstone: EntityView<RingstoneView> = {
  create(ctx, e, g) {
    const group = new THREE.Group(), glow = ctx.glow(AEL, { transparent: true, opacity: 0.5, depthWrite: false });
    put(group, new THREE.DodecahedronGeometry(0.3, 0).scale(0.85, 1.9, 0.6), ctx.lambert("#9a958c", { map: ctx.tex.stone, emissive: new THREE.Color("#1c4a40") }), 0, 0.55, 0);
    put(group, new THREE.DodecahedronGeometry(0.33, 0).scale(0.85, 1.9, 0.6), glow, 0, 0.55, 0);
    put(group, new THREE.RingGeometry(0.3, 0.55, 16).rotateX(-Math.PI / 2), glow, 0, 0.03, 0);
    const light = new THREE.PointLight(AEL, 1.4, 4.5, 1.6);
    light.position.set(0, 1, 0);
    group.add(light);
    const t = g.world.need(e, "transform");
    const [x, z] = toWorld(t.x, t.y);
    group.position.set(x, 0, z);
    ctx.scene.add(group);
    return { group, glow, light, k: (t.x * 3 + t.y * 7) % 6 };
  },
  update(_ctx, v, _e, _g, f) {
    const b = Math.sin(f.t * 1.6 + v.k);
    v.group.children[0]!.rotation.y = v.group.children[1]!.rotation.y = f.t * 0.4;
    v.glow.opacity = 0.35 + b * 0.15;
    v.light.intensity = 1.2 + b * 0.4;
  },
  remove(ctx, v) {
    ctx.scene.remove(v.group);
    disposeTree(v.group);
  },
};
