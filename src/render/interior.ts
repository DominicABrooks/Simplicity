// Inside a house: the room (a plank or flagstone floor, low walls the camera sees over, the door standing
// open) and its furniture: the hearth with its fire (and its light), a table laid with a loaf and a candle,
// benches, beds made up, a chest, shelves of pots, barrels, an inn's counter, a loom, a workbench, an anvil,
// a rug, a cradle. Low-poly and hand-painted, at the hero's scale (about 1.1 tall), like the town outside.
import * as THREE from "three";
import { T } from "../data/world.ts";
import { FACING_YAW, FURNITURE, ROOM_WALL, roomWalls } from "../world/plans.ts";
import { GROUND, box, onGround, type RenderContext } from "./context.ts";
import { put } from "./castle.ts";
import type { PropView } from "./props.ts";
import { hash } from "./terrain.ts";
import { DARK_WOOD, IRON, LIT, WOOD, tiledBox, type PropOf } from "./town.ts";

const PLANK = "#9a6a42", FLAGS = "#cfc6b4", LINEN = "#e8e0cc", STRAW = "#d9b46a";
const BLANKETS = ["#8a2f3a", "#2f4f8a", "#5a6b3a", "#7a5a2a", "#6a4a7a", "#a8743a"];

// ---------- The room ----------
export function buildRoom(ctx: RenderContext, parent: THREE.Group, p: PropOf<"room">): PropView {
  const { lambert, tex } = ctx, g = new THREE.Group();
  const x0 = p.rect.x / T, z0 = p.rect.y / T, w = p.rect.w / T, d = p.rect.h / T;
  // The floor: boards running across the room, or big flagstones, just above the ground.
  const planks = p.floor === "planks";
  const floor = new THREE.PlaneGeometry(w, d).rotateX(-Math.PI / 2), uv = floor.attributes.uv!;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, (uv.getX(i) * w) / (planks ? 3 : 1.4), (uv.getY(i) * d) / (planks ? 3 : 1.4));
  put(g, floor, lambert(planks ? PLANK : FLAGS, { map: planks ? tex.timber : tex.stone, ...onGround(GROUND.plaza) }), x0 + w / 2, 0.01, z0 + d / 2);
  if (planks) for (let z = z0 + 0.5; z < z0 + d; z += 0.5) put(g, box(w, 0.005, 0.03), lambert(DARK_WOOD, onGround(GROUND.plazaRings)), x0 + w / 2, 0.012, z);
  // The walls, a beam along their tops, and the open door.
  const wall = lambert(p.wall, { map: planks ? tex.timber : tex.stone }), beam = lambert(DARK_WOOD), H = ROOM_WALL.high;
  for (const s of roomWalls(p)) {
    put(g, tiledBox(s.w, H, s.d, 0.8), wall, s.x, H / 2, s.z);
    put(g, box(s.w + 0.04, 0.08, s.d + 0.04), beam, s.x, H + 0.04, s.z);
  }
  const along = p.door === "north" || p.door === "south", t = ROOM_WALL.thick, gap = ROOM_WALL.gap;
  const at = (k: number) => (along ? { x: x0 + p.doorAt + k, z: p.door === "north" ? z0 + t / 2 : z0 + d - t / 2 } : { x: p.door === "west" ? x0 + t / 2 : x0 + w - t / 2, z: z0 + p.doorAt + k });
  for (const k of [0, gap]) { const q = at(k); put(g, box(0.16, H + 0.4, 0.16), beam, q.x, (H + 0.4) / 2, q.z); }   // door posts, taller than the wall
  const lintel = at(gap / 2);
  put(g, along ? box(gap + 0.16, 0.12, 0.2) : box(0.2, 0.12, gap + 0.16), beam, lintel.x, H + 0.4, lintel.z);
  const hinge = at(0.05), leaf = new THREE.Group();          // the door, swung open into the room
  put(leaf, box(gap - 0.1, H + 0.3, 0.06), lambert(DARK_WOOD), (gap - 0.1) / 2, (H + 0.3) / 2, 0);
  leaf.position.set(hinge.x, 0, hinge.z);
  leaf.rotation.y = (along ? 0 : Math.PI / 2) + (p.door === "south" || p.door === "west" ? 1.2 : -1.2);
  g.add(leaf);
  parent.add(g);
}

