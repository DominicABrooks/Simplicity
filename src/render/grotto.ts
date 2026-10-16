// The Koi Grotto (src/areas/grotto.ts), dressed: its walls blue-grey rock, frost on top of it, sheathed in clear ice
// wherever it faces the cave floor, icicles hanging from the lip of the high rock and snow drifted against its foot,
// with clusters of ice crystals giving off a cold light. Tall at the back of the cave, low along the front, so the
// camera (looking north) sees over them to the floor. The floor's ice clouded deeper blue here and there, cracked and
// bloomed with frost; pale shafts of daylight come down through cracks in the roof; frost hangs in the air, drifting.
// And the hole in the ice: rounded off by a rim of broken slabs and chunks, a cold light welling up out of the deep
// under it, a breath of mist off the water. Low-poly, at the hero's scale.
import * as THREE from "three";
import { softDisc } from "./camp.ts";
import { put } from "./castle.ts";
import { GROUND, WATER_Y, onGround, type RenderContext } from "./context.ts";
import type { PropView } from "./props.ts";
import { hash } from "./terrain.ts";
import type { PropOf } from "./town.ts";

/** The sides a wall cell can face the floor on (its `open` bits), as the way out from its middle. */
const SIDES = [[1, 0, -1], [2, 1, 0], [4, 0, 1], [8, -1, 0]] as const;
/** How many cold lights the crystals give at most (each is a real light, so only a few). */
const LIGHTS = 4;
/** Frost in the air: how many motes; and how many shafts of daylight through the roof. */
const MOTES = 70, SHAFTS = 3;

