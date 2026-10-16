// The frost of Rime's fight (src/game/rimefight.ts), drawn on the entity made for it at her stage's middle: patches
// of frost creeping over the ice (a ring on the ice, filling white), then setting hard (a cluster of ice crystals
// standing up out of it for a moment); and once she's fallen, the ring of the lake thawed to open water round where
// she stood, its edge broken into floes.
import * as THREE from "three";
import { RIME_FIGHT as F } from "../data/hollow.ts";
import { Tile } from "../data/world.ts";
import { fellAt } from "../game/bosses.ts";
import { inThaw, rimeFight, type Patch, type RimeFight } from "../game/rimefight.ts";
import { GROUND, PX_PER_TILE, onGround, toWorld, type RenderContext } from "./context.ts";
import type { TileMap } from "../world/map.ts";
import { disposeTree } from "./dispose.ts";
import { hash } from "./terrain.ts";
import type { EntityView } from "./views.ts";

const FROST = "#dff6ff", GLINT = "#9fe3ff";

interface PatchMesh { group: THREE.Group; edge: THREE.Mesh; fill: THREE.Mesh; crystals: THREE.Group; mats: THREE.MeshBasicMaterial[] }
export interface RimeFrostView {
  group: THREE.Group;
  patches: PatchMesh[];
  /** The thawed ring, once she's fallen (built the first time it's needed), and how far it's faded in. */
  thaw: THREE.Group | null;
  thawK: number;
}

function makePatch(ctx: RenderContext, parent: THREE.Group): PatchMesh {
  const R = F.patch.radius / PX_PER_TILE, group = new THREE.Group();
  const decal = { transparent: true, depthWrite: false, ...onGround(GROUND.marker) };
  const edgeMat = ctx.glow(GLINT, { ...decal, opacity: 0.8 }), fillMat = ctx.glow(FROST, { ...decal, opacity: 0.45 });
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
    return { group, patches: [], thaw: null, thawK: 0 };
  },
  update(ctx, v, e, g, f) {
    const fight = rimeFight(g), fell = fellAt(g, "rime");
    const patches = fight && fight.view === e ? fight.patches : [];
    while (v.patches.length < patches.length) v.patches.push(makePatch(ctx, v.group));
    while (v.patches.length > patches.length) { const m = v.patches.pop()!; m.group.removeFromParent(); disposeTree(m.group); }
    if (fight) patches.forEach((pa, i) => posePatch(v.patches[i]!, fight, pa, f.t));
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
    ctx.scene.remove(v.group);
    disposeTree(v.group);
  },
};
