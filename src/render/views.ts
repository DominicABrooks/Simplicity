// Entity views: how each kind of entity looks. The render system creates a view when an entity
// with a Renderable appears, updates it every frame, and removes it when the entity goes away.
// Adding a new kind of thing to draw means adding one entry here.
import * as THREE from "three";
import type { Entity } from "../core/ecs.ts";
import { smooth, turn } from "../core/math.ts";
import { SLIME, SPELLS, type BoltKind, type School, type SpellName } from "../data/enemies.ts";
import { PAL } from "../data/palette.ts";
import { RARITY_COLOR } from "../data/tiers.ts";
import { CRAFTS } from "../data/crafts.ts";
import { HALF } from "../data/world.ts";
import type { RenderKind, Transform } from "../game/components.ts";
import { blinkVisible } from "../game/despawn.ts";
import type { Game } from "../game/game.ts";
import type { Dress } from "../world/wardrobe.ts";
import { DAIS_HIGH } from "../world/plans.ts";
import { GROUND, SHADOW_Y, onGround, PX_PER_TILE, addShadow, box, col, toWorld, type RenderContext } from "./context.ts";
import { disposeTree } from "./dispose.ts";
import { dressBody, dressCommoner, dressSoldier, makeBody, removeBody, type Body } from "./models/body.ts";
import { hourOf, residentById } from "../game/townsfolk.ts";
import { TOWNSFOLK } from "../data/townsfolk.ts";
import { makeMageBody, makeSlimeModel } from "./models/enemies.ts";
import { animateCinder, makeCinder, type CinderParts } from "./models/cinder.ts";
import { RIME_SCALE, animateRime, makeRime, type RimeParts } from "./models/rime.ts";
import { rimefrost } from "./rime.ts";
import { animateCalder, makeCalder, type CalderParts } from "./models/calder.ts";
import { tempest } from "./tempest.ts";
import { makeKoiMesh, type KoiMesh } from "./koi.ts";
import { rimeFight } from "../game/rimefight.ts";
import { RIME_FIGHT } from "../data/hollow.ts";
import { blaze } from "./blaze.ts";
import { spirit } from "./spirit.ts";
import { watcher } from "./watcher.ts";
import { makeGhostModel, type GhostModel } from "./models/ghost.ts";
import { GHOST } from "../data/ghost.ts";
import { makePetModel, posePet, type PetModel } from "./models/pets.ts";
import { BUTT_TILT, makeButt, makeDummy } from "./castle.ts";
import { makeArrowMesh, makeOrbMesh, ORB_COLORS } from "./models/projectiles.ts";
import { SPARK_PAIRS, type SparkPair } from "./particles.ts";
import { poseLoad, poseWork, type Worker } from "./work.ts";
import { loadOf } from "../world/workplaces.ts";
import { ringstone } from "./undercroft.ts";
import { boatman } from "./quay.ts";
import { yssa } from "./yssa.ts";
import { cloak, head, homestone, lantern } from "./homecoming.ts";
import { dragon, egg } from "./dragons.ts";

export interface Frame {
  /** Game clock, for animation. */
  t: number;
  dt: number;
  hero: Transform;
}

export interface EntityView<S> {
  create(ctx: RenderContext, e: Entity, g: Game): S;
  update(ctx: RenderContext, view: S, e: Entity, g: Game, f: Frame): void;
  remove(ctx: RenderContext, view: S): void;
  /** What it put in the scene, to hide while it's out of the camera's reach (by default its group, shadow and ripple). */
  roots?(view: S): THREE.Object3D[];
}

/** A view's objects in the scene: its own say, or its group, shadow and ripple. */
export function viewRoots<S>(def: EntityView<S>, view: S): THREE.Object3D[] {
  if (def.roots) return def.roots(view);
  const v = view as { group?: unknown; shadow?: unknown; ripple?: unknown };
  return [v.group, v.shadow, v.ripple].filter((o): o is THREE.Object3D => o instanceof THREE.Object3D);
}

/** Views made of a group and a blob shadow. */
interface Simple { group: THREE.Object3D; shadow: THREE.Object3D }
const removeSimple = (ctx: RenderContext, v: Simple) => {
  ctx.scene.remove(v.group, v.shadow);
  const keep = new Set<unknown>([ctx.shadowGeo, ctx.shadowMat]);
  disposeTree(v.group, keep);
  disposeTree(v.shadow, keep);
};
const facing = (from: Transform, to: Transform) => -Math.atan2(to.y - from.y, to.x - from.x);

// ---------- Slime ----------
interface SlimeView extends Simple { body: THREE.Group; mat: THREE.MeshLambertMaterial; yaw: number | null }
const slime: EntityView<SlimeView> = {
  create(ctx) {
    const { group, body, mat } = makeSlimeModel(ctx);
    const shadow = addShadow(ctx);
    ctx.scene.add(group, shadow);
    return { group, body, mat, shadow, yaw: null };
  },
  update(_ctx, v, e, g, f) {
    const o = g.world.need(e, "transform"), s = g.world.need(e, "slime"), enemy = g.world.need(e, "enemy");
    const [x, z] = toWorld(o.x, o.y);
    const hop = s.hop > 0 ? Math.sin((1 - s.hop / SLIME.hopTime) * Math.PI) : 0;
    v.group.position.set(x, hop * 0.45, z);
    const look = facing(o, f.hero);                          // always face the hero
    v.yaw = v.yaw === null ? look : turn(v.yaw, look, f.dt, 10);
    v.group.rotation.y = v.yaw;
    const wob = Math.sin(f.t * 5 + o.x);
    v.body.scale.set(1 + (hop ? -0.12 : wob * 0.06), 1 + (hop ? 0.2 : -wob * 0.08), 1 + (hop ? -0.12 : wob * 0.06));
    v.mat.emissive.set(enemy.flash > 0 ? 0xffffff : 0x000000);
    v.shadow.position.set(x, SHADOW_Y, z);
    v.shadow.scale.setScalar(1 - hop * 0.3);
  },
  remove: removeSimple,
};

// ---------- Mage ----------
// The same body as the hero, dressed in its school's tier, with glowing eyes.
const SCHOOL_SPARKS: Record<School, SparkPair> = { ember: "fire", frost: "frost", storm: "spark" };
/** Which orb a mage holds while charging each spell. */
const CAST_ORB: Record<SpellName, BoltKind> = { fire: "fire", poly: "poly", frost: "frost", spark: "spark", nova: "frost", strike: "spark", wisp: "wisp", icicle: "icicle" };

