// The storm of Calder's fight (src/game/calderfight.ts), drawn on the entity made for it at the glade's middle:
// lightning standing all round the glade in a great ring while it's on, flickering; the three iron rods he drives into the
// ground, going in and then humming with their tips lit; the lightning along the lines between them (and behind his
// blinks, and the walls sweeping across the ring in the storm proper), a faint crawling flicker on the ground where it's
// going to be, then a white-hot jagged bolt along it; the cage of lightning round him in the storm proper; and
// the great crack itself (src/render/wild.ts), drawn as wide as the fight has it. Once he's fallen, on the entity that
// keeps it shut: his spark flying home south over the trees, and the crack groaning shut, sealed over with grey stone.
import * as THREE from "three";
import { CALDER_FIGHT as F } from "../data/rift.ts";
import { calderFight, calderGone, crackSealed, crackWidth, type Arc, type CalderFight } from "../game/calderfight.ts";
import { GROUND, PX_PER_TILE, onGround, toWorld, type RenderContext } from "./context.ts";
import { disposeTree } from "./dispose.ts";
import { GREAT_CRACK_NAME } from "./wild.ts";
import type { EntityView } from "./views.ts";

const BOLT = "#fff6c8", TRIM = "#8f9dff", IRON = "#3a3d4a";
/** Bolts standing round the ring, and how many points up each. */
const PILLARS = 22, STEPS = 6;
/** Points along an arc's jagged strands, and how many strands. */
const ARC_STEPS = 10, STRANDS = 2;
const additive = (ctx: RenderContext, c: string, opacity: number, ground = false) =>
  ctx.glow(c, { transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, ...(ground ? onGround(GROUND.marker) : {}) });

interface RodMesh { group: THREE.Group; tip: THREE.MeshBasicMaterial }
interface ArcMesh {
  group: THREE.Group;
  mark: THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>;
  glow: THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>;
  bolt: THREE.LineSegments<THREE.BufferGeometry, THREE.LineBasicMaterial>;
}
export interface TempestView {
  group: THREE.Group;
  /** The lightning round the glade, while the fight's on. */
  ring: THREE.Group | null;
  pillars: THREE.LineSegments<THREE.BufferGeometry, THREE.LineBasicMaterial> | null;
  /** How far out the ring is (world units: tiles). */
  r: number;
  rods: RodMesh[];
  /** The cage of lightning round him in the storm proper: a band on the ground, and bolts arching up over him. */
  cage: { group: THREE.Group; bolts: THREE.LineSegments<THREE.BufferGeometry, THREE.LineBasicMaterial> } | null;
  arcs: ArcMesh[];
  /** His spark, going home. */
  spark: THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>;
}

export const tempest: EntityView<TempestView> = {
  create(ctx, e, g) {
    const group = new THREE.Group(), t = g.world.need(e, "transform"), [x, z] = toWorld(t.x, t.y);
    group.position.set(x, 0, z);
    ctx.scene.add(group);
    const spark = new THREE.Mesh(new THREE.IcosahedronGeometry(0.16, 1), additive(ctx, BOLT, 0.95));
    spark.visible = false;
    group.add(spark);
    const v: TempestView = { group, ring: null, pillars: null, r: F.arena.r, rods: [], cage: null, arcs: [], spark };
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
    if (v.cage) {
      v.cage.group.visible = !!mine?.storm;
      if (mine?.storm) poseCage(v.cage, mine.storm.t, f.t);
    }
    if (mine) {
      poseRods(ctx, v, mine, f.t);
      poseArcs(ctx, v, mine, f.t);
    }
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
    if (v.ring) for (let i = 0; i < 48; i++) {                // the lightning round the glade bursts into sparks
      const a = (i / 48) * Math.PI * 2, x = Math.cos(a) * v.r, z = Math.sin(a) * v.r;
      ctx.particles.spawn(i % 2 ? "spark" : "sparkLight", v.group.position.x + x, 0.2 + Math.random() * 1.4, v.group.position.z + z,
        Math.cos(a) * (0.4 + Math.random()), 0.6 + Math.random(), Math.sin(a) * (0.4 + Math.random()), 0.7);
    }
    ctx.scene.remove(v.group);
    disposeTree(v.group);
  },
};

