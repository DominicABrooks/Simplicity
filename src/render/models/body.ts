// The humanoid body shared by everyone: the hero, the mages and the kingdom's guards: a little stone spirit in a bark wrap, with
// floating hands. Gear (dressBody) is rebuilt whenever the equipment changes, so loot visibly
// upgrades whoever wears it; soldiers wear a soldier's kit instead (dressSoldier).
import * as THREE from "three";
import type { ItemType } from "../../data/items.ts";
import { PAL } from "../../data/palette.ts";
import { TIERS, type TierName } from "../../data/tiers.ts";
import type { Slot } from "../../data/items.ts";
import { addShadow, box, col, type RenderContext } from "../context.ts";
import { disposeTree } from "../dispose.ts";
import type { Dress } from "../../world/wardrobe.ts";
import { makeArrowMesh } from "./projectiles.ts";

const STEEL = "#a9b1ba", STEEL_DARK = "#6b737d";

/** What a body wears: a tier per slot (null when empty) and the weapon type. */
export type Outfit = Record<Slot, TierName | null> & { weaponType: ItemType | null };

export interface Body {
  group: THREE.Group;
  body: THREE.Group;
  gear: THREE.Group;
  /** The weapon in hand (sword, bow or rod), animated separately from the body. */
  sword: THREE.Group;
  /** The ring, orbiting the body. */
  ring: THREE.Group;
  eyes: THREE.Mesh[];
  /** The bare stone body and its bark wrap: hidden under townsfolk's clothes, which close over it. */
  torso: THREE.Mesh[];
  feet: THREE.Group[];
  /** [0] is the front hand on the camera side, [1] the back hand. */
  hands: THREE.Mesh[];
  shadow: THREE.Mesh;
  ripple: THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>;
  /** Where the feet rest along X: further out from under a robe. */
  footX: number;
  /** Where the front hand holds the weapon, along its length. */
  gripY: number;
  rodTip: THREE.Object3D | null;
  bow: { string: THREE.Line; arrow: ReturnType<typeof makeArrowMesh>; nockX: number } | null;
  /** The outfit the gear was last built for. */
  key: string | null;
}

export function makeBody(ctx: RenderContext): Body {
  const { lambert, basic, lathe, scene } = ctx;
  const group = new THREE.Group(), body = new THREE.Group(), sword = new THREE.Group(), ring = new THREE.Group();
  group.add(body, sword, ring);
  const skin = lambert(PAL.w);
  const trunk = lathe([[0, 0.06], [0.2, 0.06], [0.27, 0.2], [0.27, 0.4], [0.2, 0.56], [0.08, 0.64]], skin);
  const wrap = new THREE.Mesh(new THREE.CylinderGeometry(0.285, 0.29, 0.11, 7), lambert(PAL.n)); wrap.position.y = 0.19;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.27, 7, 5), skin); head.position.y = 0.8;
  const face = new THREE.Mesh(new THREE.SphereGeometry(0.2, 6, 4), basic(PAL.k));
  face.position.set(0.17, 0.78, 0); face.scale.set(0.55, 0.8, 0.9);
  const eyeMat = ctx.glow(PAL.Y);                           // the eyes shine, day and night
  const eyes = [-1, 1].map(s => { const e = new THREE.Mesh(box(0.05, 0.1, 0.06), eyeMat); e.position.set(0.29, 0.8, s * 0.075); return e; });
  // Each foot is a group so bare feet and boots share the walk animation.
  const feet = [-1, 1].map(s => {
    const f = new THREE.Group(); f.position.set(0.14, 0, s * 0.12);
    const nub = new THREE.Mesh(box(0.14, 0.07, 0.11), skin); nub.position.y = 0.035;
    f.add(nub); f.userData.nub = nub;
    return f;
  });
  body.add(trunk, wrap, head, face, ...eyes, ...feet);
  const gear = new THREE.Group(); body.add(gear);
  // Floating hands (no arms).
  const handGeo = new THREE.IcosahedronGeometry(0.1, 0).scale(1.1, 0.9, 1);
  const handMat = lambert("#8f8578");                        // a shade darker than the body so they read
  const hands = [1, -1].map(s => { const m = new THREE.Mesh(handGeo, handMat); m.position.set(0.12, 0.38, s * 0.44); return m; });
  group.add(...hands);

  const shadow = addShadow(ctx);
  const ripple = new THREE.Mesh(new THREE.RingGeometry(0.38, 0.5, 10).rotateX(-Math.PI / 2), basic(PAL.C, { transparent: true, opacity: 0.6, depthWrite: false }));
  ripple.renderOrder = 1;                                    // after the see-through water, wherever it sorts
  scene.add(group, shadow, ripple);
  return { group, body, gear, sword, ring, eyes, torso: [trunk, wrap], feet, hands, shadow, ripple, footX: 0.14, gripY: 0, rodTip: null, bow: null, key: null };
}

