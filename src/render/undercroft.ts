// Under St Mary's (see docs/CURIOSITIES.md): the low iron-banded door at the foot of the tower, the chest tombs
// of the church's dead with their effigies, and the ring of old grey standing stones on the temple floor beneath it
// all, faintly warm, spirals cut in them breathing a little light, one stone missing. Low-poly and flat-coloured like
// everything else, at the hero's scale; every detail stands proud of what it's on or is cut into it, never laid flat
// on a face (with every vertex snapped to the screen's coarse grid, a face laid on a face flickers through it).
import * as THREE from "three";
import { T } from "../data/world.ts";
import type { Facing } from "../world/area.ts";
import { FACING_YAW, ROOM_WALL } from "../world/plans.ts";
import { LAMP_OFF, NEST_R } from "../world/solids.ts";
import { ringPlan } from "../world/stonering.ts";
import { put } from "./castle.ts";
import { GROUND, box, onGround, toWorld, type RenderContext } from "./context.ts";
import { disposeTree } from "./dispose.ts";
import type { PropView } from "./props.ts";
import { hash } from "./terrain.ts";
import { DARK_WOOD, IRON, type PropOf } from "./town.ts";
import type { EntityView } from "./views.ts";
import { sealOpen } from "../game/undercroft.ts";

const STONE = "#8f8a80", PALE_STONE = "#b9b2a4", EFFIGY = "#cbc4b6", AEL = "#7fd8c4";

/**
 * The door: a low pointed arch of dressed stone blocks round a heavy plank door, strap hinges and a ring handle on it
 * and a big iron lock plate, a worn step before it and a little moss.
 */
export function buildCryptDoor(ctx: RenderContext, parent: THREE.Group, p: PropOf<"cryptDoor">): PropView {
  const { lambert } = ctx, g = new THREE.Group(), stone = lambert(PALE_STONE, { map: ctx.tex.stone }), wood = lambert(DARK_WOOD), plank = lambert("#5a3f2a"), iron = lambert(IRON);
  // The jambs, block on block, and the arch over them: voussoirs round two arcs meeting at a point.
  for (const s of [-1, 1]) for (let i = 0; i < 4; i++) put(g, box(0.2, 0.25, 0.2), stone, s * 0.47, 0.13 + i * 0.26, 0.05);
  // An equilateral arch: each side an arc centred on the other side's springing, the two meeting at the keystone.
  const spring = 1.04, w = 0.47, r = 2 * w, apex = spring + r * Math.sin(Math.PI / 3);
  for (const s of [-1, 1]) for (let i = 0; i < 4; i++) {
    const th = ((i + 0.5) / 4) * (Math.PI / 3), x = -s * w + s * r * Math.cos(th), y = spring + r * Math.sin(th);
    put(g, box(0.2, 0.17, 0.2), stone, x, y, 0.05, 0, 0, s * th);
  }
  put(g, box(0.17, 0.22, 0.2), stone, 0, apex + 0.02, 0.05);       // the keystone
  // The door: planks side by side, a little back in the arch, each cut to the curve of it over its head.
  for (let i = 0; i < 6; i++) {
    const x = -0.31 + i * 0.124, edge = Math.abs(x) + 0.062, top = spring + Math.sqrt(Math.max(0, r * r - (edge + w) * (edge + w))) - 0.08;
    put(g, box(0.124, top, 0.05), i % 2 ? plank : wood, x, top / 2, 0);
  }
  // Strap hinges, the ring and the lock plate, standing off the planks.
  for (const y of [0.28, 0.78]) put(g, box(0.5, 0.05, 0.025), iron, -0.12, y, 0.04);
  put(g, new THREE.TorusGeometry(0.06, 0.012, 4, 10), iron, 0.18, 0.5, 0.05);
  put(g, box(0.12, 0.16, 0.03), iron, 0.2, 0.68, 0.04);
  put(g, box(0.025, 0.06, 0.01), ctx.basic("#0a0808"), 0.2, 0.66, 0.06);
  // The step, worn hollow in the middle, and a little moss at its corner.
  put(g, box(1.2, 0.08, 0.38), stone, 0, 0.04, 0.27);
  put(g, new THREE.DodecahedronGeometry(0.07, 0).scale(1.6, 0.5, 1.2), lambert("#4f6a35"), -0.48, 0.09, 0.36);
  g.position.set(p.x / T, 0, p.y / T);
  g.rotation.y = FACING_YAW[p.facing];
  parent.add(g);
}

/**
 * A chest tomb: a stepped plinth, the chest framed with corner posts and rails round sunken panels, a shield carved
 * proud in each, a moulded lid with a band of lettering round its edge; and on it, if it's old enough, its effigy:
 * lying in its robe with its head on a cushion and its hands together, a crown or a hood or a mitre, sometimes a sword
 * laid along it, and a little dog or lion at its feet. Long along z, its foot at +z.
 */
