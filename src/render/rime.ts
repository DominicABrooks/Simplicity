// The frost of Rime's fight (src/game/rimefight.ts), drawn on the entity made for it at her arena's middle: the wall
// of ice shooting up all round between the pillars (and shattering when she falls); patches of frost creeping over
// the ice (a ring on the ice, filling white), then setting hard (a cluster of ice crystals
// standing up out of it for a moment); and once she's fallen, the ring of the lake thawed to open water round where
// she stood, its edge broken into floes.
import * as THREE from "three";
import { RIME_FIGHT as F } from "../data/hollow.ts";
import { Tile } from "../data/world.ts";
import { fellAt } from "../game/bosses.ts";
import { inThaw, rimeFight, type Fall, type Patch, type RimeFight } from "../game/rimefight.ts";
import { GROUND, PX_PER_TILE, onGround, toWorld, type RenderContext } from "./context.ts";
import type { TileMap } from "../world/map.ts";
import { disposeTree } from "./dispose.ts";
import { hash } from "./terrain.ts";
import type { EntityView } from "./views.ts";

const FROST = "#dff6ff", GLINT = "#9fe3ff";
/**
 * What warns on the ice, where white and cyan vanish: a deep indigo (the edge pulsing, the fill gathering), so a patch
 * about to set or an icicle about to land reads at a glance on the white.
 */
const WARN_EDGE = "#3348c8", WARN_FILL = "#2a3590";

interface PatchMesh { group: THREE.Group; edge: THREE.Mesh; fill: THREE.Mesh; crystals: THREE.Group; mats: THREE.MeshBasicMaterial[] }
interface FallMesh { group: THREE.Group; edge: THREE.Mesh; fill: THREE.Mesh; icicle: THREE.Mesh; shards: THREE.Group; mats: THREE.MeshBasicMaterial[] }
export interface RimeFrostView {
  group: THREE.Group;
  patches: PatchMesh[];
  falls: FallMesh[];
  /** The wall of ice between the pillars, while the fight's on, its shards, and how far round it stands (tiles). */
  wall: THREE.Group | null;
  shards: THREE.Mesh[];
  ringR: number;
  /** The thawed ring, once she's fallen (built the first time it's needed), and how far it's faded in. */
  thaw: THREE.Group | null;
  thawK: number;
}

function makePatch(ctx: RenderContext, parent: THREE.Group): PatchMesh {
  const R = F.patch.radius / PX_PER_TILE, group = new THREE.Group();
  const decal = { transparent: true, depthWrite: false, ...onGround(GROUND.marker) };
  const edgeMat = ctx.basic(WARN_EDGE, { ...decal, opacity: 0.8 }), fillMat = ctx.basic(WARN_FILL, { ...decal, opacity: 0.45 });
  const crystalMat = ctx.glow(FROST, { transparent: true, opacity: 0.9 });
  const edge = new THREE.Mesh(new THREE.RingGeometry(R - 0.08, R, 20).rotateX(-Math.PI / 2), edgeMat);
  const fill = new THREE.Mesh(new THREE.CircleGeometry(R, 20).rotateX(-Math.PI / 2), fillMat);
  edge.position.y = fill.position.y = 0.035;
  // Set hard: a cluster of ice crystals standing up out of it, leaning out from the middle.
  const crystals = new THREE.Group();
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2, d = i ? R * 0.55 : 0, h = i ? 0.35 + (i % 3) * 0.12 : 0.6;
    const c = new THREE.Mesh(new THREE.ConeGeometry(0.08, h, 4).translate(0, h / 2, 0), crystalMat);
    c.position.set(Math.cos(a) * d, 0, Math.sin(a) * d);
    c.rotation.set(Math.sin(a) * 0.35 * (i ? 1 : 0), 0, -Math.cos(a) * 0.35 * (i ? 1 : 0));
    crystals.add(c);
  }
  group.add(edge, fill, crystals);
  parent.add(group);
  return { group, edge, fill, crystals, mats: [edgeMat, fillMat, crystalMat] };
}