/** The lightning round the glade: a glowing band on the ground all round the ring, and bolts standing up out of it. */
function makeRing(ctx: RenderContext, v: TempestView): void {
  const ring = new THREE.Group();
  const band = new THREE.Mesh(new THREE.RingGeometry(0.97, 1.03, 72).rotateX(-Math.PI / 2), additive(ctx, TRIM, 0.45, true));
  band.position.y = 0.03;
  band.scale.set(v.r, 1, v.r);
  ring.add(band);
  const pillars = new THREE.LineSegments(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: BOLT, transparent: true, opacity: 0.9 }));
  pillars.geometry.setAttribute("position", new THREE.Float32BufferAttribute(new Float32Array(PILLARS * STEPS * 6), 3));
  pillars.frustumCulled = false;
  v.group.add(ring, pillars);
  v.ring = ring;
  v.pillars = pillars;
  // The cage, ready for the storm proper.
  const cage = new THREE.Group(), R = F.shield.radius / PX_PER_TILE;
  const floor = new THREE.Mesh(new THREE.RingGeometry(R - 0.12, R + 0.12, 40).rotateX(-Math.PI / 2), additive(ctx, BOLT, 0.7, true));
  floor.position.y = 0.035;
  const dome = new THREE.Mesh(new THREE.SphereGeometry(R, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), additive(ctx, TRIM, 0.12));
  const bolts = new THREE.LineSegments(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: BOLT, transparent: true, opacity: 0.95 }));
  bolts.geometry.setAttribute("position", new THREE.Float32BufferAttribute(new Float32Array(CAGE_BOLTS * CAGE_STEPS * 6), 3));
  bolts.frustumCulled = false;
  cage.add(floor, dome, bolts);
  cage.visible = false;
  v.group.add(cage);
  v.cage = { group: cage, bolts };
}

/** Bolts in the cage, and points along each. */
const CAGE_BOLTS = 9, CAGE_STEPS = 7;

/** The cage: bolts arching up from the band on the ground over him, redrawn as they flicker; rising up as it closes. */
function poseCage(cage: NonNullable<TempestView["cage"]>, k: number, t: number): void {
  const R = F.shield.radius / PX_PER_TILE, pos = cage.bolts.geometry.getAttribute("position") as THREE.BufferAttribute;
  cage.group.scale.set(1, Math.min(1, k * 3), 1);
  let n = 0;
  for (let b = 0; b < CAGE_BOLTS; b++) {
    const a = (b / CAGE_BOLTS) * Math.PI * 2 + t * 0.6, lit = Math.sin(t * (17 + b) + b * 5) > -0.2;
    let from = { x: Math.cos(a) * R, y: 0, z: Math.sin(a) * R };
    for (let i = 1; i <= CAGE_STEPS; i++) {
      const p = i / CAGE_STEPS, up = Math.sin(p * Math.PI / 2), r = R * Math.cos(p * Math.PI / 2), j = i === CAGE_STEPS ? 0 : 0.18;
      const to = lit ? { x: Math.cos(a + p * 0.6) * r + (Math.random() - 0.5) * j, y: up * R, z: Math.sin(a + p * 0.6) * r + (Math.random() - 0.5) * j } : from;
      pos.setXYZ(n++, from.x, from.y, from.z);
      pos.setXYZ(n++, to.x, to.y, to.z);
      from = to;
    }
  }
  pos.needsUpdate = true;
}

/** Redraw the bolts round the ring, a few lit at a time, each a jagged line from the ground up into the sky. */
function flickerPillars(v: TempestView, t: number): void {
  const pos = v.pillars!.geometry.getAttribute("position") as THREE.BufferAttribute;
  for (let p = 0; p < PILLARS; p++) {
    const lit = Math.sin(t * (13 + p) + p * 7) > 0.3, a = (p / PILLARS) * Math.PI * 2 + Math.sin(t * 0.3 + p) * 0.05;
    const bx = Math.cos(a) * v.r, bz = Math.sin(a) * v.r;
    let from = { x: bx, y: 0, z: bz };
    for (let i = 1; i <= STEPS; i++) {
      const n = (p * STEPS + i - 1) * 2, j = 0.25;
      const to = lit ? { x: bx + (Math.random() - 0.5) * j, y: i * 0.7, z: bz + (Math.random() - 0.5) * j } : from;
      pos.setXYZ(n, from.x, from.y, from.z);
      pos.setXYZ(n + 1, to.x, to.y, to.z);
      from = to;
    }
  }
  pos.needsUpdate = true;
  v.pillars!.material.opacity = 0.6 + Math.random() * 0.4;
}

/** An iron rod: a dark shaft with fins near the top and a tip that glows, standing a little taller than the hero. */
function makeRod(ctx: RenderContext, parent: THREE.Group): RodMesh {
  const group = new THREE.Group(), iron = ctx.lambert(IRON), tip = ctx.glow(BOLT, { transparent: true, opacity: 0.9 });
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.08, 1.9, 6).translate(0, 0.95, 0), iron);
  const fins = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.3, 4).translate(0, 1.55, 0), iron);
  const ball = new THREE.Mesh(new THREE.IcosahedronGeometry(0.11, 0).translate(0, 1.98, 0), tip);
  const foot = new THREE.Mesh(new THREE.RingGeometry(0.25, 0.42, 16).rotateX(-Math.PI / 2), additive(ctx, TRIM, 0.5, true));
  foot.position.y = 0.03;
  group.add(shaft, fins, ball, foot);
  parent.add(group);
  return { group, tip };
}

