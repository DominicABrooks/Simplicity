// Paths and paving that blend into the grass. Grass covers all the ground; a path or a street is an
// overlay whose edge follows a smooth field (the tile mask, blurred, plus noise) rather than tile
// squares. Edge tiles are cut into quarter-tile quads and the field decides each corner, so the boundary
// comes out as crisp, ragged, organic curves (alpha-tested, in keeping with the pixel look) while the
// tiles underneath (and so collision) stay on the grid.
import * as THREE from "three";
import type { Tile } from "../data/world.ts";
import type { TileMap } from "../world/map.ts";
import type { RenderContext } from "./context.ts";
import { hash } from "./terrain.ts";

/** Quads per tile edge where a layer meets something else. */
const SUB = 4;

export interface LayerStyle {
  texture: THREE.Texture;
  /** World units per texture repeat. */
  repeat: number;
  /** Height above the ground (layers stack: later ones sit higher). */
  lift: number;
  /** How far the edge wanders from the tile grid (0 = straight edges, ~0.6 = very ragged). */
  wobble: number;
  seed: number;
}

/** Smooth noise around 0.5, with a little quarter-tile grain for raggedness. */
const noise = (x: number, z: number, s: number) =>
  0.5 + 0.3 * Math.sin(x * 2.1 + z * 1.3 + s) * Math.cos(x * 0.7 - z * 1.9 + s * 0.7) + 0.2 * (hash(Math.floor(x * SUB), Math.floor(z * SUB), s) - 0.5);

/** An overlay mesh for every tile `member` accepts, with blended edges. Null if there are none. */
export function blendLayer(ctx: RenderContext, map: TileMap, member: (t: Tile) => boolean, style: LayerStyle): THREE.Mesh | null {
  const { width: W, height: H, tiles } = map;
  /** 1 for a layer tile, else 0; off the map, the nearest edge tile. */
  const m = (x: number, y: number) => (member(tiles[Math.max(0, Math.min(H - 1, y))]![Math.max(0, Math.min(W - 1, x))]!) ? 1 : 0);
  /** The blurred mask at a world point (bilinear between tile centres), wobbled by noise. */
  const field = (px: number, pz: number) => {
    const fx = px - 0.5, fz = pz - 0.5, x0 = Math.floor(fx), z0 = Math.floor(fz), tx = fx - x0, tz = fz - z0;
    const top = m(x0, z0) * (1 - tx) + m(x0 + 1, z0) * tx, bottom = m(x0, z0 + 1) * (1 - tx) + m(x0 + 1, z0 + 1) * tx;
    return top * (1 - tz) + bottom * tz + style.wobble * (noise(px, pz, style.seed) - 0.5);
  };
  const pos: number[] = [], uv: number[] = [], col: number[] = [];
  const corner = (x: number, z: number, a: number) => {
    pos.push(x, style.lift, z);
    uv.push(x / style.repeat, z / style.repeat);
    col.push(1, 1, 1, a);
  };
  const quad = (x0: number, z0: number, x1: number, z1: number, alpha: (x: number, z: number) => number) => {
    const a = alpha(x0, z0), b = alpha(x0, z1), c = alpha(x1, z1), d = alpha(x1, z0);
    if (!a && !b && !c && !d) return;
    for (const [x, z, k] of [[x0, z0, a], [x0, z1, b], [x1, z1, c], [x0, z0, a], [x1, z1, c], [x1, z0, d]] as const) corner(x, z, k);
  };
  const solid = () => 1, edge = (x: number, z: number) => (field(x, z) >= 0.5 ? 1 : 0);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const here = m(x, y);
    let uniform = true;
    for (let j = -1; j <= 1 && uniform; j++) for (let i = -1; i <= 1; i++) if (m(x + i, y + j) !== here) { uniform = false; break; }
    if (uniform) { if (here) quad(x, y, x + 1, y + 1, solid); continue; }
    for (let j = 0; j < SUB; j++) for (let i = 0; i < SUB; i++) quad(x + i / SUB, y + j / SUB, x + (i + 1) / SUB, y + (j + 1) / SUB, edge);
  }
  if (!pos.length) return null;
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  geo.setAttribute("color", new THREE.Float32BufferAttribute(col, 4));
  geo.computeVertexNormals();
  const mat = ctx.lambert("#ffffff", {
    map: style.texture, vertexColors: true, alphaTest: 0.5, side: THREE.DoubleSide,
    // Sit on the ground without fighting it.
    polygonOffset: true, polygonOffsetFactor: -1 - style.lift * 200, polygonOffsetUnits: -4 - style.lift * 800,
  });
  return new THREE.Mesh(geo, mat);
}