interface MageView extends Body {
  orbs: Record<BoltKind, THREE.Group>;
  novaEdge: THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>;
  novaFill: THREE.Mesh;
  yaw: number | null;
  wasMelee: boolean;
  /** Whether it wears its school's robes, hood and boots (Cinder has his own: see models/cinder.ts). */
  robed: boolean;
}
/** What a mage wears: its school's robes, hood and boots (if it's robed), and its sword when it's drawn. */
const mageOutfit = (b: { school: School; melee: boolean }, robed: boolean) => {
  const tier = robed ? b.school : null;
  return { helm: tier, armor: tier, boots: tier, weapon: b.melee ? b.school : null, ring: null, amulet: null, weaponType: b.melee ? "blade" as const : null };
};
const mage: EntityView<MageView> = {
  create(ctx, e, g) {
    const m = makeMageBody(ctx, g.world.need(e, "mage").school);
    const orbs = Object.fromEntries((Object.keys(ORB_COLORS) as BoltKind[]).map(k => {
      const orb = makeOrbMesh(ctx, k);
      orb.visible = false;
      m.group.add(orb);
      return [k, orb];
    })) as Record<BoltKind, THREE.Group>;
    // Frost Nova telegraph: the blast radius outlined on the ground, filling as the spell charges.
    const R = SPELLS.nova.radius! / PX_PER_TILE;
    const novaEdge = new THREE.Mesh(new THREE.RingGeometry(R - 0.12, R, 24).rotateX(-Math.PI / 2), ctx.glow(PAL.C, { transparent: true, opacity: 0.8, depthWrite: false, ...onGround(GROUND.marker) }));
    const novaFill = new THREE.Mesh(new THREE.CircleGeometry(R, 24).rotateX(-Math.PI / 2), ctx.glow(PAL.C, { transparent: true, opacity: 0.25, depthWrite: false, ...onGround(GROUND.marker) }));
    novaEdge.position.y = novaFill.position.y = 0.03;
    m.group.add(novaEdge, novaFill);
    return { ...m, orbs, novaEdge, novaFill, yaw: null, wasMelee: false, robed: true };
  },
  update(ctx, v, e, g, f) {
    const o = g.world.need(e, "transform"), b = g.world.need(e, "mage"), enemy = g.world.need(e, "enemy");
    const { t, dt } = f;
    const [x, z] = toWorld(o.x, o.y);
    v.group.position.set(x, 0, z);
    dressBody(ctx, v, mageOutfit(b, v.robed));
    if (b.melee !== v.wasMelee) {                            // a puff of sparks as the sword is drawn or put away
      ctx.particles.burst(SPARK_PAIRS[SCHOOL_SPARKS[b.school]], 8, x, 0.5, z, 1.6, () => 1.2 + Math.random(), 0.35);
      v.wasMelee = b.melee;
    }
    const look = facing(o, f.hero);                          // always face the hero
    v.yaw = v.yaw === null ? look : turn(v.yaw, look, dt, 8);
    v.group.rotation.y = v.yaw;
    v.group.visible = !(enemy.flash > 0 && Math.floor(t * 30) % 2);
    v.body.position.y = b.moving ? Math.abs(Math.sin(t * 10)) * 0.05 : 0;
    v.body.scale.y = 1 + Math.sin(t * 2.5) * 0.025;
    v.feet.forEach((foot, i) => { foot.position.x = v.footX + (b.moving ? Math.sin(t * 10 + i * Math.PI) * 0.08 : 0); });
    // Casting: both hands come forward and an orb grows between them (the telegraph).
    const k = b.casting ? b.castK : 0;
    // Sword: held at the side while chasing, swung on the same curve as the hero's swipes.
    const sw = v.sword;
    if (b.melee && b.swing) { const r = b.swingRel; sw.position.set(Math.cos(r) * 0.3, 0.5, Math.sin(r) * 0.3); sw.rotation.set(0, -r, -Math.PI / 2); }
    else if (b.melee) { sw.position.set(0.12, 0.5 + Math.sin(t * 3) * 0.04, 0.46); sw.rotation.set(0, 0, 0.15); }
    const overhead = b.spell === "nova" || b.spell === "strike";
    v.hands.forEach((h, i) => {
      const side = i === 0 ? 1 : -1;
      if (b.melee && i === 0) { sw.updateMatrix(); h.position.set(0, v.gripY, 0).applyMatrix4(sw.matrix); }   // front hand on the grip
      else if (b.casting && overhead) h.position.set(0.05, 0.75 + k * 0.25, side * 0.3);                   // arms raised
      else if (b.casting) h.position.set(0.32 + k * 0.08, 0.5 + k * 0.1, side * (0.22 - k * 0.08));
      else h.position.set(0.12 + (b.moving ? Math.sin(t * 12 + i * Math.PI) * 0.1 : 0), 0.38 + Math.sin(t * 2.5 + i) * 0.02, side * 0.44);
    });
    for (const [kind, orb] of Object.entries(v.orbs) as [BoltKind, THREE.Group][]) {
      orb.visible = b.casting && !!b.spell && CAST_ORB[b.spell] === kind;
      if (overhead) orb.position.set(0.05, 1.25 + k * 0.15, 0); else orb.position.set(0.5, 0.58 + k * 0.08, 0);
      orb.scale.setScalar(0.3 + k * 0.9 + Math.sin(t * 30) * 0.05 * k);
      orb.rotation.set(t * 4, t * 5, 0);
    }
    const nova = b.casting && b.spell === "nova";
    v.novaEdge.visible = v.novaFill.visible = nova;
    if (nova) { v.novaFill.scale.setScalar(Math.max(0.01, k)); v.novaEdge.material.opacity = 0.5 + Math.sin(t * 25) * 0.3; }
    v.shadow.position.set(x, SHADOW_Y, z);
  },
  remove: removeBody,
};

// ---------- Cinder ----------
// The Ember lieutenant: a mage's brain and moves, in his own burnt, crowned body (see models/cinder.ts).
interface CinderView extends MageView { cinder: CinderParts }
const cinder: EntityView<CinderView> = {
  create(ctx, e, g) {
    const v = mage.create(ctx, e, g);
    v.robed = false;
    dressBody(ctx, v, mageOutfit(g.world.need(e, "mage"), false));
    return { ...v, cinder: makeCinder(ctx, v) };
  },
  update(ctx, v, e, g, f) {
    mage.update(ctx, v, e, g, f);
    const b = g.world.need(e, "mage"), o = g.world.need(e, "transform");
    animateCinder(v.cinder, f.t, b.casting ? b.castK : 0);
    if (Math.random() < f.dt * 10) {                         // embers always rising off him
      const [x, z] = toWorld(o.x, o.y);
      ctx.particles.spawn(Math.random() < 0.5 ? "fire" : "ember", x + (Math.random() - 0.5) * 0.6, 0.4 + Math.random() * 0.9, z + (Math.random() - 0.5) * 0.6,
        (Math.random() - 0.5) * 0.3, 0.9 + Math.random() * 0.8, (Math.random() - 0.5) * 0.3, 0.8);
    }
  },
  remove: removeBody,
};

