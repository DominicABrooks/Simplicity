// What you'd find in a castle (its guards are game entities: see spawnGuard and the guard view): the
// barbican and drawbridge before its gate, stairs up to its wall walks and torches on its walls, braziers
// by the keep's stair, a training yard (archery butts, practice dummies, weapon racks), a smithy at its
// forge, a covered well, a trebuchet, stables, and horses at a trough with a hay cart. Low-poly and
// hand-painted like the rest of the town, at the hero's scale (about 1.1 units tall). Each is built
// facing south (+z) and turned to its facing.
import * as THREE from "three";
import { PAL } from "../data/palette.ts";
import { T } from "../data/world.ts";
import { box, type RenderContext } from "./context.ts";
import { STRAW, TURN, at, centreOf } from "./market.ts";
import type { PropView } from "./props.ts";
import { hash } from "./terrain.ts";
import { barbicanPlan } from "../world/plans.ts";
import { CLAY, DARK_WOOD, DOORWAY, IRON, SLATE, WOOD, merlons, occluder, roofGeometry, tiledBox, tiledCylinder, tower, type PropOf } from "./town.ts";

const STEEL = "#9aa3ad", BURLAP = "#b89a6a";

/** Add a mesh to a group at a position (and optional rotation), returning it. */
export function put(g: THREE.Object3D, geo: THREE.BufferGeometry, mat: THREE.Material, x: number, y: number, z: number, rx = 0, ry = 0, rz = 0): THREE.Mesh {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.rotation.set(rx, ry, rz);
  g.add(m);
  return m;
}

/** Place a group built facing south at a point, turned to `facing`. */
export function place(parent: THREE.Group, g: THREE.Group, x: number, z: number, facing: keyof typeof TURN = "south"): void {
  g.position.set(x, 0, z);
  g.rotation.y = TURN[facing];
  parent.add(g);
}

// ---------- Brazier ----------
/** An iron fire bowl on a tripod, its flames flickering and throwing embers. */
export function buildBrazier(ctx: RenderContext, parent: THREE.Group, p: PropOf<"brazier">): PropView {
  const { lambert, basic, particles } = ctx, g = new THREE.Group(), iron = lambert(IRON);
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2;
    put(g, box(0.05, 1.0, 0.05), iron, Math.cos(a) * 0.17, 0.48, Math.sin(a) * 0.17, Math.sin(a) * 0.2, 0, -Math.cos(a) * 0.2);
  }
  put(g, new THREE.CylinderGeometry(0.3, 0.16, 0.22, 8, 1, true), lambert(IRON, { side: THREE.DoubleSide }), 0, 1.02, 0);
  put(g, new THREE.CylinderGeometry(0.27, 0.27, 0.04, 8), basic("#e8642a"), 0, 1.06, 0);   // the coals
  const flames = [PAL.O, PAL.Y, "#e8642a"].map((c, i) => put(g, new THREE.ConeGeometry(0.14 - i * 0.03, 0.45 - i * 0.1, 5), basic(c), (i - 1) * 0.07, 1.28, (i % 2) * 0.05));
  const [x, z] = at(p);
  place(parent, g, x, z);
  return {
    update(t, dt) {
      flames.forEach((f, i) => { const s = 0.8 + Math.sin(t * (9 + i * 3) + i) * 0.2 + Math.sin(t * 23 + i) * 0.08; f.scale.set(1, s, 1); f.position.y = 1.08 + (0.45 - i * 0.1) * s / 2; });
      if (Math.random() < dt * 5) particles.spawn("fire", x + (Math.random() - 0.5) * 0.2, 1.4, z + (Math.random() - 0.5) * 0.2, (Math.random() - 0.5) * 0.3, 1.2, (Math.random() - 0.5) * 0.3, 0.6);
    },
  };
}

