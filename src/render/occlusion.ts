// Seeing the hero, and what's around them, behind things. The camera looks north over rooftops and
// treetops, so anything tall can stand between it and the action. Each frame we test the lines of sight
// from the camera to the hero and to a few points around them (mostly just ahead, where trouble comes
// from); anything that blocks one fades to see-through until it's clear again.
//
// Buildings fade as objects (each has its own materials). Trees are one instanced mesh per part, so a
// tree in the way is hidden in the instances and drawn as a see-through stand-in instead.
import * as THREE from "three";
import { smooth } from "../core/math.ts";
import type { TreeSet } from "./terrain.ts";

/** Something tall that can hide the hero: its object, and its box in world units. */
export interface Occluder {
  object: THREE.Object3D;
  /** West and east edges. */
  x0: number;
  x1: number;
  /** North and south edges. */
  z0: number;
  z1: number;
  height: number;
}

const FADED = 0.3;
/** Lines of sight from just above the ground. */
const EYE_Y = 0.35;
/** Points to keep in view, relative to the hero (world units): the hero, either side, and ahead (north). */
const SAMPLES: readonly [number, number][] = [[0, 0], [-1.2, 0], [1.2, 0], [0, -1.6], [-1.1, -1.2], [1.1, -1.2], [0, 0.8]];

export interface Occlusion {
  /** The current area's occluders and trees (replaces the last area's). */
  set(occluders: Occluder[], trees: TreeSet | null): void;
  /** Fade whatever hides the hero at world (x, z), from a camera offset `toCamera` from the hero. */
  update(x: number, z: number, toCamera: THREE.Vector3, dt: number): void;
}

/** Does a box cross the line from a point on the ground up to the camera? */
function blocks(x0: number, x1: number, z0: number, height: number, px: number, pz: number, toCamera: THREE.Vector3): boolean {
  if (px < x0 || px > x1 || pz > z0 + 0.2) return false;     // off to the side, or not south of the point
  const t = Math.max(0, (z0 - pz) / toCamera.z);            // where the line reaches the box's north face
  return EYE_Y + toCamera.y * t < height;
}

/** Is the hero underneath it (an arcade, a gatehouse's arch, a roof you've walked in under)? */
const over = (x0: number, x1: number, z0: number, z1: number, x: number, z: number) => x > x0 + 0.5 && x < x1 - 0.5 && z > z0 + 0.5 && z < z1 - 0.5;

/** Does it hide the hero or anything just around them, or is the hero underneath it? (Only the hero counts for
 * that: a house just ahead of you isn't in your way.) */
const hidesAny = (x0: number, x1: number, z0: number, z1: number, height: number, x: number, z: number, toCamera: THREE.Vector3) =>
  over(x0, x1, z0, z1, x, z) || SAMPLES.some(([dx, dz]) => blocks(x0, x1, z0, height, x + dx, z + dz, toCamera));

export function createOcclusion(scene: THREE.Scene): Occlusion {
  let list: { o: Occluder; materials: THREE.Material[]; fade: number }[] = [];
  let trees: TreeSet | null = null;
  /** Hidden trees: index -> its see-through stand-in. */
  const ghosts = new Map<number, THREE.Group>();
  let ghostMaterials: THREE.Material[] = [];
  const hidden = new THREE.Matrix4().makeScale(0, 0, 0);
  const saved = new Map<number, THREE.Matrix4[]>();

  const apply = (materials: THREE.Material[], fade: number) => {
    const see = fade < 0.99;
    for (const m of materials) {
      if (see !== m.transparent) {
        m.transparent = see;
        m.depthWrite = !see;                                 // so the hero shows through it
        m.needsUpdate = true;
      }
      m.opacity = see ? fade : 1;
    }
  };

  function clearTrees(): void {
    for (const g of ghosts.values()) scene.remove(g);
    ghosts.clear();
    saved.clear();
    for (const m of ghostMaterials) m.dispose();
    ghostMaterials = [];
  }

  function hideTree(i: number): void {
    if (!trees || ghosts.has(i)) return;
    const ghost = new THREE.Group();
    const matrices = trees.meshes.map((mesh, k) => {
      const original = new THREE.Matrix4();
      mesh.getMatrixAt(i, original);
      mesh.setMatrixAt(i, hidden);
      mesh.instanceMatrix.needsUpdate = true;
      const part = new THREE.Mesh(mesh.geometry, ghostMaterials[k]!);
      part.matrixAutoUpdate = false;
      part.matrix.multiplyMatrices(mesh.matrixWorld, original);   // the ghost stands in the scene; the tree, in the terrain (which may be offset)
      ghost.add(part);
      return original;
    });
    saved.set(i, matrices);
    ghosts.set(i, ghost);
    scene.add(ghost);
  }

  function showTree(i: number): void {
    if (!trees) return;
    const matrices = saved.get(i);
    if (matrices) trees.meshes.forEach((mesh, k) => { mesh.setMatrixAt(i, matrices[k]!); mesh.instanceMatrix.needsUpdate = true; });
    const ghost = ghosts.get(i);
    if (ghost) scene.remove(ghost);
    ghosts.delete(i);
    saved.delete(i);
  }

  return {
    set(occluders, treeSet) {
      list = occluders.map(o => {
        const materials = new Set<THREE.Material>();
        o.object.traverse(c => { if (c instanceof THREE.Mesh) for (const m of [c.material].flat() as THREE.Material[]) materials.add(m); });
        return { o, materials: [...materials], fade: 1 };
      });
      clearTrees();
      trees = treeSet;
      ghostMaterials = (treeSet?.meshes ?? []).map(mesh => {
        const m = (mesh.material as THREE.Material).clone();
        m.transparent = true;
        m.opacity = FADED;
        m.depthWrite = false;
        return m;
      });
    },

    update(x, z, toCamera, dt) {
      for (const item of list) {
        const o = item.o, target = hidesAny(o.x0, o.x1, o.z0, o.z1, o.height, x, z, toCamera) ? FADED : 1;
        if (Math.abs(item.fade - target) < 0.005) continue;
        item.fade = smooth(item.fade, target, dt, 10);
        if (Math.abs(item.fade - target) < 0.01) item.fade = target;
        apply(item.materials, item.fade);
      }
      if (!trees) return;
      // Only trees near the hero can be in the way: just south of them, toward the camera.
      trees.items.forEach((tree, i) => {
        const near = Math.abs(tree.x - x) < 3 && tree.z > z - 3 && tree.z < z + 4;
        const r = 0.6 * tree.scale, top = tree.y + 1.75 * tree.scale;
        const inWay = near && hidesAny(tree.x - r, tree.x + r, tree.z - r, tree.z + r, top, x, z, toCamera);
        if (inWay) hideTree(i); else if (ghosts.has(i)) showTree(i);
      });
    },
  };
}
