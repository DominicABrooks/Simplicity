// Old Gil (src/game/quay.ts): the hero's body in a boatman's smock and cap, sitting... well, standing, by his boat,
// looking out over the river (or at whoever's come to talk), a patch where his left eye was until he has it back.
import * as THREE from "three";
import { GIL } from "../data/quay.ts";
import { spentCurios } from "../game/curios.ts";
import { SHADOW_Y, toWorld } from "./context.ts";
import { dressCommoner, makeBody, removeBody, type Body } from "./models/body.ts";
import type { EntityView } from "./views.ts";

interface BoatmanView extends Body { k: number; patch: THREE.Mesh }
export const boatman: EntityView<BoatmanView> = {
  create(ctx, e, g) {
    const b = makeBody(ctx);
    dressCommoner(ctx, b, GIL.dress);
    b.ripple.visible = false;
    b.sword.visible = false;
    b.feet.forEach(f => { f.position.x = b.footX; });
    // The patch, over the first eye, on its own little band.
    const eye = b.eyes[0]!, patch = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.07, 0.03), ctx.lambert("#1c1612"));
    patch.position.copy(eye.position);
    patch.position.z += 0.01;
    eye.parent!.add(patch);
    const t = g.world.need(e, "transform");
    return Object.assign(b, { k: (t.x * 5 + t.y * 3) % 10, patch });
  },
  update(_ctx, v, e, g, f) {
    const o = g.world.need(e, "transform"), s = g.world.need(e, "sentry"), [x, z] = toWorld(o.x, o.y), t = f.t + v.k;
    v.group.position.set(x, 0, z);
    v.group.rotation.y = -s.look;
    v.shadow.position.set(x, SHADOW_Y, z);
    v.body.scale.y = 1 + Math.sin(t * 1.8) * 0.025;           // breathing, slow and old
    v.body.rotation.x = 0.08 + Math.sin(t * 0.3) * 0.03;      // a stoop
    const eye = spentCurios(g).has("eye");
    v.patch.visible = !eye;
    v.eyes[0]!.visible = eye;
    v.eyes.forEach(e2 => { e2.scale.y = t % 4.1 < 0.15 ? 0.15 : 1; });
  },
  remove: removeBody,
};
