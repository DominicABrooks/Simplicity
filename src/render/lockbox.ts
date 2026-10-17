// The woodcutters' strongbox (src/game/lockbox.ts): a squat wooden box bound with iron, studded at the corners, with a
// brass plate in its front holding four number wheels side by side. Shut, it sits square; opened with the right number,
// its lid swings up and back on its hinges, and the wheels catch a little warm light. Low-poly, at the hero's scale.
// And Abel Coppin, whose box it is, standing about the Wallside lanes in Kingsholm.
import * as THREE from "three";
import { ABEL } from "../data/lockbox.ts";
import { lockboxOpen } from "../game/lockbox.ts";
import { box, SHADOW_Y, toWorld } from "./context.ts";
import { put } from "./castle.ts";
import { disposeTree } from "./dispose.ts";
import { dressCommoner, makeBody, removeBody, type Body } from "./models/body.ts";
import type { EntityView } from "./views.ts";

/** The box's size (world units): wide, tall to the lid, deep; and the lid's own height. */
const W = 0.5, H = 0.26, D = 0.32, LID = 0.1;

interface LockboxView { group: THREE.Group; lid: THREE.Group; brass: THREE.MeshLambertMaterial; open: number }
export const lockbox: EntityView<LockboxView> = {
  create(ctx, e, g) {
    const t = g.world.need(e, "transform"), [x, z] = toWorld(t.x, t.y);
    const { lambert } = ctx, group = new THREE.Group(), lid = new THREE.Group();
    const wood = lambert("#6b4a2e", { map: ctx.tex.timber }), iron = lambert("#3d3b3a"), brass = lambert("#b8913f", { emissive: new THREE.Color("#3a2a08") });
    const dial = lambert("#e8dcc4");
    group.position.set(x, 0, z);
    // The body, its iron bands round it and studs at the corners.
    put(group, box(W, H, D), wood, 0, H / 2, 0);
    for (const bx of [-W / 2 + 0.06, W / 2 - 0.06]) put(group, box(0.04, H + 0.01, D + 0.01), iron, bx, H / 2, 0);
    put(group, box(W + 0.01, 0.035, D + 0.01), iron, 0, 0.03, 0);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) put(group, new THREE.OctahedronGeometry(0.018, 0), iron, sx * (W / 2 + 0.005), H - 0.03, sz * (D / 2 + 0.005));
    // The brass plate in its front, and the four wheels in it, each a pale number face in a dark slot.
    put(group, box(0.3, 0.1, 0.02), brass, 0, H * 0.55, D / 2 + 0.01);
    for (let i = 0; i < 4; i++) {
      const wx = -0.105 + i * 0.07;
      put(group, box(0.05, 0.07, 0.01), iron, wx, H * 0.55, D / 2 + 0.022);
      put(group, box(0.034, 0.045, 0.012), dial, wx, H * 0.55, D / 2 + 0.026);
    }
    // The lid hangs from the back edge: it swings up and back when it opens.
    lid.position.set(0, H, -D / 2);
    group.add(lid);
    put(lid, box(W + 0.02, LID, D + 0.02), wood, 0, LID / 2, D / 2);
    put(lid, box(W + 0.03, 0.03, D + 0.03), iron, 0, LID - 0.01, D / 2);
    put(lid, box(0.06, 0.06, 0.02), brass, 0, LID / 2, D + 0.015);              // the hasp
    ctx.scene.add(group);
    return { group, lid, brass, open: lockboxOpen(g) ? 1 : 0 };
  },
  update(_ctx, v, _e, g, f) {
    const to = lockboxOpen(g) ? 1 : 0;
    v.open += Math.sign(to - v.open) * Math.min(Math.abs(to - v.open), f.dt * 1.2);
    v.lid.rotation.x = -1.9 * v.open * v.open * (3 - 2 * v.open);
    v.brass.emissiveIntensity = 0.6 + v.open * (0.6 + Math.sin(f.t * 2) * 0.2);
  },
  remove(ctx, v) {
    ctx.scene.remove(v.group);
    disposeTree(v.group);
  },
};

/**
 * Abel Coppin (src/game/lockbox.ts): a big woodcutter in a moss-green smock and a leather jerkin, a felt hat, the sack
 * they carried out of the Ashwild over his shoulder, standing in the lane with nothing to cut. He breathes, shifts his
 * weight now and then, and turns to look at whoever comes up to him; walking to his door at bedtime, or out of it in
 * the morning, he steps along the way the townsfolk do, facing where he's going.
 */
interface WoodcutterView extends Body { k: number; was: { x: number; y: number }; walking: number }
export const woodcutter: EntityView<WoodcutterView> = {
  create(ctx, e, g) {
    const b = makeBody(ctx);
    dressCommoner(ctx, b, ABEL.dress);
    b.ripple.visible = false;
    b.sword.visible = false;
    b.feet.forEach(f => { f.position.x = b.footX; });
    b.group.scale.setScalar(1.06);                             // a big man
    const t = g.world.need(e, "transform");
    return Object.assign(b, { k: (t.x * 5 + t.y * 3) % 10, was: { x: t.x, y: t.y }, walking: 0 });
  },
  update(_ctx, v, e, g, f) {
    const o = g.world.need(e, "transform"), s = g.world.need(e, "sentry"), [x, z] = toWorld(o.x, o.y), t = f.t + v.k;
    const dx = o.x - v.was.x, dy = o.y - v.was.y, moved = Math.hypot(dx, dy) > 0.01;
    v.was = { x: o.x, y: o.y };
    v.walking = moved ? 0.2 : Math.max(0, v.walking - f.dt);   // still walking for a moment between steps
    v.group.position.set(x, 0, z);
    v.shadow.position.set(x, SHADOW_Y, z);
    const b = v.body;
    if (v.walking > 0) {                                       // stepping along, as the townsfolk do
      if (moved) v.group.rotation.y = -Math.atan2(dy, dx);
      const pace = ABEL.speed * 0.3;
      b.position.y = Math.abs(Math.sin(t * pace)) * 0.05;
      b.rotation.z = -0.06;
      b.scale.y = 1;
      v.feet.forEach((foot, i) => { foot.position.x = v.footX + Math.sin(t * pace + i * Math.PI) * 0.09; });
    } else {
      v.group.rotation.y = -s.look;
      b.position.y = 0;
      b.scale.y = 1 + Math.sin(t * 1.6) * 0.02;                // breathing
      b.rotation.z = Math.sin(t * 0.21) * 0.04;                // shifting his weight
      v.feet.forEach(foot => { foot.position.x = v.footX; });
    }
    v.eyes.forEach(e2 => { e2.scale.y = t % 3.7 < 0.15 ? 0.15 : 1; });
  },
  remove: removeBody,
};
