// The storm of Calder's fight (src/game/calderfight.ts), drawn on the entity made for it at the ring's middle: lightning
// standing all round the glade's edge while it's on, flickering; the two echoes of him his blink leaves round the hero,
// his own body to the life but casting no shadow, crackling out as they throw their sparks; and the great crack itself
// (src/render/wild.ts), drawn as wide as the fight has it. Once he's fallen, on the entity that keeps it shut: his spark
// flying home south over the trees, and the crack groaning shut, sealed over with grey stone.
import * as THREE from "three";
import { CALDER_FIGHT as F } from "../data/rift.ts";
import { calderFight, calderGone, crackSealed, crackWidth } from "../game/calderfight.ts";
import { GROUND, PX_PER_TILE, onGround, toWorld, type RenderContext } from "./context.ts";
import { disposeTree } from "./dispose.ts";
import { dressBody, removeBody, type Body } from "./models/body.ts";
import { makeMageBody } from "./models/enemies.ts";
import { animateCalder, makeCalder, type CalderParts } from "./models/calder.ts";
import { GREAT_CRACK_NAME } from "./wild.ts";
import type { EntityView } from "./views.ts";

const BOLT = "#fff6c8", TRIM = "#8f9dff";
/** Bolts standing round the ring, and how many points up each. */
const PILLARS = 14, STEPS = 6;

interface EchoBody extends Body { parts: CalderParts }
export interface TempestView {
  group: THREE.Group;
  /** The lightning round the glade's edge, while the fight's on, and how far out it stands (tiles). */
  ring: THREE.Group | null;
  pillars: THREE.LineSegments<THREE.BufferGeometry, THREE.LineBasicMaterial> | null;
  ringR: number;
  echoes: EchoBody[];
  /** His spark, going home. */
  spark: THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>;
}

export const tempest: EntityView<TempestView> = {
  create(ctx, e, g) {
    const group = new THREE.Group(), t = g.world.need(e, "transform"), [x, z] = toWorld(t.x, t.y);
    group.position.set(x, 0, z);
    ctx.scene.add(group);
    const spark = new THREE.Mesh(new THREE.IcosahedronGeometry(0.16, 1), ctx.glow(BOLT, { transparent: true, opacity: 0.95, depthWrite: false, blending: THREE.AdditiveBlending }));
    spark.visible = false;
    group.add(spark);
    const v: TempestView = { group, ring: null, pillars: null, ringR: F.keepIn / PX_PER_TILE + 0.4, echoes: [], spark };
    if (calderFight(g)?.view === e) makeRing(ctx, v);
    return v;
  },
  update(ctx, v, e, g, f) {
    const fight = calderFight(g), mine = fight?.view === e ? fight : null;
    // The great crack, as wide as it is now: scaled across about its spine (it runs east-west).
    const crack = ctx.scene.getObjectByName(GREAT_CRACK_NAME);
    if (crack) {
      const w = crackWidth(g), mid = crack.userData.mid as number;
      crack.scale.z = w;
      crack.position.z = mid * (1 - w);
      crack.userData.sealed = crackSealed(g);
    }
    if (v.ring && v.pillars) {
      v.ring.visible = v.pillars.visible = !!mine;
      if (mine) flickerPillars(v, f.t);
    }
    // His echoes, standing round the hero.
    v.echoes.forEach((b, i) => {
      const echo = mine?.echoes[i];
      b.group.visible = !!echo;
      if (!echo) return;
      const [x, z] = toWorld(echo.x, echo.y), k = echo.t / F.blink.daze;
      b.group.position.set(x, 0, z);
      b.group.rotation.y = -Math.atan2(f.hero.y - echo.y, f.hero.x - echo.x);
      b.group.visible = !(k > 0.8 && Math.floor(f.t * 30) % 2);          // crackling out at the end
      animateCalder(b.parts, f.t + i, k);
    });
    // Once he's fallen: his spark, flying home south, high over the trees.
    const gone = calderGone(g), at = g.world.need(e, "transform");
    v.spark.visible = gone !== null && gone < 2.6;
    if (v.spark.visible) {
      const k = gone! / 2.6;
      v.spark.position.set(Math.sin(k * 9) * 0.3, 1.2 + k * 7, k * k * 30);
      v.spark.scale.setScalar(1 + Math.sin(f.t * 30) * 0.2);
      if (Math.random() < f.dt * 40) {
        const [x, z] = toWorld(at.x, at.y), p = v.spark.position;
        ctx.particles.spawn(Math.random() < 0.5 ? "spark" : "sparkLight", x + p.x, p.y, z + p.z, 0, -0.2, 0, 0.6);
      }
    }
  },
  remove(ctx, v) {
    if (v.ring) for (let i = 0; i < 36; i++) {                // the lightning round the glade bursts into sparks
      const a = (i / 36) * Math.PI * 2;
      ctx.particles.spawn(i % 2 ? "spark" : "sparkLight", v.group.position.x + Math.cos(a) * v.ringR, 0.2 + Math.random() * 1.4, v.group.position.z + Math.sin(a) * v.ringR,
        Math.cos(a) * (0.4 + Math.random()), 0.6 + Math.random(), Math.sin(a) * (0.4 + Math.random()), 0.7);
    }
    for (const b of v.echoes) removeBody(ctx, b);
    ctx.scene.remove(v.group);
    disposeTree(v.group);
  },
};

