// Ambience: small critters and environmental detail. Purely visual: nothing here touches gameplay.
// Critters wander on their own and react to the hero: bunnies bolt, birds take off as a flock,
// butterflies scatter and frogs dive into the water. In town, rats scurry along the foot of the walls and duck
// into a gap when the hero comes near, pigeons peck about the paving, and weeds grow where the walls meet the street.
import * as THREE from "three";
import { PAL } from "../data/palette.ts";
import { Tile } from "../data/world.ts";
import type { TileMap } from "../world/map.ts";
import { GROUND, onGround, WATER_Y, col, type RenderContext } from "./context.ts";
import { disposeTree } from "./dispose.ts";
import { hash } from "./terrain.ts";

const rnd = (a: number, b: number) => a + Math.random() * (b - a);
const pick = <T>(list: readonly T[]): T => list[Math.floor(Math.random() * list.length)]!;
const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]] as const;

/** Merge simple geometries into one (used for tufts, reeds and critter parts). */
function merge(parts: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const pos: number[] = [], nor: number[] = [];
  for (const g of parts) {
    const n = g.index ? g.toNonIndexed() : g;
    n.computeVertexNormals();
    pos.push(...n.attributes.position!.array);
    nor.push(...n.attributes.normal!.array);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute("normal", new THREE.Float32BufferAttribute(nor, 3));
  return geo;
}

interface Hop { fx: number; fz: number; tx: number; tz: number; t: number; time: number; height: number }
interface Bunny { g: THREE.Group; body: THREE.Group; shadow: THREE.Mesh; x: number; z: number; t: number; hop: Hop | null; yaw: number }
interface Bird {
  g: THREE.Group; wings: THREE.Mesh[]; shadow: THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>;
  x: number; z: number; y: number; vx: number; vz: number; flying: boolean; gone: number; t: number; yaw: number; flock: number;
}
interface Butterfly { g: THREE.Group; wings: THREE.Mesh[]; x: number; z: number; hx: number; hz: number; phase: number; startle: number }
interface Rat {
  g: THREE.Group; body: THREE.Group; tail: THREE.Mesh; x: number; z: number; t: number; yaw: number; gone: number;
  /** The wall-foot spots still to run through, and the dash to the next. */
  route: number[]; dash: Hop | null; spot: number; fleeing: boolean; phase: number;
}
interface Frog { g: THREE.Group; body: THREE.Group; x: number; z: number; hop: Hop | null; gone: number; phase: number; yaw: number; diving: boolean }
type Decor = [number, number, number, number, number, THREE.Color?];   // x, y, z, scale, rotY, colour

export interface Ambient {
  /** Build an area's decor and critters (or none, with `enabled` false). */
  setMap(map: TileMap, enabled?: boolean): void;
  update(dt: number, t: number, heroX: number, heroZ: number): void;
  /** For the debug handle: where the critters are. */
  critters(): { bunnies: Bunny[]; birds: Bird[]; butterflies: Butterfly[]; frogs: Frog[]; rats: Rat[] };
}

export function createAmbient(ctx: RenderContext): Ambient {
  const { scene, lambert, basic } = ctx;
  const group = new THREE.Group();
  scene.add(group);
  let map: TileMap | null = null, W = 0, H = 0;

  const tile = (x: number, z: number) => {
    const tx = Math.floor(x), tz = Math.floor(z);
    return !map || tx < 0 || tz < 0 || tx >= W || tz >= H ? Tile.Tree : map.tiles[tz]![tx]!;
  };
  const isLand = (x: number, z: number) => { const t = tile(x, z); return t === Tile.Grass || t === Tile.Flower || t === Tile.Path || t === Tile.Cobble; };
  const isWater = (x: number, z: number) => tile(x, z) === Tile.Water;

  // Instanced static decor.
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), s3 = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
  function instanced(geo: THREE.BufferGeometry, mat: THREE.Material, list: Decor[]): void {
    if (!list.length) return;
    const inst = new THREE.InstancedMesh(geo, mat, list.length);
    list.forEach(([x, y, z, k, r, c], i) => {
      q.setFromAxisAngle(up, r);
      m4.compose(new THREE.Vector3(x, y, z), q, s3.set(k, k, k));
      inst.setMatrixAt(i, m4);
      if (c) inst.setColorAt(i, c);
    });
    group.add(inst);
  }

  // ---------- Geometry ----------
  const tuftGeo = merge([-0.05, 0, 0.05].map((o, i) => new THREE.ConeGeometry(0.025, 0.24 - i * 0.03, 3).translate(o, 0.12 - i * 0.015, (i - 1) * 0.03).rotateZ(o * 2)));
  const reedGeo = merge([-0.06, 0, 0.06].map((o, i) => new THREE.ConeGeometry(0.02, 0.6 - i * 0.12, 3).translate(o, 0.3 - i * 0.06, (i - 1) * 0.04)));
  const cattailGeo = new THREE.CylinderGeometry(0.03, 0.03, 0.12, 5).translate(0, 0.5, 0);
  const padGeo = new THREE.CylinderGeometry(0.2, 0.2, 0.01, 7, 1, false, 0.4, Math.PI * 2 - 0.6);
  const lilyGeo = new THREE.ConeGeometry(0.06, 0.08, 5).translate(0, 0.05, 0);
  const stemGeo = new THREE.CylinderGeometry(0.025, 0.03, 0.1, 5).translate(0, 0.05, 0);
  const capGeo = new THREE.SphereGeometry(0.07, 6, 3, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, 0.7, 1).translate(0, 0.09, 0);
  const logGeo = new THREE.CylinderGeometry(0.13, 0.15, 1.1, 6).rotateZ(Math.PI / 2).translate(0, 0.13, 0);
  const weedGeo = merge([-0.03, 0.02, 0.05].map((o, i) => new THREE.ConeGeometry(0.018, 0.12 - i * 0.025, 3).translate(o, 0.06 - i * 0.012, (i - 1) * 0.025).rotateZ(o * 4)));
  const ratBodyGeo = new THREE.IcosahedronGeometry(0.06, 0).scale(1.6, 0.8, 0.85);
  const ratHeadGeo = new THREE.ConeGeometry(0.035, 0.08, 5).rotateZ(-Math.PI / 2);
  const ratNoseGeo = new THREE.BoxGeometry(0.014, 0.014, 0.014);
  const ratEarGeo = new THREE.IcosahedronGeometry(0.016, 0).scale(0.5, 1, 1);
  const ratEyeGeo = new THREE.BoxGeometry(0.012, 0.012, 0.012);
  const ratTailGeo = new THREE.CylinderGeometry(0.004, 0.009, 0.17, 3).rotateZ(Math.PI / 2).translate(-0.085, 0, 0);

  // ---------- Critters ----------
  const shadowGeo = new THREE.CircleGeometry(0.12, 6).rotateX(-Math.PI / 2);
  const shadowMat = basic("#000000", { transparent: true, opacity: 0.3, depthWrite: false, ...onGround(GROUND.shadow) });
  const dark = basic(PAL.k);

  function makeBunny(): Bunny {
    const g = new THREE.Group(), body = new THREE.Group();
    const fur = lambert(pick([PAL.N, PAL.w, PAL.W, "#a8774a"]));
    const b = new THREE.Mesh(new THREE.IcosahedronGeometry(0.12, 0).scale(1.3, 0.95, 1), fur); b.position.y = 0.12;
    const head = new THREE.Mesh(new THREE.IcosahedronGeometry(0.08, 0), fur); head.position.set(0.13, 0.2, 0);
    const ears = [1, -1].map(s => { const e = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.12, 0.045), fur); e.position.set(0.1, 0.3, s * 0.035); e.rotation.z = 0.25; return e; });
    const tail = new THREE.Mesh(new THREE.IcosahedronGeometry(0.045, 0), lambert(PAL.W)); tail.position.set(-0.16, 0.13, 0);
    const eyes = [1, -1].map(s => { const e = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.02, 0.02), dark); e.position.set(0.19, 0.22, s * 0.045); return e; });
    body.add(b, head, ...ears, tail, ...eyes);
    g.add(body);
    const shadow = new THREE.Mesh(shadowGeo, shadowMat);
    group.add(g, shadow);
    return { g, body, shadow, x: 0, z: 0, t: rnd(0.5, 2), hop: null, yaw: Math.random() * 6 };
  }
  function makeBird(flock: number, pigeon = false): Bird {
    const g = new THREE.Group();
    const feather = lambert(pigeon ? pick(["#8a8e96", "#9a9ca4", "#6e727c", "#b8b4ac"]) : pick([PAL.n, PAL.k, "#5a4a3a", PAL.b]));
    const b = new THREE.Mesh(new THREE.IcosahedronGeometry(0.055, 0).scale(1.6, 1, 1), feather); b.position.y = 0.06;
    const head = new THREE.Mesh(new THREE.IcosahedronGeometry(0.04, 0), feather); head.position.set(0.07, 0.1, 0);
    const beak = new THREE.Mesh(new THREE.ConeGeometry(0.015, 0.04, 3).rotateZ(-Math.PI / 2), lambert(PAL.O)); beak.position.set(0.12, 0.1, 0);
    const breast = new THREE.Mesh(new THREE.IcosahedronGeometry(0.035, 0), lambert(pigeon ? pick(["#5e7a74", "#6a5e7e"]) : pick([PAL.R, PAL.O, PAL.w]))); breast.position.set(0.05, pigeon ? 0.08 : 0.05, 0);
    const wings = [1, -1].map(s => { const w = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.01, 0.1).translate(0, 0, s * 0.05), feather); w.position.set(-0.01, 0.08, s * 0.03); return w; });
    g.add(b, head, beak, breast, ...wings);
    const shadow = new THREE.Mesh(shadowGeo, shadowMat);
    shadow.scale.setScalar(0.6);
    group.add(g, shadow);
    return { g, wings, shadow, x: 0, z: 0, y: 0, vx: 0, vz: 0, flying: false, gone: 0, t: rnd(0.2, 1.5), yaw: Math.random() * 6, flock };
  }
  function makeButterfly(): Butterfly {
    const g = new THREE.Group();
    const wingMat = basic(pick([PAL.Y, PAL.W, PAL.O, PAL.C, "#c79cf0", "#f2a6c0"]), { side: THREE.DoubleSide });
    const wings = [1, -1].map(s => new THREE.Mesh(new THREE.PlaneGeometry(0.09, 0.08).rotateX(-Math.PI / 2).translate(0, 0, s * 0.045), wingMat));
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.015, 0.015), dark);
    g.add(body, ...wings);
    group.add(g);
    return { g, wings, x: 0, z: 0, hx: 0, hz: 0, phase: Math.random() * 10, startle: 0 };
  }
  /** A rat: a grey-brown lozenge of a body, a pointed snout, pink ears and a long bare tail. */
  function makeRat(): Rat {
    const g = new THREE.Group(), body = new THREE.Group();
    const fur = lambert(pick(["#6a5e54", "#5a524c", "#7a6a5a", "#4a4440"])), pink = lambert("#d89a98");
    const b = new THREE.Mesh(ratBodyGeo, fur); b.position.y = 0.055;
    const head = new THREE.Mesh(ratHeadGeo, fur); head.position.set(0.1, 0.06, 0);
    const nose = new THREE.Mesh(ratNoseGeo, pink); nose.position.set(0.155, 0.055, 0);
    const ears = [1, -1].map(s => { const e = new THREE.Mesh(ratEarGeo, pink); e.position.set(0.085, 0.095, s * 0.025); return e; });
    const eyes = [1, -1].map(s => { const e = new THREE.Mesh(ratEyeGeo, dark); e.position.set(0.12, 0.075, s * 0.022); return e; });
    const tail = new THREE.Mesh(ratTailGeo, pink); tail.position.set(-0.08, 0.04, 0);
    body.add(b, head, nose, ...ears, ...eyes, tail);
    g.add(body);
    g.scale.setScalar(1.5);                                // a touch big, to read at the game's size
    group.add(g);
    return { g, body, tail, x: 0, z: 0, t: rnd(0.5, 3), yaw: 0, gone: 0, route: [], dash: null, spot: 0, fleeing: false, phase: Math.random() * 10 };
  }
  function makeFrog(): Frog {
    const g = new THREE.Group(), body = new THREE.Group();
    const skin = lambert(pick([PAL.G, "#7fbf5a", PAL.v]));
    const b = new THREE.Mesh(new THREE.IcosahedronGeometry(0.08, 0).scale(1.2, 0.7, 1.1), skin); b.position.y = 0.06;
    const eyes = [1, -1].flatMap(s => {
      const e = new THREE.Mesh(new THREE.IcosahedronGeometry(0.025, 0), lambert(PAL.W)); e.position.set(0.05, 0.11, s * 0.04);
      const pupil = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.012, 0.012), dark); pupil.position.set(0.07, 0.115, s * 0.04);
      return [e, pupil];
    });
    body.add(b, ...eyes);
    g.add(body);
    group.add(g);
    return { g, body, x: 0, z: 0, hop: null, gone: 0, phase: Math.random() * 10, yaw: Math.random() * 6, diving: false };
  }

  // ---------- Atmosphere ----------
  const cloudMat = basic("#000000", { transparent: true, opacity: 0.12, depthWrite: false, ...onGround(GROUND.stain) });
  const leafGeo = new THREE.PlaneGeometry(0.08, 0.05);
  const leafMats = [basic(PAL.G, { side: THREE.DoubleSide, transparent: true }), basic(PAL.O, { side: THREE.DoubleSide, transparent: true }), basic("#86c46a", { side: THREE.DoubleSide, transparent: true })];
  const splashGeo = new THREE.RingGeometry(0.08, 0.13, 10).rotateX(-Math.PI / 2);
  /** Made once and reused across areas: never disposed. */
  const shared = new Set<unknown>([tuftGeo, reedGeo, cattailGeo, padGeo, lilyGeo, stemGeo, capGeo, logGeo, weedGeo,
    ratBodyGeo, ratHeadGeo, ratNoseGeo, ratEarGeo, ratEyeGeo, ratTailGeo,
    shadowGeo, shadowMat, dark, cloudMat, leafGeo, ...leafMats, splashGeo]);

  let bunnies: Bunny[] = [], birds: Bird[] = [], butterflies: Butterfly[] = [], frogs: Frog[] = [], rats: Rat[] = [];
  /** Where each flock of birds comes back down: the meadows, or for pigeons the paving. */
  let flockHomes: [number, number][][] = [];
  /** Spots along the foot of the walls (where, and the way to the wall), and which spots are next to which. */
  let wallFoot: { x: number; z: number; wx: number; wz: number }[] = [], footNext: number[][] = [];
  let clouds: THREE.Mesh[] = [], leaves: { mesh: THREE.Mesh; life: number; sway: number }[] = [];
  let splashes: { mesh: THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>; life: number }[] = [];
  let landTiles: [number, number][] = [], flowerTiles: [number, number][] = [], shoreTiles: [number, number][] = [], treeTiles: [number, number][] = [];
  let leafTimer = 0;

  const placeOn = (list: [number, number][]): [number, number] => { const [x, z] = pick(list); return [x + rnd(0.2, 0.8), z + rnd(0.2, 0.8)]; };

  function splash(x: number, z: number): void {
    const mesh = new THREE.Mesh(splashGeo, basic(PAL.W, { transparent: true, opacity: 0.8, depthWrite: false }));
    mesh.position.set(x, WATER_Y + 0.02, z);
    group.add(mesh);
    splashes.push({ mesh, life: 0.5 });
  }

  /** Put a rat at its spot, nose along the wall one way or the other. */
  function placeRat(r: Rat): void {
    const f = wallFoot[r.spot]!;
    r.x = f.x; r.z = f.z;
    r.yaw = -Math.atan2(f.wx, -f.wz) + (Math.random() < 0.5 ? Math.PI : 0);
  }
  /** A run along the wall from a spot: up to n spots on, never doubling back (and, given a point, only away from it). */
  function ratRoute(from: number, n: number, awayX?: number, awayZ?: number): number[] {
    const route: number[] = [], far = (j: number) => (awayX === undefined || awayZ === undefined ? 0 : Math.hypot(wallFoot[j]!.x - awayX, wallFoot[j]!.z - awayZ));
    let at = from, prev = -1;
    for (let i = 0; i < n; i++) {
      const next = (footNext[at] ?? []).filter(j => j !== prev && (awayX === undefined || far(j) > far(at)));
      if (!next.length) break;
      const j = pick(next);
      route.push(j);
      prev = at; at = j;
    }
    return route;
  }

  // Start a hop toward (tx, tz) if it lands on land; returns whether it did.
  function startHop(c: Bunny, tx: number, tz: number, time: number, height: number): boolean {
    if (!isLand(tx, tz)) return false;
    c.hop = { fx: c.x, fz: c.z, tx, tz, t: 0, time, height };
    c.yaw = -Math.atan2(tz - c.z, tx - c.x);
    return true;
  }
  // Advance a hop; returns the height. `toWater` lands with a dip (for frogs diving in).
  function stepHop(c: { x: number; z: number; hop: Hop | null }, dt: number, toWater = false): number {
    const h = c.hop!;
    h.t += dt;
    const k = Math.min(1, h.t / h.time);
    c.x = h.fx + (h.tx - h.fx) * k; c.z = h.fz + (h.tz - h.fz) * k;
    if (k >= 1) c.hop = null;
    return Math.sin(k * Math.PI) * h.height + (toWater && k > 0.8 ? WATER_Y * (k - 0.8) * 5 : 0);
  }

  return {
    setMap(m, enabled = true) {
      map = m; H = m.height; W = m.width;
      disposeTree(group, shared);                            // free the last area's decor and critters
      group.clear();
      bunnies = []; birds = []; butterflies = []; frogs = []; rats = []; clouds = []; leaves = []; splashes = [];
      flockHomes = []; wallFoot = []; footNext = [];
      landTiles = []; flowerTiles = []; shoreTiles = []; treeTiles = [];
      if (!enabled) return;
      landTiles = []; flowerTiles = []; shoreTiles = []; treeTiles = [];
      const waterTiles: [number, number][] = [];
      const near = (x: number, y: number, t: Tile) => DIRS.some(([dx, dy]) => tile(x + dx, y + dy) === t);
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        const t = m.tiles[y]![x]!;
        if (t === Tile.Grass || t === Tile.Flower) {
          landTiles.push([x, y]);
          if (t === Tile.Flower) flowerTiles.push([x, y]);
          if (near(x, y, Tile.Water)) shoreTiles.push([x, y]);
        } else if (t === Tile.Water) waterTiles.push([x, y]);
        else if (t === Tile.Tree && (near(x, y, Tile.Grass) || near(x, y, Tile.Flower))) treeTiles.push([x, y]);
      }

      // Grass tufts across the meadows: not right beside a path or paving, whose ragged edge may spill
      // onto the tile (a tuft would stand up out of the road).
      const paved = (x: number, y: number) => { const t = tile(x, y); return t === Tile.Path || t === Tile.Cobble || t === Tile.Wall; };
      const byRoad = (x: number, y: number) => { for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) if (paved(x + i, y + j)) return true; return false; };
      const tufts: Decor[] = [];
      for (const [x, y] of landTiles) {
        if (byRoad(x, y)) continue;
        for (let i = 0; i < 2; i++) {
          if (hash(x, y, 50 + i) > 0.38) continue;
          const shade = 0.75 + hash(x, y, 60 + i) * 0.4;
          tufts.push([x + hash(x, y, 70 + i), 0, y + hash(x, y, 80 + i), 1.2 + hash(x, y, 90 + i) * 0.8, hash(x, y, 95 + i) * 6, new THREE.Color(shade * 0.85, shade, shade * 0.8)]);
        }
      }
      instanced(tuftGeo, lambert("#86c46a"), tufts);

      // Reeds and cattails on the shores, leaning out over the water.
      const reeds: Decor[] = [], cattails: Decor[] = [];
      for (const [x, y] of shoreTiles) {
        if (hash(x, y, 100) > 0.6) continue;
        const [wx, wy] = DIRS.find(([dx, dy]) => tile(x + dx, y + dy) === Tile.Water)!;
        const rx = x + 0.5 + wx * 0.42 + (hash(x, y, 101) - 0.5) * 0.4, rz = y + 0.5 + wy * 0.42 + (hash(x, y, 102) - 0.5) * 0.4;
        const k = 0.8 + hash(x, y, 103) * 0.5;
        reeds.push([rx, 0, rz, k, hash(x, y, 104) * 6, new THREE.Color(0.7 + hash(x, y, 105) * 0.3, 0.85, 0.6)]);
        if (hash(x, y, 106) < 0.6) cattails.push([rx + 0.03, 0, rz, k, 0]);
      }
      instanced(reedGeo, lambert(PAL.G), reeds);
      instanced(cattailGeo, lambert(PAL.n), cattails);

      // Lily pads float on the lake and pond (not the fast river), a few with flowers.
      const pads: Decor[] = [], lilies: Decor[] = [];
      for (const [x, y] of waterTiles) {
        const open = DIRS.filter(([dx, dy]) => tile(x + dx, y + dy) === Tile.Water).length;
        if (open < 4 || hash(x, y, 110) > 0.14) continue;
        const px = x + hash(x, y, 111), pz = y + hash(x, y, 112);
        pads.push([px, WATER_Y + 0.012, pz, 0.8 + hash(x, y, 113) * 0.6, hash(x, y, 114) * 6]);
        if (hash(x, y, 115) < 0.35) lilies.push([px, WATER_Y + 0.012, pz, 1, 0]);
      }
      instanced(padGeo, lambert("#4f9a42"), pads);
      instanced(lilyGeo, lambert("#f2a6c0", { emissive: col("#f2a6c0"), emissiveIntensity: 0.2 }), lilies);

      // Mushrooms at the foot of the treeline, and the odd fallen log.
      const stems: Decor[] = [], caps: Decor[] = [], logs: Decor[] = [];
      const capColors = [PAL.R, PAL.O, PAL.N, PAL.R];
      for (const [x, y] of treeTiles) {
        if (hash(x, y, 120) < 0.16) {
          for (let i = 0; i < 1 + Math.floor(hash(x, y, 121) * 3); i++) {
            const mx = x + 0.2 + hash(x, y, 122 + i) * 0.6, mz = y + 0.2 + hash(x, y, 125 + i) * 0.6, k = 0.8 + hash(x, y, 128 + i) * 0.6;
            stems.push([mx, 0, mz, k, 0]);
            caps.push([mx, 0, mz, k, 0, col(capColors[Math.floor(hash(x, y, 131) * 4)]!)]);
          }
        }
        if (hash(x, y, 140) < 0.03) logs.push([x + 0.5, 0, y + 0.5, 1, hash(x, y, 141) * Math.PI]);
      }
      instanced(stemGeo, lambert(PAL.W), stems);
      instanced(capGeo, lambert("#ffffff"), caps);
      instanced(logGeo, lambert(PAL.N), logs);

      // Along the foot of the walls: a spot on each open tile beside a wall, and weeds in the cracks there.
      const open = (x: number, y: number) => { const t = tile(x, y); return t === Tile.Cobble || t === Tile.Path || t === Tile.Grass; };
      const footAt = new Map<number, number>(), weeds: Decor[] = [], paving: [number, number][] = [];
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        if (!open(x, y)) continue;
        const wall = DIRS.find(([dx, dy]) => tile(x + dx, y + dy) === Tile.Wall);
        if (wall) {
          footAt.set(y * W + x, wallFoot.length);
          wallFoot.push({ x: x + 0.5 + wall[0] * 0.2, z: y + 0.5 + wall[1] * 0.2, wx: wall[0], wz: wall[1] });   // out from under any sill or counter
          if (tile(x, y) !== Tile.Grass && hash(x, y, 150) < 0.3) {
            const along = (hash(x, y, 151) - 0.5) * 0.7;
            weeds.push([x + 0.5 + wall[0] * 0.44 + along * Math.abs(wall[1]), 0, y + 0.5 + wall[1] * 0.44 + along * Math.abs(wall[0]),
              0.8 + hash(x, y, 153) * 0.7, hash(x, y, 154) * 6, new THREE.Color(0.55 + hash(x, y, 155) * 0.3, 0.75, 0.45)]);
          }
        } else if (tile(x, y) === Tile.Cobble && [-1, 0, 1].every(j => [-1, 0, 1].every(i => tile(x + i, y + j) === Tile.Cobble))) paving.push([x, y]);
      }
      footNext = wallFoot.map(f => {
        const x = Math.floor(f.x), y = Math.floor(f.z);
        return DIRS.flatMap(([dx, dy]) => { const j = footAt.get((y + dy) * W + x + dx); return j === undefined ? [] : [j]; });
      });
      instanced(weedGeo, lambert("#5f8a3e"), weeds);

      // Critters.
      bunnies = Array.from({ length: 7 }, makeBunny);
      for (const b of bunnies) [b.x, b.z] = placeOn(landTiles);
      birds = [];
      const pigeonFlocks = paving.length > 300 ? 3 : 0;      // a town: pigeons about the paving
      for (let f = 0; f < 3 + pigeonFlocks; f++) {
        const pigeon = f >= 3, home = pigeon ? paving : landTiles;
        flockHomes.push(home);
        const [fx, fz] = placeOn(home);
        for (let i = 0; i < (pigeon ? 5 : 4); i++) {
          const b = makeBird(f, pigeon);
          b.x = fx + rnd(-0.6, 0.6); b.z = fz + rnd(-0.6, 0.6);
          if (!isLand(b.x, b.z)) { b.x = fx; b.z = fz; }
          birds.push(b);
        }
      }
      butterflies = Array.from({ length: 18 }, () => {
        const b = makeButterfly();
        [b.hx, b.hz] = placeOn(flowerTiles.length ? flowerTiles : landTiles);
        b.x = b.hx; b.z = b.hz;
        return b;
      });
      rats = wallFoot.length > 200 ? Array.from({ length: Math.min(12, Math.floor(wallFoot.length / 80)) }, () => {
        const r = makeRat();
        r.spot = Math.floor(Math.random() * wallFoot.length);
        placeRat(r);
        return r;
      }) : [];
      frogs = shoreTiles.length ? Array.from({ length: 6 }, () => { const f = makeFrog(); [f.x, f.z] = placeOn(shoreTiles); return f; }) : [];

      // Cloud shadows drifting across the land.
      clouds = Array.from({ length: 6 }, () => {
        const c = new THREE.Mesh(new THREE.CircleGeometry(rnd(3, 6), 12).rotateX(-Math.PI / 2).scale(1.6, 1, 1), cloudMat);
        c.position.set(rnd(0, W), 0.04, rnd(0, H));
        c.userData.speed = rnd(0.25, 0.45);
        group.add(c);
        return c;
      });
      leaves = []; splashes = [];
    },

    update(dt, t, hx, hz) {
      if (!map) return;
      const dist = (x: number, z: number) => Math.hypot(x - hx, z - hz);

      for (const b of bunnies) {
        let y = 0;
        if (b.hop) y = stepHop(b, dt);
        else if (dist(b.x, b.z) < 2.4) {                     // bolt away from the hero
          const a = Math.atan2(b.z - hz, b.x - hx) + rnd(-0.5, 0.5);
          if (!startHop(b, b.x + Math.cos(a) * 0.9, b.z + Math.sin(a) * 0.9, 0.22, 0.22)) startHop(b, b.x + rnd(-0.8, 0.8), b.z + rnd(-0.8, 0.8), 0.22, 0.22);
        } else if ((b.t -= dt) <= 0) {                       // wander: a short lazy hop
          b.t = rnd(0.8, 3);
          const a = Math.random() * Math.PI * 2;
          startHop(b, b.x + Math.cos(a) * 0.45, b.z + Math.sin(a) * 0.45, 0.3, 0.12);
        }
        b.g.position.set(b.x, y, b.z);
        b.g.rotation.y = b.yaw;
        b.body.rotation.z = b.hop ? -0.2 : Math.sin(t * 6 + b.x) * 0.04;   // nibbling when still
        b.shadow.position.set(b.x, 0.01, b.z);
      }

      for (const b of birds) {
        if (b.gone > 0) {                                    // flown off; come back somewhere else later
          b.gone -= dt;
          if (b.gone <= 0) {
            const [x, z] = placeOn(flockHomes[b.flock] ?? landTiles);
            for (const o of birds) if (o.flock === b.flock) {
              o.x = x + rnd(-0.6, 0.6); o.z = z + rnd(-0.6, 0.6);
              if (!isLand(o.x, o.z)) { o.x = x; o.z = z; }
              o.y = 0; o.flying = false; o.gone = 0; o.g.visible = o.shadow.visible = true;
            }
          }
          continue;
        }
        if (!b.flying && dist(b.x, b.z) < 3) {               // the whole flock takes off together
          for (const o of birds) if (o.flock === b.flock && !o.flying) {
            const a = Math.atan2(o.z - hz, o.x - hx) + rnd(-0.6, 0.6), sp = rnd(2.5, 3.5);
            o.flying = true; o.vx = Math.cos(a) * sp; o.vz = Math.sin(a) * sp; o.yaw = -a;
          }
        }
        if (b.flying) {
          b.x += b.vx * dt; b.z += b.vz * dt; b.y += dt * 1.6;
          b.wings.forEach((w, i) => { w.rotation.x = Math.sin(t * 30) * 0.9 * (i ? -1 : 1); });
          if (b.y > 6) {
            b.g.visible = b.shadow.visible = false;
            b.gone = rnd(6, 12);
            for (const o of birds) if (o.flock === b.flock) { o.gone = b.gone; o.g.visible = o.shadow.visible = false; }
          }
        } else {
          b.wings.forEach(w => { w.rotation.x = 0; });
          if ((b.t -= dt) <= 0) { b.t = rnd(0.3, 1.4); b.yaw += rnd(-1.2, 1.2); }
        }
        const peck = !b.flying && Math.sin(t * 9 + b.x * 7) > 0.7;
        b.g.position.set(b.x, b.y, b.z);
        b.g.rotation.set(0, b.yaw, peck ? -0.5 : 0);
        b.shadow.position.set(b.x, 0.01, b.z);
        b.shadow.material.opacity = 0.3;
      }

      for (const b of butterflies) {
        if (dist(b.x, b.z) < 1.2) b.startle = 1.5;
        b.startle = Math.max(0, b.startle - dt);
        const r = b.startle > 0 ? 1.4 : 0.6;
        b.phase += dt * (b.startle > 0 ? 2.2 : 1);
        const tx = b.hx + Math.cos(b.phase * 0.9) * r + Math.sin(b.phase * 2.3) * 0.2;
        const tz = b.hz + Math.sin(b.phase * 0.7) * r;
        const yaw = -Math.atan2(tz - b.z, tx - b.x);
        b.x += (tx - b.x) * Math.min(1, dt * 3); b.z += (tz - b.z) * Math.min(1, dt * 3);
        b.g.position.set(b.x, 0.45 + Math.sin(b.phase * 3) * 0.15 + (b.startle > 0 ? 0.4 : 0), b.z);
        b.g.rotation.y = yaw;
        b.wings.forEach((w, i) => { w.rotation.x = Math.sin(t * 22 + b.phase) * 1.1 * (i ? -1 : 1); });
      }

      for (const r of rats) {
        if (r.gone > 0) {                                    // in a gap in the wall; out again somewhere else, away from the hero
          r.gone -= dt;
          if (r.gone <= 0) {
            for (let i = 0; i < 10; i++) {
              r.spot = Math.floor(Math.random() * wallFoot.length);
              if (dist(wallFoot[r.spot]!.x, wallFoot[r.spot]!.z) > 7) break;
            }
            placeRat(r); r.route = []; r.dash = null; r.fleeing = false; r.t = rnd(0.5, 2); r.g.visible = true;
          }
          continue;
        }
        if (!r.fleeing && dist(r.x, r.z) < 2.2) {            // the hero: off along the wall, and into a gap
          r.route = ratRoute(r.spot, 3 + Math.floor(Math.random() * 3), hx, hz);
          r.fleeing = true;
          if (!r.route.length && !r.dash) { r.gone = rnd(8, 16); r.g.visible = false; continue; }
        }
        if (!r.dash && r.route.length) {                     // on to the next spot along the wall
          const j = r.route.shift()!, to = wallFoot[j]!;
          r.dash = { fx: r.x, fz: r.z, tx: to.x, tz: to.z, t: 0, time: Math.max(0.05, Math.hypot(to.x - r.x, to.z - r.z) / (r.fleeing ? 3.4 : 1.8)), height: 0 };
          r.yaw = -Math.atan2(to.z - r.z, to.x - r.x);
          r.spot = j;
        }
        const running = !!r.dash;
        if (r.dash) {
          const d = r.dash;
          d.t += dt;
          const k = Math.min(1, d.t / d.time);
          r.x = d.fx + (d.tx - d.fx) * k; r.z = d.fz + (d.tz - d.fz) * k;
          if (k >= 1) {
            r.dash = null;
            if (!r.route.length) {
              if (r.fleeing) { r.gone = rnd(8, 16); r.g.visible = false; continue; }
              r.t = rnd(0.6, 3.5);                            // stop and sniff about
            } else if (!r.fleeing && Math.random() < 0.3) { r.t = rnd(0.2, 0.8); r.route.length = 0; }   // a pause mid-run
          }
        } else if ((r.t -= dt) <= 0) r.route = ratRoute(r.spot, 1 + Math.floor(Math.random() * 5));
        r.phase += dt * (running ? 30 : 6);
        r.g.position.set(r.x, running ? Math.abs(Math.sin(r.phase)) * 0.015 : 0, r.z);
        r.g.rotation.y = r.yaw + (running ? 0 : Math.sin(t * 1.7 + r.phase) * 0.25);
        r.body.rotation.z = running ? 0 : Math.max(0, Math.sin(t * 2.3 + r.phase)) * 0.25;   // nose up, sniffing
        r.tail.rotation.y = Math.sin(r.phase * (running ? 0.5 : 0.3)) * 0.35;
      }

      for (const f of frogs) {
        if (f.gone > 0) {                                    // under water; pop up on another bank later
          f.gone -= dt;
          if (f.gone <= 0) { [f.x, f.z] = placeOn(shoreTiles); f.g.visible = true; }
          continue;
        }
        let y = 0;
        if (f.hop) {
          y = stepHop(f, dt, true);
          if (!f.hop && f.diving) { splash(f.x, f.z); f.diving = false; f.g.visible = false; f.gone = rnd(8, 15); }
        } else if (dist(f.x, f.z) < 2) {                     // leap into the nearest water
          const dirs = DIRS.map(([dx, dz]) => [f.x + dx * 0.9, f.z + dz * 0.9] as const).filter(([x, z]) => isWater(x, z));
          const to = dirs[0];
          if (to) {
            const [tx, tz] = to;
            f.hop = { fx: f.x, fz: f.z, tx, tz, t: 0, time: 0.35, height: 0.3 };
            f.yaw = -Math.atan2(tz - f.z, tx - f.x);
            f.diving = true;
          }
        }
        f.g.position.set(f.x, y, f.z);
        f.g.rotation.y = f.yaw;
        f.body.scale.y = f.hop ? 1.15 : 1 + Math.max(0, Math.sin(t * 3 + f.phase)) * 0.08;   // throat puffing
      }

      for (const c of clouds) {
        c.position.x += (c.userData.speed as number) * dt;
        if (c.position.x > W + 10) { c.position.x = -10; c.position.z = rnd(0, H); }
      }

      // Leaves drift down from trees near the hero.
      if ((leafTimer -= dt) <= 0 && treeTiles.length) {
        leafTimer = 0.25;
        const nearTrees = treeTiles.filter(([x, z]) => Math.abs(x - hx) < 8 && Math.abs(z - hz) < 6);
        if (nearTrees.length) {
          const [x, z] = pick(nearTrees);
          const mesh = new THREE.Mesh(leafGeo, pick(leafMats));
          mesh.position.set(x + rnd(0.2, 0.8), rnd(1, 1.5), z + rnd(0.2, 0.8));
          group.add(mesh);
          leaves.push({ mesh, life: 3, sway: Math.random() * 6 });
        }
      }
      leaves = leaves.filter(l => {
        const m = l.mesh;
        l.life -= dt;
        if (m.position.y > 0.02) {
          m.position.y -= dt * 0.35;
          m.position.x += Math.sin(t * 2 + l.sway) * dt * 0.4;
          m.rotation.set(t * 2 + l.sway, t * 1.3, Math.sin(t * 3 + l.sway));
        } else m.rotation.set(-Math.PI / 2, 0, l.sway);
        if (l.life > 0) return true;
        group.remove(m);
        return false;
      });
      splashes = splashes.filter(s => {
        s.life -= dt;
        const k = 1 - s.life / 0.5;
        s.mesh.scale.setScalar(1 + k * 2.5);
        s.mesh.material.opacity = 0.8 * (1 - k);
        if (s.life > 0) return true;
        group.remove(s.mesh);
        s.mesh.material.dispose();
        return false;
      });
    },

    critters: () => ({ bunnies, birds, butterflies, frogs, rats }),
  };
}