export function buildTomb(ctx: RenderContext, parent: THREE.Group, p: PropOf<"tomb">): PropView {
  const { lambert } = ctx, g = new THREE.Group(), k = hash(p.x, p.y, 501), k2 = hash(p.x, p.y, 505);
  const stone = lambert(k < 0.5 ? STONE : PALE_STONE, { map: ctx.tex.stone }), dark = lambert("#5d5850"), sunk = lambert("#6e6960"), cut = lambert("#3e3a35");
  const pale = lambert(EFFIGY), worn = lambert("#b4ad9f");
  /** A shield, standing out of a sunken panel: square-topped, pointed below. */
  const shield = (x: number, z: number, yaw: number) => {
    const sh = new THREE.Group();
    sh.position.set(x, 0.4, z);
    sh.rotation.y = yaw;
    put(sh, box(0.14, 0.1, 0.05), worn, 0, 0.03, 0);
    put(sh, box(0.1, 0.1, 0.05), worn, 0, -0.04, 0, 0, 0, Math.PI / 4);
    g.add(sh);
  };
  // The plinth, stepped.
  put(g, box(1.02, 0.08, 2.02), dark, 0, 0.04, 0);
  put(g, box(0.94, 0.06, 1.94), stone, 0, 0.11, 0);
  // The chest: sunken panels between posts and rails.
  put(g, box(0.76, 0.42, 1.76), sunk, 0, 0.35, 0);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) put(g, box(0.1, 0.46, 0.1), stone, sx * 0.4, 0.37, sz * 0.9);
  for (const y of [0.17, 0.57]) {
    for (const sx of [-1, 1]) put(g, box(0.07, 0.06, 1.72), stone, sx * 0.4, y, 0);
    for (const sz of [-1, 1]) put(g, box(0.72, 0.06, 0.07), stone, 0, y, sz * 0.9);
  }
  for (const sx of [-1, 1]) for (const z of [-0.55, 0, 0.55]) {
    put(g, box(0.06, 0.3, 0.06), stone, sx * 0.4, 0.37, z + 0.27);   // the posts between the panels
    shield(sx * 0.4, z, Math.PI / 2 * sx);                          // a shield in each, standing out of the sunken face
  }
  shield(0, 0.9, 0);                                                 // and one on its foot, the Kellets' mark cut in it
  put(g, box(0.03, 0.08, 0.02), cut, 0, 0.4, 0.95);
  // The lid, moulded, a band of lettering standing proud round its edge.
  put(g, box(0.96, 0.07, 1.98), stone, 0, 0.635, 0);
  put(g, box(0.88, 0.05, 1.9), stone, 0, 0.695, 0);
  for (const sx of [-1, 1]) put(g, box(0.02, 0.035, 1.6), cut, sx * 0.49, 0.635, 0);
  if (p.effigy) {
    const top = 0.72;
    // The cushion, tilted up under its head; its head on it, a little raised.
    put(g, box(0.42, 0.09, 0.32), worn, 0, top + 0.05, -0.7, -0.22, 0, 0);
    put(g, new THREE.IcosahedronGeometry(0.135, 1).scale(1, 0.95, 1.05), pale, 0, top + 0.2, -0.64);
    // What it wears on its head: a crown, a hood or a mitre.
    if (k2 < 0.34) for (let i = 0; i < 5; i++) put(g, new THREE.ConeGeometry(0.028, 0.08, 4), worn, Math.cos((i / 5) * Math.PI * 2) * 0.11, top + 0.33, -0.64 + Math.sin((i / 5) * Math.PI * 2) * 0.11);
    else if (k2 < 0.67) put(g, new THREE.IcosahedronGeometry(0.15, 1).scale(1.08, 1, 1.2), worn, 0, top + 0.21, -0.69);
    else put(g, new THREE.ConeGeometry(0.11, 0.22, 4).scale(1, 1, 0.5), worn, 0, top + 0.36, -0.64, -Math.PI / 2, 0, 0);
    // Its shoulders, and its robe falling from them, narrowing to the feet, two folds down it.
    put(g, box(0.4, 0.13, 0.2), pale, 0, top + 0.1, -0.42);
    put(g, new THREE.CylinderGeometry(0.19, 0.15, 1.0, 7).rotateX(Math.PI / 2).scale(1, 0.72, 1), pale, 0, top + 0.1, 0.12);
    for (const sx of [-0.06, 0.07]) put(g, box(0.035, 0.035, 0.8), worn, sx, top + 0.21, 0.18);
    // Its hands, together at its breast, pointing up.
    for (const s of [-1, 1]) put(g, box(0.065, 0.19, 0.065), pale, s * 0.03, top + 0.29, -0.24, 0.15, 0, s * -0.3);
    // Its feet, toes up, at the end of the robe.
    for (const s of [-1, 1]) put(g, box(0.075, 0.13, 0.08), pale, s * 0.06, top + 0.12, 0.66);
    // A sword laid at its side, on some.
    if (k > 0.5) {
      put(g, box(0.04, 0.03, 0.78), worn, 0.2, top + 0.15, 0.1);
      put(g, box(0.18, 0.035, 0.045), worn, 0.2, top + 0.15, -0.3);
    }
    // At its feet, a little dog (or a lion), curled.
    put(g, new THREE.IcosahedronGeometry(0.12, 0).scale(1.3, 0.8, 1), worn, 0, top + 0.08, 0.83);
    put(g, new THREE.IcosahedronGeometry(0.07, 0), worn, 0.11, top + 0.14, 0.9);
  }
  g.position.set(p.x / T, 0, p.y / T);
  g.rotation.y = FACING_YAW[p.facing];
  parent.add(g);
}