// ---------- Training dummy ----------
/** A straw-stuffed sack on a post with a crossbar for arms, a target painted on its chest. It wobbles. */
export function buildDummy(ctx: RenderContext, parent: THREE.Group, p: PropOf<"dummy">): PropView {
  const { lambert, basic } = ctx, g = new THREE.Group(), top = new THREE.Group(), wood = lambert(WOOD), sack = lambert(BURLAP);
  put(g, box(0.36, 0.08, 0.36), lambert(DARK_WOOD), 0, 0.04, 0);
  put(g, box(0.09, 0.7, 0.09), wood, 0, 0.4, 0);
  put(top, new THREE.CylinderGeometry(0.2, 0.17, 0.5, 8), sack, 0, 0.25, 0);
  put(top, box(0.9, 0.08, 0.08), wood, 0, 0.36, 0);
  for (const s of [-1, 1]) put(top, new THREE.CylinderGeometry(0.06, 0.06, 0.12, 6), lambert(STRAW), s * 0.48, 0.36, 0, 0, 0, Math.PI / 2);   // straw tufts
  put(top, new THREE.IcosahedronGeometry(0.15, 0), sack, 0, 0.64, 0);
  // The target on its chest: rings, each standing a little proud of the last.
  put(top, new THREE.CircleGeometry(0.13, 10), basic("#ffffff"), 0, 0.27, 0.21);
  put(top, new THREE.CircleGeometry(0.09, 10), basic(PAL.R), 0, 0.27, 0.23);
  put(top, new THREE.CircleGeometry(0.04, 8), basic("#ffffff"), 0, 0.27, 0.25);
  top.position.y = 0.72;
  g.add(top);
  const [x, z] = at(p), k = hash(x, z, 701) * 10;
  place(parent, g, x, z, p.facing);
  return { update(t) { top.rotation.z = Math.sin(t * 1.3 + k) * 0.04; } };
}

// ---------- Archery butt ----------
/** A round straw butt on an A-frame, painted with rings, a few arrows stuck in it. */
export function buildTarget(ctx: RenderContext, parent: THREE.Group, p: PropOf<"target">): PropView {
  const { lambert, basic } = ctx, g = new THREE.Group(), wood = lambert(DARK_WOOD);
  for (const s of [-1, 1]) put(g, box(0.07, 1.25, 0.07), wood, s * 0.38, 0.6, -0.12, 0.25, 0, s * -0.12);   // the A-frame
  put(g, box(0.07, 1.0, 0.07), wood, 0, 0.45, -0.38, -0.45);                                                // and its prop
  const face = new THREE.Group();
  put(face, new THREE.CylinderGeometry(0.46, 0.46, 0.2, 14), lambert(STRAW), 0, 0, 0, Math.PI / 2);
  for (const [r, c, i] of [[0.42, "#ffffff", 0], [0.32, PAL.K, 1], [0.23, "#3f6fd0", 2], [0.14, PAL.R, 3], [0.06, PAL.Y, 4]] as const)
    put(face, new THREE.CircleGeometry(r, 14), basic(c), 0, 0, 0.12 + i * 0.02);   // far enough apart for the depth buffer
  // Arrows in it, at a slant.
  for (let i = 0; i < 3; i++) {
    const ax = (hash(i, p.x, 702) - 0.5) * 0.4, ay = (hash(i, p.y, 703) - 0.5) * 0.4;
    put(face, new THREE.CylinderGeometry(0.012, 0.012, 0.45, 4), lambert(WOOD), ax, ay, 0.3, Math.PI / 2 + 0.15, 0, 0);
    put(face, box(0.06, 0.05, 0.08), basic("#ffffff"), ax, ay - 0.03, 0.5);
  }
  face.position.set(0, 0.8, 0);
  face.rotation.x = -0.12;
  g.add(face);
  const [x, z] = at(p);
  place(parent, g, x, z, p.facing);
}

