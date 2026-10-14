// Outside the walls, and on the river: a post windmill and a watermill (both turning), a stone bridge of
// arches, boats at their moorings, a treadwheel crane on the quay, fences, the jousting ground's pavilions
// and grandstand, and fields of crops. Low-poly and hand-painted, at the hero's scale (about 1.1 tall).
import * as THREE from "three";
import { PAL } from "../data/palette.ts";
import { T } from "../data/world.ts";
import { FACING_YAW } from "../world/plans.ts";
import { onGround, GROUND, WATER_Y, box, type RenderContext } from "./context.ts";
import { put, shield } from "./castle.ts";
import type { PropView } from "./props.ts";
import { hash } from "./terrain.ts";
import { CLAY, DARK_WOOD, DOORWAY, GOLD, MARBLE, WOOD, banner, occluder, pennant, roofGeometry, tiledBox, tiledCylinder, type PropOf } from "./town.ts";

const TRIM = "#8a8378", CANVAS = "#e6dcc4";
const centre = (r: { x: number; y: number; w: number; h: number }) => ({ x: (r.x + r.w / 2) / T, z: (r.y + r.h / 2) / T });

// ---------- Windmill ----------
/** A post mill: a timber body on a round brick base, turned into the wind by its tail pole; its four sails turn. */
export function buildWindmill(ctx: RenderContext, parent: THREE.Group, p: PropOf<"windmill">): PropView {
  const { lambert, basic, tex } = ctx, g = new THREE.Group(), wood = lambert(WOOD), dark = lambert(DARK_WOOD);
  put(g, tiledCylinder(1.1, 1.3, 10, 0.5), lambert("#b8613a", { map: tex.stone }), 0, 0.65, 0);
  put(g, new THREE.ConeGeometry(1.2, 0.5, 10), lambert(TRIM), 0, 1.55, 0);
  put(g, tiledBox(1.7, 2.4, 1.5, 1.0), lambert("#ffffff", { map: tex.timber }), 0, 2.9, 0);
  put(g, roofGeometry(1.9, 1.8, 0.8), lambert(CLAY, { map: tex.shingles, side: THREE.DoubleSide }), 0, 4.1, 0, 0, Math.PI / 2, 0);
  put(g, box(0.5, 0.9, 0.05), basic(DOORWAY), 0, 2.4, -0.77);
  const tail = put(g, box(0.12, 0.12, 3.0), dark, 0, 1.6, -1.9);
  tail.rotation.x = -0.5;
  const sails = new THREE.Group();
  put(sails, new THREE.CylinderGeometry(0.15, 0.15, 0.4, 8), dark, 0, 0, 0, Math.PI / 2, 0, 0);
  for (let i = 0; i < 4; i++) {
    const arm = new THREE.Group();
    put(arm, box(0.1, 3.4, 0.08), dark, 0, 1.8, 0);
    put(arm, box(0.62, 2.8, 0.03), lambert(CANVAS, { side: THREE.DoubleSide }), 0.36, 2.0, 0.03);
    for (let y = 0.8; y < 3.4; y += 0.45) put(arm, box(0.7, 0.04, 0.05), wood, 0.32, y, 0.05);
    arm.rotation.z = (i / 4) * Math.PI * 2;
    sails.add(arm);
  }
  sails.position.set(0, 3.3, 0.95);
  g.add(sails);
  const x = p.x / T, z = p.y / T;
  g.position.set(x, 0, z);
  parent.add(g);
  return { update(t) { sails.rotation.z = -t * 0.7; }, occluders: [occluder(g, x, z, 3, 3, 6.5)] };
}