/** Rebuild the gear meshes if the outfit changed. */
export function dressBody(ctx: RenderContext, h: Body, g: Partial<Outfit>): void {
  const key = JSON.stringify(g);
  if (key === h.key) return;
  h.key = key;
  const { lambert, basic, lathe, tex } = ctx;
  for (const part of [h.gear, h.sword, h.ring]) { disposeTree(part); part.clear(); }
  h.feet.forEach(f => {
    const nub = f.userData.nub as THREE.Mesh;
    for (const c of f.children) if (c !== nub) disposeTree(c);   // old boots
    f.clear(); f.add(nub); nub.visible = true;
  });

  if (g.armor) {
    const T = g.armor;
    h.gear.add(lathe([[0.42, 0], [0.4, 0.1], [0.3, 0.38], [0.18, 0.56]], lambert("#ffffff", { map: tex.cloth(T) })));
    h.gear.add(lathe([[0.38, 0.44], [0.34, 0.52], [0.2, 0.64]], lambert("#ffffff", { map: tex.mantle(T) })));
  }
  if (g.helm) {
    const T = g.helm;
    const hood = new THREE.Mesh(new THREE.SphereGeometry(0.31, 7, 5), lambert("#ffffff", { map: tex.cloth(T) }));
    hood.position.set(0, 0.8, 0); hood.scale.set(1, 0.95, 1);
    const tip = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.45, 5), lambert(TIERS[T].cloth));
    tip.position.set(-0.2, 1.04, 0); tip.rotation.z = 1.1;
    const opening = new THREE.Mesh(new THREE.SphereGeometry(0.22, 6, 4), basic(PAL.k));
    opening.position.set(0.21, 0.77, 0); opening.scale.set(0.6, 0.85, 0.95);
    h.gear.add(hood, tip, opening);
  }
  // Eyes sit in whatever face is in front: the hood's opening or the bare head.
  h.eyes.forEach(e => { e.position.x = g.helm ? 0.34 : 0.29; });
  if (g.boots) {
    const T = TIERS[g.boots];
    h.feet.forEach(f => {
      (f.userData.nub as THREE.Mesh).visible = false;
      const boot = new THREE.Mesh(box(0.2, 0.12, 0.14), lambert(T.boot)); boot.position.set(0.02, 0.06, 0);
      const cuff = new THREE.Mesh(box(0.15, 0.04, 0.16), lambert(T.trim)); cuff.position.set(-0.01, 0.14, 0);
      f.add(boot, cuff);
    });
  }
  // Feet poke out from under a robe, or sit under a bare body.
  h.footX = g.armor ? 0.3 : 0.14;
  if (g.amulet) {
    const T = TIERS[g.amulet];
    const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.055, 0), lambert(T.gem, { emissive: col(T.gem), emissiveIntensity: 0.6 }));
    gem.position.set(g.armor ? 0.36 : 0.28, 0.5, 0);
    const chain = new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.012, 3, 10).rotateX(Math.PI / 2), lambert(T.metal));
    chain.position.set(g.armor ? 0.18 : 0.1, 0.6, 0); chain.scale.set(1.15, 1, 1);
    h.gear.add(gem, chain);
  }
  if (g.ring) {
    const T = TIERS[g.ring];
    const band = new THREE.Mesh(new THREE.TorusGeometry(0.06, 0.018, 4, 8), lambert(T.metal, { emissive: col(T.gem), emissiveIntensity: 0.5 }));
    band.position.set(0.52, 0.45, 0);
    h.ring.add(band);
  }
  h.rodTip = null; h.bow = null;
  if (g.weaponType === "bow" && g.weapon) {
    const T = TIERS[g.weapon];
    const wood = lambert(PAL.N), wrap = lambert(T.cloth), tipMat = lambert(T.metal, { emissive: col(T.metal), emissiveIntensity: T.glow });
    // Limbs curve forward (+X) away from the string; the grip sits at the group origin.
    const limb = (s: number) => { const m = new THREE.Mesh(box(0.045, 0.3, 0.05), wood); m.position.set(0.06, s * 0.2, 0); m.rotation.z = s * 0.35; return m; };
    const limb2 = (s: number) => { const m = new THREE.Mesh(box(0.04, 0.16, 0.045), wood); m.position.set(0.0, s * 0.4, 0); m.rotation.z = s * -0.25; return m; };
    const gripM = new THREE.Mesh(box(0.06, 0.15, 0.07), wrap); gripM.position.x = 0.08;
    const tips = [1, -1].map(s => { const m = new THREE.Mesh(box(0.05, 0.05, 0.06), tipMat); m.position.set(-0.03, s * 0.48, 0); return m; });
    const stringGeo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(-0.03, 0.48, 0), new THREE.Vector3(-0.03, 0, 0), new THREE.Vector3(-0.03, -0.48, 0)]);
    const string = new THREE.Line(stringGeo, new THREE.LineBasicMaterial({ color: col(PAL.W) }));
    // Nocked arrow, shown while drawing.
    const arrow = makeArrowMesh(ctx);
    arrow.visible = false;
    h.sword.add(limb(1), limb(-1), limb2(1), limb2(-1), gripM, ...tips, string, arrow);
    h.bow = { string, arrow, nockX: -0.03 };
    h.gripY = 0;
  } else if (g.weaponType === "rod") {
    const oak = lambert(PAL.N), dark = lambert(PAL.n);
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.035, 1.3, 4).translate(0, 0.6, 0), oak);
    const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.22, 5).translate(0, -0.05, 0), dark);
    const reel = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.05, 6).rotateX(Math.PI / 2), lambert(PAL.w));
    reel.position.set(-0.06, 0.12, 0);
    const tip = new THREE.Object3D(); tip.position.y = 1.25;
    h.sword.add(pole, grip, reel, tip);
    h.rodTip = tip;
    h.gripY = -0.05;
  } else if (g.weapon) {
    const T = TIERS[g.weapon];
    const blade = lambert(T.blade, { emissive: col(g.weapon === "rare" ? PAL.Y : PAL.C), emissiveIntensity: T.glow });
    const guard = lambert(T.guard);
    const parts: [THREE.BufferGeometry, THREE.Material, number][] = [
      [box(0.05, 0.62, 0.12), blade, 0.45], [box(0.08, 0.06, 0.32), guard, 0.12], [box(0.05, 0.16, 0.05), lambert(PAL.N), 0.02], [box(0.08, 0.08, 0.08), guard, -0.08],
    ];
    for (const [geo, m, y] of parts) { const p = new THREE.Mesh(geo, m); p.position.y = y; h.sword.add(p); }
    h.gripY = 0.02;
  }
}

