// Inside a house: the room (a plank or flagstone floor, low walls the camera sees over, the door standing
// open) and its furniture: the hearth with its fire (and its light), a table laid with a loaf and a candle,
// benches, beds made up, a chest, shelves of pots, barrels, an inn's counter, a loom, a workbench, an anvil,
// a rug, a cradle. Low-poly and hand-painted, at the hero's scale (about 1.1 tall), like the town outside.
import * as THREE from "three";
import { T } from "../data/world.ts";
import { DAIS_HIGH, FACING_YAW, FURNITURE, ROOM_WALL, roomWalls } from "../world/plans.ts";
import { GROUND, box, onGround, type RenderContext } from "./context.ts";
import { put } from "./castle.ts";
import type { PropView } from "./props.ts";
import { hash } from "./terrain.ts";
import { DARK_WOOD, IRON, LIT, MARBLE, WOOD, tiledBox, type PropOf } from "./town.ts";

const PLANK = "#9a6a42", FLAGS = "#cfc6b4", LINEN = "#e8e0cc", TICKING = "#ddd2b8";
/** Rugs' borders. */
const RUG_EDGES = ["#3a2a22", "#e8dcc4", "#2f3a4a", "#5a2a24"];
const BLANKETS = ["#8a2f3a", "#2f4f8a", "#5a6b3a", "#7a5a2a", "#6a4a7a", "#a8743a"];
/** The throne room's colours: the kingdom's crimson, bright gold, rubies, and the stained glass. */
const CRIMSON = "#8a1f2e", BRIGHT_GOLD = "#e8b84a", RUBY = "#e0303a";
const STAINED = ["#3f6fd0", "#c8423a", "#f5d562", "#5fb04a", "#8a4fc0", "#e08a3a"] as const;

/** A marble floor's tile: white and pale-grey squares in a check, with a thread of gold between them. */
let marble: THREE.CanvasTexture | null = null;
function marbleTexture(): THREE.CanvasTexture {
  if (marble) return marble;
  const c = document.createElement("canvas"), x = c.getContext("2d")!;
  c.width = c.height = 32;
  for (const [i, j, col] of [[0, 0, "#fbf8f1"], [1, 1, "#fbf8f1"], [1, 0, "#e6e0d4"], [0, 1, "#e6e0d4"]] as const) { x.fillStyle = col; x.fillRect(i * 16, j * 16, 16, 16); }
  x.fillStyle = "#efe9dd"; x.fillRect(4, 6, 6, 1); x.fillRect(22, 24, 4, 1); x.fillStyle = "#d6cfc1"; x.fillRect(20, 5, 5, 1); x.fillRect(6, 22, 4, 1);   // veins
  x.fillStyle = "#e0b850"; x.fillRect(0, 0, 32, 1); x.fillRect(0, 16, 32, 1); x.fillRect(0, 0, 1, 32); x.fillRect(16, 0, 1, 32);   // a fine thread of gold
  for (const [cx, cy] of [[0, 0], [16, 16], [16, 0], [0, 16]] as const) { x.fillRect(cx - 1 < 0 ? 31 : cx - 1, cy, 3, 1); x.fillRect(cx, cy - 1 < 0 ? 31 : cy - 1, 1, 3); }   // little gold stars at the corners
  marble = new THREE.CanvasTexture(c);
  marble.magFilter = marble.minFilter = THREE.NearestFilter;
  marble.wrapS = marble.wrapT = THREE.RepeatWrapping;
  marble.colorSpace = THREE.SRGBColorSpace;
  return marble;
}

