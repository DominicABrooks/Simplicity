// Calder, the Storm captain of the Greyed (src/game/bosses.ts): what makes him more than a mage to look at. Laid over a
// mage's body (see the calder view): the body gone the slate of a stormy sky, in the long indigo coat of the wardens'
// captain rather than any school's robe, a high collar and spiked pauldrons, a small black storm cloud hanging over his
// bare head with lightning crawling down out of it to his shoulders, three sparks circling him, and a cold white light
// flickering on everything round him. Bigger than any of them. Also worn by his echoes (src/render/tempest.ts).
import * as THREE from "three";
import { PAL } from "../../data/palette.ts";
import { GROUND, onGround, type RenderContext } from "../context.ts";
import { put } from "../castle.ts";
import { softDisc } from "../camp.ts";
import type { Body } from "./body.ts";

/** How much bigger than a mage he stands. */
export const CALDER_SCALE = 1.55;
const SLATE = "#5d6577", COAT = "#3b4486", TRIM = "#8f9dff", BOLT = "#fff6c8";

export interface CalderParts {
  /** The storm cloud over his head, drifting and flashing. */
  cloud: THREE.Group;
  /** The sparks circling him, at chest height. */
  sparks: THREE.Group;
  /** The lightning crawling down out of the cloud: a jagged line, redrawn as it flickers. */
  arcs: THREE.LineSegments<THREE.BufferGeometry, THREE.LineBasicMaterial>;
  /** Everything lit with lightning on him (the coat's seams, his eyes' glow), flickering. */
  charge: THREE.MeshBasicMaterial;
  /** The cloud's own inner flash. */
  flash: THREE.MeshBasicMaterial;
  /** A pool of cold light on the ground under him. */
  pool: THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>;
  light: THREE.PointLight;
}

/** Storm a mage's body into Calder's: recolour its bare stone, and add his coat, collar, pauldrons, cloud and sparks. */
export function makeCalder(ctx: RenderContext, m: Body): CalderParts {
  const { lambert, glow } = ctx;
  const stone = new THREE.Color(PAL.w);
  m.body.traverse(o => {                                      // the bare stone body and head go storm-slate
    if (o instanceof THREE.Mesh && o.material instanceof THREE.MeshLambertMaterial && o.material.color.equals(stone)) o.material.color.set(SLATE);
  });
  m.eyes.forEach(e => { e.material = glow(BOLT); e.scale.set(1, 1.2, 1.35); });
  const charge = glow(BOLT, { transparent: true, opacity: 0.9 }), trim = glow(TRIM, { transparent: true, opacity: 0.8 });
  const coat = lambert(COAT, { side: THREE.DoubleSide }), dark = lambert("#24284f"), slate = lambert(SLATE);
  ctx.glowAtNight(coat, slate);

  // The captain's coat: long, flared, open a little at the front, a seam of lightning down it and round the hem.
  const open = 0.35 * Math.PI, start = open / 2, len = Math.PI * 2 - open;
  put(m.body, new THREE.CylinderGeometry(0.26, 0.5, 0.72, 10, 1, true, start, len), coat, 0, 0.36, 0);
  put(m.body, new THREE.CylinderGeometry(0.22, 0.3, 0.7, 8), dark, 0, 0.36, 0);
  put(m.body, new THREE.TorusGeometry(0.5, 0.018, 4, 18), trim, 0, 0.02, 0, Math.PI / 2, 0, 0);
  for (const s of [-1, 1]) put(m.body, new THREE.BoxGeometry(0.02, 0.62, 0.025), charge, Math.cos(start) * 0.4, 0.34, s * Math.sin(start) * 0.4, 0, 0, s * 0.18);
  put(m.body, new THREE.TorusGeometry(0.27, 0.025, 4, 12), trim, 0, 0.62, 0, Math.PI / 2, 0, 0);   // his belt
  // A high collar, open at the front, and spiked pauldrons.
  put(m.body, new THREE.CylinderGeometry(0.3, 0.22, 0.24, 9, 1, true, Math.PI * 0.75, Math.PI * 1.5), coat, -0.02, 0.86, 0);
  for (const s of [-1, 1]) {
    put(m.body, new THREE.SphereGeometry(0.15, 7, 5, 0, Math.PI * 2, 0, Math.PI / 2), dark, 0, 0.72, s * 0.3);
    for (let i = 0; i < 3; i++) put(m.body, new THREE.ConeGeometry(0.035, 0.18, 4), i === 1 ? charge : slate, -0.05 + i * 0.06, 0.84, s * 0.33, s * -0.3, 0, 0);
  }

  // The storm cloud over his head: a few dark puffs, a flash deep in them.
  const cloud = new THREE.Group(), puff = lambert("#2a2d3e"), flash = glow(BOLT, { transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending });
  cloud.position.y = 1.32;
  for (const [x, y, z, r] of [[0, 0, 0, 0.17], [0.13, -0.02, 0.08, 0.12], [-0.12, 0.01, -0.07, 0.13], [0.02, 0.05, -0.14, 0.11], [-0.05, -0.03, 0.15, 0.1]] as const)
    put(cloud, new THREE.IcosahedronGeometry(r, 0), puff, x, y, z);
  put(cloud, new THREE.IcosahedronGeometry(0.22, 0), flash, 0, -0.02, 0);
  m.group.add(cloud);

  // The lightning down out of it: a few jagged strands, redrawn as it flickers (see animateCalder).
  const arcs = new THREE.LineSegments(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: BOLT, transparent: true, opacity: 0.9 }));
  arcs.geometry.setAttribute("position", new THREE.Float32BufferAttribute(new Float32Array(ARC_POINTS * 6), 3));
  m.group.add(arcs);

  // Three sparks circling him.
  const sparks = new THREE.Group();
  sparks.position.y = 0.66;
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2, s = put(sparks, new THREE.OctahedronGeometry(0.07, 0), charge, Math.cos(a) * 0.78, 0, Math.sin(a) * 0.78);
    s.scale.set(0.8, 1.6, 0.8);
  }
  m.group.add(sparks);

  // A pool of cold light under him, and his own light.
  const pool = new THREE.Mesh(new THREE.PlaneGeometry(2, 2).rotateX(-Math.PI / 2),
    glow(TRIM, { transparent: true, depthWrite: false, map: softDisc(), opacity: 0.3, blending: THREE.AdditiveBlending, ...onGround(GROUND.marker) }));
  pool.position.y = 0.025;
  pool.scale.setScalar(0.8);
  m.group.add(pool);
  const light = new THREE.PointLight(0xcfd8ff, 2.2, 4.5, 1.4);
  light.position.set(0, 1.2, 0);
  m.group.add(light);

  m.group.scale.setScalar(CALDER_SCALE);
  m.shadow.scale.setScalar(CALDER_SCALE * 1.1);
  return { cloud, sparks, arcs, charge, flash, pool, light };
}

