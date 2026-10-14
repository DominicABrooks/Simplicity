// Freeing GPU memory. Anything built for one area (or one entity) is disposed when it goes away, so
// memory stays flat no matter how many areas you pass through. Shared resources are kept.
import * as THREE from "three";

/**
 * Dispose every geometry and material in a subtree (and instanced meshes' buffers), except those in
 * `keep`. Textures are left alone: they're shared and cached (see textures.ts).
 */
export function disposeTree(root: THREE.Object3D, keep: ReadonlySet<unknown> = new Set()): void {
  root.traverse(o => {
    if (o instanceof THREE.InstancedMesh) o.dispose();
    if (o instanceof THREE.Mesh || o instanceof THREE.Line || o instanceof THREE.Points || o instanceof THREE.Sprite) {
      if (!keep.has(o.geometry)) o.geometry.dispose();
      for (const m of [o.material].flat() as THREE.Material[]) {
        if (keep.has(m)) continue;
        m.dispose();
        (m.userData.maskTex as THREE.Texture | undefined)?.dispose();   // a ground layer's own mask (see groundLayers.ts)
      }
    }
  });
}
