// The fire of Cinder's fight (src/game/cinderfight.ts), drawn on the entity made for it at the circle's
// middle: a ring of flame leaping up between the stones, the spots about to erupt (a ring on the ground
// filling, then a column of fire and a patch left burning), the walls of fire (smouldering low at
// their edge, then rising and sweeping across), and in the inferno the wheel of fire's spokes, turning from the middle.
import * as THREE from "three";
import { CINDER_FIGHT as F } from "../data/ashwild.ts";
import { PAL } from "../data/palette.ts";
import { beamAt, cinderFight, spokesOf, wheelStill, type Beam, type CinderFight, type Flare } from "../game/cinderfight.ts";
import { GROUND, PX_PER_TILE, onGround, toWorld, type RenderContext } from "./context.ts";
import { disposeTree } from "./dispose.ts";
import { hash } from "./terrain.ts";
import type { EntityView } from "./views.ts";

const FIRE = "#ff7a2a";
const additive = (ctx: RenderContext, c: string, opacity: number, ground = false) =>
  ctx.glow(c, { transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending, ...(ground ? onGround(GROUND.marker) : {}) });

interface FlareMesh { group: THREE.Group; edge: THREE.Mesh; fill: THREE.Mesh; column: THREE.Mesh; burn: THREE.Group; mats: THREE.MeshBasicMaterial[] }
interface BeamMesh { group: THREE.Group; warn: THREE.Mesh; wall: THREE.Group; flames: THREE.Mesh[]; mats: THREE.MeshBasicMaterial[] }
export interface BlazeView {
  group: THREE.Group;
  /** The ring of fire between the stones. */
  wall: THREE.Group;
  wallFlames: THREE.Mesh[];
  /** How far out the ring of fire stands (tiles). */
  ringR: number;
  flares: FlareMesh[];
  beams: BeamMesh[];
  /** The inferno's spokes of fire: walls like the sweeping ones, run out from the middle to the fire. */
  spokes: BeamMesh[];
}

function makeFlare(ctx: RenderContext, parent: THREE.Group): FlareMesh {
  const R = F.flare.radius / PX_PER_TILE, group = new THREE.Group();
  const edgeMat = additive(ctx, PAL.R, 0.9, true), fillMat = additive(ctx, PAL.O, 0.35, true), colMat = additive(ctx, PAL.Y, 0.9);
  const edge = new THREE.Mesh(new THREE.RingGeometry(R - 0.1, R, 20).rotateX(-Math.PI / 2), edgeMat);
  const fill = new THREE.Mesh(new THREE.CircleGeometry(R, 20).rotateX(-Math.PI / 2), fillMat);
  edge.position.y = fill.position.y = 0.035;
  const column = new THREE.Mesh(new THREE.CylinderGeometry(R * 0.55, R * 0.9, 2.2, 7, 1, true).translate(0, 1.1, 0), colMat);
  const burn = new THREE.Group(), burnMat = additive(ctx, FIRE, 0.85);
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2, d = i ? R * 0.5 : 0, h = 0.35 + (i % 2) * 0.15;
    const m = new THREE.Mesh(new THREE.ConeGeometry(0.12, h, 5).translate(0, h / 2, 0), burnMat);
    m.position.set(Math.cos(a) * d, 0, Math.sin(a) * d);
    burn.add(m);
  }
  group.add(edge, fill, column, burn);
  parent.add(group);
  return { group, edge, fill, column, burn, mats: [edgeMat, fillMat, colMat, burnMat] };
}

function makeBeam(ctx: RenderContext, parent: THREE.Group): BeamMesh {
  // Built along X, one tile long: stretched to the chord of the circle where it stands, turned for its sweep.
  const group = new THREE.Group(), wall = new THREE.Group();
  const warnMat = additive(ctx, PAL.R, 0.6, true), coreMat = additive(ctx, PAL.Y, 0.8), floorMat = additive(ctx, FIRE, 0.5, true);
  const flameMats = [additive(ctx, PAL.R, 0.85), additive(ctx, PAL.O, 0.9), additive(ctx, PAL.Y, 0.9)];
  const warn = new THREE.Mesh(new THREE.PlaneGeometry(1, 0.35).rotateX(-Math.PI / 2), warnMat);
  warn.position.y = 0.036;
  // A glowing seam along the ground, a low white-hot core, and a crowd of flames of all heights over it.
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(1, 0.7).rotateX(-Math.PI / 2), floorMat);
  floor.position.y = 0.037;
  wall.add(floor, new THREE.Mesh(new THREE.BoxGeometry(1, 0.28, 0.1).translate(0, 0.14, 0), coreMat));
  const flames: THREE.Mesh[] = [];
  for (let i = 0; i < 30; i++) {
    const k = hash(i, 1, 411), h = 0.5 + k * 0.9, m = new THREE.Mesh(new THREE.ConeGeometry(0.13 - (i % 3) * 0.025, h, 5).translate(0, h / 2, 0), flameMats[i % 3]!);
    m.position.set(i / 29 - 0.5, 0, (hash(i, 2, 413) - 0.5) * 0.18);   // across the wall's unit length; scaled with it
    flames.push(m);
    wall.add(m);
  }
  group.add(warn, wall);
  parent.add(group);
  return { group, warn, wall, flames, mats: [warnMat, coreMat, floorMat, ...flameMats] };
}

