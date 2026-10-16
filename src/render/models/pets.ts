// Dogs and cats, low-poly and flat-shaded, facing +X. Each dog is one of a few breeds (a mutt, a shepherd,
// a mastiff, a terrier, a spitz), each cat lithe with a round, wide-cheeked head; coats come with
// their own markings (a saddle, patches, tabby stripes, a white bib and socks). The trunk (body, neck, head,
// legs and tail) pivots at the hips so it can sit up or lie down; legs bend at the knee, and the tail is a
// chain of segments that curls and wags. posePet puts the rig in a pose; the entity view (views.ts) says which.
import * as THREE from "three";
import type { Species } from "../../data/pets.ts";
import { box, type RenderContext } from "../context.ts";

type Ears = "prick" | "flop" | "fold" | "cat";
/** A body plan, world units: body length, height and width; how high the hips stand; head, muzzle and neck. */
interface Build {
  L: number; h: number; w: number; leg: number;
  /** The hips' girth against the chest's. */
  hips: number;
  head: number; snout: number; neck: number;
  ears: Ears;
  /** Tail: segments, each one's length and thickness, how high it's carried (radians) and how much each segment curls. */
  tail: { n: number; len: number; thick: number; lift: number; curl: number; bushy?: boolean };
  /** A thick ruff of fur round the neck. */
  ruff?: boolean;
  /** Overall size. */
  scale: number;
}
const BREEDS = {
  mutt: { L: 0.5, h: 0.21, w: 0.17, leg: 0.25, hips: 0.8, head: 0.17, snout: 0.11, neck: 0.1, ears: "flop", tail: { n: 3, len: 0.08, thick: 0.045, lift: 0.5, curl: 0.15 }, scale: 1 },
  shepherd: { L: 0.58, h: 0.23, w: 0.18, leg: 0.3, hips: 0.78, head: 0.18, snout: 0.15, neck: 0.13, ears: "prick", tail: { n: 3, len: 0.1, thick: 0.06, lift: -0.3, curl: -0.25, bushy: true }, scale: 1.08 },
  mastiff: { L: 0.56, h: 0.28, w: 0.24, leg: 0.27, hips: 0.75, head: 0.23, snout: 0.08, neck: 0.08, ears: "flop", tail: { n: 3, len: 0.08, thick: 0.05, lift: 0.1, curl: -0.1 }, scale: 1.12 },
  terrier: { L: 0.38, h: 0.17, w: 0.13, leg: 0.17, hips: 0.92, head: 0.14, snout: 0.08, neck: 0.07, ears: "fold", tail: { n: 2, len: 0.06, thick: 0.04, lift: 1.25, curl: 0.1 }, scale: 0.95 },
  spitz: { L: 0.44, h: 0.22, w: 0.18, leg: 0.22, hips: 0.85, head: 0.16, snout: 0.09, neck: 0.08, ears: "prick", tail: { n: 3, len: 0.08, thick: 0.065, lift: 1.4, curl: 0.85, bushy: true }, ruff: true, scale: 0.95 },
  cat: { L: 0.36, h: 0.14, w: 0.13, leg: 0.15, hips: 0.95, head: 0.15, snout: 0.035, neck: 0.06, ears: "cat", tail: { n: 4, len: 0.085, thick: 0.035, lift: 0.3, curl: 0 }, scale: 1 },
} satisfies Record<string, Build>;
type Breed = keyof typeof BREEDS;

/**
 * Drawn chunkier than life, so they still read as dogs and cats at the game's low resolution: heavier heads
 * (and so ears), stouter bodies, legs and tails. But sized to the people: a hero or townsperson stands about
 * 1.07 tall (big-headed, so short in the body), and standing, a shepherd comes to just over half his height
 * (0.6), a mutt's head to about his waist (0.39), a terrier's lower (0.3), and a cat's to under a third (0.3).
 * `size` brings the chunkier build to that.
 */
const READ = {
  dog: { size: 0.7, head: 1.35, girth: 1.4, limb: 1.6, leg: 0.85, tail: 1.7, face: 1.7 },
  cat: { size: 0.65, head: 1.35, girth: 1.35, limb: 1.6, leg: 0.85, tail: 1.6, face: 1.4 },
} satisfies Record<Species, Record<string, number>>;