// ---------- Rime ----------
// The Frost lieutenant: a mage's brain and moves, in her own icy, crowned body (see models/rime.ts), her nova's
// telegraph as wide as her nova.
interface RimeView extends MageView { rime: RimeParts; novaK: number }
const rime: EntityView<RimeView> = {
  create(ctx, e, g) {
    const v = mage.create(ctx, e, g), b = g.world.need(e, "mage");
    v.robed = false;
    dressBody(ctx, v, mageOutfit(b, false));
    const parts = makeRime(ctx, v), novaK = (b.boost?.nova ?? 1) / RIME_SCALE;    // the group's scaled already
    v.novaEdge.scale.setScalar(novaK);
    return { ...v, rime: parts, novaK };
  },
  update(ctx, v, e, g, f) {
    mage.update(ctx, v, e, g, f);
    const b = g.world.need(e, "mage"), o = g.world.need(e, "transform");
    v.novaFill.scale.multiplyScalar(v.novaK);
    // Drawing the cold in for a volley; or sealed in her block of ice.
    const fight = rimeFight(g), vol = fight?.volley, wind = vol ? (vol.wind > 0 ? 1 - vol.wind / RIME_FIGHT.volley.wind : 1) : 0;
    const sealedFor = (t: number, hold: number) => Math.max(0, Math.min(1, t / 0.25, (hold - t) / 0.15));
    const sealed = fight?.stand ? sealedFor(fight.stand.t, RIME_FIGHT.lastStand.hold) : fight?.block ? sealedFor(fight.block.t, RIME_FIGHT.block.hold) : 0;
    animateRime(v.rime, f.t, b.casting ? b.castK : wind, sealed);
    if (Math.random() < f.dt * 6) {                          // frost always drifting off her
      const [x, z] = toWorld(o.x, o.y);
      ctx.particles.spawn(Math.random() < 0.5 ? "snow" : "ice", x + (Math.random() - 0.5) * 0.7, 0.3 + Math.random() * 1.1, z + (Math.random() - 0.5) * 0.7,
        (Math.random() - 0.5) * 0.2, 0.3 + Math.random() * 0.4, (Math.random() - 0.5) * 0.2, 1.1);
    }
  },
  remove: removeBody,
};

// ---------- Calder ----------
// The Storm captain: a mage's brain and moves, in his own stormy, cloud-crowned body (see models/calder.ts), the
// lightning always crawling over him, and while he's catching his breath after a blink, no orb, just sparks.
interface CalderView extends MageView { calder: CalderParts }
const calder: EntityView<CalderView> = {
  create(ctx, e, g) {
    const v = mage.create(ctx, e, g);
    v.robed = false;
    dressBody(ctx, v, mageOutfit(g.world.need(e, "mage"), false));
    return { ...v, calder: makeCalder(ctx, v) };
  },
  update(ctx, v, e, g, f) {
    mage.update(ctx, v, e, g, f);
    const b = g.world.need(e, "mage"), o = g.world.need(e, "transform");
    animateCalder(v.calder, f.t, b.casting ? b.castK : 0);
    if (Math.random() < f.dt * (b.held ? 30 : 8)) {          // sparks always crackling off him (a shower of them while he's dazed)
      const [x, z] = toWorld(o.x, o.y);
      ctx.particles.spawn(Math.random() < 0.5 ? "spark" : "sparkLight", x + (Math.random() - 0.5) * 0.7, 0.3 + Math.random() * 1.3, z + (Math.random() - 0.5) * 0.7,
        (Math.random() - 0.5) * 0.8, 0.4 + Math.random() * 0.8, (Math.random() - 0.5) * 0.8, 0.5);
    }
  },
  remove: removeBody,
};

// ---------- The Great Koi ----------
// A koi, but huge and gold, flopped on its side on the ice: thrashing where it lies, leaping at you in an arc, its
// whiskers trailing, and a glow of freezing water gathering at its mouth before it spits.
const KOI_SIZE = 6.5;
interface GreatKoiView extends Simple { body: THREE.Group; fish: KoiMesh; orb: THREE.Mesh; yaw: number | null }
const greatkoi: EntityView<GreatKoiView> = {
  create(ctx) {
    const group = new THREE.Group(), body = new THREE.Group(), fish = makeKoiMesh(ctx, PAL.Y, PAL.O, 0.35);
    fish.scale.setScalar(KOI_SIZE);
    body.add(fish);
    const whisker = ctx.lambert(PAL.O);
    for (const s of [-1, 1]) {                                // two long barbels trailing back from its lip
      const w = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.012, 0.75, 4).rotateZ(Math.PI / 2).translate(-0.37, 0, 0), whisker);
      w.position.set(1.15, -0.1, s * 0.2);
      w.rotation.set(s * 0.35, s * 0.5, -0.25);
      body.add(w);
    }
    const orb = new THREE.Mesh(new THREE.IcosahedronGeometry(0.22, 0), ctx.glow(PAL.C, { transparent: true, opacity: 0.8, depthWrite: false, blending: THREE.AdditiveBlending }));
    orb.position.set(1.4, 0, 0);
    orb.visible = false;
    body.add(orb);
    group.add(body);
    const shadow = addShadow(ctx, 2.6);
    ctx.scene.add(group);
    return { group, shadow, body, fish, orb, yaw: null };
  },
  update(ctx, v, e, g, f) {
    const o = g.world.need(e, "transform"), koi = g.world.need(e, "koi"), enemy = g.world.need(e, "enemy"), { t, dt } = f;
    const [x, z] = toWorld(o.x, o.y);
    const air = koi.hop > 0 ? 1 - koi.hop / koi.hopTime : -1;
    const look = air >= 0 ? -Math.atan2(koi.dy, koi.dx) : facing(o, f.hero);
    v.yaw = v.yaw === null ? look : turn(v.yaw, look, dt, air >= 0 ? 14 : 4);
    v.group.position.set(x, air >= 0 ? Math.sin(air * Math.PI) * 1.1 : 0, z);
    v.group.rotation.y = v.yaw;
    v.group.visible = !(enemy.flash > 0 && Math.floor(t * 30) % 2);
    // On its side and thrashing on the ice; upright and arched in a leap.
    if (air >= 0) { v.body.rotation.set(0.3, 0, Math.cos(air * Math.PI) * 0.45); v.body.position.y = 0.55; }
    else { v.body.rotation.set(1.25 + Math.sin(t * 9) * 0.22, 0, Math.sin(t * 4.5) * 0.12); v.body.position.y = 0.42; }
    v.fish.userData.tail.rotation.y = Math.sin(t * (air >= 0 ? 10 : 16)) * 0.7;
    v.orb.visible = koi.wind > 0;
    if (koi.wind > 0) v.orb.scale.setScalar(0.4 + (1 - koi.wind / 0.6) * 1.2 + Math.sin(t * 30) * 0.08);
    v.shadow.position.set(x, SHADOW_Y, z);
    v.shadow.scale.setScalar(2.6 * (air >= 0 ? 1 - Math.sin(air * Math.PI) * 0.35 : 1));
    if (Math.random() < dt * 6) ctx.particles.spawn("water", x + (Math.random() - 0.5) * 1.2, 0.3, z + (Math.random() - 0.5) * 1.2, (Math.random() - 0.5) * 0.6, 1 + Math.random(), (Math.random() - 0.5) * 0.6, 0.5);
  },
  remove: removeSimple,
};

