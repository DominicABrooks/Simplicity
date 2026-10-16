// Cinder, the Ember lieutenant (src/game/bosses.ts): what makes him more than a mage to look at. Laid over
// a mage's body (see the cinder view): the body burnt to charcoal and cracked with fire, in his own charcoal
// robe seamed with fire rather than any school's, no hood but a crown of burning shards floating over his
// bare head and a ring of fire behind it, a ragged ash mantle with a smouldering hem, molten-seamed
// pauldrons, and three coals circling him. Bigger than any mage.
import * as THREE from "three";
import { PAL } from "../../data/palette.ts";
import { GROUND, onGround, type RenderContext } from "../context.ts";
import { put } from "../castle.ts";
import { softDisc } from "../camp.ts";
import type { Body } from "./body.ts";

/** How much bigger than a mage he stands. */
export const CINDER_SCALE = 1.45;
const CHAR = "#2b2523", ASH = "#4a4340", FIRE = "#ff7a2a";

export interface CinderParts {
  /** The shards over his head, turning slowly. */
  crown: THREE.Group;
  /** The ring of fire behind his head. */
  halo: THREE.Mesh;
  /** The coals circling him, at chest height. */
  coals: THREE.Group;
  /** The glow of everything burning on him, breathing (and flaring as he casts). */
  fire: THREE.MeshBasicMaterial;
  /** A pool of heat on the ground under him. */
  heat: THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>;
  light: THREE.PointLight;
}