// ---------- Watermill ----------
/** A mill on the riverbank: a stone ground floor, timber above, and its wheel turning in the water. */
export function buildWatermill(ctx: RenderContext, parent: THREE.Group, p: PropOf<"watermill">): PropView {
  const { lambert, basic, tex, particles } = ctx, g = new THREE.Group(), c = centre(p.rect);
  const sideways = p.wheel === "east" || p.wheel === "west";
  const w = (sideways ? p.rect.h : p.rect.w) / T - 0.3, d = (sideways ? p.rect.w : p.rect.h) / T - 0.3;
  // Built with its wheel on the +z side, then turned.
  put(g, tiledBox(w, 1.8, d, 0.8), lambert("#ffffff", { map: tex.stone }), 0, 0.9, 0);
  put(g, tiledBox(w, 1.6, d, 1.15), lambert("#ffffff", { map: tex.timber }), 0, 2.6, 0);
  put(g, roofGeometry(w + 0.4, d + 0.7, d * 0.5), lambert(CLAY, { map: tex.shingles, side: THREE.DoubleSide }), 0, 3.4, 0);
  put(g, box(0.7, 1.4, 0.05), basic(DOORWAY), -w / 4, 0.7, -d / 2 - 0.02);
  for (const x of [-w / 4, w / 4]) put(g, box(0.36, 0.44, 0.06), lambert("#5e4630"), x, 2.7, -d / 2 - 0.02);
  const wheel = new THREE.Group(), dark = lambert(DARK_WOOD), R = 1.5;
  for (const s of [-1, 1]) put(wheel, new THREE.TorusGeometry(R, 0.08, 4, 16), dark, s * 0.3, 0, 0, 0, Math.PI / 2, 0);
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    put(wheel, box(0.7, 0.06, 0.4), lambert(WOOD), 0, Math.sin(a) * R, Math.cos(a) * R, a, 0, 0);
    if (i % 3 === 0) put(wheel, box(0.06, R * 2, 0.08), dark, 0, 0, 0, a, 0, 0);
  }
  wheel.position.set(0, 0.6, d / 2 + 0.6);
  g.add(wheel);
  put(g, new THREE.CylinderGeometry(0.1, 0.1, 1.4, 6), dark, 0, 0.6, d / 2 + 0.3, Math.PI / 2, 0, 0);
  g.position.set(c.x, 0, c.z);
  g.rotation.y = FACING_YAW[p.wheel];
  parent.add(g);
  const foot = new THREE.Vector3(0, WATER_Y, d / 2 + 0.6 + R * 0.6).applyAxisAngle(new THREE.Vector3(0, 1, 0), FACING_YAW[p.wheel]);
  return {
    update(t, dt) {
      wheel.rotation.x = t * 0.9;
      if (Math.random() < dt * 10) particles.spawn("water", c.x + foot.x + (Math.random() - 0.5) * 0.6, WATER_Y + 0.05, c.z + foot.z, (Math.random() - 0.5) * 0.4, 0.8, (Math.random() - 0.5) * 0.4, 0.4);
    },
    occluders: [occluder(g, c.x, c.z, (sideways ? d : w) + 1, (sideways ? w : d) + 1, 4.5)],
  };
}

// ---------- Stone bridge ----------
/**
 * A bridge of stone arches, running north-south: a level roadway between tall parapets with a cornice
 * and a pinnacled post every couple of paces, a greater pair of pinnacles over each pier, and pointed
 * cutwaters breaking the current.
 */