/**
 * Dress a body as a soldier of the tier's colours instead of in robes: a steel nasal helm with a plume, a
 * mail shirt under a surcoat with a belt and emblem, steel pauldrons, gauntlets and greaves, a spear in
 * the front hand (as the weapon, gripped like one) and a shield on the other. Same body, same face.
 */
export function dressSoldier(ctx: RenderContext, h: Body, tier: TierName): void {
  const { lambert, basic, lathe } = ctx, T = TIERS[tier];
  for (const part of [h.gear, h.sword, h.ring]) { disposeTree(part); part.clear(); }
  h.key = `soldier/${tier}`;
  const steel = lambert(STEEL), dark = lambert(STEEL_DARK), cloth = lambert(T.cloth), trim = lambert(T.trim);
  // Helm: a steel dome over the head, a rim, a nose guard down the face, a plume on top.
  const dome = new THREE.Mesh(new THREE.SphereGeometry(0.3, 8, 5, 0, Math.PI * 2, 0, Math.PI * 0.52), steel);
  dome.position.y = 0.87;                                   // its rim just above the eyes
  const rim = new THREE.Mesh(new THREE.CylinderGeometry(0.31, 0.31, 0.05, 8), dark);
  rim.position.y = 0.87;
  const nose = new THREE.Mesh(box(0.04, 0.2, 0.06), dark);
  nose.position.set(0.3, 0.79, 0);
  const plume = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.32, 5), cloth);
  plume.position.set(-0.04, 1.26, 0); plume.rotation.z = 0.35;
  h.gear.add(dome, rim, nose, plume);
  // Mail to the shoulders, and the surcoat over it with a gold hem, belt and emblem.
  h.gear.add(lathe([[0.31, 0.08], [0.31, 0.32], [0.29, 0.46], [0.21, 0.6]], steel));
  h.gear.add(lathe([[0.36, 0], [0.34, 0.08], [0.33, 0.3], [0.32, 0.44]], cloth));
  const hem = new THREE.Mesh(new THREE.CylinderGeometry(0.365, 0.37, 0.04, 8), trim); hem.position.y = 0.02;
  const belt = new THREE.Mesh(new THREE.CylinderGeometry(0.345, 0.345, 0.05, 8), lambert(PAL.n)); belt.position.y = 0.3;
  const buckle = new THREE.Mesh(box(0.04, 0.07, 0.08), trim); buckle.position.set(0.345, 0.3, 0);
  const emblem = new THREE.Mesh(new THREE.OctahedronGeometry(0.07, 0), basic(T.trim)); emblem.position.set(0.335, 0.17, 0); emblem.scale.x = 0.3;
  h.gear.add(hem, belt, buckle, emblem);
  for (const s of [-1, 1]) {                                 // pauldrons
    const p = new THREE.Mesh(new THREE.SphereGeometry(0.13, 6, 4, 0, Math.PI * 2, 0, Math.PI / 2), steel);
    p.position.set(0, 0.54, s * 0.26); p.rotation.x = s * 0.5;
    h.gear.add(p);
  }
  // Greaves, and gauntlets on the floating hands.
  h.feet.forEach(f => {
    const nub = f.userData.nub as THREE.Mesh;
    for (const c of f.children) if (c !== nub) disposeTree(c);
    f.clear(); f.add(nub); nub.visible = false;
    const boot = new THREE.Mesh(box(0.2, 0.12, 0.14), lambert(T.boot)); boot.position.set(0.02, 0.06, 0);
    const greave = new THREE.Mesh(box(0.13, 0.12, 0.15), steel); greave.position.set(0, 0.16, 0);
    f.add(boot, greave);
  });
  h.footX = 0.3;
  (h.hands[0]!.material as THREE.Material).dispose();      // the bare hands' material (one for both)
  h.hands.forEach(hand => { hand.material = steel; });
  h.eyes.forEach(e => { e.position.x = 0.29; });
  // The spear, its butt on the ground when held at rest (the weapon group sits at about hand height).
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.026, 2.0, 5), lambert(PAL.N)); shaft.position.y = 0.5;
  const head = new THREE.Mesh(new THREE.OctahedronGeometry(0.07, 0), steel); head.position.y = 1.55; head.scale.set(0.5, 2.2, 0.5);
  const collar = new THREE.Mesh(box(0.06, 0.05, 0.06), trim); collar.position.y = 1.47;
  h.sword.add(shaft, head, collar);
  h.gripY = 0.05;
  h.rodTip = null; h.bow = null;
  // The shield, strapped to the back hand: the tier's colour, a gold rim and boss.
  const shield = new THREE.Group();
  const face = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.04, 10).rotateX(Math.PI / 2), cloth);
  const edge = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.025, 4, 10), trim);
  const boss = new THREE.Mesh(new THREE.SphereGeometry(0.07, 6, 4), trim); boss.position.z = -0.03;
  shield.add(face, edge, boss);
  shield.position.set(0.02, 0.02, -0.08);
  h.hands[1]!.add(shield);
}

