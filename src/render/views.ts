// Entity views: how each kind of entity looks. The render system creates a view when an entity
// with a Renderable appears, updates it every frame, and removes it when the entity goes away.
// Adding a new kind of thing to draw means adding one entry here.
import * as THREE from "three";
import type { Entity } from "../core/ecs.ts";
import { turn } from "../core/math.ts";
import { SLIME, SPELLS, type BoltKind, type School, type SpellName } from "../data/enemies.ts";
import { PAL } from "../data/palette.ts";
import { RARITY_COLOR } from "../data/tiers.ts";
import { HALF } from "../data/world.ts";
import type { RenderKind, Transform } from "../game/components.ts";
import type { Game } from "../game/game.ts";
import { PX_PER_TILE, addShadow, box, col, toWorld, type RenderContext } from "./context.ts";
import { dressBody, makeBody, removeBody, type Body } from "./models/body.ts";
import { makeArrowMesh, makeOrbMesh, ORB_COLORS } from "./models/projectiles.ts";
import { SPARK_PAIRS, type SparkPair } from "./particles.ts";

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
}

/** Views made of a group and a blob shadow. */
interface Simple { group: THREE.Object3D; shadow: THREE.Object3D }
const removeSimple = (ctx: RenderContext, v: Simple) => ctx.scene.remove(v.group, v.shadow);
const facing = (from: Transform, to: Transform) => -Math.atan2(to.y - from.y, to.x - from.x);

// ---------- Slime ----------
interface SlimeView extends Simple { body: THREE.Group; mat: THREE.MeshLambertMaterial; yaw: number | null }
const slime: EntityView<SlimeView> = {
  create(ctx) {
    const { lambert, basic } = ctx;
    const group = new THREE.Group(), body = new THREE.Group();
    const mat = lambert(PAL.G, { transparent: true, opacity: 0.9, emissive: col("#000000") });
    const blob = new THREE.Mesh(new THREE.IcosahedronGeometry(0.36, 0), mat);
    blob.scale.set(1, 0.72, 1); blob.position.y = 0.26;
    const eyeMat = basic(PAL.k);
    const eyes = [-1, 1].map(s => { const e = new THREE.Mesh(box(0.06, 0.1, 0.06), eyeMat); e.position.set(0.3, 0.32, s * 0.11); return e; });
    const shine = new THREE.Mesh(box(0.08, 0.05, 0.08), basic(PAL.W)); shine.position.set(-0.08, 0.5, -0.12);
    body.add(blob, ...eyes, shine);
    group.add(body);
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
    v.shadow.position.set(x, 0.01, z);
    v.shadow.scale.setScalar(1 - hop * 0.3);
  },
  remove: removeSimple,
};

// ---------- Mage ----------
// The same body as the hero, dressed in its school's tier, with glowing eyes.
const MAGE_EYES: Record<School, string> = { ember: PAL.O, frost: PAL.C, storm: "#fff6c8" };
const SCHOOL_SPARKS: Record<School, SparkPair> = { ember: "fire", frost: "frost", storm: "spark" };
/** Which orb a mage holds while charging each spell. */
const CAST_ORB: Record<SpellName, BoltKind> = { fire: "fire", poly: "poly", frost: "frost", spark: "spark", nova: "frost", strike: "spark" };

