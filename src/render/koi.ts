// Koi swim just under the surface of every body of water, about one per 7 water tiles, and a few in
// each fountain's pool. They wander, mill around a bobber, scatter from the hero and never leave the water.
// Under a frozen lake, now and then, something big swims by: only a very large koi, a dark shape under the ice.
import * as THREE from "three";
import { angleDiff } from "../core/math.ts";
import { PAL } from "../data/palette.ts";
import { T, Tile } from "../data/world.ts";
import type { Prop } from "../world/area.ts";
import type { TileMap } from "../world/map.ts";
import { FOUNTAIN_POOL, onFountainPool } from "../world/plans.ts";
import { col, type RenderContext } from "./context.ts";
import { disposeTree } from "./dispose.ts";

const FISH_COLORS: [string, string][] = [[PAL.O, PAL.W], [PAL.R, PAL.W], [PAL.W, PAL.O], [PAL.Y, PAL.O], [PAL.O, PAL.R]];

export type KoiMesh = THREE.Group & { userData: { tail: THREE.Group } };

/** A koi: elongated octahedron body, a wiggling tail and a top fin. */
export function makeKoiMesh(ctx: RenderContext, main: string, accent: string, glow = 0.75): KoiMesh {
  const { lambert } = ctx;
  const group = new THREE.Group() as KoiMesh, tail = new THREE.Group();
  const bodyMat = lambert(main, { emissive: col(main), emissiveIntensity: glow });
  const accentMat = lambert(accent, { emissive: col(accent), emissiveIntensity: glow });
  group.add(new THREE.Mesh(koiGeo().body, bodyMat));
  const fin = new THREE.Mesh(koiGeo().fin, accentMat); fin.position.x = 0.02;
  tail.position.x = -0.17; tail.add(new THREE.Mesh(koiGeo().tail, accentMat));
  group.add(fin, tail);
  group.userData.tail = tail;
  return group;
}

let geos: { body: THREE.BufferGeometry; tail: THREE.BufferGeometry; fin: THREE.BufferGeometry } | null = null;
const koiGeo = () => (geos ??= {
  body: new THREE.OctahedronGeometry(0.1, 0).scale(1.9, 0.65, 0.8),
  tail: new THREE.ConeGeometry(0.075, 0.13, 3).rotateZ(Math.PI / 2).translate(-0.065, 0, 0),
  fin: new THREE.ConeGeometry(0.035, 0.08, 3).translate(0, 0.07, 0),
});

/** How many koi live in a fountain's pool. */
const FOUNTAIN_KOI = 5;

interface Koi {
  group: KoiMesh; x: number; z: number; heading: number; speed: number; phase: number; turn: number; dart: number;
  /** How high it swims, just under its water's surface. */
  y: number;
  /** Is (x, z) its water (a pond or river, or its fountain's pool)? */
  water: (x: number, z: number) => boolean;
}

export interface KoiPond {
  setMap(map: TileMap, props: readonly Prop[]): void;
  /** bobber: a line in the water (world X/Z) that draws the fish in. */
  update(dt: number, t: number, heroX: number, heroZ: number, bobber: { x: number; z: number } | null, bigOne?: boolean): void;
}

/** The big one under the ice: how big, how fast it glides, and how long between its passes and each pass (s). */
const BIG = { size: 7, speed: 0.55, every: 34, pass: 14, opacity: 0.38 } as const;

