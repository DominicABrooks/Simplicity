// The world's static scenery, built once per map: ground and flower quads, water with a sunken bed
// and earthen banks, a ring of mountains past the map edge, instanced trees and undergrowth.
import * as THREE from "three";
import { PAL } from "../data/palette.ts";
import { Tile, isSolidTile } from "../data/world.ts";
import type { TileMap } from "../world/map.ts";
import { BED_Y, WATER_Y, type RenderContext } from "./context.ts";

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

export function buildTerrain(ctx: RenderContext, map: TileMap): THREE.Group {
  const { lambert, tex } = ctx, world = new THREE.Group();
  const { width: W, height: H, tiles } = map;
  const isWater = (x: number, y: number) => x >= 0 && y >= 0 && x < W && y < H && tiles[y]![x] === Tile.Water;
  const paths: Quad[] = [], cobbles: Quad[] = [], ground: Quad[] = [], flowers: Quad[] = [], water: Quad[] = [], bed: Quad[] = [], shore: Quad[] = [], trees: [number, number][] = [];
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
      if (t === Tile.Path) paths.push({ p: corners(0), uv: worldUV(4) });
      else if (t === Tile.Cobble || t === Tile.Wall) cobbles.push({ p: corners(0), uv: worldUV(2) });   // paving, under buildings too
      else ground.push({ p: corners(0), uv: worldUV(4) });
      if (t === Tile.Flower) flowers.push({ p: corners(0.01), uv: unitUV });
      if (t === Tile.Tree) trees.push([x + 0.5, y + 0.5]);
    }
  }
  const side = { side: THREE.DoubleSide };
  world.add(new THREE.Mesh(quadGeometry(ground), lambert("#ffffff", { map: tex.grass, ...side })));
  world.add(new THREE.Mesh(quadGeometry(paths), lambert("#ffffff", { map: tex.path, ...side })));
  world.add(new THREE.Mesh(quadGeometry(cobbles), lambert("#ffffff", { map: tex.cobble, ...side })));
  world.add(new THREE.Mesh(quadGeometry(flowers), lambert("#ffffff", { map: tex.flower, alphaTest: 0.5, ...side })));
  world.add(new THREE.Mesh(quadGeometry(bed), lambert(PAL.b, side)));
  world.add(new THREE.Mesh(quadGeometry(shore), lambert("#ffffff", { map: tex.earth, ...side })));
  world.add(new THREE.Mesh(quadGeometry(water), lambert("#ffffff", { map: tex.water, transparent: true, opacity: 0.62, ...side })));

  const walkable = (x: number, y: number) => x >= 0 && y >= 0 && x < W && y < H && !isSolidTile(tiles[y]![x]!);

  // Mountains ring the world beyond the map edge: flat at the edge (meeting the ground), rising
  // gently through foothills and then into faceted ridges and snowy peaks. Kept low for the first
  // few tiles so they never hide the hero from the camera.
  const outside = (x: number, z: number) => Math.hypot(Math.max(-x, 0, x - W), Math.max(-z, 0, z - H));
  // Broad ridges plus finer crags so slopes break into rugged facets instead of smooth walls.
  const ridge = (x: number, z: number) => 0.5 + 0.26 * Math.sin(x * 0.29 + 1.7) * Math.sin(z * 0.33 + 0.3) + 0.2 * Math.sin(x * 0.11 - z * 0.15 + 2.2)
    + 0.14 * Math.sin(x * 0.83 + z * 0.21) + 0.1 * Math.sin(z * 0.97 - x * 0.4);
  const mountainHeight = (x: number, z: number) => {
    const d = outside(x, z);
    if (d <= 0) return 0;
    const rise = Math.min(1, d / 6);
    return Math.max(0, Math.pow(rise, 1.3) * (3.5 + 11 * ridge(x, z)) + (hash(x, z, 40) - 0.5) * 1.8 * rise);
  };
  {
    const STEP = 2, MR = 34, pos: number[] = [], colors: number[] = [], c = new THREE.Color();
    const vtx = (x: number, z: number): V3 => [x, mountainHeight(x, z), z];
    // Colour each facet by its height: mossy foothills, grey stone, snow on the peaks.
    const facetColor = (hAvg: number, x: number, z: number) => {
      const n = hash(x, z, 41);
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

  // Trees: map trees (nudged off the grid) plus a band of trees climbing the foothills.
  const placed: [number, number, number, number][] = [];   // [x, z, scale, y]
  for (const [x, z] of trees) {
    placed.push([x + (hash(x, z, 1) - 0.5) * 0.3, z + (hash(x, z, 2) - 0.5) * 0.3, 0.8 + hash(x, z, 3) * 0.45, 0]);
  }
  for (let y = -4; y < H + 4; y++) for (let x = -4; x < W + 4; x++) {
    if (x >= 0 && y >= 0 && x < W && y < H) continue;
    const tx = x + 0.5 + (hash(x, y, 6) - 0.5) * 0.7, tz = y + 0.5 + (hash(x, y, 7) - 0.5) * 0.7;
    const d = outside(tx, tz);
    if (d > 3 || hash(x, y, 4) > 0.65 - d * 0.18) continue;   // thinning out as the slope climbs
    placed.push([tx, tz, 0.9 + hash(x, y, 5) * 0.5, mountainHeight(tx, tz) - 0.05]);
  }
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
  const instanced = (geo: THREE.BufferGeometry, mat: THREE.Material, list: [number, number, number, number?][], colorFor: (x: number, z: number) => THREE.Color) => {
    const inst = new THREE.InstancedMesh(geo, mat, list.length);
    list.forEach(([x, z, k, y = 0], i) => {
      q.setFromAxisAngle(up, hash(x, z, 8) * Math.PI * 2);
      m.compose(new THREE.Vector3(x, y, z), q, sc.set(k, k * (0.9 + hash(x, z, 9) * 0.25), k));
      inst.setMatrixAt(i, m);
      inst.setColorAt(i, colorFor(x, z));
    });
    world.add(inst);
  };
  // Leaves vary a little in hue and brightness; trees on the foothills are a little darker.
  const leafColor = (x: number, z: number) => {
    const deep = x < 0 || z < 0 || x > W || z > H ? 0.85 : 1;
    const b = (0.78 + hash(x, z, 10) * 0.35) * deep;
    return new THREE.Color(b * (0.92 + hash(x, z, 11) * 0.12), b, b * (0.9 + hash(x, z, 12) * 0.1));
  };
  instanced(new THREE.CylinderGeometry(0.11, 0.17, 0.62, 5).translate(0, 0.31, 0), lambert("#ffffff", { map: tex.bark }), placed, () => new THREE.Color(1, 1, 1));
  instanced(new THREE.IcosahedronGeometry(0.52, 0).translate(0, 0.92, 0), lambert("#ffffff", { map: tex.leaf }), placed, leafColor);
  instanced(new THREE.IcosahedronGeometry(0.36, 0).translate(0.08, 1.34, 0.04), lambert("#ffffff", { map: tex.leaf }), placed, leafColor);

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
  instanced(new THREE.IcosahedronGeometry(0.24, 0).translate(0, 0.14, 0).scale(1.2, 0.8, 1.2), lambert("#ffffff", { map: tex.leaf }), bushes, leafColor);
  instanced(new THREE.DodecahedronGeometry(0.16, 0).translate(0, 0.08, 0).scale(1.3, 0.75, 1), lambert(PAL.w), rocks,
    (x, z) => { const b = 0.75 + hash(x, z, 19) * 0.3; return new THREE.Color(b, b, b); });
  return world;
}