/**
 * Each garment's outline, [radius, height] from the hem up: slim through the waist (0.26 to 0.47 up),
 * where the hands hover at the sides, and closing over the neck under the head. Long garments stop just
 * clear of the ground, so the shoes step out from under them rather than through them.
 */
const NECK: [number, number][] = [[0.21, 0.56], [0.15, 0.62], [0, 0.65]];
const GARMENTS: Record<Dress["garment"], [number, number][]> = {
  "tunic": [[0.32, 0.13], [0.31, 0.18], [0.28, 0.28], [0.275, 0.44], ...NECK],
  "long tunic": [[0.34, 0.075], [0.32, 0.14], [0.28, 0.28], [0.275, 0.44], ...NECK],
  "smock": [[0.36, 0.12], [0.34, 0.18], [0.29, 0.25], [0.28, 0.3], [0.28, 0.44], ...NECK],
  "doublet": [[0.31, 0.21], [0.29, 0.25], [0.265, 0.3], [0.275, 0.44], ...NECK],
  "gown": [[0.4, 0.075], [0.36, 0.14], [0.29, 0.26], [0.26, 0.36], [0.265, 0.44], ...NECK],
  "kirtle": [[0.37, 0.075], [0.34, 0.14], [0.28, 0.28], [0.255, 0.4], [0.26, 0.46], ...NECK],
  "robe": [[0.38, 0.075], [0.36, 0.14], [0.3, 0.26], [0.28, 0.32], [0.28, 0.44], ...NECK],
};
/** A profile's radius at height y, flat beyond its ends. */
function radiusAt(pts: readonly [number, number][], y: number): number {
  if (y <= pts[0]![1]) return pts[0]![0];
  for (let i = 1; i < pts.length; i++) {
    const [r0, y0] = pts[i - 1]!, [r1, y1] = pts[i]!;
    if (y <= y1) return r0 + ((r1 - r0) * (y - y0)) / (y1 - y0);
  }
  return pts[pts.length - 1]![0];
}
/** Where a feather sits in each hat that takes one. */
const FEATHER: Partial<Record<Dress["head"], [number, number, number]>> = { cap: [-0.08, 0.98, 0.2], felt: [-0.06, 1.1, 0.2], chaperon: [-0.08, 1.07, 0.2] };

/**
 * Dress a body as one of the townsfolk, in their own clothes (see Dress, src/world/wardrobe.ts). The body
 * faces +x, and its bare stone is hidden: the clothes close over it. Their garment (a tunic, a smock, a
 * doublet, a gown, a kirtle or a robe, each with its own collar, buttons, laces, girdle or cord) in one
 * colour, split in two, or banded; hose, where a short garment shows the legs; what they wear over it;
 * their hair and headwear; a feather, a pouch, a brooch; their shoes; and whatever they carry, in the back
 * hand (or, a staff, the front).
 *
 * Nothing pokes through anything: every layer is turned on the same eight facets as the garment, so their
 * corners line up, and measured from the layers beneath (`under` and `outer`), a little further out.
 */