export function createKoiPond(ctx: RenderContext): KoiPond {
  let fish: Koi[] = [];
  let big: { group: KoiMesh; mat: THREE.MeshBasicMaterial; x: number; z: number; heading: number; turn: number; ice: (x: number, z: number) => boolean; spots: [number, number][] } | null = null;
  const pond = new THREE.Group();
  ctx.scene.add(pond);

  return {
    setMap(map, props) {
      disposeTree(pond, new Set(Object.values(koiGeo())));    // the last area's fish (the koi shapes are shared)
      pond.clear();
      const isWaterAt = (x: number, z: number) => {
        const tx = Math.floor(x), tz = Math.floor(z);
        return tx >= 0 && tz >= 0 && tx < map.width && tz < map.height && map.tiles[tz]![tx] === Tile.Water;
      };
      const waterTiles: [number, number][] = [];
      for (let y = 0; y < map.height; y++) for (let x = 0; x < map.width; x++) if (map.tiles[y]![x] === Tile.Water) waterTiles.push([x, y]);
      fish = [];
      const add = (x: number, z: number, y: number, water: Koi["water"], size: number) => {
        const [main, accent] = FISH_COLORS[Math.floor(Math.random() * FISH_COLORS.length)]!;
        const group = makeKoiMesh(ctx, main, accent);
        group.scale.setScalar(size);
        pond.add(group);
        fish.push({ group, x, z, y, water, heading: Math.random() * Math.PI * 2, speed: 0.4, phase: Math.random() * 10, turn: 0, dart: 0 });
      };
      for (let i = 0; i < Math.round(waterTiles.length / 7); i++) {
        const [x, y] = waterTiles[Math.floor(Math.random() * waterTiles.length)]!;
        add(x + 0.5, y + 0.5, -0.22, isWaterAt, 1.4 + Math.random() * 0.6);
      }
      // Under the ice, the big one: a dark shape, flattened, just under the surface (drawn on it: the ice is opaque).
      const iceTiles: [number, number][] = [];
      for (let y = 0; y < map.height; y++) for (let x = 0; x < map.width; x++) if (map.tiles[y]![x] === Tile.Ice) iceTiles.push([x, y]);
      big = null;
      if (iceTiles.length > 40) {
        const mat = ctx.basic("#28465a", { transparent: true, opacity: 0, depthWrite: false });
        const group = makeKoiMesh(ctx, "#28465a", "#28465a");
        group.traverse(o => { if (o instanceof THREE.Mesh) o.material = mat; });
        group.scale.set(BIG.size, 0.15, BIG.size);
        pond.add(group);
        const ice = (x: number, z: number) => {                // well in from the shore, so all of it stays under the ice
          for (const [dx, dz] of [[0, 0], [1.2, 0], [-1.2, 0], [0, 1.2], [0, -1.2]] as const) {
            const tx = Math.floor(x + dx), tz = Math.floor(z + dz);
            if (map.tiles[tz]?.[tx] !== Tile.Ice) return false;
          }
          return true;
        };
        const spots = iceTiles.filter(([x, y]) => ice(x + 0.5, y + 0.5));
        if (spots.length) {
          const [x, z] = spots[Math.floor(Math.random() * spots.length)]!;
          big = { group, mat, x: x + 0.5, z: z + 0.5, heading: Math.random() * Math.PI * 2, turn: 0, ice, spots };
        }
      }
      // A few in each fountain, swimming round the pedestal (smaller: it's a small pool).
      for (const p of props) {
        if (p.kind !== "fountain") continue;
        const water = (x: number, z: number) => onFountainPool(p, x, z), ring = (FOUNTAIN_POOL.pedestal + p.radius - FOUNTAIN_POOL.inset) / 2;
        for (let i = 0; i < FOUNTAIN_KOI; i++) {
          const a = (i / FOUNTAIN_KOI) * Math.PI * 2 + Math.random();
          add(p.x / T + Math.cos(a) * ring, p.y / T + Math.sin(a) * ring, FOUNTAIN_POOL.y - 0.07, water, 1 + Math.random() * 0.4);
        }
      }
    },
    update(dt, t, px, pz, bobber, bigOne = true) {
      if (big) big.group.visible = bigOne;
      if (big && bigOne) {                                              // the big one: a slow pass now and then, fading in and out
        const into = t % BIG.every, shown = into < BIG.pass;
        big.mat.opacity = shown ? BIG.opacity * Math.min(1, into / 2, (BIG.pass - into) / 2) : 0;
        big.group.visible = shown;
        if (shown && into < dt * 2) {                          // each pass starts somewhere new
          const [x, z] = big.spots[Math.floor(Math.random() * big.spots.length)]!;
          big.x = x + 0.5; big.z = z + 0.5;
        }
        if (Math.random() < dt * 0.4) big.turn = (Math.random() - 0.5) * 0.8;
        big.heading += big.turn * dt;
        const nx = big.x + Math.cos(big.heading) * BIG.speed * dt, nz = big.z + Math.sin(big.heading) * BIG.speed * dt;
        if (big.ice(nx + Math.cos(big.heading) * 0.6, nz + Math.sin(big.heading) * 0.6)) { big.x = nx; big.z = nz; }
        else big.heading += Math.PI * (0.5 + Math.random() * 0.5);
        big.group.position.set(big.x, 0.012, big.z);
        big.group.rotation.y = -big.heading;
        big.group.userData.tail.rotation.y = Math.sin(t * 2.2) * 0.45;
      }
      for (const f of fish) {
        // Wander: drift the turn rate, and occasionally pick a new one.
        if (Math.random() < dt * 0.8) f.turn = (Math.random() - 0.5) * 2.4;
        f.heading += f.turn * dt;
        // Drift toward a bobber in the water and mill around it.
        if (bobber) {
          const bx = bobber.x - f.x, bz = bobber.z - f.z, bd = Math.hypot(bx, bz);
          if (bd < 3 && bd > 0.35) f.heading += angleDiff(Math.atan2(bz, bx), f.heading) * dt * 2;
        }
        // Scatter from the hero.
        const dx = f.x - px, dz = f.z - pz, d = Math.hypot(dx, dz);
        if (d < 1.4 && f.dart <= 0) { f.heading = Math.atan2(dz, dx) + (Math.random() - 0.5) * 0.8; f.dart = 0.6; }
        f.dart = Math.max(0, f.dart - dt);
        const speed = f.dart > 0 ? 2.2 : 0.45;
        f.speed += (speed - f.speed) * (1 - Math.exp(-dt * 6));
        // Stay in the water: if the way ahead is land, turn away.
        const ahead = 0.3 * f.group.scale.x;
        if (!f.water(f.x + Math.cos(f.heading) * ahead, f.z + Math.sin(f.heading) * ahead)) {
          f.heading += Math.PI * (0.6 + Math.random() * 0.6);
          f.dart = 0;
        } else {
          f.x += Math.cos(f.heading) * f.speed * dt;
          f.z += Math.sin(f.heading) * f.speed * dt;
        }
        f.group.position.set(f.x, f.y + Math.sin(t * 1.3 + f.phase) * 0.02, f.z);
        f.group.rotation.y = -f.heading;
        f.group.userData.tail.rotation.y = Math.sin(t * (6 + f.speed * 10) + f.phase) * 0.6;
      }
    },
  };
}