// ---------- Potion ----------
const potion: EntityView<Simple> = {
  create(ctx) {
    const { lambert, basic } = ctx, group = new THREE.Group();
    const bottle = new THREE.Mesh(new THREE.SphereGeometry(0.16, 6, 5), lambert(PAL.R, { emissive: col(PAL.r), emissiveIntensity: 0.6 }));
    bottle.position.y = 0.17;
    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 0.1, 5), lambert(PAL.w)); neck.position.y = 0.34;
    const cork = new THREE.Mesh(box(0.08, 0.06, 0.08), lambert(PAL.n)); cork.position.y = 0.42;
    const glint = new THREE.Mesh(box(0.04, 0.04, 0.04), basic(PAL.W)); glint.position.set(-0.07, 0.24, -0.07);
    group.add(bottle, neck, cork, glint);
    const shadow = addShadow(ctx, 0.6);
    ctx.scene.add(group, shadow);
    return { group, shadow };
  },
  update(_ctx, v, e, g, f) {
    const o = g.world.need(e, "transform"), [x, z] = toWorld(o.x, o.y);
    v.group.position.set(x, 0.06 + Math.sin(f.t * 3 + o.x) * 0.06, z);
    v.group.rotation.y = f.t * 1.5 + o.x;
    v.shadow.position.set(x, SHADOW_Y, z);
  },
  remove: removeSimple,
};

// ---------- Loot ----------
// A spinning gem in the rarity colour, with a light beam over magic and rare items (PoE style).
interface LootView extends Simple { gem: THREE.Mesh }
const loot: EntityView<LootView> = {
  create(ctx, e, g) {
    const pickup = g.world.need(e, "pickup"), rarity = pickup.kind === "loot" ? pickup.item.rarity : "normal";
    const group = new THREE.Group(), c = RARITY_COLOR[rarity];
    const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.15, 0), ctx.lambert(c, { emissive: col(c), emissiveIntensity: 0.5 }));
    gem.position.y = 0.3;
    group.add(gem);
    if (rarity !== "normal") {                               // light beam: short for magic, tall for rare
      const hgt = rarity === "legendary" ? 4.5 : rarity === "rare" ? 3 : 1.2;
      group.add(new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.12, hgt, 5, 1, true).translate(0, hgt / 2, 0),
        ctx.glow(c, { transparent: true, opacity: 0.35, depthWrite: false, blending: THREE.AdditiveBlending })));
    }
    const shadow = addShadow(ctx, 0.5);
    ctx.scene.add(group, shadow);
    return { group, shadow, gem };
  },
  update(_ctx, v, e, g, f) {
    const o = g.world.need(e, "transform"), [x, z] = toWorld(o.x, o.y);
    v.group.position.set(x, 0, z);
    v.gem.rotation.y = f.t * 2;
    v.gem.position.y = 0.3 + Math.sin(f.t * 3 + o.x) * 0.05;
    v.shadow.position.set(x, SHADOW_Y, z);
    const despawn = g.world.get(e, "despawn");
    v.group.visible = v.shadow.visible = !despawn || blinkVisible(despawn.left);   // blinks before it vanishes
  },
  remove: removeSimple,
};

// ---------- Arrow ----------
interface ArrowView extends Simple { yaw: number }
const arrow: EntityView<ArrowView> = {
  create(ctx, e, g) {
    const group = new THREE.Group(), mesh = makeArrowMesh(ctx, g.world.need(e, "arrow").power);
    mesh.position.x = -0.24;                                 // centre the arrow on its game position
    group.add(mesh);
    const shadow = addShadow(ctx);
    shadow.scale.set(0.5, 1, 0.15);
    ctx.scene.add(group, shadow);
    return { group, shadow, yaw: 0 };
  },
  update(_ctx, v, e, g) {
    const o = g.world.need(e, "transform"), a = g.world.need(e, "arrow"), [x, z] = toWorld(o.x, o.y);
    if (a.vx || a.vy) v.yaw = -Math.atan2(a.vy, a.vx);
    if (a.grounded) {                                        // a dud lying in the grass
      v.group.position.set(x, 0.03, z);
      v.group.rotation.set(0, v.yaw, 0);
    } else if (a.stuck > 0) {                                // stuck in a tree, a little higher
      v.group.position.set(x, 0.6, z);
    } else if (a.dud) {                                      // a weak shot: arcs down, nose dipping, to the ground
      const k = 1 - Math.max(0, a.life) / a.flight;
      v.group.position.set(x, 0.5 * (1 - k * k), z);
      v.group.rotation.set(0, v.yaw, a.bounced ? -k * 5 : -k * 0.8);   // a glanced arrow tumbles end over end
    } else {
      v.group.position.set(x, 0.5, z);
      v.group.rotation.set(0, v.yaw, 0);
    }
    v.shadow.position.set(x, SHADOW_Y, z);
    v.shadow.visible = a.stuck <= 0;
  },
  remove: removeSimple,
};

// ---------- Spell bolt ----------
const BOLT_SPARKS: Record<BoltKind, SparkPair> = { fire: "fire", poly: "arcane", frost: "frost", spark: "spark", wisp: "frost", icicle: "frost" };
const bolt: EntityView<Simple> = {
  create(ctx, e, g) {
    const group = makeOrbMesh(ctx, g.world.need(e, "bolt").kind);
    const shadow = addShadow(ctx, 0.35);
    ctx.scene.add(group, shadow);
    return { group, shadow };
  },
  update(ctx, v, e, g, f) {
    const o = g.world.need(e, "transform"), bolt = g.world.need(e, "bolt"), kind = bolt.kind, [x, z] = toWorld(o.x, o.y);
    v.group.position.set(x, 0.55 + Math.sin(f.t * 12 + o.x + HALF) * 0.03, z);
    if (kind === "icicle") v.group.rotation.set(f.t * 3, -Math.atan2(bolt.vy, bolt.vx), 0, "YXZ");   // point first, turning slowly about its length
    else v.group.rotation.set(f.t * 6, f.t * 7, 0);
    v.shadow.position.set(x, SHADOW_Y, z);
    if (Math.random() < f.dt * (kind === "icicle" ? 8 : 30)) { // ember trail
      const pair = SPARK_PAIRS[BOLT_SPARKS[kind]];
      ctx.particles.spawn(pair[Math.random() < 0.5 ? 0 : 1], x, 0.55, z, (Math.random() - 0.5) * 0.6, 0.8 + Math.random() * 0.6, (Math.random() - 0.5) * 0.6, 0.25);
    }
  },
  remove: removeSimple,
};

// ---------- Lightning strike marker ----------
interface StrikeView extends Simple { edge: THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>; fill: THREE.Mesh }
const strike: EntityView<StrikeView> = {
  create(ctx) {
    const R = SPELLS.strike.radius! / PX_PER_TILE, group = new THREE.Group();
    const edge = new THREE.Mesh(new THREE.RingGeometry(R - 0.08, R, 16).rotateX(-Math.PI / 2), ctx.glow(PAL.Y, { transparent: true, opacity: 0.85, depthWrite: false, ...onGround(GROUND.marker) }));
    const fill = new THREE.Mesh(new THREE.CircleGeometry(R, 16).rotateX(-Math.PI / 2), ctx.glow(PAL.Y, { transparent: true, opacity: 0.3, depthWrite: false, ...onGround(GROUND.marker) }));
    group.add(edge, fill);
    ctx.scene.add(group);
    return { group, shadow: new THREE.Object3D(), edge, fill };
  },
  update(_ctx, v, e, g, f) {
    const o = g.world.need(e, "transform"), s = g.world.need(e, "strike"), [x, z] = toWorld(o.x, o.y);
    v.group.position.set(x, 0.03, z);
    v.fill.scale.setScalar(Math.max(0.01, 1 - s.t / s.total));   // fills as it charges
    v.edge.material.opacity = 0.55 + Math.sin(f.t * 30) * 0.3;
  },
  remove: removeSimple,
};