type Pattern = "plain" | "saddle" | "patches" | "tabby" | "bib" | "tortie" | "mask";
interface Coat { fur: string; mark: string; eye: string; breed: Breed; pattern: Pattern; nose?: string; inner?: string }
/** Coats, as many as PETS.coats says for each. */
export const COATS: Record<Species, readonly Coat[]> = {
  dog: [
    { fur: "#8a5a32", mark: "#e8dcc4", eye: "#1a1410", breed: "mutt", pattern: "bib" },          // brown, white chest
    { fur: "#b07a3a", mark: "#2a2420", eye: "#1a1410", breed: "shepherd", pattern: "saddle" },   // black and tan
    { fur: "#d2a86a", mark: "#3a2a1e", eye: "#1a1410", breed: "mastiff", pattern: "mask" },      // fawn, dark mask
    { fur: "#ece4d4", mark: "#7a4a26", eye: "#1a1410", breed: "terrier", pattern: "patches" },   // white, brown patches
    { fur: "#c0683a", mark: "#f4ecdc", eye: "#1a1410", breed: "spitz", pattern: "bib" },         // red, white ruff
  ],
  cat: [
    { fur: "#d8843a", mark: "#a85424", eye: "#b8d040", breed: "cat", pattern: "tabby", nose: "#d87a8a", inner: "#e8a8a0" },   // ginger tabby
    { fur: "#262224", mark: "#262224", eye: "#e0c030", breed: "cat", pattern: "plain", nose: "#3a3034", inner: "#5a4448" },   // black
    { fur: "#8e8e8a", mark: "#4e4e4c", eye: "#a8d060", breed: "cat", pattern: "tabby", nose: "#c87a80", inner: "#d8a0a0" },   // grey tabby
    { fur: "#eee8de", mark: "#eee8de", eye: "#70b8e0", breed: "cat", pattern: "plain", nose: "#f0a0a8", inner: "#f2b0b0" },   // white
    { fur: "#3a2a22", mark: "#d8843a", eye: "#d8a030", breed: "cat", pattern: "tortie", nose: "#5a3a34", inner: "#a87070" },  // tortoiseshell
    { fur: "#262224", mark: "#eee8de", eye: "#b8d040", breed: "cat", pattern: "bib", nose: "#e89aa0", inner: "#d8a0a0" },     // black and white
  ],
};

/** One leg: it swings at the hip (or shoulder) and bends at the knee (or hock); rest angles stand it square. */
export interface Leg { hip: THREE.Group; knee: THREE.Group; front: boolean; rest: readonly [number, number] }

export interface PetModel {
  group: THREE.Group;
  /** Body, neck, head, legs and tail, pivoting at the hips. */
  trunk: THREE.Group;
  /** The neck bows from the chest (to sniff, or lay the head down); the head nods on the end of it. */
  neck: THREE.Group;
  head: THREE.Group;
  /** Tail segments, root first, each hung on the one before. */
  tail: THREE.Group[];
  /** Front left, front right, hind left, hind right. */
  legs: Leg[];
  eyes: THREE.Mesh[];
  build: Build;
  /** How far forward of the hips the shoulders are (to sit up on the front legs). */
  shoulder: number;
}

/** A tapered limb along local -y from its pivot, `sides` faces round. */
const limb = (top: number, bottom: number, len: number, sides = 5) => new THREE.CylinderGeometry(top, bottom, len, sides).translate(0, -len / 2, 0);