// ---------- Weapon rack ----------
/** A wooden rack: spears leaning in it, swords hanging, a shield against its end. */
export function buildRack(ctx: RenderContext, parent: THREE.Group, p: PropOf<"rack">): PropView {
  const { lambert, basic } = ctx, g = new THREE.Group(), wood = lambert(WOOD), steel = lambert(STEEL), gold = basic(PAL.Y);
  const len = Math.max(p.rect.w, p.rect.h) / T - 0.3;
  for (const s of [-1, 1]) put(g, box(0.08, 1.1, 0.08), wood, s * len / 2, 0.55, -0.1);
  put(g, box(len, 0.07, 0.07), wood, 0, 1.0, -0.1);
  put(g, box(len, 0.07, 0.07), wood, 0, 0.25, 0.08);
  const n = Math.max(2, Math.floor(len / 0.3));
  for (let i = 0; i < n; i++) {
    const x = -len / 2 + 0.2 + (i * (len - 0.4)) / (n - 1);
    if (i % 2 === 0) {                                                         // a spear, leaning back
      put(g, new THREE.CylinderGeometry(0.02, 0.02, 1.5, 5), lambert(DARK_WOOD), x, 0.75, 0, -0.12);
      put(g, new THREE.ConeGeometry(0.04, 0.16, 4), steel, x, 1.53, -0.09);
    } else {                                                                   // a sword, hanging point down
      put(g, box(0.05, 0.6, 0.015), steel, x, 0.62, -0.05);
      put(g, box(0.2, 0.04, 0.04), gold, x, 0.94, -0.05);
      put(g, box(0.04, 0.12, 0.04), lambert(DARK_WOOD), x, 1.02, -0.05);
    }
  }
  put(g, new THREE.CylinderGeometry(0.24, 0.24, 0.05, 10), lambert("#3f6fd0"), len / 2 + 0.12, 0.3, 0.05, Math.PI / 2 - 0.25, 0, 0.1);   // a shield
  put(g, new THREE.CylinderGeometry(0.07, 0.07, 0.06, 6), gold, len / 2 + 0.12, 0.31, 0.09, Math.PI / 2 - 0.25, 0, 0.1);
  const [x, z] = centreOf(p.rect);
  place(parent, g, x, z, p.facing);
}

// ---------- Well ----------
/** A round stone well under a little shingled roof, with a crank, a rope and a bucket. */
export function buildWell(ctx: RenderContext, parent: THREE.Group, p: PropOf<"well">): PropView {
  const { lambert, tex } = ctx, g = new THREE.Group(), wood = lambert(DARK_WOOD);
  put(g, tiledCylinder(0.62, 0.62, 10, 0.5, true), lambert("#ffffff", { map: tex.stone, side: THREE.DoubleSide }), 0, 0.31, 0);
  put(g, new THREE.RingGeometry(0.48, 0.7, 10), lambert("#8a8378"), 0, 0.63, 0, -Math.PI / 2);
  put(g, new THREE.CircleGeometry(0.5, 10), lambert("#152a3a"), 0, 0.2, 0, -Math.PI / 2);   // the water, far down
  for (const s of [-1, 1]) put(g, box(0.09, 1.5, 0.09), wood, s * 0.6, 0.75, 0);
  put(g, new THREE.CylinderGeometry(0.05, 0.05, 1.3, 6), wood, 0, 1.1, 0, 0, 0, Math.PI / 2);      // the axle
  put(g, box(0.05, 0.25, 0.05), wood, 0.72, 1.0, 0.05);                                             // its crank
  put(g, new THREE.CylinderGeometry(0.008, 0.008, 0.5, 3), lambert("#c9b48a"), 0, 0.85, 0);        // rope
  put(g, new THREE.CylinderGeometry(0.09, 0.07, 0.14, 8), lambert(WOOD), 0, 0.56, 0);                // bucket, resting on the lip
  put(g, roofGeometry(1.5, 1.3, 0.55), lambert(CLAY, { map: tex.shingles, side: THREE.DoubleSide }), 0, 1.5, 0);
  const [x, z] = at(p);
  place(parent, g, x, z);
  return { occluders: [occluder(g, x, z, 1.5, 1.4, 2.0)] };
}

