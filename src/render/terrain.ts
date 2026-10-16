// The world's static scenery, built once per map: grass with paths and paving blended over it, flowers,
// water with a sunken bed and earthen banks, a ring of mountains past the map edge, instanced trees and
// undergrowth.
import * as THREE from "three";
import { PAL } from "../data/palette.ts";
import { T, Tile, isSolidTile } from "../data/world.ts";
import type { Prop } from "../world/area.ts";
import type { TileMap } from "../world/map.ts";
import { GROUND, BED_Y, WATER_Y, type RenderContext } from "./context.ts";
import { blendLayer } from "./groundLayers.ts";
import { frosted, iceTexture, snowFacet, snowLeaf, snowy } from "./snow.ts";

type V3 = [number, number, number];
interface Quad { p: V3[]; uv: [number, number][] }

function quadGeometry(quads: Quad[]): THREE.BufferGeometry {
  const pos: number[] = [], uv: number[] = [];
  for (const q of quads) for (const i of [0, 1, 2, 0, 2, 3]) { pos.push(...q.p[i]!); uv.push(...q.uv[i]!); }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  geo.computeVertexNormals();
  return geo;
}

/** Deterministic per-position noise so the world looks the same every run. */
export const hash = (x: number, z: number, k: number): number => {
  const s = Math.sin(x * 127.1 + z * 311.7 + k * 74.7) * 43758.5453;
  return s - Math.floor(s);
};

/** The trees, as instanced meshes (trunk and two leaf clusters) and where each one stands, so they can fade. */
export interface TreeSet {
  meshes: THREE.InstancedMesh[];
  items: { x: number; z: number; scale: number; y: number }[];
}

/**
 * The ground as it's drawn: the map, but with the tiles a bridge crosses water on drawn as water (they're
 * walkable road in the map, but nothing should show under the deck but the river).
 */
export function groundUnderBridges(map: TileMap, props: readonly Prop[]): TileMap {
  const tiles = map.tiles.map(row => [...row]);
  const at = (x: number, y: number) => map.tiles[y]?.[x];
  for (const p of props) {
    if (p.kind !== "bridge" && p.kind !== "stoneBridge" && p.kind !== "drawbridge") continue;
    const x0 = Math.round(p.rect.x / T), y0 = Math.round(p.rect.y / T), x1 = x0 + Math.round(p.rect.w / T) - 1, y1 = y0 + Math.round(p.rect.h / T) - 1;
    for (let y = y0; y <= y1; y++) if (at(x0 - 1, y) === Tile.Water && at(x1 + 1, y) === Tile.Water) for (let x = x0; x <= x1; x++) tiles[y]![x] = Tile.Water;
  }
  return { ...map, tiles };
}

/** The scenery for a map whose top-left tile is at `origin` (tiles) in the world. */
/** A texture with its colour drained to a warm grey (the same pattern): grass and leaves in the ash woods. One copy each. */
const ashCopies = new Map<THREE.Texture, THREE.CanvasTexture>();
function ashen(t: THREE.CanvasTexture): THREE.CanvasTexture {
  const done = ashCopies.get(t);
  if (done) return done;
  const src = t.image as HTMLCanvasElement, c = document.createElement("canvas");
  c.width = src.width; c.height = src.height;
  const g = c.getContext("2d")!;
  g.drawImage(src, 0, 0);
  const px = g.getImageData(0, 0, c.width, c.height), d = px.data;
  for (let i = 0; i < d.length; i += 4) {
    const v = d[i]! * 0.3 + d[i + 1]! * 0.55 + d[i + 2]! * 0.15;
    d[i] = Math.min(255, v * 1.12 + 8); d[i + 1] = Math.min(255, v * 1.06 + 6); d[i + 2] = Math.min(255, v * 1.0 + 6);
  }
  g.putImageData(px, 0, 0);
  const out = new THREE.CanvasTexture(c);
  out.magFilter = t.magFilter; out.minFilter = t.minFilter; out.wrapS = t.wrapS; out.wrapT = t.wrapT; out.colorSpace = t.colorSpace;
  ashCopies.set(t, out);
  return out;
}