/** A dog or cat in the given coat, `size` times its breed's usual. Not added to the scene. */
export function makePetModel(ctx: RenderContext, species: Species, coat: number, size: number): PetModel {
  const { lambert, basic } = ctx;
  const c = COATS[species][coat % COATS[species].length]!, cat = species === "cat", r = READ[species], life: Build = BREEDS[c.breed];
  const b: Build = {
    ...life, w: life.w * r.girth, h: life.h * Math.sqrt(r.girth), leg: life.leg * r.leg, head: life.head * r.head, snout: life.snout * Math.sqrt(r.head),
    tail: { ...life.tail, thick: life.tail.thick * r.tail },
  };
  const fur = lambert(c.fur), mark = lambert(c.mark), eyeMat = basic(c.eye), pupilMat = basic("#141010"), noseMat = basic(c.nose ?? "#141010");
  const { L, h, w, leg, head: hs } = b, rChest = h / 2, rHips = (h / 2) * b.hips;
  /** Which parts take the markings' colour, by pattern. */
  const marked = (where: "ears" | "muzzle" | "chest" | "socks" | "tip") => {
    const yes = c.pattern === "bib" ? where === "chest" || where === "socks" || where === "tip" || (cat && where === "muzzle")
      : c.pattern === "mask" ? where === "muzzle" || where === "ears"
      : c.pattern === "saddle" ? where === "ears" || where === "tip"
      : c.pattern === "patches" ? where === "ears"
      : c.pattern === "tabby" ? where === "tip"
      : false;
    return yes ? mark : fur;
  };

  const group = new THREE.Group(), trunk = new THREE.Group();
  group.add(trunk);

  // The body: deep in the chest, narrower at the hips, six-sided, lying along +X from the rump; a full chest.
  trunk.add(new THREE.Mesh(new THREE.CylinderGeometry(rChest, rHips, L, 6).rotateZ(-Math.PI / 2).scale(1, 1, w / h).translate(L / 2, h / 2, 0), fur));
  const chest = new THREE.Mesh(new THREE.IcosahedronGeometry(rChest * 1.02, 0).scale(0.9, 1, w / h), marked("chest"));
  chest.position.set(L - rChest * 0.55, h / 2 - rChest * 0.05, 0);
  trunk.add(chest);

  // Markings on the back and sides.
  if (c.pattern === "saddle") {
    const saddle = new THREE.Mesh(new THREE.CylinderGeometry(rChest * 1.04, rHips * 1.04, L * 0.6, 6, 1, true, -Math.PI * 0.5, Math.PI).rotateZ(-Math.PI / 2).scale(1, 1, w / h).translate(L * 0.42, h / 2, 0), mark);
    trunk.add(saddle);
  }
  if (c.pattern === "tabby") {
    for (let i = 0; i < 4; i++) {
      const x = L * (0.14 + i * 0.2), r = rHips + (rChest - rHips) * (x / L);
      trunk.add(new THREE.Mesh(new THREE.CylinderGeometry(r * 1.05, r * 1.05, 0.024, 6, 1, true, -Math.PI * 0.4, Math.PI * 0.8).rotateZ(-Math.PI / 2).scale(1, 1, w / h).translate(x, h / 2, 0), mark));
    }
  }
  if (c.pattern === "patches" || c.pattern === "tortie") {
    for (const [x, z, k] of [[0.3, 0.32, 1], [0.64, -0.3, 0.8], [0.14, -0.25, 0.65]] as const) {
      const p = new THREE.Mesh(new THREE.IcosahedronGeometry(h * 0.3 * k, 0).scale(1.4, 0.55, 1), mark);
      p.position.set(L * x, h * 0.88, w * z);
      trunk.add(p);
    }
  }

  // The neck, up and forward from the chest, and a ruff round it.
  const neckAt = new THREE.Vector3(L - rChest * 0.45, h * 0.6, 0), neckUp = cat ? 0.75 : 0.9, neckLen = b.neck + rChest * 0.3;
  const neck = new THREE.Group();
  neck.position.copy(neckAt);
  neck.add(new THREE.Mesh(new THREE.CylinderGeometry(rChest * 0.5, rChest * 0.62, neckLen, 5).translate(0, neckLen / 2, 0).rotateZ(neckUp - Math.PI / 2).scale(1, 1, w / h), fur));
  trunk.add(neck);
  if (b.ruff) {
    const ruff = new THREE.Mesh(new THREE.IcosahedronGeometry(rChest * 1.1, 0).scale(0.8, 1.05, 1.2), marked("chest"));
    ruff.position.set(L - rChest * 0.15, h * 0.78, 0);
    trunk.add(ruff);
  }

  // The head on the end of the neck: skull, muzzle, nose, eyes and ears.
  const head = new THREE.Group();
  head.position.set(Math.cos(neckUp) * b.neck, Math.sin(neckUp) * b.neck, 0);
  neck.add(head);
  const skull = new THREE.Mesh(cat
    ? new THREE.DodecahedronGeometry(hs / 2, 0).scale(0.9, 0.82, 1.08)                      // round, wide in the cheeks
    : new THREE.CylinderGeometry(hs * 0.42, hs * 0.5, hs, 4).rotateY(Math.PI / 4).rotateZ(-Math.PI / 2).scale(1, 0.9, 1), fur);
  skull.position.set(hs * 0.15, hs * 0.1, 0);
  head.add(skull);
  const front = hs * 0.15 + hs * (cat ? 0.42 : 0.5);
  const muzzle = new THREE.Mesh(cat
    ? box(b.snout, hs * 0.32, hs * 0.48)
    : new THREE.CylinderGeometry(hs * 0.2, hs * 0.3, b.snout, 4).rotateY(Math.PI / 4).rotateZ(-Math.PI / 2), marked("muzzle"));
  muzzle.position.set(front + b.snout / 2 - 0.01, hs * (cat ? -0.08 : -0.05), 0);
  head.add(muzzle);
  const nose = new THREE.Mesh(box(0.03, cat ? 0.022 : 0.034, cat ? 0.03 : 0.045).scale(r.face, r.face, r.face), noseMat);
  nose.position.set(front + b.snout - 0.008, hs * (cat ? 0 : 0.06), 0);
  head.add(nose);
  const eyes = [1, -1].map(s => {
    const e = new THREE.Mesh(box(0.024, 0.026, cat ? 0.03 : 0.028).scale(r.face, r.face, r.face), eyeMat);
    e.position.set(cat ? hs * 0.5 : front - 0.004, hs * (cat ? 0.14 : 0.2), s * hs * (cat ? 0.2 : 0.24));
    if (cat) {                                               // a slit pupil, on the eye so it shuts with it
      const slit = new THREE.Mesh(box(0.008, 0.022, 0.007).scale(r.face, r.face, r.face), pupilMat);
      slit.position.x = 0.012 * r.face;
      e.add(slit);
    }
    head.add(e);
    return e;
  });
  const earMat = marked("ears"), innerMat = lambert(c.inner ?? c.mark);
  for (const s of [1, -1]) {
    const ear = new THREE.Group();
    if (b.ears === "prick" || b.ears === "cat") {           // pricked up: a pointed triangle, pink (or dark) inside
      const tall = cat ? hs * 0.5 : hs * 0.65, wide = cat ? hs * 0.24 : hs * 0.22;
      const outer = new THREE.Mesh(new THREE.ConeGeometry(wide, tall, 3).rotateY(Math.PI / 6).scale(0.55, 1, 1).translate(0, tall / 2, 0), earMat);
      const inner = new THREE.Mesh(new THREE.ConeGeometry(wide * 0.6, tall * 0.75, 3).rotateY(Math.PI / 6).scale(0.4, 1, 1).translate(0, tall * 0.375, 0), cat ? innerMat : mark);
      inner.position.x = wide * 0.22;
      ear.add(outer, inner);
      ear.position.set(hs * 0.02, hs * 0.36, s * hs * (cat ? 0.27 : 0.24));
      ear.rotation.x = s * 0.22;
    } else if (b.ears === "fold") {                          // a terrier's: up, then folded forward at the tip
      ear.add(new THREE.Mesh(box(hs * 0.12, hs * 0.22, hs * 0.26).translate(0, hs * 0.11, 0), earMat),
        new THREE.Mesh(box(hs * 0.2, hs * 0.05, hs * 0.24).translate(hs * 0.08, hs * 0.22, 0), earMat));
      ear.position.set(hs * 0.05, hs * 0.38, s * hs * 0.24);
      ear.rotation.x = s * 0.15;
    } else {                                                 // floppy: flaps hanging down beside the head
      const len = hs * 0.6;
      ear.add(new THREE.Mesh(box(hs * 0.32, len, 0.025).translate(0, -len / 2, 0), earMat));
      ear.position.set(hs * 0.05, hs * 0.38, s * hs * 0.5);
      ear.rotation.x = s * 0.18;
    }
    head.add(ear);
  }

  // Legs: tapered upper and lower, socks or plain, a paw at the foot. Hind legs stand bent at the hock.
  const thick = (cat ? 0.038 : life.w * 0.27 * (c.breed === "mastiff" ? 1.25 : 1)) * r.limb;
  const legs = ([[L - rChest * 0.7, 1, true], [L - rChest * 0.7, -1, true], [L * 0.13, 1, false], [L * 0.13, -1, false]] as const).map(([x, s, isFront]): Leg => {
    const hipY = h / 2 - (isFront ? rChest : rHips) * 0.75;
    const rest: readonly [number, number] = isFront ? [0, 0.05] : [0.38, -0.7];
    const paw = thick * 0.8, reach = leg + hipY - paw;      // from the joint down to the top of the paw
    const k = Math.cos(rest[0]) * 0.5 + Math.cos(rest[0] + rest[1]) * 0.5, upperLen = (reach / k) * (isFront ? 0.5 : 0.55), lowerLen = reach / k - upperLen;
    const hip = new THREE.Group(), knee = new THREE.Group();
    hip.position.set(x, hipY, s * (w / 2 - thick * 0.6));
    const upper = new THREE.Mesh(limb(thick * (isFront ? 0.75 : 1.05), thick * 0.6, upperLen), fur);
    knee.position.y = -upperLen;
    const foot = new THREE.Mesh(box(paw * 1.5, paw, paw * 1.25), marked("socks"));
    foot.position.set(paw * 0.3, -lowerLen - paw / 2, 0);
    knee.add(new THREE.Mesh(limb(thick * 0.55, thick * 0.5, lowerLen), marked("socks")), foot);
    hip.add(upper, knee);
    trunk.add(hip);
    return { hip, knee, front: isFront, rest };
  });

  // The tail, from the top of the rump: a chain of tapering segments (fat and furry for some), the tip marked.
  const tail: THREE.Group[] = [];
  let parent: THREE.Object3D = trunk;
  for (let i = 0; i < b.tail.n; i++) {
    const seg = new THREE.Group(), k = 1 - i / b.tail.n, last = i === b.tail.n - 1;
    const r = b.tail.thick * (b.tail.bushy ? 1 - Math.abs(i - 1) * 0.25 : 0.55 + k * 0.45);
    const geo = b.tail.bushy
      ? new THREE.IcosahedronGeometry(b.tail.len * 0.65, 0).scale(1, r / (b.tail.len * 0.65), r / (b.tail.len * 0.65)).translate(-b.tail.len / 2, 0, 0)
      : new THREE.CylinderGeometry(r * 0.8, r, b.tail.len + 0.01, 4).rotateZ(Math.PI / 2).translate(-b.tail.len / 2, 0, 0);
    seg.add(new THREE.Mesh(geo, last ? marked("tip") : fur));
    if (i === 0) seg.position.set(0.02, h * (0.5 + b.hips * 0.35), 0);
    else seg.position.x = -b.tail.len;
    parent.add(seg);
    tail.push(seg);
    parent = seg;
  }

  const model: PetModel = { group, trunk, neck, head, tail, legs, eyes, build: b, shoulder: L - rChest * 0.7 };
  group.scale.setScalar(size * b.scale * r.size);
  posePet(model, { sit: 0, lie: 0, curl: 0, stride: 0, swing: 0, bob: 0 });
  return model;
}