export function dressCommoner(ctx: RenderContext, h: Body, d: Dress): void {
  const key = `common/${JSON.stringify(d)}`;
  if (key === h.key) return;
  for (const part of [h.gear, h.sword, h.ring]) { disposeTree(part); part.clear(); }
  for (const hand of h.hands) for (const c of [...hand.children]) { hand.remove(c); disposeTree(c); }
  h.key = key;
  h.torso.forEach(m => { m.visible = false; });
  const { lambert } = ctx, cloth = lambert(d.cloth), second = lambert(d.second), trim = lambert(d.trim), linen = lambert("#ece4d0");
  const mesh = (geo: THREE.BufferGeometry, mat: THREE.Material, x = 0, y = 0, z = 0) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); h.gear.add(m); return m; };
  /** A turned shape over `quarters` eighth-turns from `from` (0 is +z, 2 the front, 6 the back), on the garment's facets. */
  const Q = Math.PI / 4;
  const turned = (pts: [number, number][], mat: THREE.Material, from = 0, quarters = 8) =>
    mesh(new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), quarters, from * Q, quarters * Q), mat);
  const shape = GARMENTS[d.garment], [hemR, hemY] = shape[0]!;
  const long = hemY < 0.1;

  // How far out the clothes reach at each height: the garment and anything worn close over it (`under`),
  // then a cloak or shawl over all (`outer`). Each layer is fitted a little outside the one below.
  const TIGHT = 0.022, WRAP = { cloak: 0.07, shawl: 0.045 } as Partial<Record<Dress["over"], number>>;
  const apronLo = Math.max(hemY + 0.04, 0.1), surcoatLo = long ? hemY + 0.06 : Math.max(0.075, hemY - 0.06);
  const tight: [number, number] | null = { apron: [apronLo, 0.32], vest: [0.24, 0.56], surcoat: [surcoatLo, 0.58], tabard: [0.14, 0.58] }[d.over as string] as [number, number] | undefined ?? null;
  const wrap: [number, number] | null = d.over === "cloak" ? [0.08, 0.63] : d.over === "shawl" ? [0.3, 0.63] : null;
  const under = (y: number) => radiusAt(shape, y) + (tight && y >= tight[0] - 0.01 && y <= tight[1] + 0.01 ? TIGHT : 0);
  const outer = (y: number) => under(y) + (wrap && y >= wrap[0] && y <= wrap[1] ? WRAP[d.over]! : 0);
  /** Points following the garment from y0 up to y1, `pad` outside the layers beneath. */
  const fitted = (y0: number, y1: number, pad: number | ((y: number) => number), surface = under): [number, number][] =>
    [y0, ...shape.map(p => p[1]).filter(y => y > y0 && y < y1), y1].map(y => [surface(y) + (typeof pad === "number" ? pad : pad(y)), y]);
  const band = (y0: number, y1: number, pad: number, mat: THREE.Material, from = 0, quarters = 8, surface = under) => turned(fitted(y0, y1, pad, surface), mat, from, quarters);
  /** Something small on the clothes' surface at height y, facing out at angle phi (PI/2 the front). */
  const onFront = (geo: THREE.BufferGeometry, mat: THREE.Material, y: number, pad: number, phi = Math.PI / 2, surface = under) => {
    const r = surface(y) + pad, m = mesh(geo, mat, Math.sin(phi) * r, y, Math.cos(phi) * r);
    m.rotation.y = phi - Math.PI / 2;
    return m;
  };
  /** A rod from a to b (hair, a cord). */
  const rod = (a: THREE.Vector3, b: THREE.Vector3, r: number, mat: THREE.Material) => {
    const dir = b.clone().sub(a), m = mesh(new THREE.CylinderGeometry(r, r, dir.length(), 5), mat);
    m.position.copy(a).add(b).multiplyScalar(0.5);
    m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
    return m;
  };

  // ---- The garment ----
  if (d.pattern === "parti") { turned(shape, cloth, -2, 4); turned(shape, second, 2, 4); }   // one side each colour
  else turned(shape, cloth);
  if (d.pattern === "banded") for (const y of [hemY + 0.05, hemY + 0.11]) band(y, y + 0.03, 0.008, second);
  band(hemY, hemY + 0.035, 0.01, trim);                                                     // the hem
  switch (d.garment) {
    case "tunic": case "long tunic":
      band(0.5, 0.57, 0.01, trim);                                                          // the collar
      if (d.garment === "long tunic") onFront(box(0.02, 0.16, 0.035), trim, 0.47, 0.008).rotation.z = 0.35;   // a placket at the throat
      break;
    case "smock": band(0.44, 0.54, 0.01, d.pattern === "plain" ? second : linen); break;   // the gathered yoke
    case "doublet":
      band(0.5, 0.58, 0.012, trim);                                                         // a standing collar
      for (let i = 0; i < 4; i++) onFront(box(0.03, 0.03, 0.035), trim, 0.25 + i * 0.065, 0.012);   // buttons down the front
      break;
    case "gown": band(0.5, 0.57, 0.01, trim); break;                                        // the neckline
    case "kirtle":
      band(0.53, 0.6, 0.008, linen);                                                        // the shift showing at the neck
      for (let i = 0; i < 6; i++) onFront(box(0.015, 0.018, 0.1), trim, 0.33 + Math.floor(i / 2) * 0.055, 0.01).rotation.x = i % 2 ? 0.7 : -0.7;   // laced up the front
      break;
    case "robe": break;
  }

  // ---- Close over it ----
  if (d.over === "apron") {
    band(apronLo, 0.32, TIGHT, second, 1, 2);                                               // linen, or a smith's leather
    if (d.garment === "gown" || d.garment === "kirtle") onFront(box(0.015, 0.15, 0.15), second, 0.4, TIGHT, Math.PI / 2, y => radiusAt(shape, y));   // and a bib
  } else if (d.over === "vest") band(0.24, 0.56, TIGHT, second, 3, 6);                    // open down the front
  else if (d.over === "surcoat") {                                                          // sideless: open at the sides down to the hips
    band(surcoatLo, 0.3, TIGHT, second);
    for (const from of [1, 5]) band(0.3, 0.58, TIGHT, second, from, 2);
    band(surcoatLo, surcoatLo + 0.03, 0.01, trim);
  } else if (d.over === "tabard") {                                                         // panels front and back, the arms on the front
    for (const from of [1, 5]) { band(0.14, 0.58, TIGHT, second, from, 2); band(0.14, 0.17, 0.01, trim, from, 2); }
    onFront(new THREE.OctahedronGeometry(0.06, 0), trim, 0.42, 0.01).scale.x = 0.3;
  }

  // ---- Belt, pouch ----
  if (d.garment === "robe") {                                                               // a cord, its ends hanging
    band(0.31, 0.335, 0.01, linen);
    for (const [phi, lo] of [[Math.PI / 2, 0.14], [Math.PI / 2 - 0.12, 0.18]] as const) {
      const r = (y: number) => under(y) + 0.014;
      rod(new THREE.Vector3(Math.sin(phi) * r(0.31), 0.31, Math.cos(phi) * r(0.31)), new THREE.Vector3(Math.sin(phi) * r(lo), lo, Math.cos(phi) * r(lo)), 0.013, linen);
    }
  } else if (d.garment === "gown") {                                                        // a girdle high under the bust, its end hanging
    band(0.37, 0.4, 0.01, trim);
    if (d.over !== "apron" && d.over !== "surcoat") onFront(box(0.015, 0.2, 0.035), trim, 0.27, 0.012);
  } else band(0.3, 0.345, 0.012, trim);                                                     // the belt
  if (d.pouch) onFront(box(0.06, 0.09, 0.08), lambert("#5d4430"), 0.23, 0.03, 0.2 * Math.PI);
  if (d.garment === "robe" && !d.over.match(/cloak|shawl/) && (d.head === "bare" || d.head === "coif"))   // the cowl, down on the shoulders
    turned([[under(0.42) + 0.015, 0.42], [under(0.5) + 0.05, 0.5], [under(0.58) + 0.035, 0.58]], lambert(d.cloth, { side: THREE.DoubleSide }), 4, 4);

  // ---- Over all ----
  if (d.over === "cloak") {                                                                 // down the back from the shoulders, with a collar and clasp
    const mat = lambert(d.second, { side: THREE.DoubleSide });
    turned([...fitted(0.08, 0.56, y => WRAP.cloak! - 0.02 + (0.56 - y) * 0.04), [0.17, 0.63]], mat, 4, 4);
    band(0.52, 0.6, WRAP.cloak!, mat);
    onFront(box(0.03, 0.05, 0.07), trim, 0.56, WRAP.cloak! + 0.01);
  } else if (d.over === "shawl") {                                                          // round the shoulders, to a point down the back
    band(0.42, 0.6, WRAP.shawl!, second);
    band(0.3, 0.42, WRAP.shawl!, second, 5, 2);
    onFront(new THREE.OctahedronGeometry(0.045, 0), second, 0.45, WRAP.shawl! + 0.015);
  }
  if (d.brooch) onFront(new THREE.OctahedronGeometry(0.04, 0), lambert("#d9a83a"), d.over === "cloak" ? 0.6 : 0.5, 0.02, Math.PI / 2, outer);

  // ---- Hair and headwear ----
  const hair = lambert(d.hair);
  const cap = (r: number, y: number, mat: THREE.Material, open = 0.5, x = -0.03) =>
    mesh(new THREE.SphereGeometry(r, 7, 5, 0, Math.PI * 2, 0, Math.PI * open), mat, x, y, 0);
  // Hair, swept back: clear of the head (0.27) by enough that their low-poly faces never meet and flicker, and
  // set back so the face still shows in front. Any hat over it must clear it in turn.
  if (d.head === "bare" || d.head === "cap" || d.head === "felt" || d.head === "straw") cap(0.3, 0.8, hair, 0.5, -0.05).rotation.z = 0.5;
  if (d.longHair && d.head !== "wimple" && d.head !== "veil" && d.head !== "hood") {          // a braid down the back, a ribbon at its end
    const top = new THREE.Vector3(-0.25, 0.7, 0), end = new THREE.Vector3(-(outer(0.42) + 0.05), 0.42, 0), plait = new THREE.IcosahedronGeometry(0.058, 0).scale(1, 1.3, 1);
    for (let i = 0; i < 4; i++) mesh(plait, hair).position.lerpVectors(top, end, i / 3).add(new THREE.Vector3(0, 0, i % 2 ? 0.015 : -0.015));
    mesh(box(0.05, 0.035, 0.1), second, end.x, end.y - 0.07, 0);
  }
  switch (d.head) {
    case "coif": cap(0.29, 0.8, linen, 0.55).rotation.z = 0.35; break;
    case "kerchief": {
      cap(0.29, 0.81, second, 0.48).rotation.z = 0.3;
      mesh(new THREE.ConeGeometry(0.08, 0.14, 4), second, -0.27, 0.72, 0).rotation.z = 0.6;                 // the knot behind
      break;
    }
    case "wimple": {
      cap(0.3, 0.8, linen, 0.6).rotation.z = 0.3;
      mesh(new THREE.CylinderGeometry(0.2, outer(0.56) + 0.03, 0.16, 8, 1, true), linen, 0, 0.64, 0);       // round the chin and throat
      break;
    }
    case "veil": {                                                                         // over the crown and down the back, held by a fillet
      const veil = lambert(d.second, { side: THREE.DoubleSide });
      cap(0.3, 0.8, veil, 0.5, -0.02);
      turned([[0.3, 0.8], [0.31, 0.68], [outer(0.6) + 0.03, 0.6], [outer(0.48) + 0.035, 0.48], [outer(0.38) + 0.04, 0.38]], veil, 4, 4);
      mesh(new THREE.CylinderGeometry(0.305, 0.305, 0.04, 8), trim, -0.02, 0.83, 0);
      break;
    }
    case "cap": {
      cap(0.32, 0.9, cloth, 0.45, -0.02).scale.set(1, 0.7, 1);                              // over the hair
      mesh(new THREE.CylinderGeometry(0.31, 0.31, 0.04, 8), trim, -0.02, 0.92, 0);
      break;
    }
    case "chaperon": {                                                                     // a rolled band like a turban, its tail hanging to one side
      mesh(new THREE.TorusGeometry(0.22, 0.08, 5, 10).rotateX(Math.PI / 2), second, -0.02, 0.98, 0);
      cap(0.22, 0.98, second, 0.5, -0.02);
      mesh(box(0.06, 0.32, 0.12), second, -0.18, 0.84, -0.22).rotation.x = 0.3;
      break;
    }
    case "hood": {
      mesh(new THREE.SphereGeometry(0.31, 7, 5, Math.PI * 0.15, Math.PI * 1.7), second, -0.02, 0.8, 0).rotation.y = Math.PI / 2;
      mesh(new THREE.CylinderGeometry(0.22, Math.max(0.33, outer(0.54) + 0.03), 0.13, 8), second, 0, 0.6, 0);   // its cape, over whatever's on the shoulders
      break;
    }
    case "straw": {
      const straw = lambert("#d9b46a");
      mesh(new THREE.CylinderGeometry(0.42, 0.45, 0.03, 10), straw, 0, 0.99, 0);
      mesh(new THREE.CylinderGeometry(0.17, 0.21, 0.14, 8), straw, 0, 1.06, 0);
      mesh(new THREE.CylinderGeometry(0.212, 0.212, 0.03, 8), second, 0, 1.01, 0);
      break;
    }
    case "felt": {
      mesh(new THREE.CylinderGeometry(0.34, 0.36, 0.03, 10), cloth, -0.02, 0.98, 0);
      mesh(new THREE.CylinderGeometry(0.16, 0.22, 0.2, 8), cloth, -0.02, 1.08, 0);
      mesh(new THREE.CylinderGeometry(0.225, 0.225, 0.04, 8), trim, -0.02, 1.0, 0);
      break;
    }
  }
  const quill = FEATHER[d.head];
  if (d.feather && quill) mesh(new THREE.ConeGeometry(0.04, 0.32, 4), lambert(["#f2ead8", "#c8423a", "#3f6fd0"][d.cloth.length % 3]!), ...quill).rotation.set(0.5, 0, 0.6);

  // ---- Hose and shoes ----
  // Feet step out from under a long hem; under a short one, legs in hose run up inside it, so they're
  // never seen ending.
  const shoe = lambert(d.shoes), hose = lambert(d.hose);
  h.feet.forEach(f => {
    const nub = f.userData.nub as THREE.Mesh;
    for (const c of f.children) if (c !== nub) disposeTree(c);
    f.clear(); f.add(nub); nub.visible = false;
    const s = new THREE.Mesh(box(0.17, 0.07, 0.12), shoe); s.position.set(0.02, 0.035, 0);
    f.add(s);
    if (!long) { const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, hemY - 0.05, 5), hose); leg.position.set(-0.01, 0.06 + (hemY - 0.05) / 2, 0); f.add(leg); }
  });
  h.footX = long ? hemR - 0.07 : 0.15;

  // ---- What they carry ----
  const back = h.hands[1]!, front = h.hands[0]!, hold = (o: THREE.Object3D, hand: THREE.Mesh, x: number, y: number, z: number) => { o.position.set(x, y, z); hand.add(o); };
  const group = (...parts: [THREE.BufferGeometry, THREE.Material, number, number, number][]) => {
    const g = new THREE.Group();
    for (const [geo, mat, x, y, z] of parts) { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); g.add(m); }
    return g;
  };
  const wicker = lambert("#a8794a"), wood = lambert("#6b4f3a");
  switch (d.carry) {
    case "basket": hold(group(
      [new THREE.CylinderGeometry(0.15, 0.12, 0.14, 8, 1, true), wicker, 0, 0, 0], [new THREE.CircleGeometry(0.12, 8).rotateX(-Math.PI / 2), wicker, 0, -0.07, 0],
      [new THREE.TorusGeometry(0.13, 0.015, 3, 8, Math.PI), wicker, 0, 0.05, 0], [new THREE.IcosahedronGeometry(0.1, 0).scale(1, 0.6, 1), lambert(["#c8423a", "#5fb04a", "#e8963a"][d.second.length % 3]!), 0, 0.04, 0],
    ), back, 0.02, -0.12, -0.02); break;
    case "sack": mesh(new THREE.IcosahedronGeometry(0.22, 1).scale(0.8, 1.1, 0.9), lambert("#c9b896"), -(outer(0.55) + 0.15), 0.6, 0); break;   // over the shoulder, on the back
    case "bundle": hold(group([box(0.22, 0.16, 0.18), second, 0, 0, 0], [box(0.24, 0.03, 0.03), trim, 0, 0.02, 0]), back, 0, -0.06, -0.04); break;
    case "staff": hold(group([new THREE.CylinderGeometry(0.025, 0.03, 1.5, 5), wood, 0, 0.3, 0]), front, 0.02, 0, 0.02); break;
    case "bucket": hold(group(
      [new THREE.CylinderGeometry(0.12, 0.1, 0.18, 8, 1, true), wood, 0, -0.14, 0], [new THREE.CircleGeometry(0.11, 8).rotateX(-Math.PI / 2), lambert("#5a8ab0"), 0, -0.08, 0],
      [new THREE.TorusGeometry(0.11, 0.012, 3, 8, Math.PI), lambert("#4a4a52"), 0, -0.05, 0],
    ), back, 0, 0, 0); break;
    case "tools": hold(group([box(0.04, 0.34, 0.04), wood, 0, -0.1, 0], [box(0.14, 0.07, 0.07), lambert("#6b737d"), 0, 0.07, 0]), back, 0, 0, 0); break;
    case "book": hold(group([box(0.16, 0.2, 0.06), second, 0, 0, 0], [box(0.14, 0.18, 0.065), linen, 0.012, 0, 0]), back, 0.04, 0, 0); break;
    case "flowers": {
      const parts: [THREE.BufferGeometry, THREE.Material, number, number, number][] = [[new THREE.ConeGeometry(0.06, 0.2, 5).rotateZ(Math.PI), lambert("#3d6a2a"), 0, 0, 0]];
      ["#e05a7a", "#e8d23a", "#f2f0e6", "#9a6ad6", "#e8963a"].forEach((c, i) => parts.push([new THREE.OctahedronGeometry(0.045, 0), lambert(c), Math.cos(i * 1.3) * 0.06, 0.12 + (i % 2) * 0.03, Math.sin(i * 1.3) * 0.06]));
      hold(group(...parts), back, 0.03, 0.02, 0);
      break;
    }
    case "none": break;
  }
  h.eyes.forEach(e => { e.position.x = 0.29; });
  h.rodTip = null; h.bow = null;
}

/** Take a body out of the scene. */
export function removeBody(ctx: RenderContext, h: Body): void {
  ctx.scene.remove(h.group, h.shadow, h.ripple);
  const keep = new Set<unknown>([ctx.shadowGeo, ctx.shadowMat]);
  for (const o of [h.group, h.shadow, h.ripple]) disposeTree(o, keep);
}