/** The lightning round the glade: a glowing band on the ground, and bolts standing up out of it all the way round. */
function makeRing(ctx: RenderContext, v: TempestView): void {
  const ring = new THREE.Group(), R = v.ringR;
  ring.add(new THREE.Mesh(new THREE.RingGeometry(R - 0.35, R + 0.35, 56).rotateX(-Math.PI / 2),
    ctx.glow(TRIM, { transparent: true, opacity: 0.4, depthWrite: false, blending: THREE.AdditiveBlending, ...onGround(GROUND.marker) })));
  const pillars = new THREE.LineSegments(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: BOLT, transparent: true, opacity: 0.9 }));
  pillars.geometry.setAttribute("position", new THREE.Float32BufferAttribute(new Float32Array(PILLARS * STEPS * 6), 3));
  pillars.frustumCulled = false;
  v.group.add(ring, pillars);
  v.ring = ring;
  v.pillars = pillars;
  v.echoes = [makeEcho(ctx), makeEcho(ctx)];                 // made now, so a blink doesn't have to wait on them
}

/** Redraw the bolts round the ring, a few at a time, each a jagged line from the ground up into the sky. */
function flickerPillars(v: TempestView, t: number): void {
  const pos = v.pillars!.geometry.getAttribute("position") as THREE.BufferAttribute;
  for (let p = 0; p < PILLARS; p++) {
    const lit = Math.sin(t * (13 + p) + p * 7) > 0.3, a = (p / PILLARS) * Math.PI * 2 + Math.sin(t * 0.3 + p) * 0.1;
    let from = { x: Math.cos(a) * v.ringR, y: 0, z: Math.sin(a) * v.ringR };
    for (let i = 1; i <= STEPS; i++) {
      const n = (p * STEPS + i - 1) * 2, j = 0.25;
      const to = lit ? { x: Math.cos(a) * v.ringR + (Math.random() - 0.5) * j, y: i * 0.7, z: Math.sin(a) * v.ringR + (Math.random() - 0.5) * j } : from;
      pos.setXYZ(n, from.x, from.y, from.z);
      pos.setXYZ(n + 1, to.x, to.y, to.z);
      from = to;
    }
  }
  pos.needsUpdate = true;
  v.pillars!.material.opacity = 0.6 + Math.random() * 0.4;
}

/** One of his echoes: his body to the life, with no shadow under it. */
function makeEcho(ctx: RenderContext): EchoBody {
  const b = makeMageBody(ctx, "storm");
  dressBody(ctx, b, { helm: null, armor: null, boots: null, weapon: null, ring: null, amulet: null, weaponType: null });
  const parts = makeCalder(ctx, b);
  b.shadow.visible = false;
  parts.light.removeFromParent();                            // his own light is enough (and lights coming and going cost a recompile)
  b.group.visible = false;
  return Object.assign(b, { parts });
}