function posePatch(m: PatchMesh, f: RimeFight, pa: Patch, t: number): void {
  m.group.position.set((pa.x - f.x) / PX_PER_TILE, 0, (pa.y - f.y) / PX_PER_TILE);
  const creeping = pa.t < F.patch.warn, after = pa.t - F.patch.warn;
  m.edge.visible = creeping;
  m.fill.scale.setScalar(creeping ? Math.max(0.01, pa.t / F.patch.warn) : 1);    // creeping in toward its edge
  m.mats[0]!.opacity = 0.55 + Math.sin(t * 20) * 0.3;
  m.mats[1]!.opacity = creeping ? 0.3 + 0.25 * (pa.t / F.patch.warn) : 0.6 * Math.max(0, 1 - after / F.patch.hold);
  m.crystals.visible = !creeping;
  const rise = Math.min(1, after / 0.15), fade = Math.max(0, Math.min(1, (F.patch.hold - after) / 0.5));
  m.crystals.scale.set(1, rise * fade + 0.01, 1);
  m.mats[2]!.opacity = 0.9 * fade;
}

/** A falling icicle: a ring on the ice filling as its shadow gathers, the icicle dropping out of the cold, then its shards. */
function makeFall(ctx: RenderContext, parent: THREE.Group): FallMesh {
  const R = F.block.falls.radius / PX_PER_TILE, group = new THREE.Group();
  const decal = { transparent: true, depthWrite: false, ...onGround(GROUND.marker) };
  const edgeMat = ctx.basic(WARN_EDGE, { ...decal, opacity: 0.85 }), fillMat = ctx.basic(WARN_FILL, { ...decal, opacity: 0.4 }), iceMat = ctx.glow(FROST, { transparent: true, opacity: 0.95 });
  const edge = new THREE.Mesh(new THREE.RingGeometry(R - 0.07, R, 18).rotateX(-Math.PI / 2), edgeMat);
  const fill = new THREE.Mesh(new THREE.CircleGeometry(R, 18).rotateX(-Math.PI / 2), fillMat);
  edge.position.y = fill.position.y = 0.036;
  const icicle = new THREE.Mesh(new THREE.ConeGeometry(0.16, 1.1, 5).rotateX(Math.PI).translate(0, 0.55, 0), iceMat);   // point down
  const shards = new THREE.Group();
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2, s = new THREE.Mesh(new THREE.OctahedronGeometry(0.07, 0), iceMat);
    s.position.set(Math.cos(a) * R * 0.5, 0.05, Math.sin(a) * R * 0.5);
    s.scale.set(1, 1.8, 1);
    shards.add(s);
  }
  group.add(edge, fill, icicle, shards);
  parent.add(group);
  return { group, edge, fill, icicle, shards, mats: [edgeMat, fillMat, iceMat] };
}

function poseFall(m: FallMesh, f: RimeFight, fa: Fall, t: number): void {
  const L = F.block.falls, falling = fa.t < L.warn, after = fa.t - L.warn;
  m.group.position.set((fa.x - f.x) / PX_PER_TILE, 0, (fa.y - f.y) / PX_PER_TILE);
  m.edge.visible = m.fill.visible = falling;
  m.fill.scale.setScalar(Math.max(0.01, fa.t / L.warn));            // its shadow gathering
  m.mats[0]!.opacity = 0.55 + Math.sin(t * 24) * 0.3;
  const drop = Math.max(0, (fa.t - (L.warn - 0.3)) / 0.3);           // it drops in the last moment
  m.icicle.visible = falling && drop > 0;
  m.icicle.position.y = (1 - drop) * 4;
  m.shards.visible = !falling;
  m.shards.children.forEach((s, i) => { s.position.y = 0.05 + Math.max(0, Math.sin(Math.min(1, after / L.shatter) * Math.PI)) * 0.3 * (1 + (i % 2)); });
  m.mats[2]!.opacity = falling ? 0.95 : 0.95 * Math.max(0, 1 - after / L.shatter);
}