/** A standing stone, `h` high: a rough slab, broad at the foot and thinning to a ragged top. */
export function menhir(h: number, k: number): THREE.BufferGeometry {
  const geo = new THREE.CylinderGeometry(0.17 + k * 0.05, 0.3, h, 5, 2).translate(0, h / 2, 0).scale(1, 1, 0.55);
  // Knock its corners about a little, so no two are alike and none is a neat prism.
  const pos = geo.getAttribute("position") as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i), wob = hash(i * 13 + k * 97, Math.round(y * 10), 506) - 0.5;
    pos.setX(i, pos.getX(i) + wob * 0.06);
    if (y > h - 0.01) pos.setY(i, y + wob * 0.18);
  }
  geo.computeVertexNormals();
  return geo;
}

/**
 * The ring: grey standing stones, tall and rough and leaning, older than anything above them, packing stones at their
 * feet, a spiral cut in each one's inner face that breathes a faint light, and between them the temple's own floor of
 * great worn flags round a low hearth stone, a ring of light along their feet. In the gap, the socket the missing one
 * stood in: a squat carved base, a dark hole worn smooth in it (the Mysterious Stone, set there, is the game's
 * ringstone entity, drawn by its own view).
 */
export function buildStoneRing(ctx: RenderContext, parent: THREE.Group, p: PropOf<"stoneRing">): PropView {
  const { lambert } = ctx, g = new THREE.Group(), plan = ringPlan(p), cx = p.x / T, cz = p.y / T;
  // Pale, so they hold their own in the gloom down here; the temple's flags a cold grey against the church's warm floor.
  const greys = ["#cdc8bd", "#d8d3c8", "#c1bcb1", "#c8c3b7"].map(c => lambert(c, { map: ctx.tex.stone }));
  const flags = ["#a7a399", "#9d998f", "#b0aca1"].map(c => lambert(c, { map: ctx.tex.stone })), moss = lambert("#6f8a4f");
  const glow = ctx.glow(AEL, { transparent: true, opacity: 0.25, depthWrite: false, ...onGround(GROUND.marker) });
  const carve = ctx.glow(AEL, { transparent: true, opacity: 0.5 });
  // The temple floor: two rings of great worn flags, a little gap between each, round the hearth stone.
  for (const [r0, r1, n] of [[0.75, 1.75, 9], [1.85, p.radius + 0.95, 14]] as const) {
    for (let i = 0; i < n; i++) {
      const a = ((i + 0.5) / n) * Math.PI * 2, r = (r0 + r1) / 2, len = r1 - r0, wide = ((Math.PI * 2 * r) / n) * 0.9;
      const thick = 0.05 + hash(i, n, 507) * 0.03;                 // well clear of the room's floor, which is drawn pulled forward
      put(g, box(wide, thick, len), flags[(i + n) % 3]!, Math.cos(a) * r, thick / 2 + 0.02, Math.sin(a) * r, 0, -a + Math.PI / 2, 0);
    }
  }
  put(g, new THREE.CylinderGeometry(0.62, 0.68, 0.16, 9), greys[2]!, 0, 0.08, 0);     // the hearth stone
  put(g, new THREE.CylinderGeometry(0.2, 0.14, 0.04, 9), ctx.basic("#141210"), 0, 0.17, 0);   // the cup cut in it
  put(g, new THREE.RingGeometry(p.radius - 0.12, p.radius + 0.12, 32).rotateX(-Math.PI / 2), glow, 0, 0.11, 0);
  // A little of Ael's light in the ring, so it reads in the dark down here.
  const light = new THREE.PointLight(AEL, 2.6, 9, 1.2);
  light.position.set(0, 1.4, 0);
  g.add(light);
  for (const s of plan.stones) {
    const k = hash(s.x, s.z, 502), h = 1.4 + k * 0.7, a = Math.atan2(s.z - cz, s.x - cx), lx = s.x - cx, lz = s.z - cz;
    const stone = new THREE.Group();
    stone.position.set(lx, 0, lz);
    stone.rotation.set(0, -a - Math.PI / 2, 0);              // its broad face to the middle (local +z, inward)
    g.add(stone);
    const slab = put(stone, menhir(h, k), greys[s.i % greys.length]!, 0, -0.05, 0);
    slab.rotation.set((k - 0.5) * 0.16, 0, (hash(s.x, s.z, 503) - 0.5) * 0.22);
    // Packing stones round its foot, and moss on the shady side.
    for (let j = 0; j < 3; j++) put(stone, new THREE.DodecahedronGeometry(0.1 + hash(s.i, j, 508) * 0.06, 0), greys[(s.i + j) % greys.length]!, (j - 1) * 0.26, 0.05, (j === 1 ? -0.22 : 0.16));
    put(stone, new THREE.DodecahedronGeometry(0.09, 0).scale(1.8, 0.45, 1), moss, -0.08, 0.06, -0.2);
    // The spiral cut in its inner face, standing just off it, faintly lit.
    put(stone, new THREE.TorusGeometry(0.09, 0.016, 3, 10, Math.PI * 1.6), carve, 0, h * 0.55, 0.2, 0, 0, k * 3);
    put(stone, new THREE.TorusGeometry(0.045, 0.014, 3, 8, Math.PI * 1.4), carve, 0, h * 0.55, 0.2, 0, 0, k * 3 + 2);
  }
  // The socket where the missing one stood: a squat carved base, the hole in it worn smooth.
  const at = plan.socket;
  put(g, new THREE.CylinderGeometry(0.36, 0.42, 0.12, 8), greys[0]!, at.x - cx, 0.06, at.z - cz);
  put(g, new THREE.CylinderGeometry(0.22, 0.22, 0.02, 8), ctx.basic("#141210"), at.x - cx, 0.125, at.z - cz);
  g.position.set(cx, 0, cz);
  parent.add(g);
  const k = hash(p.x, p.y, 504) * 6;
  return {
    update: (t: number) => {
      const b = Math.sin(t * 0.9 + k);
      glow.opacity = 0.2 + b * 0.1;
      carve.opacity = 0.55 + Math.sin(t * 0.9 + k + 1) * 0.25;
      light.intensity = 2.4 + b * 0.5;
    },
  };
}