// ---------- Furniture ----------
/** One piece, built facing south (its front toward +z), then turned to its facing. */
export function buildFurniture(ctx: RenderContext, parent: THREE.Group, p: PropOf<"furniture">): PropView {
  const { lambert, basic, tex, particles } = ctx, g = new THREE.Group(), wood = lambert(WOOD), dark = lambert(DARK_WOOD);
  const [w, d] = FURNITURE[p.item], seed = hash(p.x, p.y, 900);
  const legs = (top: number, hw: number, hd: number, thick = 0.07) => { for (const sx of [-1, 1]) for (const sz of [-1, 1]) put(g, box(thick, top, thick), dark, sx * hw, top / 2, sz * hd); };
  let update: ((t: number, dt: number) => void) | null = null;
  switch (p.item) {
    case "hearth": {                                          // a stone chimney breast, the fire in its mouth, and its warm light
      const stone = lambert("#ffffff", { map: tex.stone });
      put(g, tiledBox(w, 1.7, d * 0.7, 0.6), stone, 0, 0.85, -d * 0.15);
      put(g, box(w * 0.55, 0.65, 0.1), basic("#1a1210"), 0, 0.38, d * 0.2 + 0.01);
      put(g, box(w + 0.1, 0.12, d * 0.8), lambert("#8a8378", { map: tex.stone }), 0, 1.0, -d * 0.1);
      put(g, box(w * 0.7, 0.06, 0.25), stone, 0, 0.03, d * 0.45);
      for (const s of [-1, 1]) put(g, new THREE.CylinderGeometry(0.05, 0.05, 0.5, 5), lambert("#6b4f3a"), s * 0.12, 0.08, d * 0.15, 0, 0.4 * s, Math.PI / 2);   // logs
      const flames = [0, 1, 2].map(i => put(g, new THREE.ConeGeometry(0.1 - i * 0.02, 0.32 - i * 0.05, 5), basic(["#ffb040", "#ff7a2a", "#ffe08a"][i]!), (i - 1) * 0.1, 0.25, d * 0.15));
      const light = new THREE.PointLight(0xffa860, 5, 9, 1.6);
      light.position.set(0, 0.7, d * 0.6);
      g.add(light);
      update = (t: number, dt: number) => {
        flames.forEach((f, i) => { f.scale.y = 0.8 + Math.abs(Math.sin(t * (7 + i * 2.3) + i)) * 0.5; });
        light.intensity = 4.5 + Math.sin(t * 9) * 0.4 + Math.sin(t * 23) * 0.3;
        if (Math.random() < dt * 4) {
          const o = new THREE.Vector3(0, 0.3, d * 0.2).applyAxisAngle(new THREE.Vector3(0, 1, 0), FACING_YAW[p.facing]);
          particles.spawn("ember", p.x / T + o.x, o.y, p.y / T + o.z, (Math.random() - 0.5) * 0.2, 0.8, (Math.random() - 0.5) * 0.2, 0.6);
        }
      };
      break;
    }
    case "table": {                                           // laid: a loaf, a bowl, a jug and a candle
      put(g, box(w, 0.08, d), wood, 0, 0.72, 0);
      legs(0.68, w / 2 - 0.1, d / 2 - 0.1);
      put(g, new THREE.SphereGeometry(0.11, 6, 4).scale(1.4, 0.7, 1), lambert("#c8904a"), -0.4, 0.8, 0);
      put(g, new THREE.CylinderGeometry(0.12, 0.08, 0.08, 8), lambert("#b8a88a"), 0.1, 0.8, 0.15);
      put(g, new THREE.CylinderGeometry(0.06, 0.08, 0.2, 6), lambert("#8a6a4a"), 0.45, 0.86, -0.15);
      put(g, new THREE.CylinderGeometry(0.03, 0.03, 0.14, 5), lambert(LINEN), 0.15, 0.83, -0.2);
      put(g, new THREE.ConeGeometry(0.025, 0.06, 4), basic(LIT), 0.15, 0.93, -0.2);
      break;
    }
    case "bench": put(g, box(w, 0.07, d), wood, 0, 0.42, 0); for (const s of [-1, 1]) put(g, box(0.07, 0.4, d - 0.05), dark, s * (w / 2 - 0.12), 0.2, 0); break;
    case "bed": {                                             // head at the back (-z): a straw mattress, a blanket and a pillow
      put(g, box(w, 0.28, d), dark, 0, 0.14, 0);
      put(g, box(w - 0.08, 0.12, d - 0.08), lambert(STRAW), 0, 0.33, 0);
      put(g, box(w - 0.04, 0.06, d * 0.62), lambert(BLANKETS[Math.floor(seed * BLANKETS.length)]!), 0, 0.41, d * 0.17);
      put(g, box(w - 0.3, 0.1, 0.28), lambert(LINEN), 0, 0.43, -d / 2 + 0.25);
      put(g, box(w, 0.5, 0.08), dark, 0, 0.25, -d / 2 + 0.04);
      break;
    }
    case "chest": put(g, box(w, 0.4, d), wood, 0, 0.2, 0); put(g, box(w + 0.02, 0.1, d + 0.02), dark, 0, 0.45, 0); for (const s of [-1, 1]) put(g, box(0.05, 0.42, d + 0.03), lambert(IRON), s * w * 0.3, 0.22, 0); break;
    case "shelf": {                                           // boards on uprights against the wall, pots and jars on them
      for (const s of [-1, 1]) put(g, box(0.06, 1.4, d), dark, s * (w / 2 - 0.03), 0.7, 0);
      for (const y of [0.35, 0.8, 1.25]) {
        put(g, box(w, 0.05, d), wood, 0, y, 0);
        for (let i = 0; i < 3; i++) {
          const c = ["#b0643a", "#8a8378", "#c8a060", "#5a6b8a"][Math.floor(hash(i, y * 10, seed * 100) * 4)]!;
          put(g, new THREE.CylinderGeometry(0.07, 0.09, 0.18, 6), lambert(c), -w / 2 + 0.3 + i * 0.35, y + 0.12, 0);
        }
      }
      break;
    }
    case "barrel": put(g, new THREE.CylinderGeometry(0.26, 0.24, 0.7, 10), wood, 0, 0.35, 0); for (const y of [0.12, 0.58]) put(g, new THREE.TorusGeometry(0.265, 0.02, 3, 10).rotateX(Math.PI / 2), lambert(IRON), 0, y, 0); break;
    case "counter": {                                         // an inn's counter, mugs along it
      put(g, tiledBox(w, 0.95, d, 0.6), lambert("#ffffff", { map: tex.timber }), 0, 0.475, 0);
      put(g, box(w + 0.1, 0.08, d + 0.1), dark, 0, 0.99, 0);
      for (let i = 0; i < 4; i++) put(g, new THREE.CylinderGeometry(0.06, 0.06, 0.13, 6), lambert("#8a6a4a"), -w / 2 + 0.4 + i * 0.6, 1.1, 0.05);
      break;
    }
    case "loom": {                                            // a frame with the warp strung and cloth half woven
      for (const s of [-1, 1]) put(g, box(0.08, 1.4, 0.08), dark, s * (w / 2 - 0.05), 0.7, 0);
      for (const y of [0.3, 1.35]) put(g, box(w, 0.08, 0.08), dark, 0, y, 0);
      put(g, box(w - 0.2, 0.55, 0.02), lambert(BLANKETS[Math.floor(seed * BLANKETS.length)]!), 0, 0.6, 0);
      put(g, box(w - 0.2, 0.5, 0.01), lambert(LINEN, { transparent: true, opacity: 0.6 }), 0, 1.1, 0);
      put(g, box(w * 0.8, 0.06, d * 0.6), wood, 0, 0.45, d / 2);
      break;
    }
    case "workbench": put(g, box(w, 0.1, d), wood, 0, 0.8, 0); legs(0.75, w / 2 - 0.1, d / 2 - 0.1, 0.09); put(g, box(0.05, 0.05, 0.3), dark, 0.3, 0.88, 0); put(g, box(0.15, 0.08, 0.08), lambert(IRON), 0.3, 0.88, -0.15); put(g, box(0.4, 0.08, 0.15), lambert("#c8a070"), -0.4, 0.89, 0.1); break;
    case "anvil": put(g, new THREE.CylinderGeometry(0.22, 0.26, 0.45, 8), dark, 0, 0.22, 0); put(g, box(w, 0.2, d), lambert(IRON), 0, 0.55, 0); put(g, new THREE.ConeGeometry(0.1, 0.3, 5), lambert(IRON), w / 2 + 0.12, 0.58, 0, 0, 0, -Math.PI / 2); break;
    case "rug": {                                             // just underfoot: a woven rug with a border
      const c = BLANKETS[Math.floor(seed * BLANKETS.length)]!;
      put(g, new THREE.PlaneGeometry(1.8, 1.2).rotateX(-Math.PI / 2), lambert("#d8c8a0", onGround(GROUND.plazaRings)), 0, 0.02, 0);
      put(g, new THREE.PlaneGeometry(1.5, 0.9).rotateX(-Math.PI / 2), lambert(c, onGround(GROUND.stain)), 0, 0.022, 0);
      break;
    }
    case "cradle": put(g, box(w, 0.3, d), wood, 0, 0.3, 0); put(g, box(w - 0.1, 0.05, d - 0.1), lambert(LINEN), 0, 0.44, 0); for (const s of [-1, 1]) put(g, new THREE.TorusGeometry(0.35, 0.03, 3, 8, Math.PI).rotateY(Math.PI / 2), dark, 0, 0.18, s * 0.02 + 0); break;
  }
  g.position.set(p.x / T, 0, p.y / T);
  g.rotation.y = FACING_YAW[p.facing];
  parent.add(g);
  return update ? { update } : undefined;
}
