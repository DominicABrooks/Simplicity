// What the fair folk leave: a fairy ring in a glade, pale mushrooms come up in a circle on a band of grass
// greener than the rest, the grass inside it a little paler; and by night their caps glow faintly and small
// lights drift slowly round above it. Low-poly, at the hero's scale. Or, once the fair folk are gone, broken. And
// fireflies after dark, drifting in a loose trail from wherever he is in the woods, thickening as it nears the ring, to
// lead him to it.
import * as THREE from "three";
import { HALF, T } from "../data/world.ts";
import { fireflyLead, ringHere, wayToRing } from "../game/fairyring.ts";
import type { Game } from "../game/game.ts";
import type { Prop } from "../world/area.ts";
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

/** How many fireflies come out along the way ahead of him, and how many more where it ends at the ring. */
const AHEAD = 20, GATHERED = 12;
/** How far on along the way ahead of him they come out (tiles: about as far as the screen shows), and how far back from the ring they gather. */
const WINDOW = 6, GATHER = 5;
/** How far a firefly comes out to one side of the way (world units), less close in by the ring. */
const STRAY = 0.45;
/** How long a firefly is out, from fading in to gone (seconds), at least and at most; and how long it takes to fade in, and out. */
const LIFE = [4, 7] as const, FADE_IN = 1.2, FADE_OUT = 1.6;
/** How fast a firefly drifts on the way the way goes (world units a second). */
const DRIFT = 0.22;

/** The fireflies that lead him to a fairy ring after dark (src/game/fairyring.ts, fireflyLead and wayToRing). */
export interface FireflyLead {
  /** Arriving in an area: lead him to its fairy ring, if it has one to be led to; else nothing. */
  set(props: readonly Prop[]): void;
  update(g: Game, t: number, dt: number): void;
}

/**
 * Fireflies leading him to a fairy ring: the same soft blinking lights as the ring's own, coming out one by one along
 * the way to it from wherever he is, over open ground round the trees and the water. Each fades in somewhere a little
 * to one side of the way, drifts slowly on along it towards the ring for a few seconds, wandering and bobbing, and fades
 * out again, and another comes out somewhere else; once out, it goes its own way whatever he does, so as he walks the
 * old ones fade behind him and new ones come out ahead. Most come out a little way on ahead of him, so wherever he
 * stands a few are drifting off the right way; more where the way ends at the ring, so the trail thickens as he nears
 * it. They come out as the night does, and go as softly once he's found the ring.
 */
