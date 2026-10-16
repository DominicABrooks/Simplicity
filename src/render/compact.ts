// Compacting an area's scenery once it's built. Buildings are made of many small meshes (every window,
// shutter, sill and beam), which is easy to build with but costs a draw call and a culling test each:
// a city quarter would have tens of thousands. So, once built, each building's still meshes are merged
// into one mesh per material: the same triangles, a few draw calls per building.
//
// "Per material" is per look: builders make a fresh material for every part (a stall's posts, its counter, each
// apple on it), so meshes merge when their materials would draw the same (same colour, texture, sides,
// transparency, shader kind...), not only when they share one. Except where something may change a material
// later: a prop that animates (its update may swap or recolour its own, by the hour as a lamp does) only merges
// meshes sharing the very same material, and so does any material its updates were seen to change.
//
// Two things are kept as they are. What moves (a flag, a mill's sails, a horse's tail) is found by running
// every prop's animation for a moment and seeing what changed, and left alone. And each fading unit (an
// occluder's object: a house, a run of wall, a tower) is merged within itself and keeps its own
// materials, so it still fades on its own when it's in your way.
import * as THREE from "three";

type Update = (t: number, dt: number) => void;

/**
 * Merge `root`'s still meshes, per unit and per look. `units` are the objects that fade alone; `skip` is left
 * untouched; `lively` are the objects of props that animate (see above).
 */
export function compactScenery(root: THREE.Object3D, units: readonly THREE.Object3D[], updates: readonly Update[], skip: readonly THREE.Object3D[] = [], lively: readonly THREE.Object3D[] = []): void {
  root.updateMatrixWorld(true);
  const { moving, changed } = findMoving(root, updates);
  const unitSet = new Set(units), skipSet = new Set(skip), livelySet = new Set(lively);
  // Every still mesh, sorted by the unit it fades with (its nearest unit above it, or the root) and its look.
  // Each unit's meshes of one look take the first one's material: one the unit already had, so each still fades alone.
  const groups = new Map<THREE.Object3D, Map<THREE.Material | string, THREE.Mesh[]>>();
  const visit = (o: THREE.Object3D, unit: THREE.Object3D, live: boolean) => {
    if (skipSet.has(o) || moving.has(o)) return;
    const u = unitSet.has(o) ? o : unit, l = live || livelySet.has(o);
    if (o instanceof THREE.Mesh && !(o instanceof THREE.InstancedMesh) && !Array.isArray(o.material) && o.visible) {
      let byLook = groups.get(u);
      if (!byLook) groups.set(u, (byLook = new Map()));
      const material = o.material as THREE.Material, key = (!l && !changed.has(material) && lookOf(material)) || material;
      const list = byLook.get(key);
      if (list) list.push(o); else byLook.set(key, [o]);
    }
    for (const c of [...o.children]) visit(c, u, l);
  };
  visit(root, root, false);

  const inverse = new THREE.Matrix4(), rel = new THREE.Matrix4(), dropped = new Set<THREE.BufferGeometry>(), droppedMats = new Set<THREE.Material>();
  for (const [unit, byLook] of groups) {
    inverse.copy(unit.matrixWorld).invert();
    for (const meshes of byLook.values()) {
      if (meshes.length < 2) continue;
      const material = meshes[0]!.material as THREE.Material;
      const parts = meshes.map(m => {
        rel.multiplyMatrices(inverse, m.matrixWorld);
        const g = (m.geometry.index ? m.geometry.toNonIndexed() : m.geometry.clone()).applyMatrix4(rel);
        if (!g.attributes.normal) g.computeVertexNormals();
        return g;
      });
      const merged = new THREE.Mesh(mergeParts(parts), material);
      merged.renderOrder = meshes[0]!.renderOrder;
      merged.matrixAutoUpdate = false;                       // where its unit is: it never moves of itself
      unit.add(merged);
      for (const g of parts) g.dispose();
      for (const m of meshes) { dropped.add(m.geometry); droppedMats.add(m.material as THREE.Material); m.removeFromParent(); }
    }
  }
  // Free the merged meshes' old geometries and materials, unless something still standing uses one.
  const inUse = new Set<unknown>();
  root.traverse(o => { if (o instanceof THREE.Mesh) { inUse.add(o.geometry); for (const m of [o.material].flat()) inUse.add(m); } });
  for (const g of dropped) if (!inUse.has(g)) g.dispose();
  for (const m of droppedMats) if (!inUse.has(m)) m.dispose();
}

/**
 * Freeze what never moves: everything under `root` but the lively props (see above), its matrices worked out
 * once and then left alone, so a frame neither recomputes nor even visits them. Those props are left to
 * themselves: their updates may move a part only now and then (a lamp's flame flickers only while it's lit).
 */
