// What you find where the Witchwood goes wrong: the woodwardens' barricade across the trail south, sharpened
// stakes lashed to rails with a gap at the gate, and the cold cracks in the ground of the Ashwild, black
// at the heart, with a thin, faint, wrong-coloured light along them; and at the end of the trail, the
// arena where Cinder waits. Low-poly, at the hero's scale.
import * as THREE from "three";
import { PAL } from "../data/palette.ts";
import { T } from "../data/world.ts";
import { arenaPlan } from "../world/arena.ts";
import { greatCrackSpine } from "../world/greatcrack.ts";
import { softDisc } from "./camp.ts";
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

/**
 * A boss's arena: a great scorch of black ash, a ritual circle burnt into it that breathes ember-light, cold
 * cracks running out from its heart, and a ring of burnt standing stones round it, veined with fire, tall at
 * the back with flames guttering on their tops and broken off to stumps at the front (so the fight shows).
 */
export function buildArena(ctx: RenderContext, parent: THREE.Group, p: PropOf<"arena">): PropView {
  const { lambert, glow, basic, particles } = ctx, g = new THREE.Group(), cx = p.x / T, cz = p.y / T, R = p.radius;
  g.position.set(cx, 0, cz);
  const disc = softDisc(), quad = new THREE.PlaneGeometry(2, 2).rotateX(-Math.PI / 2);
  const decal = (layer: number) => ({ transparent: true, depthWrite: false, ...onGround(layer) });

  // The scorch: black ash fading out past the stones, and a dull red heart.
  put(g, quad, basic("#120c0a", { ...decal(GROUND.stain), map: disc, opacity: 0.9 }), 0, 0.015, 0).scale.setScalar(R + 2.2);
  const heatMat = glow("#c8401c", { ...decal(GROUND.stain), map: disc, opacity: 0.35, blending: THREE.AdditiveBlending });
  const heat = put(g, quad, heatMat, 0, 0.018, 0);
  heat.scale.setScalar(R * 0.55);

  // The ritual circle: two rings, runes between them, and spokes in to a small inner ring where he stands.
  const line = glow(PAL.O, { ...decal(GROUND.marker), opacity: 0.75 });
  const ring = (r: number, w: number) => put(g, new THREE.RingGeometry(r - w, r, 48).rotateX(-Math.PI / 2), line, 0, 0.022, 0);
  ring(R - 0.9, 0.08); ring(R - 1.5, 0.05); ring(1.6, 0.06);
  const runeGeo = new THREE.PlaneGeometry(0.18, 0.32).rotateX(-Math.PI / 2);
  for (let i = 0; i < 24; i++) {
    const a = (i / 24) * Math.PI * 2, r = R - 1.2, k = hash(i, 3, 301);
    put(g, runeGeo, line, Math.cos(a) * r, 0.022, Math.sin(a) * r, 0, -a + (k - 0.5) * 0.6, 0).scale.set(0.6 + k * 0.6, 1, 1);
  }
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + Math.PI / 6, len = R - 1.5 - 1.6;
    put(g, new THREE.PlaneGeometry(len, 0.05).rotateX(-Math.PI / 2), line, Math.cos(a) * (1.6 + len / 2), 0.022, Math.sin(a) * (1.6 + len / 2), 0, -a, 0);
  }

  // Cold cracks running out from the heart, under the circle: the dark getting in where he's been.
  const dark = basic("#0c0a14", onGround(GROUND.stain)), cold = glow("#7ad0e8", { ...decal(GROUND.marker), opacity: 0.45 });
  for (let i = 0; i < 7; i++) {
    let a = (i / 7) * Math.PI * 2 + hash(i, 1, 302), x = Math.cos(a) * 0.9, z = Math.sin(a) * 0.9;
    for (let s = 0; s < 6; s++) {
      const step = 0.45 + hash(i, s, 303) * 0.3, wide = 0.14 - s * 0.018;
      a += (hash(i, s, 304) - 0.5) * 0.8;
      const mx = x + Math.cos(a) * step / 2, mz = z + Math.sin(a) * step / 2;
      put(g, new THREE.PlaneGeometry(step * 1.15, wide).rotateX(-Math.PI / 2), dark, mx, 0.019, mz, 0, -a, 0);
      put(g, new THREE.PlaneGeometry(step * 1.1, wide * 0.35).rotateX(-Math.PI / 2), cold, mx, 0.021, mz, 0, -a, 0);
      x += Math.cos(a) * step; z += Math.sin(a) * step;
    }
  }

  // Heaps of ash and a scatter of coals still glowing in them.
  const ash = lambert("#3a3634"), coalGeo = new THREE.IcosahedronGeometry(0.05, 0), coals = [glow(PAL.R), glow(PAL.O)];
  for (let i = 0; i < 14; i++) {
    const a = hash(i, 7, 305) * Math.PI * 2, r = 2 + hash(i, 8, 306) * (R - 2.6), x = Math.cos(a) * r, z = Math.sin(a) * r;
    if (i % 2) put(g, new THREE.ConeGeometry(0.15 + hash(i, 9, 307) * 0.15, 0.12, 6), ash, x, 0.05, z);
    put(g, coalGeo, coals[i % 2]!, x + 0.1, 0.03, z - 0.06).scale.y = 0.6;
  }

  // The standing stones: black, jagged, veined with fire, leaning out; the ones at the back tall and
  // crowned with flame, the front ones broken off short.
  const stone = lambert("#2a2422"), scorched = lambert("#3e3330"), vein = glow("#ff7a2a");
  const flames: THREE.Mesh[] = [], tops: { x: number; y: number; z: number }[] = [];
  for (const s of arenaPlan(p)) {
    const x = s.x - cx, z = s.z - cz, back = (Math.cos(s.round * Math.PI * 2) + 1) / 2, k = hash(s.x, s.z, 308);
    const h = 0.45 + back * back * (1.9 + k * 0.5), pil = new THREE.Group(), out = Math.atan2(z, x);
    pil.position.set(x, 0, z);
    pil.rotation.y = -out;
    put(pil, new THREE.CylinderGeometry(0.2, 0.33, h, 5), k < 0.5 ? stone : scorched, 0, h / 2, 0, 0, k * 2, 0.06);
    put(pil, new THREE.ConeGeometry(0.21, 0.3 + k * 0.2, 5), stone, 0.03, h + 0.1, 0, 0.2 * (k - 0.5), k * 2, 0.35);   // the broken top
    put(pil, new THREE.BoxGeometry(0.035, h * 0.75, 0.04), vein, -0.27, h * 0.42, 0.04, 0, 0, 0.05);                   // the fire vein, toward the middle
    put(pil, new THREE.DodecahedronGeometry(0.16, 0), stone, 0.3, 0.06, 0.2 * (k - 0.5)).scale.y = 0.5;                 // fallen chips
    pil.rotation.z = 0.06;                                    // leaning out
    g.add(pil);
    if (back > 0.55) {
      const fire = [PAL.R, PAL.O, PAL.Y].map((c, i) => put(g, new THREE.ConeGeometry(0.15 - i * 0.04, 0.5 - i * 0.12, 5).translate(0, (0.5 - i * 0.12) / 2, 0),
        glow(c, { transparent: true, opacity: 0.9 }), x, h + 0.2, z));
      flames.push(...fire);
      tops.push({ x: cx + x, y: h + 0.4, z: cz + z });
    }
  }
  // The circle lights itself, faintly orange, from the heart.
  const light = new THREE.PointLight(0xff6a2a, 5, R * 1.6, 1.3);
  light.position.set(0, 1.4, 0);
  g.add(light);
  parent.add(g);

  return {
    update(t, dt) {
      line.opacity = 0.5 + Math.sin(t * 1.6) * 0.25;
      heatMat.opacity = 0.3 + Math.sin(t * 1.6) * 0.1;
      cold.opacity = 0.35 + Math.sin(t * 1.1 + 2) * 0.15;
      flames.forEach((f, i) => { const s = 0.85 + Math.sin(t * (9 + (i % 3) * 4) + i) * 0.2; f.scale.set(1 - (s - 1) * 0.5, s, 1 - (s - 1) * 0.5); f.rotation.y = t * 2 + i; });
      light.intensity = 5 + Math.sin(t * 1.6) * 1.2 + Math.sin(t * 13) * 0.3;
      for (const top of tops) if (Math.random() < dt * 2.5) {
        particles.spawn(Math.random() < 0.5 ? "fire" : "ember", top.x + (Math.random() - 0.5) * 0.15, top.y, top.z + (Math.random() - 0.5) * 0.15,
          (Math.random() - 0.5) * 0.4, 1.4 + Math.random(), (Math.random() - 0.5) * 0.4, 0.7);
      }
    },
  };
}