/** Grow or shrink a pool of meshes to fit how many there are now. */
function fit<M extends { group: THREE.Group }>(pool: M[], n: number, make: () => M): void {
  while (pool.length < n) pool.push(make());
  while (pool.length > n) { const m = pool.pop()!; m.group.removeFromParent(); disposeTree(m.group); }
}

function poseFlare(m: FlareMesh, f: CinderFight, fl: Flare, t: number): void {
  m.group.position.set((fl.x - f.x) / PX_PER_TILE, 0, (fl.y - f.y) / PX_PER_TILE);
  const warning = fl.t < F.flare.warn, after = fl.t - F.flare.warn;
  m.edge.visible = m.fill.visible = warning;
  m.fill.scale.setScalar(Math.max(0.01, fl.t / F.flare.warn));        // fills as it's about to go
  m.mats[0]!.opacity = 0.6 + Math.sin(t * 28) * 0.3;
  m.column.visible = !warning && after < 0.35;
  m.mats[2]!.opacity = 0.9 * (1 - after / 0.35);
  m.column.scale.set(1, 0.4 + after * 3, 1);
  m.burn.visible = !warning;
  const fade = Math.min(1, (F.flare.burn - after) / 0.4);
  m.mats[3]!.opacity = 0.85 * Math.max(0, fade);
  m.burn.children.forEach((c, i) => { c.scale.y = 0.7 + Math.sin(t * (13 + i * 3) + i) * 0.3; });
}

function poseBeam(ctx: RenderContext, m: BeamMesh, f: CinderFight, b: Beam, ringR: number, t: number): void {
  const across = b.dir === "east" || b.dir === "west";
  const line = (beamAt(f, b) - (across ? f.x : f.y)) / PX_PER_TILE;
  const chord = 2 * Math.sqrt(Math.max(0.25, ringR * ringR - line * line));
  m.group.rotation.y = across ? Math.PI / 2 : 0;
  m.group.position.set(across ? line : 0, 0, across ? 0 : line);
  m.group.scale.set(chord, 1, 1);
  const warning = b.t < F.beam.warn, k = warning ? b.t / F.beam.warn : 1;
  m.warn.visible = warning;
  m.mats[0]!.opacity = 0.35 + Math.sin(t * 20) * 0.25;
  // Smouldering low at its edge while it warns, then up it goes.
  m.wall.scale.y = warning ? 0.15 + k * 0.2 : 1 + Math.sin(t * 17) * 0.06;
  m.flames.forEach((fl, i) => { fl.scale.set(1 / chord, 0.75 + Math.sin(t * (11 + (i % 4) * 3) + i) * 0.25, 1); });
  if (!warning && Math.random() < 0.6) {                      // sparks flying off it
    const [cx, cz] = toWorld(f.x, f.y), along = (Math.random() - 0.5) * chord;
    const x = cx + (across ? line : along), z = cz + (across ? along : line);
    ctx.particles.spawn(Math.random() < 0.5 ? "fire" : "ember", x, 0.3 + Math.random() * 0.8, z, (Math.random() - 0.5) * 0.6, 1.5 + Math.random(), (Math.random() - 0.5) * 0.6, 0.5);
  }
}

/**
 * A spoke of the wheel: a wall of fire from the middle out to the ring, at game angle `a`; low and smouldering while it
 * warns (`up`, growing as it comes), and flickering while the wheel stands still to turn back.
 */