export function buildStoneBridge(ctx: RenderContext, parent: THREE.Group, p: PropOf<"stoneBridge">): PropView {
  const { lambert, tex } = ctx, g = new THREE.Group(), c = centre(p.rect), rich = !!p.rich;
  const stone = lambert(rich ? MARBLE : "#ffffff", { map: tex.stone }), trim = rich ? lambert(GOLD) : lambert(TRIM, { map: tex.stone }), spire = rich ? lambert(MARBLE, { map: tex.stone }) : trim;
  const w = p.rect.w / T + 0.6, len = p.rect.h / T + 1.2, arches = Math.max(2, Math.round(len / 3.2));
  // The deck runs past the span onto paved ground at either end: it draws over the paving there (see GROUND), not through it.
  put(g, tiledBox(w, 0.08, len, 1.0), lambert(rich ? "#ece4d4" : "#a39a8c", { map: tex.cobble, ...onGround(GROUND.stain) }), 0, 0.02, 0);
  for (const s of [-1, 1]) {
    const px = s * (w / 2 - 0.2);
    put(g, tiledBox(0.4, 0.9, len, 0.8), stone, px, 0.45, 0);                               // parapets
    put(g, box(0.52, 0.12, len + 0.05), trim, px, 0.94, 0);                                  // and their cornice
    put(g, tiledBox(0.3, 1.1, len, 0.8), stone, s * (w / 2 + 0.1), -0.45, 0);              // the spandrel faces
    for (let z = -len / 2 + 0.4, i = 0; z <= len / 2 - 0.3; z += 1.6, i++) {              // posts with pinnacles
      put(g, tiledBox(0.5, 1.15, 0.5, 0.5), stone, px, 0.58, z);
      put(g, new THREE.ConeGeometry(0.28, 0.6, 4), spire, px, 1.45, z, 0, Math.PI / 4, 0);
      if (!rich) continue;
      put(g, new THREE.OctahedronGeometry(0.1, 0), trim, px, 1.82, z);                     // gold on every pinnacle
      const arms = shield(ctx, 0.5);                                                       // a shield on every post, outward
      arms.position.set(s * (w / 2 + 0.26), 0.15, z);
      arms.rotation.y = s * Math.PI / 2;
      g.add(arms);
      if (i % 2) {                                                                          // and banners hung down the sides
        const flag = banner(ctx, 0.6, 1.3);
        flag.position.set(s * (w / 2 + 0.27), 0.85, z - 0.8);
        flag.rotation.y = s * Math.PI / 2;
        g.add(flag);
      }
    }
  }
  for (let i = 1; i < arches; i++) {                                                       // piers with pointed cutwaters, and pinnacles over them
    const z = -len / 2 + (i * len) / arches;
    put(g, tiledBox(w + 0.4, 1.0, 0.9, 0.8), stone, 0, -0.55, z);
    for (const s of [-1, 1]) {
      put(g, new THREE.ConeGeometry(0.62, 1.0, 4), trim, s * (w / 2 + 0.55), -0.55, z, 0, Math.PI / 4, s * Math.PI / 2);
      put(g, tiledBox(0.8, 1.6, 0.8, 0.5), stone, s * (w / 2 - 0.1), 0.8, z);
      put(g, new THREE.ConeGeometry(0.5, 1.4, 4), spire, s * (w / 2 - 0.1), 2.3, z, 0, Math.PI / 4, 0);
      if (rich) put(g, new THREE.OctahedronGeometry(0.18, 0), trim, s * (w / 2 - 0.1), 3.1, z);
    }
  }
  g.position.set(c.x, 0, c.z);
  parent.add(g);
}

// ---------- Boats ----------
/**
 * A clinker hull along z, bow at +z, keel at y = 0: stations from stern to bow, each a section from the
 * port gunwale down round the bilge to the keel and up to the starboard gunwale. Its beam swells to `B`
 * amidships and closes to the stem and sternpost; its gunwale rises by `sheer` toward the ends.
 */