/**
 * The great crack in the Thunder Rift: a jagged chasm across the ground, black all the way down, a cold indigo light
 * breathing deep in it and along its lips, and sparks drifting up out of the dark (its shape: src/world/greatcrack.ts).
 */
export function buildGreatCrack(ctx: RenderContext, parent: THREE.Group, p: PropOf<"greatCrack">): PropView {
  const { basic, glow, particles } = ctx, g = new THREE.Group(), spine = greatCrackSpine(p);
  /** A strip along the spine, `k` of the way out to each lip, at height `y`. */
  const strip = (k: number, y: number) => {
    const pos: number[] = [];
    const edge = (i: number, side: 1 | -1) => {
      const a = spine[Math.max(0, i - 1)]!.at, b = spine[Math.min(spine.length - 1, i + 1)]!.at, len = Math.hypot(b.x - a.x, b.z - a.z) || 1;
      const nx = -(b.z - a.z) / len, nz = (b.x - a.x) / len, { at, half } = spine[i]!;
      return [at.x + nx * half * k * side, y, at.z + nz * half * k * side];
    };
    for (let i = 0; i < spine.length - 1; i++) {
      const l0 = edge(i, 1), r0 = edge(i, -1), l1 = edge(i + 1, 1), r1 = edge(i + 1, -1);
      pos.push(...l0, ...r0, ...l1, ...r0, ...r1, ...l1);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    return geo;
  };
  const side = { side: THREE.DoubleSide };
  const lip = glow("#8f9dff", { transparent: true, opacity: 0.55, depthWrite: false, ...side, ...onGround(GROUND.stain) });
  const dark = basic("#04030a", { ...side, ...onGround(GROUND.marker) });
  const deep = glow("#5a46e0", { transparent: true, opacity: 0.4, depthWrite: false, blending: THREE.AdditiveBlending, ...side, ...onGround(GROUND.marker) });
  g.add(new THREE.Mesh(strip(1.25, 0.012), lip), new THREE.Mesh(strip(1, 0.02), dark), new THREE.Mesh(strip(0.35, 0.026), deep));
  parent.add(g);
  return {
    update(t, dt) {
      lip.opacity = 0.45 + Math.sin(t * 0.9) * 0.15;
      deep.opacity = 0.3 + Math.sin(t * 1.7) * 0.15 + Math.sin(t * 4.3) * 0.05;
      if (Math.random() < dt * 6) {                           // sparks up out of the dark
        const { at, half } = spine[1 + Math.floor(Math.random() * (spine.length - 2))]!;
        particles.spawn(Math.random() < 0.6 ? "arcane" : "arcaneLight", at.x + (Math.random() - 0.5) * half, 0.05, at.z + (Math.random() - 0.5) * half,
          (Math.random() - 0.5) * 0.2, 0.8 + Math.random() * 0.8, (Math.random() - 0.5) * 0.2, 1.6);
      }
    },
  };
}