// ---------- Smithy ----------
/** A lean-to forge: a stone hearth with glowing coals and a hood, an anvil on a stump, a grindstone and a quench barrel. */
export function buildSmithy(ctx: RenderContext, parent: THREE.Group, p: PropOf<"smithy">): PropView {
  const { lambert, basic, tex, particles } = ctx, g = new THREE.Group(), iron = lambert(IRON), wood = lambert(DARK_WOOD);
  const w = p.rect.w / T - 0.2, d = p.rect.h / T - 0.2;
  // The lean-to: posts and a sloping shingled roof over the back half.
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 0.1], [1, 0.1]] as const) put(g, box(0.1, sz < 0 ? 2.0 : 1.6, 0.1), wood, sx * (w / 2 - 0.05), (sz < 0 ? 2.0 : 1.6) / 2, sz * (d / 2 - 0.05));
  put(g, box(w + 0.3, 0.06, d * 0.7), lambert("#6a5a4a", { map: tex.shingles }), 0, 1.82, -d * 0.2, 0.35);
  // The hearth at the back, its coals, hood and chimney.
  const hx = -w / 2 + 0.6;
  put(g, tiledBox(1.0, 0.75, 0.8, 0.5), lambert("#ffffff", { map: tex.stone }), hx, 0.375, -d / 2 + 0.45);
  const coals = put(g, box(0.7, 0.05, 0.5), basic("#e8642a"), hx, 0.77, -d / 2 + 0.45);
  put(g, new THREE.CylinderGeometry(0.15, 0.5, 0.45, 4, 1, true), lambert("#77706a", { side: THREE.DoubleSide }), hx, 1.25, -d / 2 + 0.45, 0, Math.PI / 4);
  put(g, tiledBox(0.3, 1.2, 0.3, 0.5), lambert("#ffffff", { map: tex.stone }), hx, 1.95, -d / 2 + 0.45);
  put(g, box(0.4, 0.2, 0.25), lambert("#7a4a2a"), hx + 0.62, 0.5, -d / 2 + 0.45, 0, 0, 0.3);   // the bellows
  // The anvil on its stump, out front.
  const ax = 0.2, az = d / 2 - 0.45;
  put(g, new THREE.CylinderGeometry(0.2, 0.22, 0.45, 8), lambert(WOOD), ax, 0.225, az);
  put(g, box(0.18, 0.12, 0.16), iron, ax, 0.51, az);
  put(g, box(0.42, 0.1, 0.2), iron, ax, 0.62, az);
  put(g, new THREE.ConeGeometry(0.08, 0.2, 4), iron, ax + 0.3, 0.62, az, 0, 0, -Math.PI / 2);
  put(g, box(0.05, 0.05, 0.3), wood, ax - 0.1, 0.7, az + 0.05, 0, 0.4);                    // a hammer on it
  put(g, box(0.12, 0.08, 0.08), iron, ax - 0.04, 0.71, az + 0.18, 0, 0.4);
  // The grindstone and the quench barrel.
  const gx = w / 2 - 0.4;
  for (const s of [-1, 1]) put(g, box(0.06, 0.6, 0.06), wood, gx + s * 0.18, 0.3, -0.1);
  put(g, new THREE.CylinderGeometry(0.28, 0.28, 0.1, 12), lambert("#a8a090"), gx, 0.6, -0.1, 0, 0, Math.PI / 2);
  put(g, new THREE.CylinderGeometry(0.22, 0.2, 0.5, 9), lambert(WOOD), gx, 0.25, az);
  put(g, new THREE.CircleGeometry(0.2, 9), lambert("#ffffff", { map: tex.water }), gx, 0.49, az, -Math.PI / 2);
  const [x, z] = centreOf(p.rect);
  place(parent, g, x, z);
  // Where things are in the world (the smithy faces south, unturned).
  const hearth = { x: x + hx, z: z - d / 2 + 0.45 }, anvil = { x: x + ax, z: z + az };
  let ring = 0;
  return {
    update(t, dt) {
      (coals.material as THREE.MeshBasicMaterial).color.setHSL(0.05, 0.85, 0.5 + Math.sin(t * 3) * 0.06);   // the coals breathe
      if (Math.random() < dt * 4) particles.spawn("ember", hearth.x + (Math.random() - 0.5) * 0.5, 0.85, hearth.z, 0, 0.9, 0, 0.7);
      ring -= dt;                                                                  // the smith's hammer, every so often
      if (ring <= 0) {
        ring = 1.2 + Math.random() * 1.5;
        for (let i = 0; i < 6; i++) { const a = Math.random() * Math.PI * 2; particles.spawn("hit", anvil.x, 0.7, anvil.z, Math.cos(a) * 0.8, 0.8 + Math.random(), Math.sin(a) * 0.8, 0.35); }
      }
    },
    occluders: [occluder(g, x, z, w, d, 2.0)],
  };
}

