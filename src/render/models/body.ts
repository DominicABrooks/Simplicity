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
  body.add(lathe([[0, 0.06], [0.2, 0.06], [0.27, 0.2], [0.27, 0.4], [0.2, 0.56], [0.08, 0.64]], skin));
  const wrap = new THREE.Mesh(new THREE.CylinderGeometry(0.285, 0.29, 0.11, 7), lambert(PAL.n)); wrap.position.y = 0.19;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.27, 7, 5), skin); head.position.y = 0.8;
  const face = new THREE.Mesh(new THREE.SphereGeometry(0.2, 6, 4), basic(PAL.k));
  face.position.set(0.17, 0.78, 0); face.scale.set(0.55, 0.8, 0.9);
  const eyeMat = basic(PAL.Y);
  const eyes = [-1, 1].map(s => { const e = new THREE.Mesh(box(0.05, 0.1, 0.06), eyeMat); e.position.set(0.29, 0.8, s * 0.075); return e; });
  // Each foot is a group so bare feet and boots share the walk animation.
  const feet = [-1, 1].map(s => {
    const f = new THREE.Group(); f.position.set(0.14, 0, s * 0.12);
    const nub = new THREE.Mesh(box(0.14, 0.07, 0.11), skin); nub.position.y = 0.035;
    f.add(nub); f.userData.nub = nub;
    return f;
  });
  body.add(wrap, head, face, ...eyes, ...feet);
  const gear = new THREE.Group(); body.add(gear);
  // Floating hands (no arms).
  const handGeo = new THREE.IcosahedronGeometry(0.1, 0).scale(1.1, 0.9, 1);
  const handMat = lambert("#8f8578");                        // a shade darker than the body so they read
  const hands = [1, -1].map(s => { const m = new THREE.Mesh(handGeo, handMat); m.position.set(0.12, 0.38, s * 0.44); return m; });
  group.add(...hands);

  const shadow = addShadow(ctx);
  const ripple = new THREE.Mesh(new THREE.RingGeometry(0.38, 0.5, 10).rotateX(-Math.PI / 2), basic(PAL.C, { transparent: true, opacity: 0.6, depthWrite: false }));
  scene.add(group, shadow, ripple);
  return { group, body, gear, sword, ring, eyes, feet, hands, shadow, ripple, footX: 0.14, gripY: 0, rodTip: null, bow: null, key: null };
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

/** Take a body out of the scene. */
export function removeBody(ctx: RenderContext, h: Body): void {
  ctx.scene.remove(h.group, h.shadow, h.ripple);
  const keep = new Set<unknown>([ctx.shadowGeo, ctx.shadowMat]);
  for (const o of [h.group, h.shadow, h.ripple]) disposeTree(o, keep);
}
