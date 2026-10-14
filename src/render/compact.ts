// Compacting an area's scenery once it's built. Buildings are made of many small meshes (every window,
// shutter, sill and beam), which is easy to build with but costs a draw call and a culling test each:
// a city quarter would have tens of thousands. So, once built, each building's still meshes are merged
// into one mesh per material: the same triangles, a few draw calls per building.
//
// Two things are kept as they are. What moves (a flag, a mill's sails, a horse's tail) is found by running
// every prop's animation for a moment and seeing what changed, and left alone. And each fading unit (an
// occluder's object: a house, a run of wall, a tower) is merged within itself and keeps its own
// materials, so it still fades on its own when it's in your way.
import * as THREE from "three";

type Update = (t: number, dt: number) => void;

/** Merge `root`'s still meshes, per unit and per material. `units` are the objects that fade alone; `skip` is left untouched. */
export function compactScenery(root: THREE.Object3D, units: readonly THREE.Object3D[], updates: readonly Update[], skip: readonly THREE.Object3D[] = []): void {
  root.updateMatrixWorld(true);
  const moving = findMoving(root, updates);
  const unitSet = new Set(units), skipSet = new Set(skip);
  // Every still mesh, sorted by the unit it fades with (its nearest unit above it, or the root) and its material.
  const groups = new Map<THREE.Object3D, Map<THREE.Material, THREE.Mesh[]>>();
  const visit = (o: THREE.Object3D, unit: THREE.Object3D) => {
    if (skipSet.has(o) || moving.has(o)) return;
    const u = unitSet.has(o) ? o : unit;
    if (o instanceof THREE.Mesh && !(o instanceof THREE.InstancedMesh) && !Array.isArray(o.material) && o.visible) {
      let byMat = groups.get(u);
      if (!byMat) groups.set(u, (byMat = new Map()));
      const list = byMat.get(o.material);
      if (list) list.push(o); else byMat.set(o.material, [o]);
    }
    for (const c of [...o.children]) visit(c, u);
  };
  visit(root, root);

  const inverse = new THREE.Matrix4(), rel = new THREE.Matrix4(), dropped = new Set<THREE.BufferGeometry>();
  for (const [unit, byMat] of groups) {
    inverse.copy(unit.matrixWorld).invert();
    for (const [material, meshes] of byMat) {
      if (meshes.length < 2) continue;
      const parts = meshes.map(m => {
        rel.multiplyMatrices(inverse, m.matrixWorld);
        const g = (m.geometry.index ? m.geometry.toNonIndexed() : m.geometry.clone()).applyMatrix4(rel);
        if (!g.attributes.normal) g.computeVertexNormals();
        return g;
      });
      const merged = new THREE.Mesh(mergeParts(parts), material);
      merged.renderOrder = meshes[0]!.renderOrder;
      unit.add(merged);
      for (const g of parts) g.dispose();
      for (const m of meshes) { dropped.add(m.geometry); m.removeFromParent(); }
    }
  }
  // Free the merged meshes' old geometries, unless something still standing uses one.
  const inUse = new Set<THREE.BufferGeometry>();
  root.traverse(o => { if (o instanceof THREE.Mesh) inUse.add(o.geometry); });
  for (const g of dropped) if (!inUse.has(g)) g.dispose();
}

/** Run every update at two moments and see which objects moved, turned or changed size. */
function findMoving(root: THREE.Object3D, updates: readonly Update[]): Set<THREE.Object3D> {
  const before = new Map<THREE.Object3D, number[]>();
  const snap = (o: THREE.Object3D) => [...o.position.toArray(), ...o.quaternion.toArray(), ...o.scale.toArray()];
  root.traverse(o => before.set(o, snap(o)));
  for (const t of [0.37, 1.93, 4.1]) for (const u of updates) u(t, 1 / 60);
  const moving = new Set<THREE.Object3D>();
  root.traverse(o => { const b = before.get(o); if (!b || snap(o).some((v, i) => Math.abs(v - b[i]!) > 1e-6)) moving.add(o); });
  return moving;
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