// ---------- Trebuchet ----------
/** A siege engine at rest: two A-frames on a base, the long throwing arm cocked, a counterweight and a sling with its stone. */
export function buildTrebuchet(ctx: RenderContext, parent: THREE.Group, p: PropOf<"trebuchet">): PropView {
  const { lambert, tex } = ctx, g = new THREE.Group(), wood = lambert(WOOD), dark = lambert(DARK_WOOD);
  const len = Math.max(p.rect.w, p.rect.h) / T - 0.3, wid = Math.min(p.rect.w, p.rect.h) / T - 0.4;
  // Built along z (the arm throws toward +z); turned so its long side runs along the rect.
  for (const s of [-1, 1]) {
    put(g, box(0.12, 0.12, len), dark, s * wid / 2, 0.06, 0);                         // base rails
    put(g, box(0.1, 2.0, 0.1), wood, s * wid / 2, 1.0, -0.35, 0.3);                    // the A-frame
    put(g, box(0.1, 2.0, 0.1), wood, s * wid / 2, 1.0, 0.35, -0.3);
  }
  for (const zz of [-len / 2 + 0.1, len / 2 - 0.1]) put(g, box(wid, 0.1, 0.1), dark, 0, 0.06, zz);
  put(g, new THREE.CylinderGeometry(0.06, 0.06, wid + 0.2, 6), lambert(IRON), 0, 1.9, 0, 0, 0, Math.PI / 2);   // the axle
  const arm = new THREE.Group();
  put(arm, box(0.1, 0.1, 3.0), wood, 0, 0, 0.6);
  put(arm, tiledBox(0.6, 0.55, 0.5, 0.4), lambert("#ffffff", { map: tex.stone }), 0, -0.4, -0.85);   // the counterweight
  arm.position.y = 1.9;
  arm.rotation.x = -0.55;                                                              // cocked: the long end down at the back
  g.add(arm);
  put(g, new THREE.IcosahedronGeometry(0.2, 0), lambert("#77706a"), 0, 0.2, len / 2 - 0.35);   // the stone, in its sling
  put(g, new THREE.CylinderGeometry(0.01, 0.01, 1.2, 3), lambert("#c9b48a"), 0, 0.75, len / 2 - 0.5, 0.5);
  const [x, z] = centreOf(p.rect);
  place(parent, g, x, z, p.facing);
  return { occluders: [occluder(g, x, z, p.rect.w / T, p.rect.h / T, 3.2)] };
}

// ---------- Hay cart ----------
/** A two-wheeled cart piled with hay, its shafts resting on the ground. */
export function buildCart(ctx: RenderContext, parent: THREE.Group, p: PropOf<"cart">): PropView {
  const { lambert } = ctx, g = new THREE.Group(), wood = lambert(WOOD), dark = lambert(DARK_WOOD);
  const len = Math.max(p.rect.w, p.rect.h) / T - 0.5;
  // Built along z, its shafts toward +z.
  put(g, box(0.8, 0.08, len * 0.6), wood, 0, 0.5, -len * 0.15);
  for (const s of [-1, 1]) {
    put(g, box(0.05, 0.22, len * 0.6), wood, s * 0.4, 0.62, -len * 0.15);
    put(g, new THREE.CylinderGeometry(0.34, 0.34, 0.06, 10), dark, s * 0.46, 0.34, -len * 0.15, 0, 0, Math.PI / 2);
    put(g, box(0.05, 0.05, len * 0.55), dark, s * 0.28, 0.3, len * 0.25, -0.3);
  }
  put(g, box(0.7, 0.35, len * 0.5), lambert(STRAW), 0, 0.78, -len * 0.15, 0, 0.05);
  put(g, box(0.55, 0.2, len * 0.35), lambert(STRAW), 0, 1.02, -len * 0.18, 0, -0.08);
  const [x, z] = centreOf(p.rect);
  place(parent, g, x, z, p.facing);
}

// ---------- Horse ----------
interface Horse { group: THREE.Group; neck: THREE.Group; tail: THREE.Group }