function poseSpoke(ctx: RenderContext, m: BeamMesh, f: CinderFight, a: number, live: boolean, up: number, t: number): void {
  const len = f.r / PX_PER_TILE, warning = !live, still = wheelStill(f);
  m.group.rotation.y = -a;
  m.group.position.set(Math.cos(a) * len / 2, 0, Math.sin(a) * len / 2);
  m.group.scale.set(len, 1, 1);
  m.warn.visible = warning;
  m.mats[0]!.opacity = 0.35 + Math.sin(t * 20) * 0.25;
  m.wall.scale.y = warning ? 0.1 + 0.3 * up : still ? 0.75 + Math.abs(Math.sin(t * 9)) * 0.55 : 1.1 + Math.sin(t * 17 + a) * 0.08;
  m.flames.forEach((fl, i) => { fl.scale.set(1 / len, 0.75 + Math.sin(t * (11 + (i % 4) * 3) + i) * 0.25, 1); });
  if (!warning && Math.random() < 0.5) {                      // sparks thrown off it as it turns
    const [cx, cz] = toWorld(f.x, f.y), along = Math.random() * len;
    ctx.particles.spawn(Math.random() < 0.5 ? "fire" : "ember", cx + Math.cos(a) * along, 0.3 + Math.random() * 0.8, cz + Math.sin(a) * along, (Math.random() - 0.5) * 0.6, 1.5 + Math.random(), (Math.random() - 0.5) * 0.6, 0.5);
  }
}

export const blaze: EntityView<BlazeView> = {
  create(ctx, e, g) {
    const group = new THREE.Group(), wall = new THREE.Group();
    const arena = g.area.layout.props.find(p => p.kind === "arena"), ringR = arena?.kind === "arena" ? arena.radius : F.keepIn / PX_PER_TILE + 1;
    // The ring of fire, all the way round between the stones, and its glow on the ground.
    wall.add(new THREE.Mesh(new THREE.RingGeometry(ringR - 0.45, ringR + 0.45, 48).rotateX(-Math.PI / 2), additive(ctx, FIRE, 0.45, true)));
    const mats = [additive(ctx, PAL.R, 0.85), additive(ctx, PAL.O, 0.9), additive(ctx, PAL.Y, 0.9)], wallFlames: THREE.Mesh[] = [];
    for (let i = 0; i < 56; i++) {
      const a = (i / 56) * Math.PI * 2, k = hash(i, 2, 412), h = 0.6 + k * 0.7;
      const m = new THREE.Mesh(new THREE.ConeGeometry(0.16 - (i % 3) * 0.03, h, 5).translate(0, h / 2, 0), mats[i % 3]!);
      m.position.set(Math.cos(a) * (ringR + (k - 0.5) * 0.3), 0, Math.sin(a) * (ringR + (k - 0.5) * 0.3));
      wallFlames.push(m);
      wall.add(m);
    }
    wall.scale.y = 0.01;
    group.add(wall);
    const [x, z] = toWorld(g.world.need(e, "transform").x, g.world.need(e, "transform").y);
    group.position.set(x, 0, z);
    ctx.scene.add(group);
    return { group, wall, wallFlames, ringR, flares: [], beams: [], spokes: [] };
  },
  update(ctx, v, _e, g, f) {
    const fight = cinderFight(g);
    if (!fight) return;
    v.wall.scale.y = Math.min(1, fight.t * 1.8);               // leaping up as the circle shuts
    v.wallFlames.forEach((m, i) => { m.scale.set(1, 0.75 + Math.sin(f.t * (9 + (i % 5) * 2) + i * 1.7) * 0.25, 1); });
    if (Math.random() < f.dt * 12) {                           // embers off the ring
      const a = Math.random() * Math.PI * 2;
      ctx.particles.spawn("ember", v.group.position.x + Math.cos(a) * v.ringR, 0.8, v.group.position.z + Math.sin(a) * v.ringR, 0, 1.2 + Math.random(), 0, 0.6);
    }
    fit(v.flares, fight.flares.length, () => makeFlare(ctx, v.group));
    fight.flares.forEach((fl, i) => poseFlare(v.flares[i]!, fight, fl, f.t));
    fit(v.beams, fight.beams.length, () => makeBeam(ctx, v.group));
    fight.beams.forEach((b, i) => poseBeam(ctx, v.beams[i]!, fight, b, v.ringR, f.t));
    const spokes = spokesOf(fight);
    fit(v.spokes, spokes.length, () => makeBeam(ctx, v.group));
    spokes.forEach((s, i) => poseSpoke(ctx, v.spokes[i]!, fight, s.a, s.live, s.up, f.t));
  },
  remove(ctx, v) {
    ctx.scene.remove(v.group);
    disposeTree(v.group);
  },
};