export function buildIceWalls(ctx: RenderContext, parent: THREE.Group, p: PropOf<"iceWalls">): PropView {
  const { lambert, glow, basic } = ctx, g = new THREE.Group();
  const walls = new Set(p.cells.map(c => c.y * 1000 + c.x)), wall = (x: number, y: number) => walls.has(y * 1000 + x);
  const W = Math.max(...p.cells.map(c => c.x)) + 1, H = Math.max(...p.cells.map(c => c.y)) + 1;
  // Which cells stand between the camera and the floor: rock with floor somewhere north of it, in its column.
  const floorNorth = new Set<number>();
  for (let x = 0; x < W; x++) for (let y = 0, seen = false; y < H; y++) {
    if (!wall(x, y)) seen = true;
    else if (seen) floorNorth.add(y * 1000 + x);
  }
  // How far each cell is from the floor (1 for the cells round it), for how the rock rises behind.
  const depth = new Map<number, number>(), queue: { x: number; y: number }[] = [];
  for (const c of p.cells) if (c.open) { depth.set(c.y * 1000 + c.x, 1); queue.push(c); }
  for (let i = 0; i < queue.length; i++) {
    const { x, y } = queue[i]!, d = depth.get(y * 1000 + x)!;
    for (const [, dx, dy] of SIDES) {
      const k = (y + dy) * 1000 + x + dx;
      if (wall(x + dx, y + dy) && !depth.has(k)) { depth.set(k, d + 1); queue.push({ x: x + dx, y: y + dy }); }
    }
  }

  const rock = [lambert("#2f3a46"), lambert("#3a4652"), lambert("#28323d")], frost = lambert("#dbe9f1"), sheath = lambert("#a9d8ee", { transparent: true, opacity: 0.7 });
  const crystal = lambert("#cdf1ff", { transparent: true, opacity: 0.88 }), heart = glow("#8fdcff", { transparent: true, opacity: 0.7 });
  const snow = lambert("#e9f4fa");
  ctx.glowAtNight(sheath, crystal);
  const lit: { x: number; z: number }[] = [];
  for (const c of p.cells) {
    const k = c.y * 1000 + c.x, front = floorNorth.has(k), d = depth.get(k) ?? 9, n = hash(c.x, c.y, 501);
    // The rock: low along the front, so he's never lost behind it; at the back and sides rising the further it is from the floor.
    const h = front ? 0.3 + Math.min(d - 1, 2) * 0.12 + n * 0.12 : Math.min(3.2, 1.3 + (d - 1) * 0.45 + n * 0.5);
    // A block of it, broken up on top by a boulder or two; frost lying in patches on it (more on the low rock at the front, so it reads).
    const stone = rock[Math.floor(hash(c.x, c.y, 502) * rock.length)]!;
    put(g, new THREE.BoxGeometry(1.02, h, 1.02), stone, c.x + 0.5, h / 2, c.y + 0.5);
    for (let i = 0; i < (front ? 1 : 2); i++) {
      const r = (front ? 0.32 : 0.45) + hash(c.x, c.y, 504 + i) * 0.2, ox = (hash(c.x, i, 505) - 0.5) * 0.5, oz = (hash(c.y, i, 506) - 0.5) * 0.5;
      const top = hash(c.x + i, c.y, 507) < (front ? 0.6 : 0.45) ? frost : rock[Math.floor(hash(c.x, c.y + i, 508) * rock.length)]!;
      put(g, new THREE.DodecahedronGeometry(r, 0), top, c.x + 0.5 + ox, h + r * 0.15, c.y + 0.5 + oz, hash(i, c.x, 509) * 3, hash(i, c.y, 509) * 3, 0).scale.y = 0.65;
    }
    if (!c.open) continue;
    // Ice down the faces toward the floor, icicles off the lip of the high rock, snow drifted at its foot, and now and
    // then a cluster of crystals there, some of them lit.
    for (const [bit, dx, dy] of SIDES) {
      if (!(c.open & bit)) continue;
      const fh = h * (0.75 + hash(c.x, c.y, 503 + bit) * 0.25), ox = c.x + 0.5 + dx * 0.53, oz = c.y + 0.5 + dy * 0.53;
      put(g, new THREE.BoxGeometry(dx ? 0.06 : 1.0, fh, dy ? 0.06 : 1.0), sheath, ox, fh / 2, oz);
      if (!front && h > 1.1) for (let i = 0; i < 4; i++) {   // a fringe of icicles, the longest in the middle
        const along = (i + 0.5) / 4 - 0.5 + (hash(c.x, c.y, 520 + i) - 0.5) * 0.12, len = 0.18 + hash(c.y, c.x, 521 + i) * 0.45 * (1 - Math.abs(along) * 1.2);
        put(g, new THREE.ConeGeometry(0.05 + len * 0.08, len, 4).rotateX(Math.PI), crystal,
          ox + dx * 0.04 + (dy ? along : 0), h - len / 2 - 0.02, oz + dy * 0.04 + (dx ? along : 0));
      }
      for (let i = 0; i < 2; i++) {                          // snow, heaped against the foot
        if (hash(c.x + i, c.y, 530 + bit) > 0.75) continue;
        const along = (hash(c.x, c.y + i, 531 + bit) - 0.5) * 0.8, r = 0.22 + hash(i, c.x + c.y, 532) * 0.18;
        put(g, new THREE.DodecahedronGeometry(r, 0), snow, ox + dx * 0.15 + (dy ? along : 0), 0.02, oz + dy * 0.15 + (dx ? along : 0), 0, hash(c.x, i, 533) * 3, 0).scale.set(1.4, 0.38, 1.1);
      }
      if (hash(c.x, c.y, 510 + bit) < 0.22) {
        const cx = c.x + 0.5 + dx * 0.7, cz = c.y + 0.5 + dy * 0.7;
        for (let i = 0; i < 3; i++) {
          const s = 0.12 + hash(c.x, i, 511) * 0.1, a = hash(c.y, i, 512) * Math.PI * 2;
          put(g, new THREE.OctahedronGeometry(s, 0), i ? crystal : heart, cx + Math.cos(a) * 0.18, s * 1.6, cz + Math.sin(a) * 0.18, 0, a, (hash(i, c.x, 513) - 0.5) * 0.6).scale.y = 2.6;
        }
        if (lit.length < LIGHTS && !front && lit.every(l => Math.hypot(l.x - cx, l.z - cz) > 6)) lit.push({ x: cx, z: cz });
      }
    }
  }
  // The cold light off the crystals, and a faint pale bloom on the ice below each.
  const lights = lit.map(({ x, z }) => {
    const light = new THREE.PointLight(0x9fe3ff, 2.2, 7, 1.4);
    light.position.set(x, 1.1, z);
    g.add(light);
    put(g, new THREE.CircleGeometry(1.4, 12).rotateX(-Math.PI / 2), basic("#d8f4ff", { transparent: true, opacity: 0.18, depthWrite: false }), x, 0.012, z);
    return light;
  });
  const air = dressFloor(ctx, g, p, wall, W, H);
  parent.add(g);
  return {
    update: (t: number, dt: number) => {
      heart.opacity = 0.55 + Math.sin(t * 0.8) * 0.15;
      lights.forEach((l, i) => { l.intensity = 2.2 + Math.sin(t * 0.7 + i * 1.9) * 0.4; });
      air(t, dt);
    },
  };
}