/** A saddled horse, built along z with its head toward +z (`saddled` or bare). */
function makeHorse(ctx: RenderContext, coatColor: string, saddled: boolean): Horse {
  const { lambert } = ctx, g = new THREE.Group(), coat = lambert(coatColor), mane = lambert("#3a2a20");
  put(g, box(0.42, 0.42, 1.1), coat, 0, 0.82, 0);
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]] as const) {
    put(g, box(0.1, 0.62, 0.11), coat, sx * 0.14, 0.31, sz * 0.4);
    put(g, box(0.11, 0.08, 0.12), mane, sx * 0.14, 0.04, sz * 0.4);                    // hooves
  }
  const neck = new THREE.Group();
  put(neck, box(0.22, 0.5, 0.26), coat, 0, 0.22, 0);
  put(neck, box(0.06, 0.5, 0.2), mane, 0, 0.25, -0.12);
  put(neck, box(0.2, 0.2, 0.42), coat, 0, 0.5, 0.15);                                  // head
  for (const s of [-1, 1]) put(neck, new THREE.ConeGeometry(0.04, 0.1, 4), coat, s * 0.06, 0.64, 0.02);   // ears
  neck.position.set(0, 0.95, 0.5);
  neck.rotation.x = 0.55;
  g.add(neck);
  const tail = new THREE.Group();
  put(tail, box(0.08, 0.55, 0.08), mane, 0, -0.27, 0);
  tail.position.set(0, 0.95, -0.56);
  tail.rotation.x = -0.25;
  g.add(tail);
  if (saddled) {
    put(g, box(0.46, 0.08, 0.4), lambert(CLAY), 0, 1.05, -0.05);                       // saddle cloth
    put(g, box(0.3, 0.1, 0.3), lambert(DARK_WOOD), 0, 1.11, -0.05);                   // saddle
  }
  return { group: g, neck, tail };
}

/** Shifting its weight, swishing its tail, now and then dropping its head to graze. */
const animateHorse = (h: Horse, t: number, k: number) => {
  h.tail.rotation.z = Math.sin(t * 2.2 + k) * 0.25;
  h.neck.rotation.x = 0.55 + (Math.sin(t * 0.3 + k) > 0.7 ? 0.5 : 0) + Math.sin(t * 1.1 + k) * 0.03;
};
const COATS = ["#8a5a34", "#e8e0d0", "#5a3a26", "#3a2a20", "#a8794a"] as const;

/** A saddled horse, tied up. */
export function buildHorse(ctx: RenderContext, parent: THREE.Group, p: PropOf<"horse">): PropView {
  const h = makeHorse(ctx, COATS[Math.floor(hash(p.rect.x, p.rect.y, 704) * COATS.length)]!, true);
  const [x, z] = centreOf(p.rect), k = hash(x, z, 705) * 10;
  place(parent, h.group, x, z, p.facing);
  return { update(t) { animateHorse(h, t, k); } };
}