interface Hull { geometry: THREE.BufferGeometry; halfBeam: (t: number) => number; gunwale: (t: number) => number; z: (t: number) => number }
function hull(L: number, B: number, H: number, sheer: number, full: number, flat: number): Hull {
  const N = 14, halfBeam = (t: number) => (B / 2) * Math.max(0.03, 1 - Math.abs(t) ** full) ** 0.6;
  const gunwale = (t: number) => H + sheer * t * t, keel = (t: number) => H * 0.5 * Math.abs(t) ** 6, z = (t: number) => (t * L) / 2;
  const section = (t: number): [number, number][] => {
    const w = halfBeam(t), top = gunwale(t), k = keel(t), bilge = k + (top - k) * 0.4;
    return [[-w, top], [-w * 0.96, bilge], [-w * flat, k], [0, k], [w * flat, k], [w * 0.96, bilge], [w, top]];
  };
  const pos: number[] = [], idx: number[] = [], M = 7;
  for (let i = 0; i <= N; i++) { const t = -1 + (2 * i) / N; for (const [x, y] of section(t)) pos.push(x, y, z(t)); }
  for (let i = 0; i < N; i++) for (let j = 0; j < M - 1; j++) {
    const a = i * M + j, b = a + 1, c = a + M, d = c + 1;
    idx.push(a, c, b, b, c, d);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  geometry.setIndex(idx);
  geometry.computeVertexNormals();
  return { geometry, halfBeam, gunwale, z };
}

/** A strip following the hull's side from stern to bow, `y` up from its gunwale (negative, below it): a wale, or the gunwale's cap. */
function wale(h: Hull, side: number, y: number, r: number, out = 1): THREE.TubeGeometry {
  const pts: THREE.Vector3[] = [];
  for (let i = 0; i <= 12; i++) { const t = -0.97 + (1.94 * i) / 12; pts.push(new THREE.Vector3(side * h.halfBeam(t) * out, h.gunwale(t) + y, h.z(t))); }
  return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 24, r, 4, false);
}

/** A rod of radius `r` from `a` to `b`: a spar, an oar, a line of the rigging. */
function rod(g: THREE.Group, a: THREE.Vector3, b: THREE.Vector3, r: number, mat: THREE.Material): THREE.Mesh {
  const m = put(g, new THREE.CylinderGeometry(r, r, a.distanceTo(b), 4), mat, (a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2);
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize());
  return m;
}
const v = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

/**
 * A boat at its mooring, bobbing. A rowing boat: a clinker hull, thwarts across it, and its oars shipped
 * along the seats. Or a cog, the kingdom's merchantman: a deep, beamy hull with a straight stem and
 * sternpost, wales along its sides, castles fore and aft painted in the royal red and gold with shields
 * along their rails, a stern rudder, a mast with its square sail furled on the yard, a fighting top,
 * shrouds and stays, and cargo amidships.
 */