/** Burn a mage's body into Cinder's: recolour its bare stone, and add his crown, mantle, pauldrons and coals. */
export function makeCinder(ctx: RenderContext, m: Body): CinderParts {
  const { lambert, glow } = ctx;
  const stone = new THREE.Color(PAL.w);
  m.body.traverse(o => {                                      // the bare stone body and head go charcoal
    if (o instanceof THREE.Mesh && o.material instanceof THREE.MeshLambertMaterial && o.material.color.equals(stone)) o.material.color.set(CHAR);
  });
  m.eyes.forEach(e => { e.material = glow(PAL.Y); e.scale.set(1, 1.25, 1.3); });
  const fire = glow(FIRE, { transparent: true, opacity: 0.95 }), char = lambert(CHAR), ash = lambert(ASH, { side: THREE.DoubleSide });
  ctx.glowAtNight(char, ash);

  // Fire in the cracks of his face: two seams down from the eyes, one across the brow.
  for (const s of [-1, 1]) put(m.body, new THREE.BoxGeometry(0.02, 0.16, 0.025), fire, 0.27, 0.68, s * 0.1, s * 0.25, 0, 0);
  put(m.body, new THREE.BoxGeometry(0.02, 0.025, 0.2), fire, 0.25, 0.94, 0, 0, 0, 0.3);

  // The crown: six black shards, tipped with fire, leaning out from over his head.
  const crown = new THREE.Group();
  crown.position.y = 1.12;
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2, h = i % 2 ? 0.3 : 0.42, shard = new THREE.Group();
    shard.position.set(Math.cos(a) * 0.2, 0, Math.sin(a) * 0.2);
    shard.rotation.set(Math.sin(a) * 0.4, 0, -Math.cos(a) * 0.4);
    put(shard, new THREE.ConeGeometry(0.055, h, 4).translate(0, h / 2, 0), char, 0, 0, 0);
    put(shard, new THREE.ConeGeometry(0.03, 0.12, 4).translate(0, 0.06, 0), fire, 0, h - 0.04, 0);
    crown.add(shard);
  }
  m.body.add(crown);
  // The ring of fire behind his head, upright, across his shoulders' line.
  const halo = put(m.body, new THREE.TorusGeometry(0.4, 0.028, 4, 20), fire, -0.16, 0.86, 0, 0, Math.PI / 2, 0);

  // His robe: charcoal, split up the front on a seam of fire, belted with fire, smouldering at the hem.
  put(m.body, new THREE.CylinderGeometry(0.25, 0.42, 0.62, 8), char, 0, 0.33, 0);
  put(m.body, new THREE.BoxGeometry(0.03, 0.5, 0.05), fire, 0.4, 0.26, 0, 0, 0, 0.24);
  for (const s of [-1, 1]) put(m.body, new THREE.BoxGeometry(0.025, 0.36, 0.04), fire, 0.17, 0.3, s * 0.36, s * 0.3, 0, 0.2);
  put(m.body, new THREE.TorusGeometry(0.29, 0.025, 4, 12), fire, 0, 0.52, 0, Math.PI / 2, 0, 0);
  put(m.body, new THREE.TorusGeometry(0.42, 0.022, 4, 16), fire, 0, 0.03, 0, Math.PI / 2, 0, 0);
  // The mantle: ragged ash over his back and shoulders, open at the front, smouldering at its hem.
  const open = 0.6 * Math.PI, start = Math.PI / 2 + open / 2, len = Math.PI * 2 - open;
  put(m.body, new THREE.CylinderGeometry(0.2, 0.46, 0.55, 9, 1, true, start, len), ash, -0.02, 0.4, 0);
  for (let i = 0; i <= 8; i++) {
    const a = start + (i / 8) * len, h = 0.1 + (i % 3) * 0.05;
    put(m.body, new THREE.ConeGeometry(0.06, h, 3), i % 2 ? ash : fire, Math.sin(a) * 0.45 - 0.02, 0.13 - h / 2 + 0.02, Math.cos(a) * 0.45, Math.PI, 0, 0);
  }
  // The pauldrons: lumps of charcoal with molten seams and a spike each.
  for (const s of [-1, 1]) {
    const p = put(m.body, new THREE.DodecahedronGeometry(0.15, 0), char, -0.02, 0.66, s * 0.27);
    p.scale.set(1, 0.75, 1);
    put(m.body, new THREE.BoxGeometry(0.2, 0.025, 0.03), fire, -0.02, 0.69, s * 0.27, 0, 0, 0.4);
    put(m.body, new THREE.ConeGeometry(0.04, 0.22, 4), char, -0.04, 0.82, s * 0.32, s * 0.5, 0, 0);
  }

  // Three coals circling him: black crust round a burning heart.
  const coals = new THREE.Group();
  coals.position.y = 0.6;
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2, coal = new THREE.Group();
    coal.position.set(Math.cos(a) * 0.72, 0, Math.sin(a) * 0.72);
    put(coal, new THREE.IcosahedronGeometry(0.07, 0), fire, 0, 0, 0);
    put(coal, new THREE.DodecahedronGeometry(0.075, 0), char, 0.03, 0.02, 0.02);
    coals.add(coal);
  }
  m.group.add(coals);

  // A pool of heat under him, and his own light.
  const heat = new THREE.Mesh(new THREE.PlaneGeometry(2, 2).rotateX(-Math.PI / 2),
    glow(FIRE, { transparent: true, depthWrite: false, map: softDisc(), opacity: 0.35, blending: THREE.AdditiveBlending, ...onGround(GROUND.marker) }));
  heat.position.y = 0.025;
  heat.scale.setScalar(0.75);
  m.group.add(heat);
  const light = new THREE.PointLight(0xff7a2a, 3, 4, 1.4);
  light.position.set(0.2, 1, 0);
  m.group.add(light);

  m.group.scale.setScalar(CINDER_SCALE);
  m.shadow.scale.setScalar(CINDER_SCALE * 1.1);
  return { crown, halo, coals, fire, heat, light };
}

/** Every frame: the crown turns, the coals circle, the fire breathes, and all of it flares as he casts (k: 0..1). */
export function animateCinder(c: CinderParts, t: number, k: number): void {
  c.crown.rotation.y = t * 0.8;
  c.crown.position.y = 1.12 + Math.sin(t * 2) * 0.03 + k * 0.08;
  c.halo.rotation.x = t * 0.6;
  c.halo.scale.setScalar(1 + k * 0.25 + Math.sin(t * 6) * 0.03);
  c.coals.rotation.y = t * (1.6 + k * 4);
  c.coals.position.y = 0.6 + Math.sin(t * 1.7) * 0.06;
  c.fire.opacity = 0.75 + Math.sin(t * 5) * 0.15 + k * 0.1;
  c.heat.material.opacity = 0.28 + Math.sin(t * 3) * 0.06 + k * 0.25;
  c.heat.scale.setScalar(0.75 + k * 0.3);
  c.light.intensity = 3 + Math.sin(t * 9) * 0.4 + k * 3;
}
