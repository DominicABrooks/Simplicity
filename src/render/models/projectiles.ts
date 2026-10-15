import * as THREE from "three";
import type { BoltKind } from "../../data/enemies.ts";
import { PAL } from "../../data/palette.ts";
import { box, col, type RenderContext } from "../context.ts";

/** Arrow: oak shaft along +X, stone head, ember fletching. The head glows on a power shot. */
export function makeArrowMesh(ctx: RenderContext, power = false): THREE.Group & { userData: { tip: THREE.Mesh<THREE.BufferGeometry, THREE.MeshLambertMaterial> } } {
  const { lambert } = ctx, g = new THREE.Group();
  const shaft = new THREE.Mesh(box(0.42, 0.025, 0.025), lambert(PAL.N)); shaft.position.x = 0.21;
  const tip = new THREE.Mesh(new THREE.ConeGeometry(0.035, 0.09, 4).rotateZ(-Math.PI / 2), lambert(PAL.w, { emissive: col(PAL.Y), emissiveIntensity: power ? 1 : 0 }));
  tip.position.x = 0.45;
  const fletch = new THREE.Mesh(box(0.1, 0.06, 0.01), lambert(PAL.R)); fletch.position.x = 0.04;
  g.add(shaft, tip, fletch);
  g.userData.tip = tip;
  return g as THREE.Group & { userData: { tip: typeof tip } };
}

/** Spell orbs: a solid core in a glowing shell. Mages hold them while charging; bolts fly as them. */
export const ORB_COLORS: Record<BoltKind, [string, string]> = { fire: [PAL.Y, PAL.R], poly: ["#e6d2ff", PAL.P], frost: [PAL.W, PAL.C], spark: ["#ffffff", PAL.Y] };

export function makeOrbMesh(ctx: RenderContext, kind: BoltKind = "fire"): THREE.Group {
  const g = new THREE.Group(), [core, shell] = ORB_COLORS[kind];
  g.add(new THREE.Mesh(new THREE.IcosahedronGeometry(0.1, 0), ctx.glow(core)));
  g.add(new THREE.Mesh(new THREE.IcosahedronGeometry(0.17, 0), ctx.glow(shell, { transparent: true, opacity: 0.6, depthWrite: false, blending: THREE.AdditiveBlending })));
  return g;
}