export function buildBoat(ctx: RenderContext, parent: THREE.Group, p: PropOf<"boat">): PropView {
  const { lambert, tex } = ctx, g = new THREE.Group(), cog = p.size === "cog";
  const wood = lambert(WOOD, { side: THREE.DoubleSide }), dark = lambert(DARK_WOOD), deckMat = lambert("#b08a5a", { side: THREE.DoubleSide });
  const L = cog ? 6.4 : 2.6, B = cog ? 2.3 : 1.0, H = cog ? 1.25 : 0.42;
  const h = hull(L, B, H, cog ? 0.5 : 0.14, cog ? 3.2 : 2.2, cog ? 0.7 : 0.45);
  put(g, h.geometry, wood, 0, 0, 0);
  for (const s of [-1, 1]) {
    put(g, wale(h, s, 0, cog ? 0.07 : 0.035, 1.01), dark, 0, 0, 0);                         // the gunwale's cap
    if (cog) put(g, wale(h, s, -0.45, 0.06, 1.02), dark, 0, 0, 0);                           // and a wale below it
  }
  // The deck (a cog) or the bottom boards (a rowing boat), inside the hull.
  const deckY = cog ? H * 0.78 : 0.08, deck = new THREE.Shape(), steps = 12, inset = cog ? 0.97 : 0.55;
  for (let i = 0; i <= steps; i++) { const t = -0.95 + (1.9 * i) / steps; if (i) deck.lineTo(h.halfBeam(t) * inset, h.z(t)); else deck.moveTo(h.halfBeam(t) * inset, h.z(t)); }
  for (let i = steps; i >= 0; i--) { const t = -0.95 + (1.9 * i) / steps; deck.lineTo(-h.halfBeam(t) * inset, h.z(t)); }
  put(g, new THREE.ShapeGeometry(deck), deckMat, 0, deckY, 0, Math.PI / 2, 0, 0);

  if (!cog) {
    for (const t of [-0.35, 0.3]) put(g, box(h.halfBeam(t) * 2 - 0.06, 0.05, 0.22), dark, 0, H * 0.72, h.z(t));                  // thwarts
    for (const s of [-1, 1]) rod(g, v(s * 0.22, H * 0.78, -1.0), v(s * 0.3, H * 0.8, 1.05), 0.03, lambert(WOOD));                // oars along the seats
    for (const s of [-1, 1]) put(g, box(0.06, 0.12, 0.06), dark, s * h.halfBeam(0) * 0.98, H + 0.05, 0);                           // rowlocks
    put(g, box(0.06, H + 0.2, 0.08), dark, 0, (H + 0.2) / 2, L / 2);                                                                // the stem
  } else {
    // Stem and sternpost, standing proud of the gunwale; the rudder hung on the sternpost, and its tiller.
    for (const s of [-1, 1]) put(g, box(0.18, H + 0.9, 0.2), dark, 0, (H + 0.9) / 2, s * L / 2, s * 0.12, 0, 0);
    put(g, box(0.1, H * 1.1, 0.7), dark, 0, H * 0.5, -L / 2 - 0.35);
    put(g, box(0.08, 0.08, 0.9), dark, 0, H + 0.55, -L / 2 + 0.2);
    // The castles: a deck over each end, a painted rail round it and shields along its sides.
    const red = lambert(CLAY), gold = lambert(GOLD);
    for (const [t0, t1, s] of [[-1.0, -0.55, -1], [0.62, 1.0, 1]] as const) {
      const tm = (t0 + t1) / 2, len = Math.abs(h.z(t1) - h.z(t0)), wid = h.halfBeam(tm) * 2 + 0.1, top = h.gunwale(tm) + 0.7, cz = h.z(tm) - s * 0.05;
      put(g, box(wid, 0.12, len), deckMat, 0, top, cz);
      put(g, tiledBox(wid - 0.15, top - deckY, 0.1, 0.6), lambert("#ffffff", { map: tex.timber }), 0, (top + deckY) / 2, cz - (s * len) / 2);   // its bulkhead
      for (const side of [-1, 1]) {
        put(g, box(0.08, 0.42, len), red, (side * wid) / 2, top + 0.27, cz);
        put(g, box(0.12, 0.06, len + 0.04), gold, (side * wid) / 2, top + 0.5, cz);
        for (let i = 0; i < 2; i++) {
          const sh = shield(ctx, 0.36);
          sh.position.set(side * (wid / 2 + 0.06), top + 0.2, cz + (i - 0.5) * len * 0.5);
          sh.rotation.y = (side * Math.PI) / 2;
          g.add(sh);
        }
      }
      put(g, box(wid, 0.42, 0.08), red, 0, top + 0.27, cz + (s * len) / 2);
      put(g, box(wid + 0.04, 0.06, 0.12), gold, 0, top + 0.5, cz + (s * len) / 2);
    }
    // The mast, the yard and its furled sail, the fighting top and the rigging.
    const mz = 0.3, top = H + 5.6, line = lambert("#3a2e24"), at = (dz: number) => (mz + dz) / (L / 2);
    put(g, new THREE.CylinderGeometry(0.09, 0.14, top - deckY, 6), dark, 0, (top + deckY) / 2, mz);
    put(g, new THREE.CylinderGeometry(0.38, 0.3, 0.32, 8, 1, true), lambert(CLAY, { side: THREE.DoubleSide }), 0, top - 0.5, mz);
    put(g, new THREE.CylinderGeometry(0.34, 0.34, 0.04, 8), dark, 0, top - 0.64, mz);
    put(g, new THREE.CylinderGeometry(0.06, 0.06, 2.9, 5), dark, 0, top - 1.3, mz, 0, 0, Math.PI / 2);
    put(g, new THREE.CylinderGeometry(0.17, 0.12, 2.6, 6), lambert(CANVAS), 0, top - 1.47, mz + 0.05, 0, 0, Math.PI / 2);
    for (const s of [-1, 1]) for (const dz of [-0.9, -0.4, 0.1]) rod(g, v(0, top - 0.6, mz), v(s * h.halfBeam(at(dz)) * 1.01, h.gunwale(at(dz)), mz + dz), 0.015, line);
    rod(g, v(0, top - 0.6, mz), v(0, h.gunwale(1) + 0.8, L / 2), 0.015, line);                          // the forestay
    rod(g, v(0, h.gunwale(1) + 0.5, L / 2 - 0.1), v(0, h.gunwale(1) + 1.2, L / 2 + 1.4), 0.06, dark);  // the bowsprit
    rod(g, v(0, top - 0.6, mz), v(0, h.gunwale(-1) + 0.8, -L / 2 + 0.1), 0.015, line);                 // the backstay
    const flag = pennant(ctx, 0.8, 0.9);
    flag.group.position.set(0, top, mz);
    g.add(flag.group);
    // Cargo amidships: barrels and a bale, and a hatch.
    for (const [x, z] of [[-0.5, -0.6], [0, -0.75], [0.5, -0.6]] as const) put(g, new THREE.CylinderGeometry(0.22, 0.2, 0.5, 8), lambert(WOOD), x, deckY + 0.25, z);
    put(g, tiledBox(0.6, 0.4, 0.5, 0.4), lambert("#c9b48a"), 0.45, deckY + 0.2, 1.1);
    put(g, box(0.8, 0.06, 0.8), dark, -0.3, deckY + 0.03, 1.2);
  }
  const x = p.x / T, z = p.y / T, k = hash(x, z, 440) * 10;
  g.position.set(x, WATER_Y - H * 0.4, z);
  g.rotation.y = FACING_YAW[p.facing];
  parent.add(g);
  const y0 = g.position.y;
  return {
    update(t) {
      g.position.y = y0 + Math.sin(t * 1.3 + k) * 0.04;
      g.rotation.z = Math.sin(t * 1.1 + k) * 0.03;
      g.rotation.x = Math.sin(t * 0.8 + k) * 0.012;
    },
  };
}