/** The thawed ring: open water over the ice tiles it covers, and floes of broken ice along its edges. Local to the group (at where she fell). */
function makeThaw(ctx: RenderContext, map: TileMap, at: { x: number; y: number }): THREE.Group {
  const group = new THREE.Group(), [cx, cz] = toWorld(at.x, at.y);
  const thaws = (x: number, y: number) => map.tiles[y]?.[x] === Tile.Ice && inThaw(x, y, cx, cz);
  const pos: number[] = [], uv: number[] = [];
  // Over the stage's frost bloom: a dark bed of deep water, and the water's moving surface over it. Faded in (see update).
  const bed = ctx.basic("#1b3247", { transparent: true, opacity: 0, depthWrite: false, ...onGround(GROUND.shadow) });
  const water = ctx.lambert("#ffffff", { map: ctx.tex.water, transparent: true, opacity: 0, depthWrite: false, ...onGround(GROUND.shadow) });
  bed.userData.full = 1; water.userData.full = 0.7;
  const floeMat = ctx.lambert("#e8f4f9"), floeGeo = new THREE.BoxGeometry(1, 1, 1);
  for (let y = 0; y < map.height; y++) for (let x = 0; x < map.width; x++) {
    if (!thaws(x, y)) continue;
    const x0 = x - cx, z0 = y - cz;
    for (const [i, j] of [[0, 0], [0, 1], [1, 1], [0, 0], [1, 1], [1, 0]] as const) { pos.push(x0 + i, 0.017, z0 + j); uv.push((x + i) / 4, (y + j) / 4); }
    // Floes along the edge, where the thaw meets ice that held.
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      if (thaws(x + dx, y + dy) || map.tiles[y + dy]?.[x + dx] !== Tile.Ice || hash(x * 2 + dx, y * 2 + dy, 431) > 0.7) continue;
      const k = hash(x, y + dx * 3 + dy, 432), floe = new THREE.Mesh(floeGeo, floeMat);
      floe.position.set(x0 + 0.5 + dx * 0.38, 0.02, z0 + 0.5 + dy * 0.38);
      floe.scale.set(0.25 + k * 0.25, 0.05, 0.2 + (1 - k) * 0.2);
      floe.rotation.y = k * Math.PI;
      group.add(floe);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  geo.computeVertexNormals();
  group.add(new THREE.Mesh(geo, bed));
  const surface = new THREE.Mesh(geo, water);
  surface.position.y = 0.001;
  group.add(surface);
  return group;
}

export const rimefrost: EntityView<RimeFrostView> = {
  create(ctx, e, g) {
    const group = new THREE.Group(), t = g.world.need(e, "transform");
    const [x, z] = toWorld(t.x, t.y);
    group.position.set(x, 0, z);
    ctx.scene.add(group);
    const stage = g.area.layout.props.find(p => p.kind === "rimeStage"), ringR = stage?.kind === "rimeStage" ? stage.radius : F.keepIn / PX_PER_TILE + 1;
    const v: RimeFrostView = { group, wall: null, shards: [], ringR, patches: [], falls: [], thaw: null, thawK: 0 };
    if (rimeFight(g)?.view === e) makeWall(ctx, v);
    return v;
  },
  update(ctx, v, e, g, f) {
    const fight = rimeFight(g), fell = fellAt(g, "rime");
    const patches = fight && fight.view === e ? fight.patches : [];
    while (v.patches.length < patches.length) v.patches.push(makePatch(ctx, v.group));
    while (v.patches.length > patches.length) { const m = v.patches.pop()!; m.group.removeFromParent(); disposeTree(m.group); }
    if (fight) patches.forEach((pa, i) => posePatch(v.patches[i]!, fight, pa, f.t));
    const falls = fight && fight.view === e ? fight.falls : [];
    while (v.falls.length < falls.length) v.falls.push(makeFall(ctx, v.group));
    while (v.falls.length > falls.length) { const m = v.falls.pop()!; m.group.removeFromParent(); disposeTree(m.group); }
    if (fight) falls.forEach((fa, i) => poseFall(v.falls[i]!, fight, fa, f.t));
    if (v.wall && fight) {                                    // shooting up as the ice shuts him in, then glinting
      v.wall.scale.y = Math.min(1, fight.t * 2.2);
      v.shards.forEach((s, i) => { s.rotation.y = Math.sin(f.t * 0.6 + i) * 0.15; });
      if (Math.random() < f.dt * 10) {                        // frost smoking off it
        const a = Math.random() * Math.PI * 2;
        ctx.particles.spawn("snow", v.group.position.x + Math.cos(a) * v.ringR, 0.4 + Math.random() * 0.6, v.group.position.z + Math.sin(a) * v.ringR, 0, 0.5 + Math.random() * 0.5, 0, 0.9);
      }
    }
    if (fell && !v.thaw && !fight) {
      const at = g.world.need(e, "transform");
      v.thaw = makeThaw(ctx, g.area.layout.map, at);
      v.group.add(v.thaw);
    }
    if (v.thaw) {                                             // fading in as the ice gives way
      v.thawK = Math.min(1, v.thawK + f.dt / 1.5);
      v.thaw.traverse(o => { if (o instanceof THREE.Mesh && typeof o.material.userData.full === "number") o.material.opacity = o.material.userData.full * v.thawK; });
    }
  },
  remove(ctx, v) {
    if (v.wall) for (let i = 0; i < 40; i++) {                // the wall shatters
      const a = (i / 40) * Math.PI * 2;
      ctx.particles.spawn(i % 2 ? "ice" : "snow", v.group.position.x + Math.cos(a) * v.ringR, 0.2 + Math.random() * 0.9, v.group.position.z + Math.sin(a) * v.ringR,
        Math.cos(a) * (0.6 + Math.random()), 0.8 + Math.random() * 1.2, Math.sin(a) * (0.6 + Math.random()), 0.9);
    }
    ctx.scene.remove(v.group);
    disposeTree(v.group);
  },
};

/** The wall of ice: a pale band glowing on the ice all the way round, and a crowd of jagged shards standing up out of it. */
function makeWall(ctx: RenderContext, v: RimeFrostView): void {
  const wall = new THREE.Group(), R = v.ringR;
  wall.add(new THREE.Mesh(new THREE.RingGeometry(R - 0.4, R + 0.4, 48).rotateX(-Math.PI / 2),
    ctx.glow(GLINT, { transparent: true, opacity: 0.35, depthWrite: false, blending: THREE.AdditiveBlending, ...onGround(GROUND.marker) })));
  const mats = [ctx.lambert("#d8eef7", { transparent: true, opacity: 0.85 }), ctx.lambert("#9cc6dc", { transparent: true, opacity: 0.9 }), ctx.glow("#c9f3ff", { transparent: true, opacity: 0.8 })];
  for (let i = 0; i < 64; i++) {
    const a = (i / 64) * Math.PI * 2, k = hash(i, 3, 441), h = 0.45 + k * 0.75, d = R + (k - 0.5) * 0.35;
    const s = new THREE.Mesh(new THREE.ConeGeometry(0.13 - (i % 3) * 0.025, h, 4).translate(0, h / 2, 0), mats[i % 3]!);
    s.position.set(Math.cos(a) * d, 0, Math.sin(a) * d);
    s.rotation.set(Math.sin(a) * 0.25 * (k - 0.5), k * 3, -Math.cos(a) * 0.25 * (k - 0.5));
    v.shards.push(s);
    wall.add(s);
  }
  wall.scale.y = 0.01;
  v.group.add(wall);
  v.wall = wall;
}