// ---------- Guard ----------
/**
 * A guard: the hero's body in a soldier's kit of the kingdom's colours (see dressSoldier), facing where
 * the sentry system has them looking. At rest like the hero: breathing, blinking, shifting their weight
 * now and then, the spear grounded in one hand and the shield at the other.
 */
interface GuardView extends Body { k: number }
const guardGrip = new THREE.Vector3();
const guard: EntityView<GuardView> = {
  create(ctx, e, g) {
    const b = makeBody(ctx);
    dressSoldier(ctx, b, "guard");
    b.ripple.visible = false;
    b.feet.forEach(f => { f.position.x = b.footX; });
    const t = g.world.need(e, "transform");
    return Object.assign(b, { k: (t.x * 7 + t.y * 13) % 10 });
  },
  update(_ctx, v, e, g, f) {
    const o = g.world.need(e, "transform"), s = g.world.need(e, "sentry"), [x, z] = toWorld(o.x, o.y), t = f.t + v.k;
    v.group.position.set(x, 0, z);
    v.group.rotation.y = -s.look;                             // game angle a is yaw -a: a body faces +x at no turn
    v.shadow.position.set(x, SHADOW_Y, z);
    v.body.scale.y = 1 + Math.sin(t * 2.5) * 0.025;           // breathing
    v.body.rotation.x = Math.sin(t * 0.35) * 0.035;           // shifting their weight, slowly
    v.eyes.forEach(eye => { eye.scale.y = t % 3.7 < 0.15 ? 0.15 : 1; });
    v.sword.position.set(0.16, 0.45, 0.4);                    // the spear, grounded at the side
    v.sword.rotation.set(0, 0, 0.04);
    v.sword.updateMatrix();
    v.hands[0]!.position.copy(guardGrip.set(0, v.gripY + Math.sin(t * 2.5) * 0.02, 0).applyMatrix4(v.sword.matrix));
    v.hands[1]!.position.set(0.14, 0.4 + Math.sin(t * 2.5 + 1) * 0.02, -0.42);
  },
  remove: removeBody,
};

// ---------- The King ----------
/** King Osric's robes: crimson banded with ermine, a gold-trimmed cloak, grey hair, a brooch, and his sceptre. */
const KING_DRESS: Dress = {
  garment: "robe", pattern: "banded", cloth: "#8a1f2e", second: "#f2ead8", trim: "#d9a83a", over: "cloak", head: "bare",
  hair: "#b8b2a8", longHair: false, hose: "#8a1f2e", feather: false, pouch: false, brooch: true, shoes: "#3a2418", carry: "staff",
};

/**
 * The King: the hero's body in royal robes (dressed like the townsfolk, see dressCommoner), with a gold
 * crown set with rubies on his head. He stands on the dais before his throne, turned to watch whoever
 * comes up the hall (the sentry system, as for the guards), breathing, blinking, a little stately sway.
 */
interface KingView extends Body { k: number }
const king: EntityView<KingView> = {
  create(ctx, e, g) {
    const b = makeBody(ctx);
    dressCommoner(ctx, b, KING_DRESS);
    b.ripple.visible = false;
    b.sword.visible = false;
    const gold = ctx.lambert("#e8b84a", { emissive: col("#5a3a08") }), ruby = ctx.basic("#e0303a");
    const crown = new THREE.Group();
    const band = new THREE.Mesh(new THREE.CylinderGeometry(0.21, 0.2, 0.09, 10, 1, true), gold);
    band.material.side = THREE.DoubleSide;
    crown.add(band);
    for (let i = 0; i < 5; i++) {                             // five points, a ruby at each one's foot
      const a = (i / 5) * Math.PI * 2, point = new THREE.Mesh(new THREE.ConeGeometry(0.045, 0.12, 4), gold);
      point.position.set(Math.cos(a) * 0.2, 0.1, Math.sin(a) * 0.2);
      const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.028, 0), ruby);
      gem.position.set(Math.cos(a) * 0.212, 0.0, Math.sin(a) * 0.212);
      crown.add(point, gem);
    }
    crown.position.set(0, 1.0, 0);
    b.gear.add(crown);
    b.feet.forEach(f => { f.position.x = b.footX; });
    const t = g.world.need(e, "transform");
    return Object.assign(b, { k: (t.x * 5 + t.y * 11) % 10 });
  },
  update(_ctx, v, e, g, f) {
    const o = g.world.need(e, "transform"), s = g.world.need(e, "sentry"), [x, z] = toWorld(o.x, o.y), t = f.t + v.k;
    v.group.position.set(x, DAIS_HIGH, z);                    // up on the dais
    v.group.rotation.y = -s.look;
    v.shadow.position.set(x, DAIS_HIGH + SHADOW_Y, z);
    v.body.scale.y = 1 + Math.sin(t * 2) * 0.02;              // breathing, slowly: he's a king
    v.body.rotation.x = Math.sin(t * 0.3) * 0.03;
    v.eyes.forEach(eye => { eye.scale.y = t % 4.3 < 0.15 ? 0.15 : 1; });
  },
  remove: removeBody,
};

// ---------- Training dummy and archery butt ----------
/**
 * Something to practise on (see spawnTraining). Each hit rocks a dummy away from the hero on its post, on a
 * damped spring (harder for a crit), or jolts an archery butt's face back on its frame; and flashes it. At
 * rest a dummy sways a little in the breeze.
 */