// ---------- Crane ----------
/** A treadwheel crane on the quay: a timber post and jib reaching over the water, a load on its rope, the great wheel at its foot. */
export function buildCrane(ctx: RenderContext, parent: THREE.Group, p: PropOf<"crane">): PropView {
  const { lambert } = ctx, g = new THREE.Group(), wood = lambert(WOOD), dark = lambert(DARK_WOOD);
  put(g, box(1.2, 0.3, 1.2), lambert(TRIM), 0, 0.15, 0);
  put(g, box(0.3, 4.2, 0.3), dark, 0, 2.1, 0);
  for (const s of [-1, 1]) put(g, box(0.15, 1.8, 0.15), dark, s * 0.45, 0.85, -0.1, 0, 0, s * 0.35);
  const jib = put(g, box(0.2, 0.2, 3.6), wood, 0, 4.0, 1.4);
  jib.rotation.x = -0.32;
  put(g, new THREE.CylinderGeometry(0.01, 0.01, 2.6, 3), lambert("#c9b48a"), 0, 3.2, 2.95);
  put(g, tiledBox(0.6, 0.5, 0.6, 0.4), lambert("#a8794a"), 0, 1.7, 2.95);
  const wheel = new THREE.Group();
  for (const s of [-1, 1]) put(wheel, new THREE.TorusGeometry(1.0, 0.06, 4, 14), dark, s * 0.3, 0, 0, 0, Math.PI / 2, 0);
  for (let i = 0; i < 10; i++) { const a = (i / 10) * Math.PI * 2; put(wheel, box(0.62, 0.05, 0.12), wood, 0, Math.sin(a), Math.cos(a), a, 0, 0); }
  wheel.position.set(0.9, 1.1, -0.4);
  wheel.rotation.y = Math.PI / 2;
  g.add(wheel);
  const x = p.x / T, z = p.y / T;
  g.position.set(x, 0, z);
  g.rotation.y = FACING_YAW[p.facing];
  parent.add(g);
  return { occluders: [occluder(g, x, z, 2.5, 2.5, 4.5)] };
}