/** The Mysterious Stone, set back in its socket: a standing stone like the others, slowly turning, glowing blue-green. */
interface RingstoneView { group: THREE.Group; stone: THREE.Group; glow: THREE.MeshBasicMaterial; light: THREE.PointLight; k: number }
export const ringstone: EntityView<RingstoneView> = {
  create(ctx, e, g) {
    const group = new THREE.Group(), stone = new THREE.Group(), glow = ctx.glow(AEL, { transparent: true, opacity: 0.5 });
    put(stone, menhir(1.5, 0.4), ctx.lambert("#9a958c", { map: ctx.tex.stone, emissive: new THREE.Color("#1c4a40") }), 0, 0.12, 0);
    for (const z of [0.2, -0.2]) {                           // its spirals, both faces, burning bright now it's home
      put(stone, new THREE.TorusGeometry(0.1, 0.02, 3, 10, Math.PI * 1.6), glow, 0, 0.95, z, 0, z > 0 ? 0 : Math.PI, 1);
      put(stone, new THREE.TorusGeometry(0.05, 0.016, 3, 8, Math.PI * 1.4), glow, 0, 0.95, z, 0, z > 0 ? 0 : Math.PI, 3);
    }
    group.add(stone);
    put(group, new THREE.RingGeometry(0.3, 0.55, 16).rotateX(-Math.PI / 2), ctx.glow(AEL, { transparent: true, opacity: 0.45, depthWrite: false, ...onGround(GROUND.marker) }), 0, 0.13, 0);
    const light = new THREE.PointLight(AEL, 1.4, 4.5, 1.6);
    light.position.set(0, 1.1, 0);
    group.add(light);
    const t = g.world.need(e, "transform");
    const [x, z] = toWorld(t.x, t.y);
    group.position.set(x, 0, z);
    ctx.scene.add(group);
    return { group, stone, glow, light, k: (t.x * 3 + t.y * 7) % 6 };
  },
  update(_ctx, v, _e, _g, f) {
    const b = Math.sin(f.t * 1.6 + v.k);
    v.stone.rotation.y = f.t * 0.4;
    v.glow.opacity = 0.55 + b * 0.25;
    v.light.intensity = 1.2 + b * 0.4;
  },
  remove(ctx, v) {
    ctx.scene.remove(v.group);
    disposeTree(v.group);
  },
};

/**
 * The Undercroft's own stonework and fittings, inside its room: a blind arcade round the walls (half-columns standing
 * out of them, pointed arches springing between, under the wall top so the camera still sees in over it), in some bays a
 * stone shelf of the old bones moved down when the church was built; squat round pillars with cushion capitals; iron
 * candle-stands, thick candles guttering on their spikes, wax down the pan, each throwing a little warm light; and
 * slabs let into the floor of the aisle, a cross cut proud on each. And in the wall behind the ring, older than any of
 * it, the little door the Kellets keep sealing (HISTORY.md): see sealedDoor.
 */
