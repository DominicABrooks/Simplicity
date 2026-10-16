// What you find where the Witchwood goes wrong: the woodwardens' barricade across the trail south, sharpened
// stakes lashed to rails with a gap at the gate, and the cold cracks in the ground of the Ashwild, black
// at the heart, with a thin, faint, wrong-coloured light along them. Low-poly, at the hero's scale.
import * as THREE from "three";
import { T } from "../data/world.ts";
import type { RenderContext } from "./context.ts";
import { GROUND, onGround } from "./context.ts";
import { put } from "./castle.ts";
import type { PropView } from "./props.ts";
import { hash } from "./terrain.ts";
import { DARK_WOOD, WOOD, type PropOf } from "./town.ts";

/** The barricade: a row of stakes leaning out (south, the way trouble comes), two rails behind them, and the gate gap with its posts. */
export function buildBarricade(ctx: RenderContext, parent: THREE.Group, p: PropOf<"barricade">): PropView {
  const { lambert } = ctx, g = new THREE.Group(), wood = lambert(WOOD), dark = lambert(DARK_WOOD), rope = lambert("#b8a070");
  const x0 = p.rect.x / T, z = p.rect.y / T + p.rect.h / T / 2, w = p.rect.w / T, gx0 = x0 + p.gate, gx1 = gx0 + p.gateW;
  for (let x = x0 + 0.2; x < x0 + w; x += 0.32) {
    if (x > gx0 - 0.1 && x < gx1 + 0.1) continue;            // the gate stands open
    const k = hash(x, z, 77), h = 0.75 + k * 0.3;
    const stake = put(g, new THREE.CylinderGeometry(0.03, 0.06, h, 5), k < 0.5 ? wood : dark, x, h / 2, z + 0.08, 0.35, 0, (k - 0.5) * 0.12);
    put(stake, new THREE.ConeGeometry(0.06, 0.16, 5), lambert("#c8a878"), 0, h / 2 + 0.08, 0);          // the sharpened point
  }
  for (const [a, b] of [[x0, gx0], [gx1, x0 + w]] as const) {
    if (b - a < 0.1) continue;
    for (const y of [0.25, 0.55]) put(g, new THREE.BoxGeometry(b - a, 0.07, 0.07), dark, (a + b) / 2, y, z - 0.05);
    for (let x = a + 0.4; x < b; x += 1.1) put(g, new THREE.CylinderGeometry(0.075, 0.075, 0.09, 6), rope, x, 0.4, z - 0.05, 0, 0, Math.PI / 2);   // lashings
  }
  for (const x of [gx0, gx1]) {                               // the gateposts, taller, a lantern on one
    put(g, new THREE.CylinderGeometry(0.08, 0.09, 1.25, 6), dark, x, 0.62, z);
    put(g, new THREE.BoxGeometry(0.2, 0.06, 0.2), dark, x, 1.27, z);
  }
  put(g, new THREE.BoxGeometry(0.12, 0.16, 0.12), ctx.basic("#ffd070"), gx0, 1.1, z + 0.14);
  parent.add(g);
}

/** A crack in the ground: a jagged black gash, faintly lit along its edges in a cold, wrong light that breathes. */
export function buildCrack(ctx: RenderContext, parent: THREE.Group, p: PropOf<"crack">): PropView {
  const g = new THREE.Group(), dark = ctx.basic("#0c0a14", onGround(GROUND.stain));
  const glow = ctx.basic("#7ad0e8", { transparent: true, opacity: 0.5, depthWrite: false, ...onGround(GROUND.marker) });
  const steps = Math.max(3, Math.round(p.len * 2.2));
  let x = 0, z = 0;
  for (let i = 0; i < steps; i++) {
    const k = hash(p.x + i, p.y, 91), along = p.len / steps, turn = (k - 0.5) * 0.9, wide = 0.08 + Math.sin((i / (steps - 1)) * Math.PI) * 0.16;
    const seg = new THREE.PlaneGeometry(along * 1.15, wide).rotateX(-Math.PI / 2).rotateY(-turn);
    put(g, seg, dark, x + Math.cos(turn) * along / 2, 0.02, z + Math.sin(turn) * along / 2);
    put(g, new THREE.PlaneGeometry(along * 1.1, wide * 0.35).rotateX(-Math.PI / 2).rotateY(-turn), glow, x + Math.cos(turn) * along / 2, 0.024, z + Math.sin(turn) * along / 2);
    x += Math.cos(turn) * along;
    z += Math.sin(turn) * along;
  }
  // Centred on (x, y), turned to its angle.
  for (const c of g.children) { c.position.x -= x / 2; c.position.z -= z / 2; }
  g.position.set(p.x / T, 0, p.y / T);
  g.rotation.y = -p.angle;
  parent.add(g);
  const k = hash(p.x, p.y, 92) * 6;
  return { update: (t: number) => { glow.opacity = 0.35 + Math.sin(t * 1.3 + k) * 0.2; } };
}
