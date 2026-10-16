// What the fair folk leave: a fairy ring in a glade, pale mushrooms come up in a circle on a band of grass
// greener than the rest, the grass inside it a little paler; and by night their caps glow faintly and small
// lights drift slowly round above it. Low-poly, at the hero's scale. Or, once the fair folk are gone, broken.
import * as THREE from "three";
import { T } from "../data/world.ts";
import { put } from "./castle.ts";
import { GROUND, onGround, type RenderContext } from "./context.ts";
import type { PropView } from "./props.ts";
import { hash } from "./terrain.ts";
import type { PropOf } from "./town.ts";

/** How many lights drift round a fairy ring. */
const MOTES = 7;
/**
 * The layer a fairy ring is drawn on as well as the usual one: deep in its spell (src/game/fairyring.ts) the renderer
 * draws its magic over everything, then the ring again on top (see src/render/trance.ts).
 */
export const FEY_LAYER = 1;
/** ...and its grass, on a layer of its own: see-through, it's only drawn again once nothing else shows under it. */
export const FEY_GROUND = 2;

/** A fairy ring: a circle of mushrooms `radius` tiles out round (x, y), and the lights that dance in it after dark. */
export function buildFairyRing(ctx: RenderContext, parent: THREE.Group, p: PropOf<"fairyRing">): PropView {
  if (p.broken) return buildBrokenRing(ctx, parent, p);
  const { lambert, glow, basic, light } = ctx, g = new THREE.Group(), R = p.radius;
  g.position.set(p.x / T, 0, p.y / T);
  const decal = (opacity: number) => ({ transparent: true, opacity, depthWrite: false, ...onGround(GROUND.stain) });
  // The band of lush grass the ring stands on, and the paler grass inside it.
  const grass = [
    put(g, new THREE.RingGeometry(R - 0.32, R + 0.3, 40).rotateX(-Math.PI / 2), basic("#2f6e22", decal(0.7)), 0, 0.016, 0),
    put(g, new THREE.CircleGeometry(R - 0.32, 32).rotateX(-Math.PI / 2), basic("#c8d890", decal(0.16)), 0, 0.015, 0),
  ];

  // The mushrooms: one every so far round, a little in or out of true, big and small; the odd pair.
  const stem = lambert("#efe6d2"), cap = lambert("#e8d8b8"), spot = lambert("#fff8ea");
  ctx.glowAtNight(cap, spot);
  const stemGeo = new THREE.CylinderGeometry(0.045, 0.06, 0.22, 5).translate(0, 0.11, 0);
  const capGeo = new THREE.SphereGeometry(0.15, 7, 3, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, 0.6, 1).translate(0, 0.2, 0);
  const spotGeo = new THREE.SphereGeometry(0.05, 5, 2, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, 0.5, 1);
  const n = Math.round(R * 2 * Math.PI / 0.55);
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < (hash(p.x, i, 501) < 0.25 ? 2 : 1); j++) {
      const a = ((i + hash(i, j, 502) * 0.5) / n) * Math.PI * 2, r = R + (hash(i, j, 503) - 0.5) * 0.22;
      const k = 0.6 + hash(i, j, 504) * 0.8 - j * 0.25, x = Math.cos(a) * r, z = Math.sin(a) * r;
      put(g, stemGeo, stem, x, 0, z).scale.setScalar(k);
      const top = put(g, capGeo, cap, x, 0, z, (hash(i, j, 505) - 0.5) * 0.3, 0, (hash(i, j, 506) - 0.5) * 0.3);
      top.scale.setScalar(k);
      if (k > 0.9) put(top, spotGeo, spot, 0.03, 0.28, -0.02);
    }
  }

  // The lights: small soft motes going slowly round above the ring, each its own height and pace, rising and
  // falling. They only show as the light goes.
  const moteMat = glow("#d8f4a8", { transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending });
  const haloMat = glow("#a8e070", { transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending });
  const moteGeo = new THREE.OctahedronGeometry(0.04, 0), haloGeo = new THREE.OctahedronGeometry(0.11, 0);
  const motes = Array.from({ length: MOTES }, (_, i) => {
    const m = put(g, moteGeo, moteMat, 0, 0, 0);
    put(m, haloGeo, haloMat, 0, 0, 0);
    return { m, a: hash(p.x, i, 511) * Math.PI * 2, r: R * (0.55 + hash(p.y, i, 512) * 0.4), y: 0.35 + hash(i, p.x, 513) * 0.4,
      speed: (0.15 + hash(i, p.y, 514) * 0.2) * (i % 2 ? 1 : -1), bob: hash(i, i, 515) * 6 };
  });
  g.traverse(o => o.layers.enable(FEY_LAYER));
  for (const m of grass) { m.layers.disable(FEY_LAYER); m.layers.enable(FEY_GROUND); }
  parent.add(g);
  return {
    update: (t: number) => {
      const dark = Math.min(1, Math.max(0, (1 - light.value) / 0.6));
      moteMat.opacity = dark * (0.75 + Math.sin(t * 2.3) * 0.15);
      haloMat.opacity = dark * 0.25;
      for (const s of motes) {
        const a = s.a + t * s.speed;
        s.m.position.set(Math.cos(a) * s.r, s.y + Math.sin(t * 1.1 + s.bob) * 0.12, Math.sin(a) * s.r);
        s.m.visible = dark > 0.02;
      }
    },
  };
}