export function buildCrypt(ctx: RenderContext, parent: THREE.Group, p: PropOf<"crypt">): PropView {
  const { lambert } = ctx, g = new THREE.Group(), stone = lambert(PALE_STONE, { map: ctx.tex.stone }), dark = lambert("#6e6960", { map: ctx.tex.stone });
  const bone = lambert("#ddd5c2"), iron = lambert(IRON), wax = lambert("#efe6cf"), flame = ctx.glow("#ffd27a"), ledger = lambert(EFFIGY, { map: ctx.tex.stone });
  const x0 = p.rect.x / T, z0 = p.rect.y / T, x1 = (p.rect.x + p.rect.w) / T, z1 = (p.rect.y + p.rect.h) / T, t = ROOM_WALL.thick, high = ROOM_WALL.high;
  // The arcade, side by side: along each wall's inner face, bays about 1.5 wide; on the door's side, none over the door.
  const sides = [
    { side: "north", from: [x0 + t, z0 + t], along: [1, 0], out: [0, 1], len: x1 - x0 - 2 * t },
    { side: "south", from: [x0 + t, z1 - t], along: [1, 0], out: [0, -1], len: x1 - x0 - 2 * t },
    { side: "west", from: [x0 + t, z0 + t], along: [0, 1], out: [1, 0], len: z1 - z0 - 2 * t },
    { side: "east", from: [x1 - t, z0 + t], along: [0, 1], out: [-1, 0], len: z1 - z0 - 2 * t },
  ] as const;
  let bay = 0;
  for (const s of sides) {
    const n = Math.max(1, Math.round(s.len / 1.5)), w = s.len / n, yaw = Math.atan2(s.out[0], s.out[1]);
    const at = (u: number, o: number): [number, number] => [s.from[0] + s.along[0] * u + s.out[0] * o, s.from[1] + s.along[1] * u + s.out[1] * o];
    const doorFrom = p.doorAt - t;
    const sealFrom = p.seal.at - t;
    const overDoor = (u: number) => (s.side === p.door && u > doorFrom - 0.3 && u < doorFrom + ROOM_WALL.gap + 0.3) || (s.side === p.seal.side && Math.abs(u - sealFrom) < 0.8);
    for (let i = 0; i <= n; i++) {                           // the half-columns, standing out of the wall
      const u = i * w;
      if (overDoor(u) || i === 0 || i === n) continue;          // (the corners have the walls)
      const [cx, cz] = at(u, 0.08);
      put(g, new THREE.CylinderGeometry(0.08, 0.09, high - 0.32, 6), stone, cx, (high - 0.32) / 2, cz);
      put(g, box(0.2, 0.08, 0.2), stone, cx, high - 0.28, cz, 0, yaw, 0);
    }
    for (let i = 0; i < n; i++) {                            // the pointed arch over each bay, and bones on a shelf in some
      const u0 = i * w, mid = u0 + w / 2;
      if (overDoor(mid)) continue;
      for (const sgn of [-1, 1]) for (let j = 0; j < 3; j++) {
        const f = (j + 0.5) / 3, [ax, az] = at(mid + sgn * (w / 2) * (1 - f), 0.07), y = high - 0.26 + Math.sin(f * Math.PI / 2) * 0.2;
        put(g, box(w / 6 + 0.04, 0.06, 0.1), stone, ax, y, az, 0, yaw, sgn * Math.cos(f * Math.PI / 2) * 0.55);
      }
      if ((s.side === "east" || s.side === "west") && bay++ % 3 === 1) {
        const shelf = new THREE.Group(), [sx, sz] = at(mid, 0.14);
        shelf.position.set(sx, 0, sz);
        shelf.rotation.y = yaw;
        g.add(shelf);
        put(shelf, box(w - 0.3, 0.06, 0.24), dark, 0, 0.5, 0);
        for (let k = 0; k < 4; k++) put(shelf, new THREE.IcosahedronGeometry(0.075, 0).scale(1, 0.9, 1.1), bone, -0.33 + k * 0.22, 0.6, 0.02);   // skulls, in a row
        for (const r of [-0.4, 0.4]) put(shelf, new THREE.CylinderGeometry(0.018, 0.018, w - 0.5, 4).rotateZ(Math.PI / 2), bone, 0, 0.46, 0.04, 0, r, 0);   // long bones crossed under
      }
    }
  }
  // The pillars: a square base, a round shaft, a cushion capital and its slab.
  for (const q of p.pillars) {
    put(g, box(0.52, 0.12, 0.52), dark, q.x, 0.06, q.y);
    put(g, new THREE.CylinderGeometry(0.19, 0.21, 1.05, 8), stone, q.x, 0.645, q.y);
    put(g, new THREE.CylinderGeometry(0.3, 0.19, 0.16, 8), stone, q.x, 1.25, q.y);
    put(g, box(0.62, 0.07, 0.62), dark, q.x, 1.365, q.y);
  }
  // The candle-stands: three legs, a stem, a drip pan, three thick candles at odd heights, their wax run down, their flames.
  const lights: { light: THREE.PointLight; flames: THREE.Mesh[]; k: number }[] = [];
  for (const q of p.prickets) {
    const s = new THREE.Group(), k = hash(q.x, q.y, 509);
    s.position.set(q.x, 0, q.y);
    g.add(s);
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2 + k;
      put(s, box(0.035, 0.3, 0.035), iron, Math.cos(a) * 0.13, 0.13, Math.sin(a) * 0.13, Math.sin(a) * 0.5, 0, -Math.cos(a) * 0.5);
    }
    put(s, new THREE.CylinderGeometry(0.025, 0.03, 0.62, 5), iron, 0, 0.55, 0);
    put(s, new THREE.CylinderGeometry(0.2, 0.17, 0.04, 8), iron, 0, 0.87, 0);
    const flames: THREE.Mesh[] = [];
    for (const [i, h] of [0.2, 0.14, 0.24].entries()) {
      const a = (i / 3) * Math.PI * 2 + k * 2, cx = Math.cos(a) * 0.09, cz = Math.sin(a) * 0.09;
      put(s, new THREE.CylinderGeometry(0.038, 0.042, h, 6), wax, cx, 0.89 + h / 2, cz);
      put(s, new THREE.ConeGeometry(0.02, 0.07, 4), wax, cx + 0.03, 0.89 + h - 0.05, cz, Math.PI, 0, 0);   // a drip down its side
      flames.push(put(s, new THREE.ConeGeometry(0.022, 0.07, 5), flame, cx, 0.89 + h + 0.04, cz));
    }
    put(s, new THREE.ConeGeometry(0.03, 0.09, 4), wax, 0.17, 0.84, 0, Math.PI, 0, 0);   // wax run over the pan's rim
    const light = new THREE.PointLight("#ffb35a", 0.9, 3.4, 1.6);
    light.position.set(0, 1.25, 0);
    s.add(light);
    lights.push({ light, flames, k });
  }
  // The slabs let into the aisle floor, a cross cut proud on each (well clear of the floor, which is drawn pulled forward).
  for (const q of p.ledgers) {
    put(g, box(0.86, 0.06, 1.46), dark, q.x, 0.05, q.y);         // the worn margin, and the slab standing on it
    put(g, box(0.74, 0.04, 1.34), ledger, q.x, 0.09, q.y);
    put(g, box(0.08, 0.03, 0.8), dark, q.x, 0.12, q.y - 0.1);
    put(g, box(0.4, 0.03, 0.08), dark, q.x, 0.12, q.y - 0.3);
  }
  const frame = sealFrame(ctx);
  frame.position.set(...sealAt(p));
  frame.rotation.y = FACING_YAW[OPPOSITE[p.seal.side]];
  g.add(frame);
  parent.add(g);
  return {
    update: (time: number) => {
      for (const l of lights) {
        const f = 0.85 + Math.sin(time * 9 + l.k * 7) * 0.08 + Math.sin(time * 23 + l.k) * 0.05;
        l.light.intensity = 0.9 * f;
        l.flames.forEach((m, i) => { m.scale.y = 0.8 + Math.sin(time * (11 + i * 3) + l.k * 5) * 0.25; });
      }
    },
  };
}