interface DummyView extends Simple {
  top: THREE.Group;
  sack: THREE.MeshLambertMaterial;
  /** How far it's rocked over (radians), how fast, and which way (world x, z). */
  lean: number;
  speed: number;
  dir: [number, number];
  flash: number;
  k: number;
  butt: boolean;
}
const DUMMY_ROCK = { kick: 9, crit: 14, stiffness: 90, damping: 7, max: 0.55 } as const;
const BUTT_JOLT = { kick: 5, crit: 8, stiffness: 160, damping: 9, max: 0.22 } as const;
const dummy: EntityView<DummyView> = {
  create(ctx, e, g) {
    const t = g.world.need(e, "transform"), k = (t.x * 7 + t.y * 13) % 10, butt = g.world.need(e, "dummy").kind === "butt";
    const { group, top, sack } = butt ? makeButt(ctx, t.x + t.y) : makeDummy(ctx);
    const shadow = addShadow(ctx);
    ctx.scene.add(group, shadow);
    return { group, top, sack, shadow, lean: 0, speed: 0, dir: [0, 1], flash: 0, k, butt };
  },
  update(_ctx, v, e, g, f) {
    const o = g.world.need(e, "transform"), enemy = g.world.need(e, "enemy"), d = g.world.need(e, "dummy"), [x, z] = toWorld(o.x, o.y);
    v.group.position.set(x, 0, z);
    v.group.rotation.y = Math.PI / 2 - d.facing;              // built facing +z (south, a game angle of PI/2)
    v.shadow.position.set(x, SHADOW_Y, z);
    // A new hit (its flash jumps up): kick it away from the hero.
    const spring = v.butt ? BUTT_JOLT : DUMMY_ROCK;
    if (enemy.flash > v.flash + 0.01) {
      const dx = o.x - f.hero.x, dz = o.y - f.hero.y, len = Math.hypot(dx, dz) || 1;
      v.dir = [dx / len, dz / len];
      v.speed += enemy.flash > 0.2 ? spring.crit : spring.kick;
    }
    v.flash = enemy.flash;
    const dt = Math.min(f.dt, 1 / 30);                       // the spring flies apart in a long step (coming back into view)
    v.speed += (-spring.stiffness * v.lean - spring.damping * v.speed) * dt;
    v.lean = Math.max(-spring.max, Math.min(spring.max, v.lean + v.speed * dt));
    if (v.butt) {                                            // a butt's face jolts straight back on its frame
      v.top.rotation.set(BUTT_TILT - Math.abs(v.lean), 0, 0);
      v.sack.emissive.setScalar(enemy.flash > 0 ? 0.5 : 0);
      return;
    }
    // Lean toward dir, in the dummy's own frame (it's turned by its facing).
    const yaw = v.group.rotation.y, lx = v.dir[0] * Math.cos(yaw) - v.dir[1] * Math.sin(yaw), lz = v.dir[0] * Math.sin(yaw) + v.dir[1] * Math.cos(yaw);
    const sway = Math.sin(f.t * 1.3 + v.k) * 0.04;
    v.top.rotation.set(lz * v.lean, 0, -lx * v.lean + sway);
    v.sack.emissive.setScalar(enemy.flash > 0 ? 0.6 : 0);
  },
  remove: removeSimple,
};

// ---------- Townsfolk ----------
/**
 * One of the census's people out in the streets (see src/game/townsfolk.ts): the hero's body in their own
 * clothes, kept on them in the census (Resident.dress: see src/world/wardrobe.ts), children smaller and the
 * old a little stooped. They walk like the hero, stand breathing when they stop, and face whoever they're
 * talking to. At work out in the open they show it: the smith hammers at the anvil, sparks flying off it at
 * every stroke; the minstrel strums his lute; and the sweepers, laundresses and water-carriers (work.ts).
 */
interface FolkView extends Body, Worker {
  k: number; size: number; stoop: number;
  /** Made the first time they're needed: a hammer in the right hand, a lute held across the body. */
  hammer: THREE.Group | null; lute: THREE.Group | null;
  /** The hammer stroke last struck (so each one throws its sparks once). */
  stroke: number;
}

/** A smith's hammer, its head at the top of the handle, to sit in a hand. */
function makeHammer(ctx: RenderContext): THREE.Group {
  const g = new THREE.Group();
  const handle = new THREE.Mesh(box(0.04, 0.3, 0.04), ctx.lambert("#6b4a2e")); handle.position.y = 0.1;
  const head = new THREE.Mesh(box(0.14, 0.07, 0.07), ctx.lambert("#4a4a52")); head.position.set(0.03, 0.25, 0);
  g.add(handle, head);
  return g;
}

/** A lute: a round-backed body, a neck and a bent-back pegbox, held across the chest neck-up to the left. */
function makeLute(ctx: RenderContext): THREE.Group {
  const g = new THREE.Group(), inner = new THREE.Group(), wood = ctx.lambert("#a8642e"), dark = ctx.lambert("#5a3a22");
  const bowl = new THREE.Mesh(new THREE.SphereGeometry(0.14, 7, 5).scale(1, 1.25, 0.55), wood);
  const rose = new THREE.Mesh(new THREE.CircleGeometry(0.035, 6), ctx.basic("#2a1a10")); rose.position.set(0, 0.03, 0.078);
  const neck = new THREE.Mesh(box(0.05, 0.26, 0.03), dark); neck.position.y = 0.28;
  const pegs = new THREE.Mesh(box(0.05, 0.09, 0.03), dark); pegs.position.set(0, 0.43, -0.03); pegs.rotation.x = -0.9;
  inner.add(bowl, rose, neck, pegs);
  inner.rotation.y = Math.PI / 2;                            // its face (the rose) to the front
  g.add(inner);
  return g;
}

/** Is this one at their work out in the open, at it right now (there, facing it, not turned to talk)? */
function atTask(w: { plan: string; task?: string | null; moving: boolean; path: readonly unknown[]; face: number | null; facing: number }): string | null {
  if (w.plan !== "work" || !w.task || w.moving || w.path.length || w.face === null) return null;
  return Math.abs(Math.atan2(Math.sin(w.facing - w.face), Math.cos(w.facing - w.face))) < 0.3 ? w.task : null;
}
const townsfolk: EntityView<FolkView> = {
  create(ctx, e, g) {
    const b = makeBody(ctx), w = g.world.need(e, "walker"), r = residentById(w.id), age = r?.age ?? 30;
    const size = age < 14 ? 0.62 + (age / 14) * 0.25 : 1, stoop = age >= 70 ? 0.22 : age >= 60 ? 0.1 : 0;
    if (r) dressCommoner(ctx, b, r.dress);
    b.ripple.visible = false;
    b.sword.visible = false;
    b.group.scale.setScalar(size);
    b.shadow.scale.setScalar(size);
    return Object.assign(b, { k: (w.id * 0.37) % 10, size, stoop, hammer: null, lute: null, stroke: 0, tools: {}, beat: 0, reach: 0, load: r && r.age >= 14 ? loadOf(r.job) : null, carried: null });
  },
  update(ctx, v, e, g, f) {
    const o = g.world.need(e, "transform"), w = g.world.need(e, "walker"), [x, z] = toWorld(o.x, o.y), t = f.t + v.k;
    v.group.position.set(x, 0, z);
    v.group.rotation.y = turn(v.group.rotation.y, -w.facing, f.dt, 8);
    v.shadow.position.set(x, SHADOW_Y, z);
    const b = v.body;
    b.rotation.z = -v.stoop;
    if ((w.moving || w.runTo) && w.blockedFor === 0 && !w.holdFor) {   // walking (or running about at play): bob and step, like the hero
      const pace = w.speed * 0.3;
      b.position.y = Math.abs(Math.sin(t * pace)) * 0.05;
      b.rotation.z -= 0.06;
      b.scale.y = 1;
      v.feet.forEach((foot, i) => { foot.position.x = v.footX + Math.sin(t * pace + i * Math.PI) * 0.09; });
      v.hands.forEach((hand, i) => { hand.position.set(0.12 + Math.sin(t * pace + i * Math.PI + Math.PI) * 0.06, 0.38, (i ? -1 : 1) * 0.42); });
    } else {                                                 // standing: breathing
      b.position.y = 0;
      b.scale.y = 1 + Math.sin(t * 2.3) * 0.02;
      v.feet.forEach(foot => { foot.position.x = v.footX; });
      v.hands.forEach((hand, i) => { hand.position.set(0.14, 0.36 + Math.sin(t * 2.3 + i) * 0.015, (i ? -1 : 1) * 0.4); });
    }
    const task = atTask(w), [right, left] = v.hands as [THREE.Mesh, THREE.Mesh];
    if (task === "anvil") {                                  // hammering: up slowly, down hard, the left hand holding the work on the anvil
      if (!v.hammer) { v.hammer = makeHammer(ctx); right.add(v.hammer); }
      const beat = f.t / CRAFTS.hammer, k = beat % 1, up = k < 0.15 ? 0 : k < 0.75 ? (k - 0.15) / 0.6 : 1 - (k - 0.75) / 0.25;
      right.position.set(0.42 - up * 0.12, 0.62 + up * 0.45, 0.16);
      v.hammer.rotation.z = -0.6 + up * 1.4;
      left.position.set(0.48, 0.64, -0.14);
      b.rotation.z -= 0.08 + up * 0.04;
      const stroke = Math.floor(beat);
      if (stroke !== v.stroke) {                             // the hammer comes down: sparks fly off the anvil in front of him
        v.stroke = stroke;
        const ax = x + Math.cos(w.facing) * 0.62 * v.size, az = z + Math.sin(w.facing) * 0.62 * v.size;
        for (let i = 0; i < 6; i++) { const a = Math.random() * Math.PI * 2; ctx.particles.spawn("hit", ax, 0.72, az, Math.cos(a) * 0.8, 0.8 + Math.random(), Math.sin(a) * 0.8, 0.35); }
      }
    } else if (task === "lute") {                            // playing: the lute across him, strumming with the right, fingering the neck with the left
      if (!v.lute) { v.lute = makeLute(ctx); v.group.add(v.lute); }
      v.lute.position.set(0.32, 0.4, 0.08);
      v.lute.rotation.set(-0.95, 0, 0);                      // neck up to his left
      right.position.set(0.44, 0.4 + Math.sin(t * 14) * 0.04, 0.12);
      left.position.set(0.38, 0.6, -0.2 + Math.sin(t * 3) * 0.02);
      b.rotation.z += Math.sin(t * 2.4) * 0.04;              // swaying to it
    }
    if (v.hammer) v.hammer.visible = task === "anvil";
    if (v.lute) v.lute.visible = task === "lute";
    poseWork(ctx, v, task, t, f.dt);   // the broom, the washtub, the well's crank...
    const h = hourOf(g), day = h >= (v.load === "bread" ? 5 : TOWNSFOLK.hours.workFrom) && h < TOWNSFOLK.hours.workTo;   // (the baker's round's before dawn)
    poseLoad(ctx, v, day && !task && !w.follow && w.plan !== "answer");   // their load, about through the working day
    v.eyes.forEach(eye => { eye.scale.y = t % 4.1 < 0.15 ? 0.15 : 1; });
  },
  remove: removeBody,
};