// ---------- Stable ----------
/** A long timber stable, open along its front under a lean-to roof, partitioned into stalls with a horse in most of them. */
export function buildStable(ctx: RenderContext, parent: THREE.Group, p: PropOf<"stable">): PropView {
  const { lambert, tex } = ctx, g = new THREE.Group(), wood = lambert(WOOD), dark = lambert(DARK_WOOD);
  const sideways = p.facing === "east" || p.facing === "west";
  const w = (sideways ? p.rect.h : p.rect.w) / T - 0.3, d = (sideways ? p.rect.w : p.rect.h) / T - 0.3, H = 2.6;
  put(g, tiledBox(w, H, 0.2, 1.15), lambert("#ffffff", { map: tex.timber }), 0, H / 2, -d / 2 + 0.1);   // back wall
  for (const s of [-1, 1]) put(g, tiledBox(0.2, H, d, 1.15), lambert("#ffffff", { map: tex.timber }), s * (w / 2 - 0.1), H / 2, 0);
  const roof = put(g, box(w + 0.4, 0.12, d + 0.9), lambert(CLAY, { map: tex.shingles }), 0, H + 0.45, 0.2);
  roof.rotation.x = 0.3;
  const stalls = Math.max(2, Math.floor(w / 1.6)), horses: Horse[] = [];
  for (let i = 0; i < stalls; i++) {
    const x = -w / 2 + (i + 0.5) * (w / stalls);
    put(g, box(0.1, 2.1, 0.1), dark, x + w / stalls / 2, 1.05, d / 2 - 0.1);            // posts along the front
    if (i < stalls - 1) put(g, box(0.08, 1.1, d * 0.75), wood, x + w / stalls / 2, 0.55, -d * 0.12);   // stall partitions
    put(g, box(1.0, 0.4, 0.25), lambert("#d9b46a"), x, 1.3, -d / 2 + 0.3);                // hay racks
    if (hash(p.rect.x + i, p.rect.y, 706) < 0.8) {
      const h = makeHorse(ctx, COATS[Math.floor(hash(p.rect.x, p.rect.y + i, 707) * COATS.length)]!, false);
      h.group.position.set(x, 0, 0);
      g.add(h.group);
      horses.push(h);
    }
  }
  put(g, box(w, 0.1, 0.1), dark, 0, 2.1, d / 2 - 0.1);
  const [x, z] = centreOf(p.rect);
  place(parent, g, x, z, p.facing);
  return {
    update(t) { horses.forEach((h, i) => animateHorse(h, t, i * 2.3 + x)); },
    occluders: [occluder(g, x, z, (sideways ? d : w) + 0.8, (sideways ? w : d) + 0.8, H + 0.8)],
  };
}

// ---------- Barbican ----------
/**
 * An outer gate in front of a main gate (see barbicanPlan): a walled passage with a round tower at each
 * front corner and a crenellated arch over its mouth, open toward its facing.
 */
export function buildBarbican(ctx: RenderContext, parent: THREE.Group, p: PropOf<"barbican">): PropView {
  const { lambert, basic, tex } = ctx, g = new THREE.Group(), b = barbicanPlan(p), H = p.height, stone = lambert("#ffffff", { map: tex.stone });
  for (const s of [-1, 1]) {
    const len = b.deep - b.towerR * 0.7, x = s * (b.gap / 2 + b.side / 2), z = -b.towerR * 0.35;
    put(g, tiledBox(b.side, H, len, 0.8), stone, x, H / 2, z);
    const m = merlons(len, H, 0.35, stone);
    m.rotation.y = Math.PI / 2;
    m.position.set(s * (b.gap / 2 + b.side - 0.2), 0, z);
    g.add(m);
    const t = tower(ctx, b.towerR, H + 2.6, SLATE);
    t.position.set(s * b.towerX, 0, b.towerZ);
    g.add(t);
  }
  const archY = 3.4;
  put(g, tiledBox(b.gap + 0.6, H + 0.9 - archY, 1.2, 0.8), stone, 0, archY + (H + 0.9 - archY) / 2, b.towerZ);
  const top = merlons(b.gap + 0.6, H + 0.9, 1.2, stone);
  top.position.z = b.towerZ;
  g.add(top);
  put(g, new THREE.PlaneGeometry(b.gap, 0.3), basic(DOORWAY, { side: THREE.DoubleSide }), 0, archY - 0.15, b.towerZ + 0.61);
  const at = centreOf(p.rect);
  place(parent, g, at[0], at[1], p.facing);
  return { occluders: [occluder(g, at[0], at[1], p.rect.w / T + 1, p.rect.h / T + 1, H + 4)] };
}

// ---------- Drawbridge ----------
/** A lowered drawbridge over a moat, its gate to the north: a heavy plank deck, chains running up to the gatehouse. */
export function buildDrawbridge(ctx: RenderContext, parent: THREE.Group, p: PropOf<"drawbridge">): PropView {
  const { lambert } = ctx, g = new THREE.Group(), w = p.rect.w / T + 0.4, len = p.rect.h / T + 0.6, iron = lambert(IRON);
  put(g, box(w, 0.22, len), lambert(WOOD), 0, -0.08, 0);
  for (let z = -len / 2 + 0.3; z < len / 2; z += 0.55) put(g, box(w + 0.02, 0.02, 0.05), lambert(DARK_WOOD), 0, 0.035, z);
  for (const s of [-1, 1]) {
    put(g, box(0.12, 0.12, len), iron, s * (w / 2 - 0.06), 0.08, 0);
    const rise = 3.6, run = len * 0.55, chain = put(g, new THREE.CylinderGeometry(0.04, 0.04, Math.hypot(rise, run), 4), iron, s * (w / 2 - 0.06), rise / 2 + 0.1, -len / 2 + run / 2 - len * 0.1);
    chain.rotation.x = -Math.atan2(run, rise);
  }
  const [x, z] = centreOf(p.rect);
  g.position.set(x, 0, z);
  parent.add(g);
}

