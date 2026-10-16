// Gilded oaks (src/game/oaks.ts), where the hero planted the fair folk's acorns: a shoot with two leaves at first, and
// once a nightfall has come and gone, a young oak about his height with gold in its leaves, swaying a little, a few gold
// acorns hanging in it, and its leaves glowing faintly of themselves after dark. They're the hero's own, not the area's,
// so they're kept here rather than with the scenery, and put up or taken down as he comes and goes.
import * as THREE from "three";
import { T } from "../data/world.ts";
import { oaksHere, type Oak } from "../game/oaks.ts";
import type { Game } from "../game/game.ts";
import { put } from "./castle.ts";
import { SHADOW_Y, type RenderContext } from "./context.ts";
import { hash } from "./terrain.ts";

export interface OakView { update(g: Game, t: number): void }

export function createOakView(ctx: RenderContext): OakView {
  const { lambert } = ctx, root = new THREE.Group();
  ctx.scene.add(root);
  const bark = lambert("#6b4a2e"), leaf = lambert("#a8b83c"), gilt = lambert("#e0bc4e"), shoot = lambert("#9cc24a"), nut = lambert("#e8b040");
  ctx.glowAtNight(leaf, gilt, nut);
  const stemGeo = new THREE.CylinderGeometry(0.015, 0.02, 0.26, 4).translate(0, 0.13, 0);
  const sproutLeaf = new THREE.PlaneGeometry(0.12, 0.07);
  const trunkGeo = new THREE.CylinderGeometry(0.06, 0.1, 0.7, 6).translate(0, 0.35, 0);
  const crownGeo = new THREE.IcosahedronGeometry(1, 0), nutGeo = new THREE.SphereGeometry(0.035, 5, 3);
  /** Each oak's look, by its id: the group, whether it's the grown one, and its crown (to sway). */
  const shown = new Map<number, { group: THREE.Group; grown: boolean; crown: THREE.Group | null; k: number }>();

  function build(o: Oak) {
    const group = new THREE.Group(), k = hash(o.x, o.y, 701);
    group.position.set(o.x / T, 0, o.y / T);
    group.rotation.y = k * Math.PI * 2;
    const shadow = new THREE.Mesh(ctx.shadowGeo, ctx.shadowMat);
    shadow.position.y = SHADOW_Y;
    group.add(shadow);
    if (!o.grown) {
      shadow.scale.setScalar(0.25);
      put(group, stemGeo, shoot, 0, 0, 0);
      put(group, sproutLeaf, shoot, 0.06, 0.24, 0, -0.6, 0, -0.5);
      put(group, sproutLeaf, gilt, -0.06, 0.2, 0, -0.6, Math.PI, -0.5);
      put(group, nutGeo, nut, 0.05, 0.02, 0.04);
      root.add(group);
      return { group, grown: false, crown: null, k };
    }
    shadow.scale.setScalar(0.9);
    put(group, trunkGeo, bark, 0, 0, 0);
    const crown = new THREE.Group();
    crown.position.y = 0.7;
    group.add(crown);
    // A few lumps of leaves, green and gold, piled round the top of the trunk.
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2, r = i === 0 ? 0 : 0.22, s = i === 0 ? 0.42 : 0.3 + hash(o.id, i, 702) * 0.08;
      put(crown, crownGeo, i % 2 ? gilt : leaf, Math.cos(a) * r, i === 0 ? 0.32 : 0.18 + hash(o.id, i, 703) * 0.12, Math.sin(a) * r,
        hash(i, o.id, 704), hash(o.id, i, 705), 0).scale.set(s, s * 0.8, s);
    }
    for (let i = 0; i < 4; i++) {                            // gold acorns hanging under the leaves
      const a = hash(o.id, i, 706) * Math.PI * 2;
      put(crown, nutGeo, nut, Math.cos(a) * 0.36, 0.02, Math.sin(a) * 0.36);
    }
    root.add(group);
    return { group, grown: true, crown, k };
  }

  return {
    update(g, t) {
      const here = oaksHere(g), ids = new Set(here.map(o => o.id));
      for (const [id, v] of shown) if (!ids.has(id)) { root.remove(v.group); shown.delete(id); }
      for (const o of here) {
        let v = shown.get(o.id);
        if (v && v.grown !== o.grown) { root.remove(v.group); v = undefined; }
        if (!v) shown.set(o.id, v = build(o));
        if (v.crown) v.crown.rotation.set(Math.sin(t * 0.9 + v.k * 6) * 0.04, 0, Math.cos(t * 0.7 + v.k * 6) * 0.04);
      }
    },
  };
}