const OPPOSITE = { north: "south", south: "north", east: "west", west: "east" } as const satisfies Record<Facing, Facing>;

/** Where the sealed door stands (world units, on the floor): at the inner face of its wall, `at` along it. */
function sealAt(p: PropOf<"crypt">): [number, number, number] {
  const x0 = p.rect.x / T, z0 = p.rect.y / T, x1 = (p.rect.x + p.rect.w) / T, z1 = (p.rect.y + p.rect.h) / T, t = ROOM_WALL.thick, a = p.seal.at;
  switch (p.seal.side) {
    case "north": return [x0 + a, 0, z0 + t];
    case "south": return [x0 + a, 0, z1 - t];
    case "west": return [x0 + t, 0, z0 + a];
    case "east": return [x1 - t, 0, z0 + a];
  }
}

/**
 * The little door behind the ring: not the church's and not the temple's either. Its frame, here (the slab in it is
 * the sealdoor view, shut or swung open): two leaning jambs of rough grey stone like the ring's and a lintel laid
 * across them, a threshold stone with grit ground out over it where the slab's been moving, and the dark behind.
 * Faces +z from the wall's face.
 */
function sealFrame(ctx: RenderContext): THREE.Group {
  const g = new THREE.Group(), rough = ctx.lambert(STONE, { map: ctx.tex.stone });
  for (const s of [-1, 1]) put(g, box(0.24, 1.0, 0.24), rough, s * 0.46, 0.5, 0.1, 0, s * 0.08, -s * 0.03);
  put(g, box(1.26, 0.24, 0.28), rough, 0, 1.1, 0.1, 0, 0, 0.02);
  put(g, box(1.1, 0.07, 0.36), rough, 0, 0.035, 0.18);
  put(g, box(0.66, 0.94, 0.04), ctx.basic("#050404"), -0.02, 0.5, 0.02);   // the dark, behind the slab
  for (let i = 0; i < 6; i++) put(g, new THREE.DodecahedronGeometry(0.025 + (i % 3) * 0.008, 0), rough, -0.2 + i * 0.09, 0.09, 0.3 + (i % 2) * 0.06);
  return g;
}

/**
 * The little door's slab (src/game/undercroft.ts): one dark slab, three flames over a snowflake and a lightning bolt
 * cut proud on it, the Vael's three fires, faintly warm the way the ring is: the Vael's lock on somebody else's door.
 * Over it the Kellets' own seals, generation on generation: iron bands staked into the jambs, lead seals hanging off
 * them on cords, mortar pressed into the joints; the top band snapped, one end hanging, the slab a finger's width off
 * true, a black seam down its side. It keeps coming unlocked. When the burning Ringstone Pendant opens it, the seals
 * fall away, the fires blaze, and the slab swings out on its left edge into the room, a cold light from beyond.
 */