/** A beam's light, up its length: nothing at the roof, strongest a little above the floor, fading out on it (additive: black shows nothing). */
function beamFade(): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = 1; c.height = 64;
  const g = c.getContext("2d")!, grad = g.createLinearGradient(0, 0, 0, 64);
  grad.addColorStop(0, "#000"); grad.addColorStop(0.55, "#fff"); grad.addColorStop(0.85, "#ddd"); grad.addColorStop(1, "#000");
  g.fillStyle = grad;
  g.fillRect(0, 0, 1, 64);
  return new THREE.CanvasTexture(c);
}

/**
 * The cave floor and the air over it: deeper ice clouding the floor, cracks and frost across it, the hole's rim of
 * broken ice and the light welling up under it, shafts of daylight through the roof, and frost drifting. Returns its
 * per-frame update.
 */
function dressFloor(ctx: RenderContext, g: THREE.Group, p: PropOf<"iceWalls">, wall: (x: number, y: number) => boolean, W: number, H: number): (t: number, dt: number) => void {
  const { lambert, glow, basic } = ctx, hole = p.hole;
  const inHole = (x: number, y: number) => !!hole && x >= hole.x && x < hole.x + hole.w && y >= hole.y && y < hole.y + hole.h;
  const floor: { x: number; y: number }[] = [];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (!wall(x, y) && !inHole(x, y)) floor.push({ x, y });
  const decal = (layer: number, o: THREE.MeshBasicMaterialParameters) => ({ transparent: true, depthWrite: false, ...onGround(layer), ...o });
  const flat = new THREE.PlaneGeometry(2, 2).rotateX(-Math.PI / 2);

  // A haze of frost over the whole floor, so the lake's ripple pattern under it is only faint: this ice is old and still.
  const haze = basic("#d4e9f3", decal(GROUND.paving, { opacity: 0.42 })), tile = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
  for (const f of floor) put(g, tile, haze, f.x + 0.5, 0.008, f.y + 0.5);   // tile by tile: the hole's left clear
  // Deeper ice: clouds of darker blue under the surface; and here and there a paler bloom of frost.
  const deep = basic("#1d4c70", decal(GROUND.stain, { map: softDisc(), opacity: 0.32 })), bloom = basic("#f2fbff", decal(GROUND.stain, { map: softDisc(), opacity: 0.22 }));
  for (const f of floor) {
    const k = hash(f.x, f.y, 540);
    if (k < 0.07) put(g, flat, deep, f.x + 0.5, 0.011, f.y + 0.5, 0, k * 40, 0).scale.set(1 + hash(f.y, f.x, 541) * 1.4, 1, 0.7 + hash(f.x, f.y, 542) * 1.1);
    else if (k > 0.95) put(g, flat, bloom, f.x + 0.5, 0.012, f.y + 0.5).scale.setScalar(0.6 + hash(f.y, f.x, 543) * 0.8);
  }
  // Cracks in the ice: jagged white lines, some of them forking.
  const crackMat = basic("#f4fbff", decal(GROUND.marker, { opacity: 0.55 }));
  for (const f of floor) {
    if (hash(f.x, f.y, 550) > 0.045) continue;
    let x = f.x + 0.5, z = f.y + 0.5, a = hash(f.y, f.x, 551) * Math.PI * 2;
    for (let s = 0; s < 5; s++) {
      const step = 0.3 + hash(f.x, s, 552) * 0.35;
      a += (hash(f.y, s, 553) - 0.5) * 1.1;
      put(g, new THREE.PlaneGeometry(step, 0.03).rotateX(-Math.PI / 2), crackMat, x + Math.cos(a) * step / 2, 0.016, z + Math.sin(a) * step / 2, 0, -a, 0);
      if (s === 2 && hash(f.x, f.y, 554) < 0.5) {
        const b = a + 0.9, l = step * 0.8;
        put(g, new THREE.PlaneGeometry(l, 0.025).rotateX(-Math.PI / 2), crackMat, x + Math.cos(b) * l / 2, 0.016, z + Math.sin(b) * l / 2, 0, -b, 0);
      }
      x += Math.cos(a) * step; z += Math.sin(a) * step;
    }
  }

  // The hole: a rim of broken ice round it, rounding off its square, slabs and chunks heaved up at the edge; under the
  // water a cold light welling up out of the deep.
  let well: { glow: THREE.MeshBasicMaterial; light: THREE.PointLight; x: number; z: number } | null = null;
  if (hole) {
    const cx = hole.x + hole.w / 2, cz = hole.y + hole.h / 2, rx = hole.w / 2 + 0.12, rz = hole.h / 2 + 0.12;
    const slab = [lambert("#d6eef8"), lambert("#bfe3f3"), lambert("#e8f6fb")], clear = lambert("#a9d8ee", { transparent: true, opacity: 0.75 });
    const N = 18;
    for (let i = 0; i < N; i++) {
      const a = (i / N) * Math.PI * 2 + hash(i, cx, 560) * 0.2, r = 1 + (hash(i, cz, 561) - 0.3) * 0.12;
      const x = cx + Math.cos(a) * rx * r, z = cz + Math.sin(a) * rz * r, size = 0.22 + hash(i, 1, 562) * 0.2;
      put(g, new THREE.BoxGeometry(size * 1.6, 0.1 + hash(i, 2, 563) * 0.12, size), slab[i % slab.length]!, x, 0.04, z, (hash(i, 3, 564) - 0.5) * 0.5, -a + Math.PI / 2, (hash(i, 4, 565) - 0.5) * 0.5);
      if (hash(i, 5, 566) < 0.45) put(g, new THREE.DodecahedronGeometry(0.1 + hash(i, 6, 567) * 0.08, 0), clear, x + Math.cos(a) * 0.22, 0.06, z + Math.sin(a) * 0.22);
    }
    for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]] as const) {   // the square's corners, under heaped ice
      put(g, new THREE.DodecahedronGeometry(0.3, 0), slab[0]!, cx + sx * (hole.w / 2 - 0.05), 0.03, cz + sz * (hole.h / 2 - 0.05), 0, sx * sz, 0).scale.set(1.2, 0.45, 1.2);
    }
    const welling = glow("#5cc8ff", { transparent: true, opacity: 0.4, depthWrite: false, blending: THREE.AdditiveBlending, map: softDisc() });
    put(g, flat, welling, cx, WATER_Y + 0.03, cz).scale.set(rx * 0.95, 1, rz * 0.95);
    const light = new THREE.PointLight(0x6fd4ff, 2.4, 6, 1.3);
    light.position.set(cx, 0.5, cz);
    g.add(light);
    well = { glow: welling, light, x: cx, z: cz };
  }

  // Shafts of daylight through cracks in the roof, slanting down onto the floor, a pale pool where each lands.
  const shaftMat = glow("#eaf7ff", { transparent: true, opacity: 0.07, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, map: beamFade() });
  const poolMat = basic("#f4fbff", decal(GROUND.marker, { map: softDisc(), opacity: 0.3 }));
  const away = floor.filter(f => !hole || Math.hypot(f.x - hole.x, f.y - hole.y) > 4).sort((a, b) => hash(a.x, a.y, 570) - hash(b.x, b.y, 570));
  const shafts: { x: number; z: number }[] = [];
  for (const f of away) if (shafts.length < SHAFTS && shafts.every(s => Math.hypot(s.x - f.x, s.z - f.y) > 5)) shafts.push({ x: f.x + 0.5, z: f.y + 0.5 });
  for (const s of shafts) {
    // Leaning back from the camera (north) and a little east, as the sun stands outside: never across his view.
    put(g, new THREE.CylinderGeometry(0.3, 0.55, 5.5, 6, 1, true).translate(0, 2.75, 0), shaftMat, s.x, 0, s.z, -0.3, 0, -0.15);
    put(g, flat, poolMat, s.x, 0.014, s.z).scale.set(0.9, 1, 0.75);
  }

  // Frost in the air: motes drifting slowly down and sideways through the cave, and round again from the top.
  const moteMat = glow("#f2fbff", { transparent: true, opacity: 0.7 }), moteGeo = new THREE.OctahedronGeometry(0.035, 0);
  const motes = floor.length ? Array.from({ length: MOTES }, (_, i) => {
    const f = floor[Math.floor(hash(i, 7, 580) * floor.length)]!, m = put(g, moteGeo, moteMat, f.x + hash(i, 8, 581), hash(i, 9, 582) * 3.5, f.y + hash(i, 10, 583));
    return { m, x: m.position.x, z: m.position.z, k: hash(i, 11, 584) * 6, fall: 0.12 + hash(i, 12, 585) * 0.12 };
  }) : [];

  return (t, dt) => {
    for (const d of motes) {
      d.m.position.y -= d.fall * dt;
      if (d.m.position.y < 0) d.m.position.y = 3.5;
      d.m.position.x = d.x + Math.sin(t * 0.4 + d.k) * 0.35;
      d.m.position.z = d.z + Math.cos(t * 0.33 + d.k) * 0.25;
    }
    shaftMat.opacity = 0.065 + Math.sin(t * 0.25) * 0.015;
    if (well) {
      const b = Math.sin(t * 0.9) * 0.5 + Math.sin(t * 2.3) * 0.2;
      well.glow.opacity = 0.38 + b * 0.12;
      well.light.intensity = 2.4 + b * 0.5;
    }
  };
}