/** The rods, driven up out of the ground as they go in, their tips humming. */
function poseRods(ctx: RenderContext, v: TempestView, fight: CalderFight, t: number): void {
  while (v.rods.length < fight.rods.length) v.rods.push(makeRod(ctx, v.group));
  const k = Math.min(1, fight.planted / F.rods.plant), ox = v.group.position.x, oz = v.group.position.z;
  fight.rods.forEach((r, i) => {
    const rod = v.rods[i]!, [x, z] = toWorld(r.x, r.y);
    rod.group.position.set(x - ox, (k - 1) * 2, z - oz);
    rod.tip.opacity = 0.55 + 0.4 * Math.abs(Math.sin(t * 9 + i * 2));
    if (k < 1 && Math.random() < 0.3) ctx.particles.spawn("spark", x, 0.1, z, (Math.random() - 0.5) * 1.5, 1 + Math.random(), (Math.random() - 0.5) * 1.5, 0.5);
  });
}

/** One line of lightning: a mark on the ground along it, a glow under it once it's live, and two jagged strands of bolt. */
function makeArc(ctx: RenderContext, parent: THREE.Group): ArcMesh {
  const group = new THREE.Group();
  // Built along X, one unit long from the origin: stretched and turned to lie along its line.
  const mark = new THREE.Mesh(new THREE.PlaneGeometry(1, 0.22).translate(0.5, 0, 0).rotateX(-Math.PI / 2), additive(ctx, TRIM, 0.4, true));
  const glow = new THREE.Mesh(new THREE.PlaneGeometry(1, 1.1).translate(0.5, 0, 0).rotateX(-Math.PI / 2), additive(ctx, BOLT, 0.5, true));
  mark.position.y = 0.032; glow.position.y = 0.034;
  const bolt = new THREE.LineSegments(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: BOLT, transparent: true, opacity: 1 }));
  bolt.geometry.setAttribute("position", new THREE.Float32BufferAttribute(new Float32Array(STRANDS * ARC_STEPS * 6), 3));
  bolt.frustumCulled = false;
  group.add(mark, glow, bolt);
  parent.add(group);
  return { group, mark, glow, bolt };
}

function poseArcs(ctx: RenderContext, v: TempestView, fight: CalderFight, t: number): void {
  while (v.arcs.length < fight.arcs.length) v.arcs.push(makeArc(ctx, v.group));
  v.arcs.forEach((m, i) => {
    const arc = fight.arcs[i];
    m.group.visible = !!arc;
    if (arc) poseArc(ctx, v, m, arc, t);
  });
}

/** Marked: a crawling flicker along the ground, brighter as it comes, a stray strand of it just before. Live: white-hot, with a glow under it. */
function poseArc(ctx: RenderContext, v: TempestView, m: ArcMesh, arc: Arc, t: number): void {
  const [ax, az] = toWorld(arc.a.x, arc.a.y), [bx, bz] = toWorld(arc.b.x, arc.b.y), ox = v.group.position.x, oz = v.group.position.z;
  const len = Math.hypot(bx - ax, bz - az) || 0.01, yaw = -Math.atan2(bz - az, bx - ax);
  for (const plane of [m.mark, m.glow]) { plane.position.set(ax - ox, plane.position.y, az - oz); plane.rotation.y = yaw; plane.scale.x = len; }
  const live = arc.t >= arc.warn, k = Math.min(1, arc.t / arc.warn);
  m.mark.visible = !live;
  m.mark.material.opacity = (0.2 + 0.4 * k) * (0.6 + 0.4 * Math.sin(t * 40 + k * 10));
  m.glow.visible = live;
  if (live) m.glow.material.opacity = 0.55 * (1 - (arc.t - arc.warn) / arc.live) + 0.15;
  m.bolt.visible = live || (k > 0.5 && Math.sin(t * 60) > 0.6);
  const pos = m.bolt.geometry.getAttribute("position") as THREE.BufferAttribute;
  const nx = -(bz - az) / len, nz = (bx - ax) / len, j = live ? 0.35 : 0.15;
  let n = 0;
  for (let s = 0; s < STRANDS; s++) {
    let from = { x: ax - ox, y: 0.15, z: az - oz };
    for (let i = 1; i <= ARC_STEPS; i++) {
      const f = i / ARC_STEPS, end = i === ARC_STEPS, off = end ? 0 : (Math.random() - 0.5) * j, up = end ? 0.15 : 0.15 + Math.random() * 0.35;
      const to = { x: ax - ox + (bx - ax) * f + nx * off, y: up, z: az - oz + (bz - az) * f + nz * off };
      pos.setXYZ(n++, from.x, from.y, from.z);
      pos.setXYZ(n++, to.x, to.y, to.z);
      from = to;
    }
  }
  pos.needsUpdate = true;
  if (live && Math.random() < 0.25) {
    const f = Math.random();
    ctx.particles.spawn("sparkLight", ax + (bx - ax) * f, 0.2, az + (bz - az) * f, (Math.random() - 0.5) * 1.2, 0.8 + Math.random(), (Math.random() - 0.5) * 1.2, 0.4);
  }
}
