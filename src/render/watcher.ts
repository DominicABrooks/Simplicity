// The watcher at the end of the street (src/game/eerie.ts): a tall, hooded shape, darker than the dark round it,
// standing quite still and turned to the hero. No face under the hood, no feet under the cloak, no shadow. It
// comes slowly out of the night, and goes all at once.
import * as THREE from "three";
import type { RenderContext } from "./context.ts";
import { toWorld } from "./context.ts";
import { disposeTree } from "./dispose.ts";
import type { EntityView } from "./views.ts";

/** How dark (its colour), and how solid at its plainest (opacity). */
const CLOAK = "#08080c", SOLID = 0.92;

interface WatcherView { group: THREE.Group; mat: THREE.MeshBasicMaterial }

export const watcher: EntityView<WatcherView> = {
  create(ctx: RenderContext) {
    const mat = ctx.basic(CLOAK, { transparent: true, opacity: 0, depthWrite: false });
    const cloak = new THREE.Mesh(new THREE.ConeGeometry(0.34, 1.45, 7, 1, true), mat);
    cloak.position.y = 0.72;
    const shoulders = new THREE.Mesh(new THREE.SphereGeometry(0.2, 7, 5), mat);
    shoulders.scale.set(1.25, 0.7, 1);
    shoulders.position.y = 1.32;
    const hood = new THREE.Mesh(new THREE.SphereGeometry(0.17, 7, 6), mat);
    hood.scale.set(1, 1.25, 1);
    hood.position.y = 1.55;
    const group = new THREE.Group();
    group.add(cloak, shoulders, hood);
    ctx.scene.add(group);
    return { group, mat };
  },
  update(_ctx, v, e, g, f) {
    const o = g.world.need(e, "transform"), w = g.world.need(e, "watcher"), [x, z] = toWorld(o.x, o.y);
    v.group.position.set(x, 0, z);
    v.group.rotation.y = -Math.atan2(f.hero.y - o.y, f.hero.x - o.x);
    v.mat.opacity = w.shown * SOLID;
    v.group.visible = w.shown > 0.01;
  },
  remove(ctx, v) {
    ctx.scene.remove(v.group);
    disposeTree(v.group);
  },
};