// ---------- Dogs and cats ----------
/**
 * One of the city's dogs and cats (see src/game/pets.ts), in its own breed and coat (models/pets.ts). They
 * trot (or bolt) with their legs stepping in diagonal pairs, stand nose down sniffing, sit up and lie down,
 * easing from one to the next. A dog wags, hard when it's greeting the hero, and lays its head on its paws
 * to doze; a cat walks with its tail up and hooked, wraps it round its paws when it sits, and curls up,
 * eyes shut, when it dozes.
 */
interface PetView extends PetModel {
  shadow: THREE.Object3D;
  k: number;
  /** The pose as drawn, easing toward the pet's (0-1). */
  sit: number;
  lie: number;
  curl: number;
  sniff: number;
  /** How far up the tail's carried, and how far the stride swings (eased). */
  lift: number;
  swing: number;
  /** Where its legs are in their stride. */
  stride: number;
}
const pet: EntityView<PetView> = {
  create(ctx, e, g) {
    const p = g.world.need(e, "pet"), k = (e * 0.618) % 1;
    const m = makePetModel(ctx, p.species, p.coat, 0.92 + k * 0.16);
    const shadow = addShadow(ctx, m.build.L * m.group.scale.x * 1.5);
    ctx.scene.add(m.group, shadow);
    m.group.rotation.y = -p.facing;
    const lie = p.pose === "lie" ? 1 : 0;
    return Object.assign(m, { shadow, k: k * 10, sit: 0, lie, curl: lie, sniff: 0, lift: m.build.tail.lift, swing: 0, stride: 0 });
  },
  update(_ctx, v, e, g, f) {
    const o = g.world.need(e, "transform"), p = g.world.need(e, "pet"), [x, z] = toWorld(o.x, o.y), t = f.t + v.k, cat = p.species === "cat";
    v.group.position.set(x, 0, z);
    v.group.rotation.y = turn(v.group.rotation.y, -p.facing, f.dt, p.running ? 14 : 7);
    v.shadow.position.set(x, SHADOW_Y, z);
    const dozing = p.pose === "lie" && !p.moving && p.wait > 12;
    v.sit = smooth(v.sit, p.pose === "sit" ? 1 : 0, f.dt, 6);
    v.lie = smooth(v.lie, p.pose === "lie" ? 1 : 0, f.dt, 4);
    v.curl = smooth(v.curl, cat && dozing ? 1 : 0, f.dt, 2);
    v.sniff = smooth(v.sniff, p.pose === "sniff" ? 1 : 0, f.dt, 5);

    // Legs: diagonal pairs, faster and wider at a run, the body bobbing with each step.
    if (p.moving) v.stride += f.dt * p.speed / (cat ? 3.2 : 4.2);
    v.swing = smooth(v.swing, p.moving ? (p.running ? 0.8 : 0.45) : 0, f.dt, 10);
    const bob = Math.abs(Math.sin(v.stride)) * v.swing * (p.running ? 0.05 : 0.025);
    posePet(v, { sit: v.sit, lie: v.lie, curl: v.curl, stride: v.stride, swing: v.swing, bob });

    // Neck and head: nose to the ground sniffing, laid down dozing, otherwise up and looking about.
    const look = p.moving ? 0 : Math.sin(t * 0.4) * 0.6 * (1 - v.lie * 0.6) * (1 - v.sniff);
    v.neck.rotation.z = -v.sniff * 1.05 - v.lie * (cat ? 0.5 + v.curl * 0.6 : 0.75) + (p.moving ? Math.sin(v.stride * 2) * 0.05 - (p.running ? 0.3 : 0.1) : 0);
    v.head.rotation.set(0, look, -v.trunk.rotation.z * 0.5 - v.sniff * 0.35 + v.lie * 0.25 + (cat && v.curl > 0.5 ? -0.3 : 0) + (v.sniff ? Math.sin(t * 9) * 0.06 * v.sniff : 0));
    v.eyes.forEach(eye => { eye.scale.y = dozing || t % 4.3 < 0.15 ? 0.15 : 1; });

    // The tail.
    const b = v.build.tail, n = v.tail.length;
    if (cat) {                                               // up and hooked walking, straight out running, round the paws sitting, round the body curled
      const lift = p.running ? 0.2 : p.moving ? 1.35 : -0.25 - v.sit * 0.35 - v.lie * 0.2;
      v.lift = smooth(v.lift, lift, f.dt, 4);
      const wrap = Math.max(v.sit, v.lie) * (1 - (p.moving ? 1 : 0)), sway = Math.sin(t * 1.3) * 0.3 * (1 - wrap * 0.6);
      v.tail.forEach((seg, i) => {
        const hook = p.moving && !p.running ? [0, 0.1, 0.3, 0.75][i] ?? 0 : 0;
        seg.rotation.set(0, (i ? 0.55 : 1.3) * wrap + sway * (i + 1) / n, i ? -hook + Math.sin(t * 2.1 - i) * 0.1 : -v.lift);
      });
    } else {                                                 // carried as the breed carries it; wagging, hard when greeting
      const lift = b.lift + (p.greeting ? 0.45 : p.moving ? 0.15 : 0) - (p.running && b.lift < 1 ? 0.3 : 0) - v.lie * (b.lift + 0.1) - v.sit * 0.4;
      v.lift = smooth(v.lift, lift, f.dt, 5);
      const wag = p.greeting ? Math.sin(t * 22) * 0.6 : Math.sin(t * (p.moving ? 9 : 3)) * (dozing ? 0.04 : 0.22);
      v.tail.forEach((seg, i) => seg.rotation.set(0, wag * (i ? 0.6 : 1) + v.lie * (i ? 0.3 : 0.9), i ? -b.curl * (1 - v.lie) : -v.lift));
    }
    v.trunk.scale.y = 1 + Math.sin(t * (dozing ? 1.4 : 2.6)) * 0.03;   // breathing
  },
  remove: removeSimple,
};