// ---------- Stairs ----------
/** A stone flight of steps up to a wall walk, climbing toward its `rises` side. */
export function buildStairs(ctx: RenderContext, parent: THREE.Group, p: PropOf<"stairs">): PropView {
  const { lambert, tex } = ctx, g = new THREE.Group(), stone = lambert("#ffffff", { map: tex.stone });
  const sideways = p.rises === "east" || p.rises === "west";
  const len = (sideways ? p.rect.w : p.rect.h) / T - 0.1, wid = (sideways ? p.rect.h : p.rect.w) / T - 0.1;
  const steps = Math.max(4, Math.round(p.height / 0.28)), stepD = len / steps;
  for (let i = 0; i < steps; i++) {
    const h = ((i + 1) * p.height) / steps;
    put(g, tiledBox(wid, h, stepD, 0.6), stone, 0, h / 2, -len / 2 + (i + 0.5) * stepD);
  }
  const [x, z] = centreOf(p.rect);
  place(parent, g, x, z, p.rises);
  return { occluders: [occluder(g, x, z, p.rect.w / T, p.rect.h / T, p.height)] };
}

// ---------- Torch ----------
/** A torch in an iron sconce on a wall, its flame flickering, now and then an ember. */
export function buildTorch(ctx: RenderContext, parent: THREE.Group, p: PropOf<"torch">): PropView {
  const { lambert, basic, particles } = ctx, g = new THREE.Group(), iron = lambert(IRON);
  put(g, box(0.18, 0.3, 0.05), iron, 0, 0, 0);
  put(g, box(0.05, 0.05, 0.3), iron, 0, -0.05, 0.15);
  put(g, new THREE.CylinderGeometry(0.035, 0.03, 0.45, 5), lambert(DARK_WOOD), 0, 0.1, 0.3, -0.25, 0, 0);
  const flame = put(g, new THREE.ConeGeometry(0.09, 0.3, 5), basic(PAL.O), 0, 0.42, 0.36);
  const core = put(g, new THREE.ConeGeometry(0.05, 0.18, 5), basic(PAL.Y), 0, 0.38, 0.36);
  const [x, z] = at(p);
  g.position.set(x, p.height, z);
  g.rotation.y = TURN[p.facing];
  parent.add(g);
  const tip = new THREE.Vector3(0, 0.5, 0.36).applyAxisAngle(new THREE.Vector3(0, 1, 0), TURN[p.facing]);
  return {
    update(t, dt) {
      const s = 0.85 + Math.sin(t * 13 + x) * 0.12 + Math.sin(t * 29 + z) * 0.06;
      flame.scale.set(1, s, 1);
      core.scale.set(1, s * 1.1, 1);
      if (Math.random() < dt * 1.5) particles.spawn("fire", x + tip.x, p.height + tip.y, z + tip.z, 0, 0.8, 0, 0.5);
    },
  };
}

// ---------- Trough ----------
export function buildTrough(ctx: RenderContext, parent: THREE.Group, p: PropOf<"trough">): PropView {
  const { lambert, tex } = ctx, g = new THREE.Group(), wood = lambert(WOOD);
  const w = p.rect.w / T - 0.3, d = p.rect.h / T - 0.45;
  put(g, box(w, 0.4, d), wood, 0, 0.2, 0);
  put(g, box(w - 0.1, 0.02, d - 0.1), lambert("#ffffff", { map: tex.water }), 0, 0.41, 0);   // full to the brim
  const [x, z] = centreOf(p.rect);
  place(parent, g, x, z);
}