// ---------- Fence ----------
/** A post-and-rail fence along a line of points. */
export function buildFence(ctx: RenderContext, parent: THREE.Group, p: PropOf<"fence">): PropView {
  const { lambert } = ctx, g = new THREE.Group(), wood = lambert(WOOD), dark = lambert(DARK_WOOD);
  p.points.slice(1).forEach((b, i) => {
    const a = p.points[i]!, ax = a.x / T, az = a.y / T, bx = b.x / T, bz = b.y / T, len = Math.hypot(bx - ax, bz - az), yaw = Math.atan2(-(bz - az), bx - ax);
    const run = new THREE.Group();
    const posts = Math.max(1, Math.round(len / 1.5));
    for (let k = 0; k <= posts; k++) put(run, box(0.12, 0.9, 0.12), dark, -len / 2 + (k * len) / posts, 0.45, 0);
    for (const y of [0.4, 0.75]) put(run, box(len, 0.07, 0.06), wood, 0, y, 0);
    run.position.set((ax + bx) / 2, 0, (az + bz) / 2);
    run.rotation.y = yaw;
    g.add(run);
  });
  parent.add(g);
}

// ---------- Pavilion ----------
/** A knight's round pavilion: striped walls, a scalloped conical roof in his colour, a pennant on top. */
export function buildPavilion(ctx: RenderContext, parent: THREE.Group, p: PropOf<"pavilion">): PropView {
  const { lambert, basic } = ctx, g = new THREE.Group(), colour = lambert(p.color, { side: THREE.DoubleSide }), white = lambert(CANVAS, { side: THREE.DoubleSide });
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    put(g, box(0.56, 1.5, 0.04), i % 2 ? colour : white, Math.sin(a) * 1.0, 0.75, Math.cos(a) * 1.0, 0, a, 0);
  }
  put(g, box(0.5, 1.2, 0.05), basic(DOORWAY), 0, 0.6, 1.03);
  put(g, new THREE.ConeGeometry(1.35, 1.4, 12), colour, 0, 2.2, 0);
  for (let i = 0; i < 12; i++) {                                                          // the scalloped valance
    const a = (i / 12) * Math.PI * 2;
    put(g, new THREE.CircleGeometry(0.22, 6, 0, Math.PI), i % 2 ? white : colour, Math.sin(a) * 1.3, 1.5, Math.cos(a) * 1.3, Math.PI, a, 0);
  }
  const flag = pennant(ctx, 0.9, 0.7);
  flag.group.position.y = 2.85;
  g.add(flag.group);
  put(g, new THREE.OctahedronGeometry(0.1, 0), basic(PAL.Y), 0, 3.8, 0);
  const x = p.x / T, z = p.y / T, k = hash(x, z, 441);
  g.position.set(x, 0, z);
  g.rotation.y = k * Math.PI * 2;
  parent.add(g);
  return { update(t) { flag.cloth.rotation.y = Math.sin(t * 3 + k * 9) * 0.4; } };
}