interface SealdoorView { group: THREE.Group; leaf: THREE.Group; seals: THREE.Group; marks: THREE.MeshLambertMaterial[]; beyond: THREE.PointLight; open: number }
export const sealdoor: EntityView<SealdoorView> = {
  create(ctx, _e, g) {
    const { lambert } = ctx, group = new THREE.Group(), leaf = new THREE.Group(), seals = new THREE.Group(), slab = lambert("#6a665e", { map: ctx.tex.stone });
    const iron = lambert(IRON), lead = lambert("#7b8084"), mortar = lambert("#c9c1ae"), cord = lambert("#4a3a2a");
    const marks = [
      lambert("#8a5a3e", { emissive: new THREE.Color("#7a2a10") }),
      lambert("#8a9aa4", { emissive: new THREE.Color("#1a5a6a") }),
      lambert("#9a8a52", { emissive: new THREE.Color("#5a4a10") }),
    ];
    // The leaf hangs from its left edge (x -0.35): the slab, and the fires on it.
    leaf.position.set(-0.35, 0, 0.06);
    group.add(leaf);
    const at = (x: number) => x + 0.35;
    put(leaf, box(0.64, 0.92, 0.1), slab, at(-0.03), 0.5, 0, 0, 0.04, 0);
    for (const i of [-1, 0, 1]) {
      put(leaf, new THREE.ConeGeometry(0.055, 0.17, 4), marks[0]!, at(-0.03 + i * 0.16), 0.79, 0.07);
      put(leaf, new THREE.ConeGeometry(0.03, 0.08, 4), marks[0]!, at(-0.01 + i * 0.16), 0.88, 0.07, 0, 0, -0.3);
    }
    for (let k = 0; k < 3; k++) put(leaf, box(0.2, 0.025, 0.03), marks[1]!, at(-0.17), 0.45, 0.07, 0, 0, (k * Math.PI) / 3);   // the snowflake
    for (const [x, y, r] of [[0.17, 0.53, -0.45], [0.13, 0.46, 1.2], [0.09, 0.39, -0.45]] as const) put(leaf, box(0.035, 0.12, 0.03), marks[2]!, at(x), y, 0.07, 0, 0, r);   // the bolt
    put(leaf, new THREE.ConeGeometry(0.028, 0.07, 4), marks[2]!, at(0.065), 0.32, 0.07, 0, 0, Math.PI - 0.45);
    // The Kellets' seals, and the seam: gone once it's open.
    group.add(seals);
    put(seals, box(0.06, 0.92, 0.04), ctx.basic("#050404"), 0.3, 0.5, 0.03);
    put(seals, box(0.98, 0.06, 0.03), iron, 0, 0.24, 0.16);
    put(seals, box(0.5, 0.06, 0.03), iron, -0.24, 0.65, 0.16);
    put(seals, box(0.3, 0.06, 0.03), iron, 0.3, 0.55, 0.17, 0, 0, 0.9);
    for (const [x, y] of [[-0.46, 0.24], [0.46, 0.24], [-0.46, 0.65]] as const) put(seals, new THREE.CylinderGeometry(0.03, 0.03, 0.05, 5).rotateX(Math.PI / 2), iron, x, y, 0.2);
    for (const [x, y] of [[-0.3, 0.24], [0.05, 0.24], [0.32, 0.24], [-0.38, 0.65]] as const) {
      put(seals, box(0.012, 0.09, 0.012), cord, x, y - 0.07, 0.18);
      put(seals, new THREE.CylinderGeometry(0.045, 0.045, 0.02, 7).rotateX(Math.PI / 2), lead, x, y - 0.14, 0.19);
    }
    for (const [x, y, h] of [[-0.35, 0.15, 0.2], [-0.35, 0.8, 0.14], [0.27, 0.95, 0.06], [-0.1, 0.97, 0.05]] as const) put(seals, box(0.07, h, 0.05), mortar, x, y, 0.1);
    // A cold light from beyond, once it's open.
    const beyond = new THREE.PointLight(AEL, 0, 3, 1.6);
    beyond.position.set(0, 0.6, 0.3);
    group.add(beyond);
    const crypt = g.area.layout.props.find((p): p is PropOf<"crypt"> => p.kind === "crypt");
    if (crypt) {
      group.position.set(...sealAt(crypt));
      group.rotation.y = FACING_YAW[OPPOSITE[crypt.seal.side]];
    }
    ctx.scene.add(group);
    const open = sealOpen(g) ? 1 : 0;
    return { group, leaf, seals, marks, beyond, open };
  },
  update(_ctx, v, _e, g, f) {
    const to = sealOpen(g) ? 1 : 0;
    v.open += Math.sign(to - v.open) * Math.min(Math.abs(to - v.open), f.dt * 0.7);
    const k = ease(v.open);
    v.leaf.rotation.y = -1.75 * k;
    v.seals.visible = v.open < 0.05;
    v.beyond.intensity = 1.6 * k;
    const glow = v.open > 0 ? 1.2 + Math.sin(f.t * 2) * 0.2 : 0.55 + Math.sin(f.t * 0.9) * 0.35;
    for (const m of v.marks) m.emissiveIntensity = glow;
  },
  remove(ctx, v) {
    ctx.scene.remove(v.group);
    disposeTree(v.group);
  },
};

const ease = (k: number) => k * k * (3 - 2 * k);

/**
 * The seal-keepers' chamber (src/areas/sealchamber.ts). In the middle, the nest: a low round dais of rough stone, a
 * rim of set stones round it, three hollows worn smooth in its top, one for each fire, flecks of gilt still in them,
 * and an old stone bowl beside it, the milk the Vael always leave out. Under it, the crack, dark and jagged across the
 * floor, stitched shut with bars of the three fires' colours. Against the back wall, the Song of the Seal on three
 * standing slabs: a flame, a snowflake, a bolt, and the Old Mother's coils across the middle one. Either side, a Vael
 * lamp: a stone post with a blue-green crystal on it, giving a cold light.
 */