// ---------- The room ----------
export function buildRoom(ctx: RenderContext, parent: THREE.Group, p: PropOf<"room">): PropView {
  const { lambert, tex } = ctx, g = new THREE.Group();
  const x0 = p.rect.x / T, z0 = p.rect.y / T, w = p.rect.w / T, d = p.rect.h / T;
  // The floor: boards running across the room, big flagstones, or (the throne room) checked marble inlaid with gold.
  const planks = p.floor === "planks", rich = p.floor === "marble";
  if (rich) {
    const floor = new THREE.PlaneGeometry(w, d).rotateX(-Math.PI / 2), uv = floor.attributes.uv!;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, (uv.getX(i) * w) / 2, (uv.getY(i) * d) / 2);
    put(g, floor, lambert("#ffffff", { map: marbleTexture(), ...onGround(GROUND.plaza) }), x0 + w / 2, 0.01, z0 + d / 2);
    const wall = lambert(p.wall, { map: tex.stone }), wainscot = lambert(CRIMSON), gold = lambert(BRIGHT_GOLD), H = ROOM_WALL.high;
    for (const s of roomWalls(p)) {                           // pale stone above a crimson wainscot, gold bands and a gold coping
      put(g, tiledBox(s.w, H, s.d, 0.8), wall, s.x, H / 2, s.z);
      put(g, box(s.w + 0.02, 0.5, s.d + 0.02), wainscot, s.x, 0.25, s.z);
      for (const y of [0.52, H + 0.05]) put(g, box(s.w + 0.05, 0.07, s.d + 0.05), gold, s.x, y, s.z);
    }
    const along = p.door === "north" || p.door === "south", t = ROOM_WALL.thick, gap = ROOM_WALL.gap;
    const at = (k: number) => (along ? { x: x0 + p.doorAt + k, z: p.door === "north" ? z0 + t / 2 : z0 + d - t / 2 } : { x: p.door === "west" ? x0 + t / 2 : x0 + w - t / 2, z: z0 + p.doorAt + k });
    for (const k of [0, gap]) { const q = at(k); put(g, box(0.2, H + 0.6, 0.2), gold, q.x, (H + 0.6) / 2, q.z); }   // gilded door posts
    const lintel = at(gap / 2);
    put(g, along ? box(gap + 0.2, 0.16, 0.24) : box(0.24, 0.16, gap + 0.2), gold, lintel.x, H + 0.6, lintel.z);
    parent.add(g);
    return;
  }
  const floor = new THREE.PlaneGeometry(w, d).rotateX(-Math.PI / 2), uv = floor.attributes.uv!;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, (uv.getX(i) * w) / (planks ? 3 : 1.4), (uv.getY(i) * d) / (planks ? 3 : 1.4));
  put(g, floor, lambert(planks ? PLANK : FLAGS, { ...(planks ? {} : { map: tex.stone }), ...onGround(GROUND.plaza) }), x0 + w / 2, 0.01, z0 + d / 2);
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

// ---------- Rugs ----------
/**
 * A rug's weave, as a little pixel texture (one per pattern): a border round the field, and on it either a
 * diamond with a light heart and a small diamond either side, or two bands across each end. Drawn as one flat
 * piece, so nothing in the pattern fights over which is on top (see GROUND.rug).
 */
