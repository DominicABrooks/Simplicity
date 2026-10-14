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
import { blinkVisible } from "../game/despawn.ts";
import type { Game } from "../game/game.ts";
import { GROUND, SHADOW_Y, onGround, PX_PER_TILE, addShadow, box, col, toWorld, type RenderContext } from "./context.ts";
import { disposeTree } from "./dispose.ts";
import { dressBody, dressCommoner, dressSoldier, makeBody, removeBody, type Body, type CommonLook } from "./models/body.ts";
import { CLOTH } from "../data/townsfolk.ts";
import { residentById } from "../game/townsfolk.ts";
import { FAMILIES } from "../world/people.ts";
import { makeMageBody, makeSlimeModel } from "./models/enemies.ts";
import { BUTT_TILT, makeButt, makeDummy } from "./castle.ts";
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
    const m = makeMageBody(ctx, g.world.need(e, "mage").school);
    const orbs = Object.fromEntries((Object.keys(ORB_COLORS) as BoltKind[]).map(k => {
      const orb = makeOrbMesh(ctx, k);
      orb.visible = false;
      m.group.add(orb);
      return [k, orb];
    })) as Record<BoltKind, THREE.Group>;
    // Frost Nova telegraph: the blast radius outlined on the ground, filling as the spell charges.
    const R = SPELLS.nova.radius! / PX_PER_TILE;
    const novaEdge = new THREE.Mesh(new THREE.RingGeometry(R - 0.12, R, 24).rotateX(-Math.PI / 2), ctx.basic(PAL.C, { transparent: true, opacity: 0.8, depthWrite: false, ...onGround(GROUND.marker) }));
    const novaFill = new THREE.Mesh(new THREE.CircleGeometry(R, 24).rotateX(-Math.PI / 2), ctx.basic(PAL.C, { transparent: true, opacity: 0.25, depthWrite: false, ...onGround(GROUND.marker) }));
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
    v.shadow.position.set(x, SHADOW_Y, z);
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
    v.shadow.position.set(x, SHADOW_Y, z);
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
    const edge = new THREE.Mesh(new THREE.RingGeometry(R - 0.08, R, 16).rotateX(-Math.PI / 2), ctx.basic(PAL.Y, { transparent: true, opacity: 0.85, depthWrite: false, ...onGround(GROUND.marker) }));
    const fill = new THREE.Mesh(new THREE.CircleGeometry(R, 16).rotateX(-Math.PI / 2), ctx.basic(PAL.Y, { transparent: true, opacity: 0.3, depthWrite: false, ...onGround(GROUND.marker) }));
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
    v.speed += (-spring.stiffness * v.lean - spring.damping * v.speed) * f.dt;
    v.lean = Math.max(-spring.max, Math.min(spring.max, v.lean + v.speed * f.dt));
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
 * One of the census's people out in the streets (see src/game/townsfolk.ts): the hero's body in clothes
 * that suit who they are (a merchant's rich cloth, a priest's black, an apron for a maid or a cook, a coif,
 * a cap or a straw hat, a basket for the market), children smaller and the old a little stooped. They walk
 * like the hero, stand breathing when they stop, and face whoever they're talking to.
 */
interface FolkView extends Body { k: number; size: number; stoop: number }
const pickBy = <V>(list: readonly V[], n: number): V => list[Math.floor(n * list.length) % list.length]!;
function lookOf(id: number): { look: CommonLook; size: number; stoop: number } {
  const r = residentById(id), n = (k: number) => { const s = Math.sin(id * 12.9898 + k * 78.233) * 43758.5453; return s - Math.floor(s); };
  const job = r?.job.toLowerCase() ?? "", female = r?.sex === "f", age = r?.age ?? 30;
  const rank = r?.family ? FAMILIES.find(f => f.id === r.family)?.rank : undefined;
  const clergy = /priest|deacon|chaplain|choir|warden/.test(job), rich = rank === "merchant" && r?.role === "family";
  const serving = /maid|cook|scullion|laundress|nurse|kitchen|baker|brewer|washing|wash/.test(job);
  const market = /stall|egg|flower|greengrocer|fish|sells|peddler/.test(job);
  const look: CommonLook = {
    cloth: pickBy(clergy ? CLOTH.clergy : rich ? CLOTH.rich : CLOTH.common, n(1)),
    trim: rich ? "#d9a83a" : pickBy(["#4f3222", "#3a2e24", "#6b4f3a"], n(2)),
    linen: pickBy(CLOTH.linen, n(3)),
    long: female || clergy || age >= 70,
    apron: serving || /smith|apprentice|journeyman|butcher|cobbler|weaver/.test(job) || (female && n(4) < 0.3),
    hat: clergy ? "hood" : female ? (n(5) < 0.65 ? "coif" : n(5) < 0.8 ? "straw" : "none") : pickBy(["cap", "cap", "hood", "straw", "none", "none"], n(6)),
    basket: market || (n(7) < 0.2 && age >= 12),
  };
  return { look, size: age < 14 ? 0.62 + (age / 14) * 0.25 : 1, stoop: age >= 70 ? 0.22 : age >= 60 ? 0.1 : 0 };
}
const townsfolk: EntityView<FolkView> = {
  create(ctx, e, g) {
    const b = makeBody(ctx), w = g.world.need(e, "walker"), { look, size, stoop } = lookOf(w.id);
    dressCommoner(ctx, b, look);
    b.ripple.visible = false;
    b.sword.visible = false;
    b.group.scale.setScalar(size);
    b.shadow.scale.setScalar(size);
    return Object.assign(b, { k: (w.id * 0.37) % 10, size, stoop });
  },
  update(_ctx, v, e, g, f) {
    const o = g.world.need(e, "transform"), w = g.world.need(e, "walker"), [x, z] = toWorld(o.x, o.y), t = f.t + v.k;
    v.group.position.set(x, 0, z);
    v.group.rotation.y = turn(v.group.rotation.y, -w.facing, f.dt, 8);
    v.shadow.position.set(x, SHADOW_Y, z);
    const b = v.body;
    b.rotation.z = -v.stoop;
    if (w.moving && w.blockedFor === 0) {                    // walking: bob and step, like the hero, at their own pace
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
    v.eyes.forEach(eye => { eye.scale.y = t % 4.1 < 0.15 ? 0.15 : 1; });
  },
  remove: removeBody,
};

export type ViewKind = Exclude<RenderKind, "hero">;

/** Every kind of entity view, in the order they update. (The hero has its own view: see hero.ts.) */
export const VIEWS = { mage, bolt, strike, slime, potion, arrow, loot, guard, dummy, townsfolk } satisfies { [K in ViewKind]: EntityView<object> };