export function buildVaelNest(ctx: RenderContext, parent: THREE.Group, p: PropOf<"vaelNest">): PropView {
  const { lambert } = ctx, g = new THREE.Group(), rough = lambert(STONE, { map: ctx.tex.stone }), pale = lambert(PALE_STONE, { map: ctx.tex.stone });
  const hollow = lambert("#3d3a35"), gilt = lambert("#d8b04a", { emissive: new THREE.Color("#3a2a08") }), crack = ctx.basic("#060505");
  const fires = [ctx.glow("#ff8a3a"), ctx.glow("#9fe0f0"), ctx.glow("#f0d860")], crystal = ctx.glow(AEL);
  const x = p.x / T, z = p.y / T, k = hash(x, z, 77);
  // The crack, first, so the nest sits over it: jagged, wider in the middle, stitched across.
  const pts = [[-3.6, 1.9], [-2.3, 1.5], [-1.2, 1.9], [0, 1.3], [1.1, 1.8], [2.4, 1.4], [3.7, 1.7]] as const;
  for (let i = 0; i < pts.length - 1; i++) {
    const [ax, az] = pts[i]!, [bx, bz] = pts[i + 1]!, len = Math.hypot(bx - ax, bz - az), wide = i === 2 || i === 3 ? 0.16 : 0.09;
    put(g, box(len + 0.05, 0.03, wide), crack, x + (ax + bx) / 2, 0.07, z + (az + bz) / 2, 0, -Math.atan2(bz - az, bx - ax), 0);
    put(g, box(0.07, 0.05, 0.36), fires[i % 3]!, x + (ax + bx) / 2, 0.09, z + (az + bz) / 2, 0, -Math.atan2(bz - az, bx - ax), 0);
  }
  // The nest: the dais, its rim of set stones, the three hollows and the gilt in them.
  put(g, new THREE.CylinderGeometry(NEST_R, NEST_R + 0.1, 0.22, 12), rough, x, 0.11, z);
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * Math.PI * 2 + k;
    put(g, box(0.34, 0.16, 0.2), i % 2 ? pale : rough, x + Math.cos(a) * (NEST_R - 0.05), 0.28, z + Math.sin(a) * (NEST_R - 0.05), 0, -a, 0);
  }
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2 - Math.PI / 2, hx = x + Math.cos(a) * 0.42, hz = z + Math.sin(a) * 0.42;
    put(g, new THREE.CylinderGeometry(0.26, 0.2, 0.05, 9), hollow, hx, 0.215, hz);
    for (let j = 0; j < 3; j++) put(g, box(0.04, 0.02, 0.03), gilt, hx + Math.cos(j * 2.1 + i) * 0.12, 0.25, hz + Math.sin(j * 2.1 + i) * 0.12, 0, j, 0);
  }
  // The bowl, by the nest: a little stone bowl, a skin of something pale in it.
  put(g, new THREE.CylinderGeometry(0.16, 0.1, 0.1, 8), pale, x + 1.25, 0.11, z + 0.75);
  put(g, new THREE.CylinderGeometry(0.13, 0.13, 0.02, 8), lambert("#e8e2d0"), x + 1.25, 0.15, z + 0.75);
  // The Song of the Seal, on three slabs against the back wall, and the Old Mother's coils over the middle one.
  for (const [i, dx] of [-1.8, 0, 1.8].entries()) {
    const sx = x + dx, sz = p.back + 0.12;
    put(g, box(1.1, 1.05, 0.18), rough, sx, 0.53, sz, 0, 0, (i - 1) * 0.02);
    put(g, box(0.9, 0.85, 0.04), pale, sx, 0.55, sz + 0.1);
    const f = fires[i]!;
    if (i === 0) for (const d of [-0.12, 0, 0.12]) put(g, new THREE.ConeGeometry(0.06, 0.2, 4), f, sx + d, 0.62, sz + 0.14);
    if (i === 1) {
      for (let j = 0; j < 3; j++) put(g, box(0.26, 0.03, 0.03), f, sx, 0.4, sz + 0.14, 0, 0, (j * Math.PI) / 3);
      put(g, new THREE.TorusGeometry(0.24, 0.035, 3, 12, Math.PI * 1.7), lambert("#8a9a94"), sx, 0.68, sz + 0.14, 0, 0, 0.4);   // her coils
      for (const d of [-0.12, 0, 0.12]) put(g, new THREE.SphereGeometry(0.05, 5, 4).scale(0.8, 1.1, 0.5), gilt, sx + d, 0.66, sz + 0.15);   // the three eggs, in them
    }
    if (i === 2) for (const [bx, by, r] of [[0.05, 0.7, -0.45], [0, 0.6, 1.2], [-0.05, 0.5, -0.45]] as const) put(g, box(0.05, 0.16, 0.03), f, sx + bx, by, sz + 0.14, 0, 0, r);
  }
  // The lamps, either side of the nest: a post, a cup, the crystal, its cold light.
  const lights: THREE.PointLight[] = [];
  for (const s of [-1, 1]) {
    const lx = x + s * LAMP_OFF;
    put(g, box(0.22, 0.12, 0.22), rough, lx, 0.06, z);
    put(g, new THREE.CylinderGeometry(0.08, 0.1, 0.8, 6), rough, lx, 0.52, z);
    put(g, new THREE.CylinderGeometry(0.16, 0.08, 0.1, 6), rough, lx, 0.96, z);
    put(g, new THREE.OctahedronGeometry(0.11, 0).scale(0.8, 1.5, 0.8), crystal, lx, 1.14, z);
    const light = new THREE.PointLight(AEL, 1.3, 5, 1.6);
    light.position.set(lx, 1.2, z);
    g.add(light);
    lights.push(light);
  }
  parent.add(g);
  return { update: (time: number) => { lights.forEach((l, i) => { l.intensity = 1.2 + Math.sin(time * 1.3 + i * 2) * 0.2; }); } };
}