const rugs = new Map<string, THREE.CanvasTexture>();
function rugTexture(edge: string, field: string, diamond: boolean): THREE.CanvasTexture {
  const key = [edge, field, diamond].join("/"), made = rugs.get(key);
  if (made) return made;
  const W = 38, H = 24, c = document.createElement("canvas"), x = c.getContext("2d")!, light = "#e8dcc4";
  c.width = W; c.height = H;
  x.fillStyle = edge; x.fillRect(0, 0, W, H);
  x.fillStyle = field; x.fillRect(2, 2, W - 4, H - 4);
  const lozenge = (cx: number, cy: number, r: number, colour: string) => {
    x.fillStyle = colour;
    for (let dy = -r; dy <= r; dy++) { const half = r - Math.abs(dy); x.fillRect(cx - half, cy + dy, half * 2 + 1, 1); }
  };
  if (diamond) {
    lozenge(W / 2 - 1, H / 2 - 1, 6, edge);
    lozenge(W / 2 - 1, H / 2 - 1, 3, light);
    for (const s of [-1, 1]) lozenge(W / 2 - 1 + s * 11, H / 2 - 1, 2, light);
  } else for (const s of [-1, 1]) {
    x.fillStyle = edge; x.fillRect(W / 2 - 1 + s * 6 - (s < 0 ? 1 : 0), 2, 2, H - 4);
    x.fillStyle = light; x.fillRect(W / 2 - 1 + s * 10 - (s < 0 ? 1 : 0), 2, 1, H - 4);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.magFilter = tex.minFilter = THREE.NearestFilter;
  tex.colorSpace = THREE.SRGBColorSpace;
  rugs.set(key, tex);
  return tex;
}

// ---------- Furniture ----------
/** One piece, built facing south (its front toward +z), then turned to its facing. */
export function buildFurniture(ctx: RenderContext, parent: THREE.Group, p: PropOf<"furniture">): PropView {
  const { lambert, basic, tex, particles } = ctx, g = new THREE.Group(), wood = lambert(WOOD), dark = lambert(DARK_WOOD);
  const [w, d] = FURNITURE[p.item], seed = hash(p.x, p.y, 900);
  const legs = (top: number, hw: number, hd: number, thick = 0.07) => { for (const sx of [-1, 1]) for (const sz of [-1, 1]) put(g, box(thick, top, thick), dark, sx * hw, top / 2, sz * hd); };
  // A pair of trestles at +-x: each a leg splayed out to a foot, under a crosspiece the top rests on.
  const trestle = (x: number, top: number, span: number) => {
    for (const s of [-1, 1]) {
      put(g, box(0.07, top, 0.08), dark, s * x, top / 2, 0);
      put(g, box(0.09, 0.05, span), dark, s * x, 0.025, 0);
      put(g, box(0.08, 0.05, span * 0.85), dark, s * x, top - 0.03, 0);
    }
  };
  let update: ((t: number, dt: number) => void) | null = null;
  switch (p.item) {
    case "hearth": {                                          // a stone chimney breast, the fire in its mouth, and its warm light
      const stone = lambert("#ffffff", { map: tex.stone });
      put(g, tiledBox(w, 1.7, d * 0.7, 0.6), stone, 0, 0.85, -d * 0.15);
      put(g, box(w * 0.55, 0.65, 0.1), basic("#1a1210"), 0, 0.38, d * 0.2 + 0.01);
      put(g, box(w + 0.1, 0.12, d * 0.8), lambert("#8a8378", { map: tex.stone }), 0, 1.0, -d * 0.1);
      put(g, box(w * 0.7, 0.06, 0.25), stone, 0, 0.03, d * 0.45);
      for (const s of [-1, 1]) put(g, new THREE.CylinderGeometry(0.05, 0.05, 0.5, 5), lambert("#6b4f3a"), s * 0.12, 0.08, d * 0.3, 0, 0.4 * s, Math.PI / 2);   // logs, in the mouth of it
      const flames = [0, 1, 2].map(i => put(g, new THREE.ConeGeometry(0.1 - i * 0.02, 0.32 - i * 0.05, 5), ctx.glow(["#ffb040", "#ff7a2a", "#ffe08a"][i]!), (i - 1) * 0.1, 0.25, d * 0.3));
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
    case "table": {                                           // a trestle table, its top of planks, laid: a loaf, a bowl, a jug and a candle
      put(g, box(w, 0.07, d), wood, 0, 0.73, 0);
      for (let i = 1; i < 4; i++) put(g, box(w - 0.02, 0.072, 0.012), dark, 0, 0.731, -d / 2 + (i * d) / 4);   // seams between the planks
      trestle(w / 2 - 0.22, 0.7, d - 0.15);
      put(g, box(w - 0.5, 0.06, 0.06), dark, 0, 0.22, 0);                                                  // the stretcher
      put(g, new THREE.SphereGeometry(0.11, 6, 4).scale(1.4, 0.7, 1), lambert("#c8904a"), -0.4, 0.8, 0);
      put(g, new THREE.CylinderGeometry(0.12, 0.08, 0.08, 8), lambert("#b8a88a"), 0.1, 0.8, 0.15);
      put(g, new THREE.CylinderGeometry(0.06, 0.08, 0.2, 6), lambert("#8a6a4a"), 0.45, 0.86, -0.15);
      put(g, new THREE.CylinderGeometry(0.03, 0.03, 0.14, 5), lambert(LINEN), 0.15, 0.83, -0.2);
      put(g, new THREE.ConeGeometry(0.025, 0.06, 4), ctx.glow(LIT), 0.15, 0.93, -0.2);
      break;
    }
    case "bench": {                                           // a plank seat on splayed trestle legs
      put(g, box(w, 0.06, d), wood, 0, 0.43, 0);
      trestle(w / 2 - 0.18, 0.4, d - 0.02);
      put(g, box(w - 0.4, 0.05, 0.05), dark, 0, 0.15, 0);
      break;
    }
    case "bed": {                                             // head at the back (-z): a posted frame, a ticking mattress, a patched quilt turned down, a bolster and pillow
      const frame = dark, quilt = [BLANKETS[Math.floor(seed * BLANKETS.length)]!, BLANKETS[Math.floor(seed * 7.3 * BLANKETS.length) % BLANKETS.length]!];
      const hw = w / 2, hd = d / 2;
      for (const s of [-1, 1]) put(g, box(0.07, 0.14, d - 0.1), frame, s * (hw - 0.035), 0.24, 0);           // side rails
      for (const s of [-1, 1]) {
        put(g, box(0.09, 0.78, 0.09), frame, s * (hw - 0.045), 0.39, -hd + 0.045);                        // head posts, tall
        put(g, new THREE.SphereGeometry(0.06, 6, 4), frame, s * (hw - 0.045), 0.81, -hd + 0.045);         // with knobs
        put(g, box(0.08, 0.46, 0.08), frame, s * (hw - 0.04), 0.23, hd - 0.04);                           // foot posts
      }
      put(g, box(w - 0.12, 0.42, 0.05), wood, 0, 0.5, -hd + 0.04);                                         // the headboard...
      put(g, new THREE.CylinderGeometry(hw - 0.06, hw - 0.06, 0.05, 10, 1, false, -Math.PI / 2, Math.PI), wood, 0, 0.71, -hd + 0.04, Math.PI / 2, 0, 0);   // ...its rounded top
      put(g, box(w - 0.12, 0.2, 0.05), wood, 0, 0.3, hd - 0.04);                                           // the footboard
      put(g, box(w - 0.12, 0.05, d - 0.14), frame, 0, 0.25, 0);                                            // the slats under it all
      // The mattress: striped ticking, stuffed with straw.
      put(g, box(w - 0.16, 0.14, d - 0.18), lambert(TICKING), 0, 0.34, 0);
      for (const x of [-0.24, -0.08, 0.08, 0.24]) put(g, box(0.025, 0.142, d - 0.2), lambert("#5a6b8a"), x * (w / 0.95), 0.341, 0);
      // The quilt over the bottom two thirds, in patches of two colours, falling over the sides; the sheet turned down over it.
      const qz = hd * 0.28, ql = d * 0.62, cols = 3, rows = 4;
      for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) {
        const pw = (w - 0.1) / cols, pl = ql / rows;
        put(g, box(pw + 0.002, 0.04, pl + 0.002), lambert(quilt[(i + j) % 2]!), -(w - 0.1) / 2 + pw * (i + 0.5), 0.43, qz - ql / 2 + pl * (j + 0.5));
      }
      for (const s of [-1, 1]) put(g, box(0.03, 0.17, ql), lambert(quilt[0]!), s * (w / 2 - 0.035), 0.36, qz);   // hanging over the sides
      put(g, box(w - 0.08, 0.05, 0.14), lambert(LINEN), 0, 0.445, qz - ql / 2 - 0.02);
      put(g, new THREE.CapsuleGeometry(0.075, w - 0.34, 2, 6).rotateZ(Math.PI / 2), lambert(LINEN), 0, 0.47, -hd + 0.2);   // the bolster
      put(g, new THREE.SphereGeometry(0.2, 7, 4).scale(1, 0.32, 0.6), lambert("#f2ead8"), 0.08, 0.53, -hd + 0.32);          // a pillow on it
      if (seed > 0.65) put(g, new THREE.IcosahedronGeometry(0.28, 0).scale(1.3, 0.22, 0.75), lambert("#6b4f3a"), 0.05, 0.47, hd - 0.28);   // a fur at the foot
      break;
    }
    case "chest": {                                           // a coffer: a rounded lid, iron straps over it, a lock
      const iron = lambert(IRON);
      put(g, box(w, 0.36, d), wood, 0, 0.2, 0);
      put(g, new THREE.CylinderGeometry(d / 2, d / 2, w, 8, 1, false, 0, Math.PI).rotateZ(Math.PI / 2).scale(1, 0.55, 1), wood, 0, 0.38, 0);
      put(g, box(w + 0.02, 0.04, d + 0.02), dark, 0, 0.38, 0);
      for (const s of [-1, 1]) {
        put(g, box(0.05, 0.38, d + 0.02), iron, s * w * 0.3, 0.2, 0);
        put(g, new THREE.TorusGeometry(d / 2 + 0.01, 0.022, 3, 8, Math.PI).scale(1, 0.55, 1).rotateY(Math.PI / 2), iron, s * w * 0.3, 0.38, 0);
        put(g, box(0.06, 0.06, d + 0.03), dark, s * (w / 2 - 0.03), 0.04, 0);                              // feet
      }
      put(g, box(0.12, 0.14, 0.03), iron, 0, 0.32, d / 2 + 0.01);
      put(g, box(0.03, 0.05, 0.035), lambert("#d9a83a"), 0, 0.3, d / 2 + 0.02);
      break;
    }
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
    case "rug": {                                             // just underfoot: one woven piece over the floor, its pattern painted on, and fringed ends
      const field = BLANKETS[Math.floor(seed * BLANKETS.length)]!, edge = RUG_EDGES[Math.floor(seed * 13.7) % RUG_EDGES.length]!, L = 1.9, Wd = 1.2;
      const weave = lambert("#ffffff", { map: rugTexture(edge, field, seed < 0.5), ...onGround(GROUND.rug) });
      put(g, new THREE.PlaneGeometry(L, Wd).rotateX(-Math.PI / 2), weave, 0, 0.015, 0);
      const fringe = lambert("#e8dcc4", onGround(GROUND.rug));
      for (const s of [-1, 1]) for (let i = 0; i < 9; i++) put(g, new THREE.PlaneGeometry(0.1, 0.03).rotateX(-Math.PI / 2), fringe, s * (L / 2 + 0.05), 0.015, -Wd / 2 + 0.1 + (i * (Wd - 0.2)) / 8);
      break;
    }
    // ---------- The throne room ----------
    case "dais": {                                            // a two-step platform, the top in crimson cloth with a gold border, gold along every edge
      // A white marble step, then the dais itself all in crimson velvet, gold along every edge and a gold sun inlaid before the throne.
      const DW = 7, DD = 3.6, step = DAIS_HIGH / 2, gold = lambert(BRIGHT_GOLD);
      put(g, box(DW + 0.5, step, DD + 0.5), lambert(MARBLE), 0, step / 2, 0.1);
      put(g, box(DW, step, DD), lambert(CRIMSON), 0, step * 1.5, 0);
      for (const [bw, bd, bx, bz] of [[DW + 0.06, 0.07, 0, DD / 2], [DW + 0.06, 0.07, 0, -DD / 2], [0.07, DD, DW / 2, 0], [0.07, DD, -DW / 2, 0]] as const) put(g, box(bw, 0.05, bd), gold, bx, DAIS_HIGH, bz);
      for (const [bw, bd, bx, bz] of [[DW - 0.6, 0.04, 0, DD / 2 - 0.3], [DW - 0.6, 0.04, 0, -DD / 2 + 0.3], [0.04, DD - 0.6, DW / 2 - 0.3, 0], [0.04, DD - 0.6, -DW / 2 + 0.3, 0]] as const) put(g, box(bw, 0.012, bd), gold, bx, DAIS_HIGH + 0.006, bz);
      put(g, new THREE.CircleGeometry(0.45, 12).rotateX(-Math.PI / 2), gold, 0, DAIS_HIGH + 0.008, 0.55);
      for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2; put(g, new THREE.ConeGeometry(0.08, 0.3, 3).rotateX(-Math.PI / 2).rotateY(-a + Math.PI / 2), gold, Math.cos(a) * 0.62, DAIS_HIGH + 0.008, 0.55 + Math.sin(a) * 0.62); }
      put(g, box(DW + 0.55, 0.035, 0.05), gold, 0, step, DD / 2 + 0.35);
      break;
    }
    case "throne": {                                          // a golden throne on the dais: a high back with a crimson panel, a crown atop it, lion-headed arms, a crimson cushion
      const gold = lambert(BRIGHT_GOLD, { emissive: new THREE.Color("#3a2606") }), red = lambert(CRIMSON), y0 = DAIS_HIGH;
      put(g, box(w, 0.12, d * 0.8), gold, 0, y0 + 0.5, 0.05);
      put(g, box(w - 0.15, 0.1, d * 0.7), red, 0, y0 + 0.6, 0.08);                                        // the cushion
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) put(g, box(0.12, 0.5, 0.12), gold, sx * (w / 2 - 0.08), y0 + 0.25, sz * (d * 0.35));
      put(g, box(w, 1.9, 0.14), gold, 0, y0 + 1.45, -d * 0.38);                                           // the back
      put(g, box(w - 0.3, 1.45, 0.02), red, 0, y0 + 1.35, -d * 0.3);
      put(g, new THREE.CircleGeometry(0.28, 12), gold, 0, y0 + 1.75, -d * 0.29);                          // a gold sun on the panel
      for (const sx of [-1, 1]) {
        put(g, box(0.14, 0.12, d * 0.75), gold, sx * (w / 2 - 0.07), y0 + 0.85, 0.05);                 // the arms
        put(g, new THREE.SphereGeometry(0.11, 7, 5), gold, sx * (w / 2 - 0.07), y0 + 0.92, d * 0.42);   // lions' heads at their ends
        put(g, new THREE.ConeGeometry(0.09, 0.35, 5), gold, sx * (w / 2 - 0.05), y0 + 2.55, -d * 0.38);  // finials
      }
      for (let i = 0; i < 5; i++) put(g, new THREE.ConeGeometry(0.07, 0.3, 4), gold, (i - 2) * 0.16, y0 + 2.55 + (i === 2 ? 0.1 : 0), -d * 0.38);   // the crown atop it
      for (let i = 0; i < 3; i++) put(g, new THREE.OctahedronGeometry(0.06, 0), basic(RUBY), (i - 1) * 0.3, y0 + 2.42, -d * 0.3);
      break;
    }
    case "carpet": {                                          // a length of the crimson carpet up the hall, gold borders, gold diamonds down its middle
      const CW = 2.0, CL = 3.8, layer = onGround(GROUND.rug);
      put(g, new THREE.PlaneGeometry(CW, CL).rotateX(-Math.PI / 2), lambert(CRIMSON, layer), 0, 0.016, 0);
      const goldTrim = lambert(BRIGHT_GOLD, layer);
      for (const s of [-1, 1]) for (const k of [0.82, 0.92]) put(g, new THREE.PlaneGeometry(0.05, CL).rotateX(-Math.PI / 2), goldTrim, s * CW / 2 * k, 0.017, 0);
      for (const z of [-1.1, 0, 1.1]) put(g, new THREE.PlaneGeometry(0.32, 0.32).rotateX(-Math.PI / 2).rotateY(Math.PI / 4), goldTrim, 0, 0.017, z);
      break;
    }
    case "pillar": {                                          // a marble column with a gilded base and capital, the kingdom's banner hanging from it toward the hall
      const marbleMat = lambert("#faf6ee"), gold = lambert(BRIGHT_GOLD), Hh = 2.3;
      put(g, new THREE.CylinderGeometry(0.4, 0.44, 0.16, 8), gold, 0, 0.08, 0);                       // a gilded base
      put(g, new THREE.CylinderGeometry(0.27, 0.3, Hh, 8), marbleMat, 0, 0.16 + Hh / 2, 0);
      for (let i = 0; i < 8; i++) put(g, box(0.03, Hh - 0.1, 0.02), lambert("#e8cf8a"), Math.cos((i * Math.PI) / 4 + 0.2) * 0.29, 0.16 + Hh / 2, Math.sin((i * Math.PI) / 4 + 0.2) * 0.29, 0, -((i * Math.PI) / 4 + 0.2), 0);   // gold fluting
      for (const y of [0.5, 0.16 + Hh - 0.25]) put(g, new THREE.TorusGeometry(0.29, 0.035, 4, 10).rotateX(Math.PI / 2), gold, 0, y, 0);
      put(g, new THREE.CylinderGeometry(0.38, 0.29, 0.24, 8), gold, 0, 0.16 + Hh + 0.12, 0);         // a gilded capital, flaring
      put(g, new THREE.CylinderGeometry(0.4, 0.4, 0.06, 8), gold, 0, 0.16 + Hh + 0.27, 0);
      put(g, box(0.62, 1.15, 0.03), lambert(CRIMSON), 0, 1.6, 0.32);                                   // the banner, on the hall side
      put(g, box(0.66, 0.06, 0.05), gold, 0, 2.2, 0.33);
      for (let i = 0; i < 3; i++) put(g, new THREE.ConeGeometry(0.06, 0.16, 4), gold, (i - 1) * 0.13, 1.72 + (i === 1 ? 0.04 : 0), 0.345);   // a gold crown on it
      put(g, new THREE.ConeGeometry(0.31, 0.28, 3).rotateZ(Math.PI), lambert(CRIMSON), 0, 0.92, 0.32);  // its swallowtail point
      break;
    }
    case "tapestry": {                                        // hung on the wall: a deep blue field in a gold border, a crimson dragon on it, a rod above
      const TW = 1.5, TH = 1.0, y = 0.75;
      put(g, box(TW + 0.1, TH + 0.1, 0.02), lambert(BRIGHT_GOLD), 0, y, 0);
      put(g, box(TW, TH, 0.03), lambert(seed < 0.5 ? "#1f3a6a" : "#2a5a3a"), 0, y, 0.01);
      const red = lambert(CRIMSON);
      put(g, box(0.5, 0.18, 0.02), red, 0, y, 0.03);                                                    // the dragon: body, neck and head, wings, tail
      put(g, box(0.1, 0.25, 0.02), red, 0.28, y + 0.12, 0.03);
      put(g, box(0.18, 0.1, 0.02), red, 0.35, y + 0.26, 0.03);
      for (const s of [-1, 1]) put(g, new THREE.ConeGeometry(0.2, 0.36, 3), red, -0.05 + s * 0.06, y + 0.22, 0.03, 0, 0, s * 0.5);
      put(g, box(0.3, 0.06, 0.02), red, -0.35, y - 0.06, 0.03, 0, 0, 0.4);
      put(g, new THREE.CylinderGeometry(0.03, 0.03, TW + 0.3, 6).rotateZ(Math.PI / 2), lambert(BRIGHT_GOLD), 0, y + TH / 2 + 0.1, 0.02);
      for (let i = 0; i < 7; i++) put(g, box(0.04, 0.08, 0.02), lambert(BRIGHT_GOLD), -TW / 2 + 0.1 + (i * (TW - 0.2)) / 6, y - TH / 2 - 0.06, 0.02);   // tassels
      break;
    }
    case "window": {                                          // a tall stained-glass window in the wall, glowing, in a stone frame with a pointed head
      const frame = lambert(MARBLE, { map: tex.stone }), GW = 0.7, GH = 1.5, y0 = 0.45;
      put(g, box(GW + 0.16, GH + 0.16, 0.12), frame, 0, y0 + GH / 2, 0);
      put(g, new THREE.ConeGeometry((GW + 0.16) / 1.414, 0.45, 4).rotateY(Math.PI / 4), frame, 0, y0 + GH + 0.22, 0);
      for (let r = 0; r < 4; r++) for (let c = 0; c < 2; c++) {
        put(g, box(GW / 2 - 0.04, GH / 4 - 0.04, 0.02), basic(STAINED[Math.floor(seed * 50 + r * 2 + c) % STAINED.length]!), (c - 0.5) * (GW / 2), y0 + (r + 0.5) * (GH / 4), 0.07);
      }
      put(g, new THREE.CircleGeometry(0.16, 8), ctx.glow("#f5d562"), 0, y0 + GH + 0.08, 0.07);                // a rose at the head
      break;
    }
    case "candelabra": {                                      // a tall gold candelabra on three feet: five arms, five candles, five flames
      const gold = lambert(BRIGHT_GOLD), wax = lambert("#f4ecd8");
      for (let i = 0; i < 3; i++) put(g, box(0.06, 0.04, 0.32), gold, Math.sin((i * Math.PI * 2) / 3) * 0.12, 0.02, Math.cos((i * Math.PI * 2) / 3) * 0.12, 0, (i * Math.PI * 2) / 3, 0);
      put(g, new THREE.CylinderGeometry(0.035, 0.05, 1.45, 6), gold, 0, 0.75, 0);
      put(g, box(0.62, 0.04, 0.05), gold, 0, 1.4, 0);
      const flames: THREE.Mesh[] = [];
      for (let i = 0; i < 5; i++) {
        const x = (i - 2) * 0.15, y = 1.42 + (i === 2 ? 0.12 : Math.abs(i - 2) === 1 ? 0.05 : 0);
        put(g, new THREE.CylinderGeometry(0.03, 0.03, 0.16, 5), wax, x, y + 0.08, 0);
        flames.push(put(g, new THREE.ConeGeometry(0.03, 0.09, 4), ctx.glow("#ffd070"), x, y + 0.21, 0));
      }
      update = t => flames.forEach((f, i) => { f.scale.y = 0.8 + Math.abs(Math.sin(t * (8 + i) + i * 1.7)) * 0.5; });
      break;
    }
    case "chandelier": {                                      // hanging high over the carpet: a gold ring of candles on chains, blazing, lighting the hall
      const gold = lambert(BRIGHT_GOLD), Hc = 2.25, flames: THREE.Mesh[] = [];
      put(g, new THREE.TorusGeometry(0.55, 0.035, 4, 14).rotateX(Math.PI / 2), gold, 0, Hc, 0);
      put(g, new THREE.TorusGeometry(0.3, 0.03, 4, 10).rotateX(Math.PI / 2), gold, 0, Hc + 0.2, 0);
      for (let i = 0; i < 4; i++) put(g, box(0.02, 0.9, 0.02), lambert(IRON), Math.cos(i * Math.PI / 2) * 0.3, Hc + 0.65, Math.sin(i * Math.PI / 2) * 0.3);
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2, x = Math.cos(a) * 0.55, z = Math.sin(a) * 0.55;
        put(g, new THREE.CylinderGeometry(0.03, 0.03, 0.14, 5), lambert("#f4ecd8"), x, Hc + 0.09, z);
        flames.push(put(g, new THREE.ConeGeometry(0.035, 0.1, 4), ctx.glow("#ffd070"), x, Hc + 0.2, z));
      }
      const light = new THREE.PointLight(0xffd090, 4, 8, 1.4);
      light.position.set(0, Hc - 0.2, 0);
      g.add(light);
      update = t => {
        flames.forEach((f, i) => { f.scale.y = 0.8 + Math.abs(Math.sin(t * (7 + i * 0.7) + i)) * 0.5; });
        light.intensity = 3.8 + Math.sin(t * 6) * 0.25;
      };
      break;
    }
    case "urn": {                                             // a gilded urn of flowers on a marble pedestal
      put(g, box(0.5, 0.55, 0.5), lambert(MARBLE, { map: tex.stone }), 0, 0.275, 0);
      put(g, new THREE.LatheGeometry([[0.08, 0], [0.2, 0.1], [0.24, 0.28], [0.15, 0.42], [0.2, 0.5]].map(([r, y]) => new THREE.Vector2(r, y)), 8), lambert(BRIGHT_GOLD), 0, 0.55, 0);
      const blooms = ["#e05a7a", "#f2f0e6", "#e8d23a", "#c8423a", "#9a6ad6"];
      for (let i = 0; i < 9; i++) {
        const a = i * 2.4 + seed * 6, r = 0.08 + (i % 3) * 0.06;
        put(g, new THREE.OctahedronGeometry(0.07, 0), lambert(blooms[i % blooms.length]!), Math.cos(a) * r, 1.12 + (i % 2) * 0.08, Math.sin(a) * r);
      }
      put(g, new THREE.SphereGeometry(0.17, 6, 4), lambert("#3d6a2a"), 0, 1.06, 0);
      break;
    }
    case "cradle": {                                        // a wooden box on rockers, a little quilt in it
      put(g, box(w, 0.26, d), wood, 0, 0.3, 0);
      put(g, box(w - 0.08, 0.04, d - 0.08), lambert(LINEN), 0, 0.42, 0);
      put(g, box(w - 0.1, 0.03, d * 0.55), lambert(BLANKETS[Math.floor(seed * BLANKETS.length)]!), 0, 0.445, d * 0.15);
      put(g, box(w, 0.14, 0.05), wood, 0, 0.5, -d / 2 + 0.025);                                           // a hood at the head
      for (const sx of [-1, 1]) {                             // the rockers: a curved runner under each side, on two little posts
        const R = 0.6, arc = Math.PI * 0.42;
        put(g, new THREE.TorusGeometry(R, 0.03, 3, 10, arc).rotateZ(-Math.PI / 2 - arc / 2).rotateY(Math.PI / 2), dark, sx * (w / 2 - 0.06), R + 0.03, 0);
        for (const sz of [-1, 1]) put(g, box(0.05, 0.06, 0.05), dark, sx * (w / 2 - 0.06), 0.15, sz * d * 0.3);
      }
      break;
    }
  }
  g.position.set(p.x / T, 0, p.y / T);
  g.rotation.y = FACING_YAW[p.facing];
  parent.add(g);
  return update ? { update } : undefined;
}