export function buildTerrain(ctx: RenderContext, map: TileMap, origin = { x: 0, y: 0 }, indoors = false): { group: THREE.Group; trees: TreeSet } {
  const { lambert, tex } = ctx, world = new THREE.Group();
  const { width: W, height: H, tiles } = map;
  const isWater = (x: number, y: number) => x >= 0 && y >= 0 && x < W && y < H && tiles[y]![x] === Tile.Water;
  const ground: Quad[] = [], flowers: Quad[] = [], water: Quad[] = [], bed: Quad[] = [], shore: Quad[] = [], iced: Quad[] = [], treeTiles: [number, number][] = [];
  const unitUV: [number, number][] = [[0, 0], [0, 1], [1, 1], [1, 0]];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const t = tiles[y]![x]!;
    const corners = (yy: number): V3[] => [[x, yy, y], [x, yy, y + 1], [x + 1, yy, y + 1], [x + 1, yy, y]];
    const worldUV = (k: number): [number, number][] => [[x / k, y / k], [x / k, (y + 1) / k], [(x + 1) / k, (y + 1) / k], [(x + 1) / k, y / k]];
    if (t === Tile.Water) {
      water.push({ p: corners(WATER_Y), uv: worldUV(4) });
      bed.push({ p: corners(BED_Y), uv: unitUV });
      const edges: [boolean, [number, number], [number, number]][] = [
        [!isWater(x, y - 1), [x, y], [x + 1, y]], [!isWater(x, y + 1), [x, y + 1], [x + 1, y + 1]],
        [!isWater(x - 1, y), [x, y], [x, y + 1]], [!isWater(x + 1, y), [x + 1, y], [x + 1, y + 1]],
      ];
      for (const [land, a, b] of edges) if (land) shore.push({
        p: [[a[0], 0, a[1]], [a[0], BED_Y, a[1]], [b[0], BED_Y, b[1]], [b[0], 0, b[1]]],
        uv: [[0, 1], [0, 0], [1, 0], [1, 1]],
      });
    } else {
      if (t === Tile.Ice) iced.push({ p: corners(0), uv: worldUV(4) });          // a frozen lake: ice, not grass
      else ground.push({ p: corners(0), uv: worldUV(4) });    // grass everywhere; paths and paving blend over it
      if (t === Tile.Flower) flowers.push({ p: corners(0.002), uv: unitUV });   // under the paths and paving, whose edges may spill over them
      if (t === Tile.Tree) treeTiles.push([x + 0.5, y + 0.5]);
    }
  }
  const side = { side: THREE.DoubleSide };
  // Grass, or where the dark gets in (an ash look), grass gone grey; or (a snow look) grass under snow, frost on the leaves.
  const ash = map.look === "ash", snow = map.look === "snow";
  const grass = ash ? ashen(tex.grass) : snow ? snowy(tex.grass) : tex.grass, leaves = ash ? ashen(tex.leaf) : snow ? frosted(tex.leaf) : tex.leaf;
  world.add(new THREE.Mesh(quadGeometry(ground), lambert("#ffffff", { map: grass, ...side })));
  if (iced.length) world.add(new THREE.Mesh(quadGeometry(iced), lambert("#ffffff", { map: iceTexture(), ...side })));
  // Paving (under buildings too) and dirt paths, their edges blending into the grass.
  const paving = blendLayer(ctx, map, t => t === Tile.Cobble || t === Tile.Wall, { texture: tex.cobble, repeat: 2, lift: 0.004, layer: GROUND.paving, wobble: 0.45, seed: 1 });
  const dirt = blendLayer(ctx, map, t => t === Tile.Path, { texture: tex.path, repeat: 4, lift: 0.006, layer: GROUND.path, wobble: 0.6, seed: 2 });
  for (const layer of [paving, dirt]) if (layer) world.add(layer);
  world.add(new THREE.Mesh(quadGeometry(flowers), lambert("#ffffff", { map: tex.flower, alphaTest: 0.5, ...side })));
  world.add(new THREE.Mesh(quadGeometry(bed), lambert(PAL.b, side)));
  world.add(new THREE.Mesh(quadGeometry(shore), lambert("#ffffff", { map: snow ? iceTexture() : tex.earth, ...side })));   // a hole in the ice: ice all the way down
  world.add(new THREE.Mesh(quadGeometry(water), lambert("#ffffff", { map: tex.water, transparent: true, opacity: 0.62, ...side })));

  const walkable = (x: number, y: number) => x >= 0 && y >= 0 && x < W && y < H && !isSolidTile(tiles[y]![x]!);

  // Mountains ring the world beyond the map edge: flat at the edge (meeting the ground), rising
  // gently through foothills and then into faceted ridges and snowy peaks. Kept low for the first
  // few tiles so they never hide the hero from the camera.
  const outside = (x: number, z: number) => Math.hypot(Math.max(-x, 0, x - W), Math.max(-z, 0, z - H));
  // Broad ridges plus finer crags so slopes break into rugged facets instead of smooth walls.
  const ridge = (x: number, z: number) => 0.5 + 0.26 * Math.sin(x * 0.29 + 1.7) * Math.sin(z * 0.33 + 0.3) + 0.2 * Math.sin(x * 0.11 - z * 0.15 + 2.2)
    + 0.14 * Math.sin(x * 0.83 + z * 0.21) + 0.1 * Math.sin(z * 0.97 - x * 0.4);
  // The camera looks down from the south (8.5 back, 11.5 up: see the renderer), so past the south edge
  // it's over the slope: there the hills stay under its line of sight to a hero at the edge.
  const southCap = (z: number) => (z > H ? 0.75 * (z - H) : Infinity);
  const mountainHeight = (x: number, z: number) => {
    const d = outside(x, z);
    if (d <= 0) return 0;
    const rise = Math.min(1, d / 6);
    return Math.min(southCap(z), Math.max(0, Math.pow(rise, 1.3) * (3.5 + 11 * ridge(x, z)) + (hash(x, z, 40) - 0.5) * 1.8 * rise));
  };
  if (!indoors) {                                            // indoors, nothing past the walls
    const STEP = 2, MR = 34, pos: number[] = [], colors: number[] = [], c = new THREE.Color();
    const vtx = (x: number, z: number): V3 => [x, mountainHeight(x, z), z];
    // Colour each facet by its height: mossy foothills, grey stone, snow on the peaks.
    const facetColor = (hAvg: number, x: number, z: number) => {
      const n = hash(x, z, 41);
      if (snow) return snowFacet(c, hAvg, n);
      if (hAvg < 0.7) return c.set(PAL.v).multiplyScalar(0.85 + n * 0.2);
      if (hAvg < 2.2) return c.set(n < 0.5 ? "#4f6b46" : "#5f6f52");
      if (hAvg < 8.5) return c.set(["#8a8378", "#9d968a", "#77706a", "#6b655f"][Math.floor(n * 4)]!);
      return c.set(n < 0.6 ? PAL.W : "#d9d4c8");
    };
    for (let z = -MR; z < H + MR; z += STEP) for (let x = -MR; x < W + MR; x += STEP) {
      if (x >= 0 && z >= 0 && x + STEP <= W && z + STEP <= H) continue;     // the map itself
      const a = vtx(x, z), b = vtx(x, z + STEP), cc = vtx(x + STEP, z + STEP), d = vtx(x + STEP, z);
      for (const tri of [[a, b, cc], [a, cc, d]]) {
        const hAvg = (tri[0]![1] + tri[1]![1] + tri[2]![1]) / 3;
        facetColor(hAvg, x + tri[1]![0], z + tri[2]![2]);
        for (const pt of tri) { pos.push(...pt); colors.push(c.r, c.g, c.b); }
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
    geo.computeVertexNormals();
    world.add(new THREE.Mesh(geo, lambert("#ffffff", { vertexColors: true, side: THREE.DoubleSide })));
  }

  // Trees: map trees (nudged off the grid) plus a band of trees climbing the foothills. Some are firs:
  // a few along the treeline, more in the deep woods and up the slopes.
  const placed: [number, number, number, number, boolean][] = [];   // [x, z, scale, y, fir]
  const openNear = (x: number, y: number, r: number) => {
    for (let j = -r; j <= r; j++) for (let i = -r; i <= r; i++) if (walkable(x + i, y + j)) return true;
    return false;
  };
  for (const [x, z] of treeTiles) {
    const fir = hash(x, z, 20) < (openNear(x - 0.5, z - 0.5, 2) ? 0.2 : 0.55);
    placed.push([x + (hash(x, z, 1) - 0.5) * 0.3, z + (hash(x, z, 2) - 0.5) * 0.3, 0.8 + hash(x, z, 3) * 0.45, 0, fir]);
  }
  if (!indoors) for (let y = -4; y < H + 4; y++) for (let x = -4; x < W + 4; x++) {
    if (x >= 0 && y >= 0 && x < W && y < H) continue;
    const tx = x + 0.5 + (hash(x, y, 6) - 0.5) * 0.7, tz = y + 0.5 + (hash(x, y, 7) - 0.5) * 0.7;
    const d = outside(tx, tz);
    if (d > 3 || hash(x, y, 4) > 0.65 - d * 0.18) continue;   // thinning out as the slope climbs
    placed.push([tx, tz, 0.9 + hash(x, y, 5) * 0.5, mountainHeight(tx, tz) - 0.05, hash(x, y, 20) < 0.3 + d * 0.15]);
  }
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0), none = new THREE.Matrix4().makeScale(0, 0, 0);
  /** One instance per entry; `shown` false draws it at zero size (each tree has a slot in every part, so a tree's index is the same in all of them). */
  const instanced = (geo: THREE.BufferGeometry, mat: THREE.Material, list: [number, number, number, number?, boolean?][], colorFor: (x: number, z: number) => THREE.Color, shown = (_fir: boolean) => true) => {
    const inst = new THREE.InstancedMesh(geo, mat, list.length);
    list.forEach(([x, z, k, y = 0, fir = false], i) => {
      q.setFromAxisAngle(up, hash(x, z, 8) * Math.PI * 2);
      m.compose(new THREE.Vector3(x, y, z), q, sc.set(k, k * (0.9 + hash(x, z, 9) * 0.25), k));
      inst.setMatrixAt(i, shown(fir) ? m : none);
      inst.setColorAt(i, colorFor(x, z));
    });
    world.add(inst);
    return inst;
  };
  // Leaves vary a little in hue and brightness; trees on the foothills are a little darker.
  // In ash woods the leaves have gone the grey of old ash, a few still faintly green, a few rust-brown.
  const leafColor = (x: number, z: number) => {
    const deep = x < 0 || z < 0 || x > W || z > H ? 0.85 : 1;
    const b = (0.78 + hash(x, z, 10) * 0.35) * deep;
    if (snow) return snowLeaf(x, z, b, hash);
    if (ash) {
      const k = hash(x, z, 13), grey = b * 0.9;
      return k < 0.15 ? new THREE.Color(grey * 0.85, grey, grey * 0.8) : k > 0.88 ? new THREE.Color(grey * 1.2, grey * 0.85, grey * 0.65) : new THREE.Color(grey * 1.05, grey, grey * 0.98);
    }
    return new THREE.Color(b * (0.92 + hash(x, z, 11) * 0.12), b, b * (0.9 + hash(x, z, 12) * 0.1));
  };
  // Firs are darker and bluer than the broadleaves (in the snow, frosted the same, so a little greyer).
  const needleColor = (x: number, z: number) => { const c = leafColor(x, z); return snow ? c.setRGB(c.r * 0.5, c.g * 0.6, c.b * 0.62) : c.setRGB(c.r * 0.45, c.g * 0.64, c.b * 0.62); };
  const broad = (fir: boolean) => !fir, fir = (f: boolean) => f;
  const bark = lambert("#ffffff", { map: tex.bark }), leaf = lambert("#ffffff", { map: leaves });
  const white = () => new THREE.Color(1, 1, 1);
  const trees: TreeSet = {
    meshes: [
      instanced(new THREE.CylinderGeometry(0.11, 0.17, 0.62, 5).translate(0, 0.31, 0), bark, placed, white, broad),
      instanced(new THREE.IcosahedronGeometry(0.52, 0).translate(0, 0.92, 0), leaf, placed, leafColor, broad),
      instanced(new THREE.IcosahedronGeometry(0.36, 0).translate(0.08, 1.34, 0.04), leaf, placed, leafColor, broad),
      // A fir: a slim trunk and three stacked tiers of needles, narrowing to a point.
      instanced(new THREE.CylinderGeometry(0.07, 0.12, 0.5, 5).translate(0, 0.25, 0), bark, placed, white, fir),
      instanced(new THREE.ConeGeometry(0.58, 0.72, 7).translate(0, 0.66, 0), leaf, placed, needleColor, fir),
      instanced(new THREE.ConeGeometry(0.44, 0.6, 7).translate(0, 1.04, 0).rotateY(0.45), leaf, placed, needleColor, fir),
      instanced(new THREE.ConeGeometry(0.28, 0.52, 6).translate(0, 1.4, 0).rotateY(0.9), leaf, placed, needleColor, fir),
    ],
    items: placed.map(([x, z, scale, y]) => ({ x: x + origin.x, z: z + origin.y, scale, y })),
  };

  // Undergrowth: bushes and rocks on tree tiles that face the clearing, softening the treeline.
  const bushes: [number, number, number][] = [], rocks: [number, number, number][] = [];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (tiles[y]![x] !== Tile.Tree) continue;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      if (!walkable(x + dx, y + dy) || hash(x * 3 + dx, y * 3 + dy, 13) > 0.55) continue;
      const bx = x + 0.5 + dx * 0.32 + (hash(x, y, 14 + dx) - 0.5) * 0.4;
      const bz = y + 0.5 + dy * 0.32 + (hash(x, y, 15 + dy) - 0.5) * 0.4;
      if (hash(x + dx, y + dy, 16) < 0.18) rocks.push([bx, bz, 0.7 + hash(x, y, 17) * 0.6]);
      else bushes.push([bx, bz, 0.7 + hash(x, y, 18) * 0.5]);
    }
  }
  instanced(new THREE.IcosahedronGeometry(0.24, 0).translate(0, 0.14, 0).scale(1.2, 0.8, 1.2), lambert("#ffffff", { map: leaves }), bushes, leafColor);
  instanced(new THREE.DodecahedronGeometry(0.16, 0).translate(0, 0.08, 0).scale(1.3, 0.75, 1), lambert(PAL.w), rocks,
    (x, z) => { const b = 0.75 + hash(x, z, 19) * 0.3; return new THREE.Color(b, b, b); });
  world.position.set(origin.x, 0, origin.y);
  return { group: world, trees };
}