/** How a pet holds itself: sit, lie and curl 0-1 (the view eases them); stride is the legs' phase, swing how far they go. */
export interface Pose { sit: number; lie: number; curl: number; stride: number; swing: number; bob: number }

/**
 * Put the rig in a pose: standing (legs square, stepping in diagonal pairs, knees bending as each foot comes
 * forward), sitting up on straight front legs with the hind legs folded under the haunches, or lying down,
 * front paws out like a sphinx or, curled up, tucked underneath.
 */
export function posePet(m: PetModel, p: Pose): void {
  const { leg } = m.build, low = leg * 0.3, up = 1 - p.lie, sit = p.sit * up;
  const pitch = Math.asin(Math.min(1, (leg - low) / m.shoulder)) * sit;
  m.trunk.position.y = leg + (low - leg) * sit + (0.015 - leg) * p.lie + p.bob;
  m.trunk.rotation.z = pitch;
  m.legs.forEach((l, i) => {
    const phase = p.stride + (i === 0 || i === 3 ? 0 : Math.PI), step = Math.sin(phase) * p.swing;
    const lift = Math.max(0, Math.cos(phase)) * p.swing;
    let hip = l.rest[0] + step, knee = l.rest[1] + (l.front ? -lift * 1.2 : lift * 0.6);
    if (l.front) {
      hip += sit * (-pitch - hip);                             // sitting: straight down, braced
      hip += p.lie * (1.5 - hip);                              // lying: out in front, or tucked under
      knee += p.lie * (-2.8 * p.curl - knee);
    } else {
      hip += sit * (Math.PI / 2 - pitch - 0.1 - hip);           // sitting: thigh forward along the ground, shin back under it
      knee += sit * (-Math.PI + 0.25 - knee);
      hip += p.lie * (1.35 - hip);
      knee += p.lie * (-2.6 - knee);
    }
    l.hip.rotation.z = hip;
    l.knee.rotation.z = knee;
  });
}