export function createFireflyLead(ctx: RenderContext): FireflyLead {
  const { glow, light, scene } = ctx, group = new THREE.Group();
  scene.add(group);
  // A mote, and a soft round glow about it facing the camera, as the woods' other fireflies have (src/render/ambient.ts).
  const moteGeo = new THREE.OctahedronGeometry(0.05, 0), haloGeo = new THREE.CircleGeometry(0.17, 8);
  const add = { transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending } as const;
  interface Leader {
    m: THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>; halo: THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>;
    /** Whether it comes out near the ring rather than on ahead of him. */
    gathers: boolean;
    /** Where it came out (world X/Z), the way it drifts (along the way, towards the ring), and how far it strays from it. */
    x: number; z: number; dx: number; dz: number; near: number;
    /** How long it's been out (below 0, how long till it comes out), and how long it'll be out. */
    age: number; life: number;
    phase: number; rate: number;
  }
  const leaders: Leader[] = Array.from({ length: AHEAD + GATHERED }, (_, i) => {
    const m = new THREE.Mesh(moteGeo, glow("#e4f8a8", { ...add })), halo = new THREE.Mesh(haloGeo, glow("#b0e46c", { ...add }));
    halo.rotation.x = -0.94;
    m.add(halo);
    m.visible = false;
    group.add(m);
    return { m, halo, gathers: i >= AHEAD, x: 0, z: 0, dx: 0, dz: 0, near: 1, age: 0, life: 0, phase: hash(i, 3, 551) * 10, rate: 1.1 + hash(i, 4, 552) * 1.2 };
  });
  /** The way from his tile to the ring, which tile it was worked out from, and how long it is (world units). */
  let way: THREE.CatmullRomCurve3 | null = null, from = "", length = 0, led = false, shown = 0;
  const at = new THREE.Vector3(), tangent = new THREE.Vector3();
  /** Out somewhere along the way: on ahead of him, or near the ring, more of them the nearer it; or, with no way, not yet. */
  const comeOut = (f: Leader) => {
    f.life = LIFE[0] + Math.random() * (LIFE[1] - LIFE[0]);
    if (!way) { f.age = -Math.random(); f.life = 0; return; }
    const d = f.gathers ? GATHER * Math.random() ** 2 : length - 0.6 - Math.random() * WINDOW;   // how far from the ring
    const u = Math.min(1, Math.max(0, 1 - d / length));
    way.getPointAt(u, at);
    way.getTangentAt(u, tangent);
    f.near = Math.min(1, 0.35 + Math.max(0, d) / GATHER);
    const side = (Math.random() * 2 - 1) * STRAY * f.near;
    f.x = at.x - tangent.z * side; f.z = at.z + tangent.x * side;
    f.dx = tangent.x; f.dz = tangent.z;
    f.age = 0;
  };

  return {
    set(props) {
      led = props.some(p => p.kind === "fairyRing" && !!p.lead && !p.broken && !p.quiet);
      way = null; from = ""; length = 0; shown = 0;
      // Not all at once: each comes out in its own time.
      for (const f of leaders) { f.age = -Math.random() * LIFE[1]; f.life = 0; f.m.visible = false; }
    },

    update(g, t, dt) {
      // Eased in and out, so they gather and go softly; and brighter the darker it is, as the ring's own lights are.
      const want = led ? fireflyLead(g) : 0;
      shown += Math.sign(want - shown) * Math.min(Math.abs(want - shown), dt * 0.5);
      const dark = Math.min(1, Math.max(0, (1 - light.value) / 0.6)), on = shown * dark;
      group.visible = on > 0.01;
      if (!group.visible) return;
      // The way on from the tile he's on, worked out again each time he steps onto another: only where the next ones
      // come out, never moving those already out.
      const p = g.world.need(g.player, "transform"), here = `${Math.floor((p.x + HALF) / T)},${Math.floor((p.y + HALF) / T)}`;
      if (here !== from) {
        from = here;
        const tiles = wayToRing(g, p.x, p.y), ring = ringHere(g);
        const points = tiles.filter((_, i) => i === 0 || (tiles.length - 1 - i) % 2 === 0).map(([x, y]) => new THREE.Vector3(x / T, 0, y / T));
        if (ring && points.length) points[points.length - 1]!.set(ring.x / T, 0, ring.y / T);
        way = points.length >= 2 ? new THREE.CatmullRomCurve3(points, false, "centripetal") : null;
        length = way ? way.getLength() : 0;
        if (length < 0.5) way = null;                            // he's there
      }
      for (const f of leaders) {
        const was = f.age;
        f.age += dt;
        if (was < 0 && f.age >= 0 || f.age >= f.life) comeOut(f);
        if (f.age < 0 || f.life <= 0) { f.m.visible = false; continue; }
        // Drifting on the way the way went where it came out, wandering a little either side, bobbing up and down.
        const go = DRIFT * f.near * f.age, wander = Math.sin(t * 0.37 + f.phase) * 0.15 * f.near;
        f.m.position.set(f.x + f.dx * go - f.dz * wander, 0.45 + Math.sin(t * 1.1 + f.phase) * 0.2, f.z + f.dz * go + f.dx * wander);
        // Blinking like any firefly, but never quite out near the ring; fading in as it comes out, and out as it goes.
        const blink = Math.max(0.45 * (1 - f.near), Math.sin(t * f.rate + f.phase)) ** 2;
        const life = Math.min(1, f.age / FADE_IN, (f.life - f.age) / FADE_OUT);
        f.m.material.opacity = on * Math.max(0, life) * (0.25 + 0.75 * blink);
        f.halo.material.opacity = f.m.material.opacity * 0.55;
        f.m.visible = true;
      }
    },
  };
}