// ---------- Grandstand ----------
/** A covered stand of wooden tiers for watching the jousts, a striped canopy over it and banners along its front. */
export function buildGrandstand(ctx: RenderContext, parent: THREE.Group, p: PropOf<"grandstand">): PropView {
  const { lambert } = ctx, g = new THREE.Group(), c = centre(p.rect), wood = lambert(WOOD), dark = lambert(DARK_WOOD);
  const sideways = p.facing === "east" || p.facing === "west";
  const w = (sideways ? p.rect.h : p.rect.w) / T - 0.3, d = (sideways ? p.rect.w : p.rect.h) / T - 0.3;
  for (let i = 0; i < 3; i++) put(g, box(w, 0.5 + i * 0.5, d / 3), wood, 0, (0.5 + i * 0.5) / 2, d / 2 - d / 6 - (i * d) / 3);   // the tiers, rising away from the front
  for (const x of [-w / 2 + 0.1, 0, w / 2 - 0.1]) for (const z of [-d / 2 + 0.1, d / 2 - 0.1]) put(g, box(0.12, 3.4, 0.12), dark, x, 1.7, z);
  for (let i = 0; i < 8; i++) {                                                          // the canopy, striped
    const stripe = put(g, box(w / 8 + 0.01, 0.06, d + 0.6), lambert(i % 2 ? CANVAS : "#3f6fd0"), -w / 2 + (i + 0.5) * (w / 8), 3.45, 0.1);
    stripe.rotation.x = -0.12;
  }
  for (let x = -w / 2 + 0.8; x < w / 2; x += 1.6) {
    const b = put(g, box(0.5, 0.8, 0.03), lambert(x > 0 ? CLAY : "#3f6fd0"), x, 2.85, d / 2 + 0.32);
    b.rotation.x = 0.05;
  }
  g.position.set(c.x, 0, c.z);
  g.rotation.y = FACING_YAW[p.facing];
  parent.add(g);
  return { occluders: [occluder(g, c.x, c.z, (sideways ? d : w) + 0.6, (sideways ? w : d) + 0.6, 3.6)] };
}

// ---------- Field ----------
const CROPS = {
  wheat: { color: "#d9b84a", height: 0.5, shape: "row" },
  barley: { color: "#c8b060", height: 0.42, shape: "row" },
  cabbage: { color: "#6aa84a", height: 0.3, shape: "head" },
} as const;

/** A field of crops in rows across its width: wheat or barley standing in long ridges, or rows of cabbages. */
export function buildField(ctx: RenderContext, parent: THREE.Group, p: PropOf<"field">): PropView {
  const crop = CROPS[p.crop], x0 = p.rect.x / T + 0.3, z0 = p.rect.y / T + 0.3, w = p.rect.w / T - 0.6, d = p.rect.h / T - 0.6;
  const rows = Math.floor(d / 0.55), per = crop.shape === "row" ? Math.ceil(w / 1.0) : Math.floor(w / 0.6);
  const geo = crop.shape === "row" ? new THREE.BoxGeometry(1.0, crop.height, 0.28).translate(0, crop.height / 2, 0) : new THREE.IcosahedronGeometry(0.2, 0).translate(0, 0.16, 0);
  const mesh = new THREE.InstancedMesh(geo, ctx.lambert(crop.color), rows * per), m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), v = new THREE.Vector3(), col = new THREE.Color();
  let i = 0;
  for (let r = 0; r < rows; r++) for (let k = 0; k < per; k++) {
    const jitter = hash(r, k, 450), along = crop.shape === "row" ? Math.min(1, w - k * 1.0) : 1;
    v.set(x0 + (crop.shape === "row" ? k * 1.0 + along / 2 : k * 0.6 + 0.3), 0, z0 + r * 0.55 + 0.27);
    s.set(along, 0.8 + jitter * 0.4, 1);
    mesh.setMatrixAt(i, m.compose(v, q, s));
    mesh.setColorAt(i, col.set(crop.color).multiplyScalar(0.85 + jitter * 0.25));
    i++;
  }
  parent.add(mesh);
}
