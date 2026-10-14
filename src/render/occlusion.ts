// Seeing the hero behind buildings. The camera looks north over the rooftops, so a tall building can
// stand between it and the hero; any that does fades to see-through until the hero comes out again.
import * as THREE from "three";
import { smooth } from "../core/math.ts";

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
/** Test the line of sight from just above the hero's feet, a little wider than the hero. */
const EYE_Y = 0.35, MARGIN = 0.35;

export interface Occlusion {
  /** The current area's occluders (replaces the last area's). */
  set(occluders: Occluder[]): void;
  /** Fade whatever hides the hero at world (x, z), from a camera offset `toCamera` from the hero. */
  update(x: number, z: number, toCamera: THREE.Vector3, dt: number): void;
}

/** Does the occluder's box cross the line from the hero up to the camera? */
function hides(o: Occluder, x: number, z: number, toCamera: THREE.Vector3): boolean {
  if (x < o.x0 - MARGIN || x > o.x1 + MARGIN || o.z1 <= z) return false;   // off to the side, or behind the hero
  const t = Math.max(0, (o.z0 - z) / toCamera.z);           // where the line reaches the building's north face
  return EYE_Y + toCamera.y * t < o.height;
}

export function createOcclusion(): Occlusion {
  let list: { o: Occluder; materials: THREE.Material[]; fade: number }[] = [];

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

  return {
    set(occluders) {
      list = occluders.map(o => {
        const materials = new Set<THREE.Material>();
        o.object.traverse(c => { if (c instanceof THREE.Mesh) for (const m of [c.material].flat() as THREE.Material[]) materials.add(m); });
        return { o, materials: [...materials], fade: 1 };
      });
    },
    update(x, z, toCamera, dt) {
      for (const item of list) {
        const target = hides(item.o, x, z, toCamera) ? FADED : 1;
        if (Math.abs(item.fade - target) < 0.005) continue;
        item.fade = smooth(item.fade, target, dt, 10);
        if (Math.abs(item.fade - target) < 0.01) item.fade = target;
        apply(item.materials, item.fade);
      }
    },
  };
}