export function freezeScenery(root: THREE.Object3D, lively: readonly THREE.Object3D[]): void {
  root.updateMatrixWorld(true);
  const livelySet = new Set(lively);
  for (const c of root.children) {
    if (livelySet.has(c)) continue;
    c.traverse(o => { o.matrixAutoUpdate = false; o.matrixWorldAutoUpdate = false; });
  }
}

/**
 * What a material looks like, as a key: two that would draw the same have the same one. Only for the plain
 * materials of the render context (lambert, basic, glow): null for anything else, which merges by identity.
 */
function lookOf(m: THREE.Material): string | null {
  if (!(m instanceof THREE.MeshLambertMaterial || m instanceof THREE.MeshBasicMaterial)) return null;
  const program = m.customProgramCacheKey();
  if (!program.startsWith("ps1-") || Object.keys(m.userData).length) return null;
  const tex = (t: THREE.Texture | null) => t?.uuid ?? "";
  const lambert = m instanceof THREE.MeshLambertMaterial ? [m.emissive.getHexString(), m.emissiveIntensity, tex(m.emissiveMap), m.flatShading] : [];
  return JSON.stringify([
    m.type, program, m.color.getHexString(), tex(m.map), tex(m.alphaMap), tex(m.lightMap), tex(m.aoMap), tex(m.envMap), tex(m.specularMap),
    m.side, m.transparent, m.opacity, m.alphaTest, m.vertexColors, m.blending, m.depthWrite, m.depthTest, m.colorWrite,
    m.polygonOffset, m.polygonOffsetFactor, m.polygonOffsetUnits, m.dithering, m.fog, m.wireframe, m.toneMapped, m.premultipliedAlpha,
    m.alphaToCoverage, m.stencilWrite, m.visible, m.combine, m.reflectivity, ...lambert,
  ]);
}

/** The state of a material an update might change. */
const materialState = (m: THREE.Material) => {
  const c = m as THREE.Material & { color?: THREE.Color; emissive?: THREE.Color; map?: THREE.Texture | null };
  return [c.color?.getHex(), c.emissive?.getHex(), c.map?.uuid, m.opacity, m.transparent, m.visible, m.side, m.depthWrite].join();
};

/** Run every update at a few moments and see which objects moved, turned or changed size, and which materials changed. */
function findMoving(root: THREE.Object3D, updates: readonly Update[]): { moving: Set<THREE.Object3D>; changed: Set<THREE.Material> } {
  const before = new Map<THREE.Object3D, number[]>(), looks = new Map<THREE.Material, string[]>();
  const snap = (o: THREE.Object3D) => [...o.position.toArray(), ...o.quaternion.toArray(), ...o.scale.toArray()];
  // A material's state at each moment ("" where no mesh wore it then: it was swapped in or out).
  const look = (at: number) => root.traverse(o => {
    if (!(o instanceof THREE.Mesh)) return;
    for (const m of [o.material].flat() as THREE.Material[]) {
      const l = looks.get(m) ?? looks.set(m, []).get(m)!;
      l[at] = materialState(m);
    }
  });
  root.traverse(o => before.set(o, snap(o)));
  look(0);
  [0.37, 1.93, 4.1].forEach((t, i) => { for (const u of updates) u(t, 1 / 60); look(i + 1); });
  const moving = new Set<THREE.Object3D>(), changed = new Set<THREE.Material>();
  root.traverse(o => { const b = before.get(o); if (!b || snap(o).some((v, i) => Math.abs(v - b[i]!) > 1e-6)) moving.add(o); });
  for (const [m, l] of looks) {
    const states = Array.from({ length: 4 }, (_, i) => l[i] ?? "");
    if (states.some(s => s !== states[0])) changed.add(m);
  }
  return { moving, changed };
}

/** Concatenate non-indexed geometries' positions, normals and uvs (a missing uv counts as 0, 0). */
function mergeParts(parts: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const count = parts.reduce((n, g) => n + g.attributes.position!.count, 0);
  const pos = new Float32Array(count * 3), nor = new Float32Array(count * 3), uv = new Float32Array(count * 2);
  let at = 0;
  for (const g of parts) {
    const n = g.attributes.position!.count;
    pos.set(g.attributes.position!.array as Float32Array, at * 3);
    nor.set(g.attributes.normal!.array as Float32Array, at * 3);
    if (g.attributes.uv) uv.set(g.attributes.uv.array as Float32Array, at * 2);
    at += n;
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  out.setAttribute("normal", new THREE.BufferAttribute(nor, 3));
  out.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
  out.computeBoundingSphere();
  return out;
}
