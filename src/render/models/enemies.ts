// Enemy models, shared by the entity views and the journal's portraits.
import * as THREE from "three";
import type { School } from "../../data/enemies.ts";
import { PAL } from "../../data/palette.ts";
import { box, col, type RenderContext } from "../context.ts";
import { dressBody, makeBody, type Body } from "./body.ts";

export interface SlimeModel {
  group: THREE.Group;
  /** Squashes and stretches as it hops. */
  body: THREE.Group;
  /** Flashes white when hit. */
  mat: THREE.MeshLambertMaterial;
}

/** A translucent green blob with two dark eyes and a shine, facing +X. Not added to the scene. */
export function makeSlimeModel(ctx: RenderContext): SlimeModel {
  const { lambert, basic } = ctx;
  const group = new THREE.Group(), body = new THREE.Group();
  const mat = lambert(PAL.G, { transparent: true, opacity: 0.9, emissive: col("#000000") });
  ctx.glowAtNight(mat);                                       // so you can still make it out at night
  const blob = new THREE.Mesh(new THREE.IcosahedronGeometry(0.36, 0), mat);
  blob.scale.set(1, 0.72, 1); blob.position.y = 0.26;
  const eyeMat = basic(PAL.k);
  const eyes = [-1, 1].map(s => { const e = new THREE.Mesh(box(0.06, 0.1, 0.06), eyeMat); e.position.set(0.3, 0.32, s * 0.11); return e; });
  const white = basic(PAL.W);
  const shine = new THREE.Mesh(box(0.08, 0.05, 0.08), white); shine.position.set(-0.08, 0.46, -0.12);   // sunk into the top, not hovering over it
  const glints = eyes.map(e => { const g = new THREE.Mesh(box(0.02, 0.025, 0.02), white); g.position.set(0.335, 0.35, e.position.z - 0.015); return g; });   // a catchlight in each eye
  body.add(blob, ...eyes, ...glints, shine);
  group.add(body);
  return { group, body, mat };
}

export const MAGE_EYES: Record<School, string> = { ember: PAL.O, frost: PAL.C, storm: "#fff6c8" };

/** The hero's body in a school's robes, hood and boots, with glowing eyes. Added to the scene (see makeBody). */
export function makeMageBody(ctx: RenderContext, school: School): Body {
  const m = makeBody(ctx);
  const eyeMat = ctx.glow(MAGE_EYES[school]);
  m.eyes.forEach(eye => { eye.material = eyeMat; });
  m.ripple.visible = false;
  dressBody(ctx, m, { helm: school, armor: school, boots: school, weapon: null, ring: null, amulet: null, weaponType: null });
  // A faint glow of its own in the dark, so you can still make it out at night: on its own copies of the
  // materials, as the hero's and the townsfolk's bodies may share them.
  m.group.traverse(o => {
    if (!(o instanceof THREE.Mesh) || !(o.material instanceof THREE.MeshLambertMaterial)) return;
    o.material = o.material.clone();
    ctx.glowAtNight(o.material);
  });
  return m;
}