interface MageView extends Body {
  orbs: Record<BoltKind, THREE.Group>;
  novaEdge: THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>;
  novaFill: THREE.Mesh;
  yaw: number | null;
  wasMelee: boolean;
}
const mage: EntityView<MageView> = {
  create(ctx, e, g) {
    const school = g.world.need(e, "mage").school;
    const m = makeBody(ctx);
    const eyeMat = ctx.basic(MAGE_EYES[school]);
    m.eyes.forEach(eye => { eye.material = eyeMat; });
    m.ripple.visible = false;
    const orbs = Object.fromEntries((Object.keys(ORB_COLORS) as BoltKind[]).map(k => {
      const orb = makeOrbMesh(ctx, k);
      orb.visible = false;
      m.group.add(orb);
      return [k, orb];
    })) as Record<BoltKind, THREE.Group>;
    // Frost Nova telegraph: the blast radius outlined on the ground, filling as the spell charges.
    const R = SPELLS.nova.radius! / PX_PER_TILE;
    const novaEdge = new THREE.Mesh(new THREE.RingGeometry(R - 0.12, R, 24).rotateX(-Math.PI / 2), ctx.basic(PAL.C, { transparent: true, opacity: 0.8, depthWrite: false }));
    const novaFill = new THREE.Mesh(new THREE.CircleGeometry(R, 24).rotateX(-Math.PI / 2), ctx.basic(PAL.C, { transparent: true, opacity: 0.25, depthWrite: false }));
    novaEdge.position.y = novaFill.position.y = 0.03;
    m.group.add(novaEdge, novaFill);
    return { ...m, orbs, novaEdge, novaFill, yaw: null, wasMelee: false };
  },
  update(ctx, v, e, g, f) {
    const o = g.world.need(e, "transform"), b = g.world.need(e, "mage"), enemy = g.world.need(e, "enemy");
    const { t, dt } = f;
    const [x, z] = toWorld(o.x, o.y);
    v.group.position.set(x, 0, z);
    dressBody(ctx, v, { helm: b.school, armor: b.school, boots: b.school, weapon: b.melee ? b.school : null, ring: null, amulet: null, weaponType: b.melee ? "blade" : null });
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
    v.shadow.position.set(x, 0.01, z);
  },
  remove: removeBody,
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
    v.shadow.position.set(x, 0.01, z);
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
      const hgt = rarity === "rare" ? 3 : 1.2;
      group.add(new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.12, hgt, 5, 1, true).translate(0, hgt / 2, 0),
        ctx.basic(c, { transparent: true, opacity: 0.35, depthWrite: false, blending: THREE.AdditiveBlending })));
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
    v.shadow.position.set(x, 0.01, z);
  },
  remove: removeSimple,
};

// ---------- Arrow ----------
const arrow: EntityView<Simple> = {
  create(ctx, e, g) {
    const group = new THREE.Group(), mesh = makeArrowMesh(ctx, g.world.need(e, "arrow").power);
    mesh.position.x = -0.24;                                 // centre the arrow on its game position
    group.add(mesh);
    const shadow = addShadow(ctx);
    shadow.scale.set(0.5, 1, 0.15);
    ctx.scene.add(group, shadow);
    return { group, shadow };
  },
  update(_ctx, v, e, g) {
    const o = g.world.need(e, "transform"), a = g.world.need(e, "arrow"), [x, z] = toWorld(o.x, o.y);
    v.group.position.set(x, a.stuck > 0 ? 0.6 : 0.5, z);   // stuck in a tree, a little higher
    if (a.stuck <= 0) v.group.rotation.set(0, -Math.atan2(a.vy, a.vx), 0);
    v.shadow.position.set(x, 0.01, z);
    v.shadow.visible = a.stuck <= 0;
  },
  remove: removeSimple,
};

// ---------- Spell bolt ----------
const BOLT_SPARKS: Record<BoltKind, SparkPair> = { fire: "fire", poly: "arcane", frost: "frost", spark: "spark" };
const bolt: EntityView<Simple> = {
  create(ctx, e, g) {
    const group = makeOrbMesh(ctx, g.world.need(e, "bolt").kind);
    const shadow = addShadow(ctx, 0.35);
    ctx.scene.add(group, shadow);
    return { group, shadow };
  },
  update(ctx, v, e, g, f) {
    const o = g.world.need(e, "transform"), kind = g.world.need(e, "bolt").kind, [x, z] = toWorld(o.x, o.y);
    v.group.position.set(x, 0.55 + Math.sin(f.t * 12 + o.x + HALF) * 0.03, z);
    v.group.rotation.set(f.t * 6, f.t * 7, 0);
    v.shadow.position.set(x, 0.01, z);
    if (Math.random() < f.dt * 30) {                         // ember trail
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
    const edge = new THREE.Mesh(new THREE.RingGeometry(R - 0.08, R, 16).rotateX(-Math.PI / 2), ctx.basic(PAL.Y, { transparent: true, opacity: 0.85, depthWrite: false }));
    const fill = new THREE.Mesh(new THREE.CircleGeometry(R, 16).rotateX(-Math.PI / 2), ctx.basic(PAL.Y, { transparent: true, opacity: 0.3, depthWrite: false }));
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

export type ViewKind = Exclude<RenderKind, "hero">;

/** Every kind of entity view, in the order they update. (The hero has its own view: see hero.ts.) */
export const VIEWS = { mage, bolt, strike, slime, potion, arrow, loot } satisfies { [K in ViewKind]: EntityView<object> };