/**
 * A fairy ring broken (src/game/fairyring.ts): once the watchers have come and the Erl-King's gone, the ring has a gap
 * torn in it where a crack runs out from its middle, dark, with a sick violet glimmer down it after dark. The grass
 * it stood on is dead; what mushrooms are left are grey and shrivelled, drooping or fallen over; and no lights dance in
 * it, only a few dim violet ones sinking slowly into the crack.
 */
function buildBrokenRing(ctx: RenderContext, parent: THREE.Group, p: PropOf<"fairyRing">): PropView {
  const { lambert, glow, basic, light } = ctx, g = new THREE.Group(), R = p.radius;
  g.position.set(p.x / T, 0, p.y / T);
  const decal = (opacity: number) => ({ transparent: true, opacity, depthWrite: false, ...onGround(GROUND.stain) });
  // Where the gap is (the crack runs out through it), and how wide.
  const gapAt = -Math.PI / 2 + (hash(p.x, p.y, 520) - 0.5) * 0.8, GAP = 0.9;
  const inGap = (a: number) => Math.abs(Math.atan2(Math.sin(a - gapAt), Math.cos(a - gapAt))) < GAP / 2;

  // The dead grass: no clean band any more, only blotches of it gone brown and grey, uneven, thinning out at the gap;
  // and tufts of it withered and bleached, leaning over, among what's left of the mushrooms.
  const shades = ["#5c5341", "#4c4536", "#6a604c", "#57524a"].map(c => basic(c, decal(1)));
  const blot = new THREE.CircleGeometry(1, 7).rotateX(-Math.PI / 2);
  const blots = Math.round(R * 2 * Math.PI / 0.32);
  for (let i = 0; i < blots; i++) {
    const a = ((i + hash(i, 6, 530)) / blots) * Math.PI * 2, near = inGap(a);
    if (near && hash(i, 7, 531) < 0.7) continue;
    const r = R + (hash(i, 8, 532) - 0.5) * 0.5, size = (0.16 + hash(i, 9, 533) * 0.22) * (near ? 0.6 : 1);
    const mat = shades[Math.floor(hash(i, 10, 534) * shades.length)]!.clone();
    mat.opacity = 0.18 + hash(i, 11, 535) * 0.32;
    const b = put(g, blot, mat, Math.cos(a) * r, 0.015 + i * 0.00002, Math.sin(a) * r, 0, hash(i, 12, 536) * Math.PI, 0);
    b.scale.set(size * (0.7 + hash(i, 13, 537) * 0.8), 1, size);
  }
  const blade = new THREE.ConeGeometry(0.018, 0.16, 3).translate(0, 0.08, 0), straw = lambert("#a8976c"), dry = lambert("#8a7d5c");
  for (let i = 0; i < Math.round(blots * 0.6); i++) {
    const a = hash(i, 14, 538) * Math.PI * 2;
    if (inGap(a)) continue;
    const r = R + (hash(i, 15, 539) - 0.5) * 0.6, x = Math.cos(a) * r, z = Math.sin(a) * r;
    for (let j = 0; j < 3; j++) {
      const lean = 0.35 + hash(i, j, 540) * 0.6, turn = hash(i, j, 541) * Math.PI * 2;
      put(g, blade, j % 2 ? straw : dry, x + (hash(i, j, 542) - 0.5) * 0.06, 0, z + (hash(i, j, 543) - 0.5) * 0.06, lean, turn, 0)
        .scale.setScalar(0.7 + hash(i, j, 544) * 0.6);
    }
  }

  // The crack: from a little behind the middle, out through the gap and on past the ring, jagged, widest in the middle.
  const crack = (width: number) => {
    const shape = new THREE.Shape(), steps = 10, from = -0.25 * R, to = R + 1.5, left: THREE.Vector2[] = [], right: THREE.Vector2[] = [];
    const dx = Math.cos(gapAt), dz = Math.sin(gapAt);
    for (let i = 0; i <= steps; i++) {
      const t = i / steps, along = from + (to - from) * t, wob = (hash(p.x, i, 521) - 0.5) * 0.22, w = width * Math.sin(Math.PI * (0.08 + t * 0.84));
      const cx = dx * along - dz * wob, cz = dz * along + dx * wob;
      left.push(new THREE.Vector2(cx - dz * w, -(cz + dx * w)));
      right.push(new THREE.Vector2(cx + dz * w, -(cz - dx * w)));
    }
    shape.setFromPoints([...left, ...right.reverse()]);
    return new THREE.ShapeGeometry(shape).rotateX(-Math.PI / 2);
  };
  put(g, crack(0.11), basic("#0c0910", decal(0.9)), 0, 0.018, 0);
  const seam = glow("#8a5cff", { transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, ...onGround(GROUND.stain) });
  put(g, crack(0.035), seam, 0, 0.019, 0);

  // What's left of the mushrooms: none in the gap, the rest grey and small, drooping, and one in three fallen over.
  const stem = lambert("#bdb5a6"), cap = lambert("#8f8574");
  const stemGeo = new THREE.CylinderGeometry(0.04, 0.055, 0.2, 5).translate(0, 0.1, 0);
  const capGeo = new THREE.SphereGeometry(0.13, 7, 3, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, 0.45, 1).translate(0, 0.18, 0);
  const n = Math.round(R * 2 * Math.PI / 0.55);
  for (let i = 0; i < n; i++) {
    const a = ((i + hash(i, 0, 502) * 0.5) / n) * Math.PI * 2;
    if (inGap(a) || hash(i, 1, 522) < 0.2) continue;              // torn out, or gone
    const r = R + (hash(i, 0, 503) - 0.5) * 0.28, k = 0.75 + hash(i, 0, 504) * 0.5;
    const m = new THREE.Group();
    m.position.set(Math.cos(a) * r, 0, Math.sin(a) * r);
    m.rotation.set((hash(i, 2, 523) - 0.5) * 0.6, hash(i, 3, 524) * Math.PI * 2, (hash(i, 4, 525) - 0.5) * 0.6);
    if (hash(i, 5, 526) < 0.33) { m.rotation.z = Math.PI / 2 - 0.15; m.position.y = 0.04; }   // fallen over
    m.scale.set(k, k * 0.8, k);
    put(m, stemGeo, stem, 0, 0, 0);
    put(m, capGeo, cap, 0, -0.02, 0.02, 0.35, 0, 0);               // the cap slumped to one side
    g.add(m);
  }

  // A few dim violet lights after dark, each sinking slowly into the crack and coming round again.
  const moteMat = glow("#a68aff", { transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending });
  const moteGeo = new THREE.OctahedronGeometry(0.035, 0);
  const sinking = Array.from({ length: 4 }, (_, i) => {
    const along = (0.1 + hash(p.y, i, 527) * 0.9) * R, wob = (hash(p.x, i, 528) - 0.5) * 0.3;
    return { m: put(g, moteGeo, moteMat, Math.cos(gapAt) * along - Math.sin(gapAt) * wob, 0, Math.sin(gapAt) * along + Math.cos(gapAt) * wob), at: hash(i, p.x, 529) };
  });
  parent.add(g);
  return {
    update: (t: number) => {
      const dark = Math.min(1, Math.max(0, (1 - light.value) / 0.6));
      seam.opacity = dark * (0.35 + Math.sin(t * 0.7) * 0.15);
      moteMat.opacity = dark * 0.45;
      for (const s of sinking) {
        const f = (t * 0.06 + s.at) % 1;                            // 0 high up, 1 gone into the crack
        s.m.position.y = 0.7 * (1 - f);
        s.m.scale.setScalar(1 - f * 0.7);
        s.m.visible = dark > 0.02;
      }
    },
  };
}
