// Rime, the Frost lieutenant (src/game/bosses.ts): what makes her more than a mage to look at. Laid over a mage's
// body (see the rime view): the body gone the white-blue of old ice, in her own long pale robe rather than any
// school's, no hood but a crown of icicles floating over her head, a frost mantle trailing a hem of icicles, three
// shards of ice circling her, and the one note she hums, rippling out over the ice round her. Bigger than any mage.
import * as THREE from "three";
import { GROUND, onGround, type RenderContext } from "../context.ts";
import { put } from "../castle.ts";
import { softDisc } from "../camp.ts";
import type { Body } from "./body.ts";
import { PAL } from "../../data/palette.ts";

/** How much bigger than a mage she stands. */
export const RIME_SCALE = 1.45;
const ICE = "#cfe6f2", DEEP = "#3f6784", ROBE = "#b9d3e4", GLINT = "#9fe3ff";

export interface RimeParts {
  /** The icicles over her head, turning slowly. */
  crown: THREE.Group;
  /** The shards circling her, at chest height. */
  shards: THREE.Group;
  /** The cold glow on everything icy on her, breathing (and brightening as she casts). */
  frost: THREE.MeshBasicMaterial;
  /** The note she hums: a ring rippling out over the ice. */
  hum: THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>;
  /** A pool of rime-light on the ice under her. */
  pool: THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>;
  light: THREE.PointLight;
}

/** Freeze a mage's body into Rime's: recolour its bare stone, and add her crown, robe, mantle and shards. */
export function makeRime(ctx: RenderContext, m: Body): RimeParts {
  const { lambert, glow } = ctx;
  const stone = new THREE.Color(PAL.w);
  m.body.traverse(o => {                                      // the bare stone body and head go to old ice
    if (o instanceof THREE.Mesh && o.material instanceof THREE.MeshLambertMaterial && o.material.color.equals(stone)) o.material.color.set(ICE);
  });
  m.eyes.forEach(e => { e.material = glow(GLINT); e.scale.set(1, 1.1, 1.3); });
  const frost = glow(GLINT, { transparent: true, opacity: 0.85 }), ice = lambert(ICE), deep = lambert(DEEP), robe = lambert(ROBE, { side: THREE.DoubleSide });
  ctx.glowAtNight(ice, robe);

  // The crown: seven icicles hanging point-up in a ring over her head, the middle one tallest.
  const crown = new THREE.Group();
  crown.position.y = 1.1;
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2, h = i % 2 ? 0.22 : 0.34;
    put(crown, new THREE.ConeGeometry(0.04, h, 4).translate(0, h / 2, 0), i % 3 ? ice : frost, Math.cos(a) * 0.18, 0, Math.sin(a) * 0.18, Math.sin(a) * 0.25, 0, -Math.cos(a) * 0.25);
  }
  put(crown, new THREE.TorusGeometry(0.19, 0.018, 4, 14), frost, 0, 0.01, 0, Math.PI / 2, 0, 0);
  m.body.add(crown);

  // Her robe: long and pale, down to the ice, a seam of frost-light down the front and round the hem.
  put(m.body, new THREE.CylinderGeometry(0.24, 0.46, 0.66, 8), robe, 0, 0.33, 0);
  put(m.body, new THREE.BoxGeometry(0.025, 0.55, 0.04), frost, 0.42, 0.28, 0, 0, 0, 0.3);
  put(m.body, new THREE.TorusGeometry(0.46, 0.02, 4, 16), frost, 0, 0.02, 0, Math.PI / 2, 0, 0);
  put(m.body, new THREE.TorusGeometry(0.28, 0.022, 4, 12), deep, 0, 0.53, 0, Math.PI / 2, 0, 0);
  // The mantle: frost-blue over her back and shoulders, open at the front, its hem hung with icicles.
  const open = 0.6 * Math.PI, start = Math.PI / 2 + open / 2, len = Math.PI * 2 - open;
  put(m.body, new THREE.CylinderGeometry(0.2, 0.5, 0.6, 9, 1, true, start, len), deep, -0.02, 0.42, 0);
  for (let i = 0; i <= 8; i++) {
    const a = start + (i / 8) * len, h = 0.12 + (i % 3) * 0.06;
    put(m.body, new THREE.ConeGeometry(0.035, h, 4), i % 2 ? ice : frost, Math.sin(a) * 0.48 - 0.02, 0.12 - h / 2 + 0.02, Math.cos(a) * 0.48, Math.PI, 0, 0);
  }
  // A high collar of ice, splayed out behind her head.
  for (let i = 0; i < 5; i++) {
    const a = Math.PI * (0.7 + i * 0.15);
    put(m.body, new THREE.ConeGeometry(0.05, 0.3, 4), ice, Math.cos(a) * 0.2 - 0.05, 0.82, Math.sin(a) * 0.22, Math.sin(a) * -0.5, 0, Math.cos(a) * 0.5);
  }

  // Three shards of ice circling her.
  const shards = new THREE.Group();
  shards.position.y = 0.62;
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2, shard = put(shards, new THREE.OctahedronGeometry(0.09, 0), i ? ice : frost, Math.cos(a) * 0.74, 0, Math.sin(a) * 0.74);
    shard.scale.set(0.7, 1.7, 0.7);
  }
  m.group.add(shards);

  // A pool of cold light under her, the note she hums rippling out over the ice, and her own light.
  const pool = new THREE.Mesh(new THREE.PlaneGeometry(2, 2).rotateX(-Math.PI / 2),
    glow(GLINT, { transparent: true, depthWrite: false, map: softDisc(), opacity: 0.3, blending: THREE.AdditiveBlending, ...onGround(GROUND.marker) }));
  pool.position.y = 0.025;
  pool.scale.setScalar(0.8);
  const hum = new THREE.Mesh(new THREE.RingGeometry(0.92, 1, 32).rotateX(-Math.PI / 2),
    glow(GLINT, { transparent: true, depthWrite: false, opacity: 0, ...onGround(GROUND.marker) }));
  hum.position.y = 0.027;
  m.group.add(pool, hum);
  const light = new THREE.PointLight(0x9fe3ff, 2.4, 4, 1.4);
  light.position.set(0.2, 1, 0);
  m.group.add(light);

  m.group.scale.setScalar(RIME_SCALE);
  m.shadow.scale.setScalar(RIME_SCALE * 1.1);
  return { crown, shards, frost, hum, pool, light };
}

/** Every frame: the crown turns, the shards circle, her note ripples out, and it all brightens as she casts (k: 0..1). */
export function animateRime(r: RimeParts, t: number, k: number): void {
  r.crown.rotation.y = -t * 0.5;
  r.crown.position.y = 1.1 + Math.sin(t * 1.6) * 0.03 + k * 0.08;
  r.shards.rotation.y = -t * (1.2 + k * 3);
  r.shards.position.y = 0.62 + Math.sin(t * 1.3) * 0.07;
  r.frost.opacity = 0.7 + Math.sin(t * 3) * 0.12 + k * 0.15;
  r.pool.material.opacity = 0.24 + Math.sin(t * 2) * 0.05 + k * 0.25;
  const hum = (t / 2.2) % 1;                                  // one slow ripple after another
  r.hum.scale.setScalar(0.5 + hum * 2.6);
  r.hum.material.opacity = (1 - hum) * 0.45;
  r.light.intensity = 2.4 + Math.sin(t * 4) * 0.3 + k * 2.5;
}