/** Strands of lightning down out of the cloud, and points along each. */
const STRANDS = 3, ARC_STEPS = 4, ARC_POINTS = STRANDS * ARC_STEPS;

/** Every frame: the cloud drifts and flashes, lightning crawls down out of it, the sparks circle, and it all brightens as he casts (k: 0..1). */
export function animateCalder(c: CalderParts, t: number, k: number): void {
  c.cloud.position.y = 1.32 + Math.sin(t * 1.3) * 0.03 + k * 0.1;
  c.cloud.rotation.y = t * 0.4;
  c.sparks.rotation.y = t * (2 + k * 5);
  c.sparks.position.y = 0.66 + Math.sin(t * 2.1) * 0.06;
  const flicker = Math.sin(t * 37) * Math.sin(t * 23) > 0.2 ? 1 : 0;   // on and off, irregularly
  c.flash.opacity = 0.15 + flicker * 0.55 + k * 0.3;
  c.charge.opacity = 0.65 + flicker * 0.3;
  c.pool.material.opacity = 0.22 + flicker * 0.08 + k * 0.25;
  c.light.intensity = 1.8 + flicker * 1.4 + k * 2.5;
  // Redraw the strands, from the cloud down to his shoulders and collar, every few frames.
  c.arcs.visible = flicker > 0 || k > 0.3;
  if (Math.floor(t * 20) % 2) return;
  const pos = c.arcs.geometry.getAttribute("position") as THREE.BufferAttribute;
  let n = 0;
  for (let s = 0; s < STRANDS; s++) {
    const a = s * 2.1 + t, end = { x: Math.cos(a) * 0.28, y: 0.86, z: Math.sin(a) * 0.3 };
    let from = { x: 0, y: 1.22, z: 0 };
    for (let i = 1; i <= ARC_STEPS; i++) {
      const f = i / ARC_STEPS, j = i === ARC_STEPS ? 0 : 0.07;
      const to = { x: end.x * f + (Math.random() - 0.5) * j, y: 1.22 + (end.y - 1.22) * f, z: end.z * f + (Math.random() - 0.5) * j };
      pos.setXYZ(n++, from.x, from.y, from.z);
      pos.setXYZ(n++, to.x, to.y, to.z);
      from = to;
    }
  }
  pos.needsUpdate = true;
}