// ---------- The Grey Ringer ----------
/**
 * Wenna's ghost (see makeGhostModel), floating and bobbing, always turned to the hero. She rises out of the
 * ground, raises her bell and rings it (its reach marked on the ground, filling as she winds up), throws her
 * arms out to wail, and fades clean away and back. Pale wisps trail off her hem.
 */
interface GhostView extends GhostModel { shadow: THREE.Object3D; ring: THREE.Group; fill: THREE.Mesh; edge: THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>; yaw: number | null; seen: number }
const ghost: EntityView<GhostView> = {
  create(ctx) {
    const m = makeGhostModel(ctx), shadow = addShadow(ctx, 1.1);
    const R = GHOST.toll.radius / PX_PER_TILE, ring = new THREE.Group();
    const edge = new THREE.Mesh(new THREE.RingGeometry(R - 0.12, R, 24).rotateX(-Math.PI / 2), ctx.glow("#9ff0e0", { transparent: true, opacity: 0.8, depthWrite: false, ...onGround(GROUND.marker) }));
    const fill = new THREE.Mesh(new THREE.CircleGeometry(R, 24).rotateX(-Math.PI / 2), ctx.glow("#9ff0e0", { transparent: true, opacity: 0.22, depthWrite: false, ...onGround(GROUND.marker) }));
    ring.add(edge, fill);
    ring.position.y = 0.03;
    m.group.add(ring);
    ctx.scene.add(m.group, shadow);
    return { ...m, shadow, ring, edge, fill, yaw: null, seen: 0 };
  },
  update(ctx, v, e, g, f) {
    const o = g.world.need(e, "transform"), b = g.world.need(e, "ghost"), flash = g.world.get(e, "enemy")?.flash ?? 0, { t, dt } = f;
    const [x, z] = toWorld(o.x, o.y);
    v.group.position.set(x, 0, z);
    v.shadow.position.set(x, SHADOW_Y, z);
    const look = facing(o, f.hero);
    v.yaw = v.yaw === null ? look : turn(v.yaw, look, dt, 4);
    v.body.rotation.y = v.yaw;
    // How much of her is there: rising out of the ground, faded away, or here.
    const rising = b.act === "rise" ? Math.min(1, b.t / GHOST.rise) : 1;
    v.seen = smooth(v.seen, b.hidden ? 0 : rising, dt, b.hidden ? 14 : 6);
    v.group.visible = v.seen > 0.02 && !(flash > 0 && Math.floor(t * 30) % 2);
    v.robe.opacity = 0.8 * v.seen; v.hood.opacity = 0.88 * v.seen; v.shell.opacity = 0.16 * v.seen * (b.angry ? 1.6 : 1);
    v.robe.emissive.set(flash > 0 ? 0xffffff : 0x2f4a46);
    v.shadow.visible = v.seen > 0.3;
    v.body.position.y = 0.22 + Math.sin(t * 2.1) * 0.07 - (1 - rising) * 1.3;
    for (const eye of v.eyes) eye.material = b.angry ? v.angry : v.calm;
    // What her arms are doing: the bell raised and shaking for the toll, both arms flung out for the wail, else held out before her.
    const k = b.act === "ring" ? 1 : b.act === "toll" ? Math.min(1, b.t / (b.angry ? GHOST.toll.angryCharge : GHOST.toll.charge)) : 0;
    const wail = b.act === "wail" ? Math.min(1, b.t / GHOST.wail.charge) : 0;
    v.bellArm.rotation.set(0, 0, smooth(v.bellArm.rotation.z, b.act === "toll" || b.act === "ring" ? 2.5 + Math.sin(t * 38) * 0.18 * k : wail ? 1.3 : 0.9 + Math.sin(t * 1.7) * 0.12, dt, 10));
    v.reachArm.rotation.set(wail ? -0.6 : 0, 0, smooth(v.reachArm.rotation.z, wail ? 1.5 : b.act === "toll" ? 0.4 : 1.15 + Math.sin(t * 1.3 + 1) * 0.1, dt, 8));
    v.bellArm.rotation.x = wail ? 0.6 : 0;
    v.bell.rotation.z = Math.sin(t * (k ? 30 : 3)) * (k ? 0.5 : 0.25);
    v.head.rotation.z = smooth(v.head.rotation.z, wail ? 0.45 : 0, dt, 8);
    v.ring.visible = k > 0;
    v.fill.scale.setScalar(Math.max(0.01, k));
    v.edge.material.opacity = 0.55 + Math.sin(t * 30) * 0.3;
    // Pale wisps trailing off her hem.
    if (v.seen > 0.5 && Math.random() < dt * 14) {
      ctx.particles.spawn(Math.random() < 0.5 ? "ice" : "snow", x + (Math.random() - 0.5) * 0.6, 0.15 + Math.random() * 0.3, z + (Math.random() - 0.5) * 0.6,
        (Math.random() - 0.5) * 0.3, 0.4 + Math.random() * 0.5, (Math.random() - 0.5) * 0.3, 0.7);
    }
  },
  remove(ctx, v) {
    ctx.scene.remove(v.group, v.shadow);
    const keep = new Set<unknown>([ctx.shadowGeo, ctx.shadowMat]);
    disposeTree(v.group, keep);
    disposeTree(v.shadow, keep);
    v.angry.dispose(); v.calm.dispose();                    // one of them isn't on a mesh just now
  },
};

export type ViewKind = Exclude<RenderKind, "hero">;

/** Every kind of entity view, in the order they update. (The hero has its own view: see hero.ts.) */
export const VIEWS = { mage, cinder, blaze, rime, rimefrost, calder, tempest, greatkoi, ghost, bolt, strike, slime, potion, arrow, loot, guard, king, dummy, townsfolk, pet, ringstone, boatman, yssa, spirit, watcher, homestone, head, lantern, dragon, egg, cloak } satisfies { [K in ViewKind]: EntityView<object> };
