// Town buildings, low-poly and hand-painted like everything else, at the hero's scale (the hero is
// about 1.1 units tall): curtain walls with walks along their tops, round towers and gatehouses you walk
// under, timber-framed houses with jettied upper floors and their gables to the street, a keep on a
// crag, and a plank bridge. (Churches, the cathedral and halls are in civic.ts; the market's things in
// market.ts; the castle's in castle.ts; the country's in country.ts.) Each builds into its area's
// scenery group (see props.ts); tall ones are occluders that fade when they'd hide the hero.
import * as THREE from "three";
import { PAL } from "../data/palette.ts";
import { T } from "../data/world.ts";
import type { Prop } from "../world/area.ts";
import { FACING_YAW, TOWER_FLARE, houseBody, houseDoor, keepPlan, local, wallPlan } from "../world/plans.ts";
import { onGround, GROUND, box, type RenderContext } from "./context.ts";
import type { Occluder } from "./occlusion.ts";
import type { PropView } from "./props.ts";
import { hash } from "./terrain.ts";
import { WARES } from "./wares.ts";

export type PropOf<K extends Prop["kind"]> = Extract<Prop, { kind: K }>;

export const SLATE = "#4a5a7a", CLAY = "#a8473a", WOOD = "#8b5a34", DARK_WOOD = "#4f3222", IRON = "#2b2438";
export const LIT = "#f5d562";
/** For what the kingdom spends most on: white marble, and gold leaf. */
export const MARBLE = "#f3eee4", GOLD = "#d9a83a";                                       // lamplight in windows and lanterns
export const DOORWAY = "#1a120d";

/** A box whose texture repeats once per `unit` world units on every face, instead of stretching. */
export function tiledBox(w: number, h: number, d: number, unit = 1): THREE.BoxGeometry {
  const geo = new THREE.BoxGeometry(w, h, d), uv = geo.attributes.uv!;
  // Faces in order: +x, -x, +y, -y, +z, -z; four vertices each.
  const spans: [number, number][] = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
  for (let f = 0; f < 6; f++) for (let i = 0; i < 4; i++) {
    const k = f * 4 + i, [su, sv] = spans[f]!;
    uv.setXY(k, (uv.getX(k) * su) / unit, (uv.getY(k) * sv) / unit);
  }
  return geo;
}

/** A cylinder whose texture repeats once per `unit` around and up; `open` leaves off the ends. */
export function tiledCylinder(r: number, h: number, segments = 8, unit = 1, open = false): THREE.CylinderGeometry {
  const geo = new THREE.CylinderGeometry(r, r * 1.06, h, segments, 1, open), uv = geo.attributes.uv!;
  const around = (Math.PI * 2 * r) / unit;
  for (let k = 0; k < uv.count; k++) uv.setXY(k, uv.getX(k) * around, (uv.getY(k) * h) / unit);
  return geo;
}

/**
 * A gabled roof: ridge along X, `w` long and `d` deep, `h` high, sitting on y = 0. Its UVs run along
 * the ridge and down the slopes, so shingle rows lie parallel to the eaves. With `ends`, its ends are
 * closed by triangles of roof; without, it's just the two slopes, for a building whose gable walls
 * (gableGeometry) close it.
 */
export function roofGeometry(w: number, d: number, h: number, ends = true): THREE.BufferGeometry {
  const a = [-w / 2, 0, d / 2], b = [w / 2, 0, d / 2], c = [w / 2, 0, -d / 2], e = [-w / 2, 0, -d / 2];
  const r1 = [-w / 2, h, 0], r2 = [w / 2, h, 0];
  const tris = [a, b, r2, a, r2, r1, c, e, r1, c, r1, r2, ...(ends ? [e, a, r1, b, c, r2] : [])];
  const slope = Math.hypot(h, d / 2), SHINGLE = 0.55;          // world units per texture repeat
  const uv = tris.flatMap(([x, , z]) => [x! / SHINGLE, ((d / 2 - Math.abs(z!)) / (d / 2)) * (slope / SHINGLE)]);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(tris.flat(), 3));
  geo.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  geo.computeVertexNormals();
  return geo;
}

/**
 * A gable wall: the end of a building under its roof, in the plane x = 0 (facing ±x), from the wall's
 * top (y = 0) up to the roof's underside. The wall is `halfSpan` either side of the ridge line; the roof
 * overhangs to `roofHalf` and rises `h` at the ridge, so the gable's sides follow its slopes.
 */
export function gableGeometry(halfSpan: number, roofHalf: number, h: number, unit = 1.15): THREE.BufferGeometry {
  const eave = Math.max(0, h * (1 - halfSpan / roofHalf) - 0.02), apex = h - 0.05;
  const pts: [number, number][] = [[-halfSpan, 0], [halfSpan, 0], [halfSpan, eave], [-halfSpan, 0], [halfSpan, eave], [-halfSpan, eave], [-halfSpan, eave], [halfSpan, eave], [0, apex]];
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(pts.flatMap(([z, y]) => [0, y, z]), 3));
  geo.setAttribute("uv", new THREE.Float32BufferAttribute(pts.flatMap(([z, y]) => [z / unit, y / unit]), 2));
  geo.computeVertexNormals();
  return geo;
}

/** A hanging banner: red cloth with a gold emblem, its face toward +z, hanging down from y = 0. */
export function banner(ctx: RenderContext, w: number, h: number): THREE.Group {
  const g = new THREE.Group();
  const cloth = new THREE.Mesh(new THREE.PlaneGeometry(w, h), ctx.lambert(CLAY, { side: THREE.DoubleSide }));
  cloth.position.y = -h / 2;
  const trim = new THREE.Mesh(new THREE.PlaneGeometry(w, h * 0.06), ctx.basic(PAL.Y, { side: THREE.DoubleSide }));
  trim.position.set(0, -h + h * 0.03, 0.012);
  const emblem = new THREE.Mesh(new THREE.OctahedronGeometry(w * 0.26, 0), ctx.basic(PAL.Y));
  emblem.scale.z = 0.3;
  emblem.position.set(0, -h * 0.4, 0.02);
  const rod = new THREE.Mesh(box(w + 0.12, 0.06, 0.06), ctx.lambert(DARK_WOOD));
  g.add(cloth, trim, emblem, rod);
  return g;
}

/** A pennant on a pole; its cloth is returned so it can flap. */
export function pennant(ctx: RenderContext, pole: number, size: number): { group: THREE.Group; cloth: THREE.Mesh } {
  const group = new THREE.Group();
  const staff = new THREE.Mesh(box(0.05, pole, 0.05), ctx.basic(IRON));
  staff.position.y = pole / 2;
  const cloth = new THREE.Mesh(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0, 0), new THREE.Vector3(size, -size * 0.22, 0), new THREE.Vector3(0, -size * 0.45, 0)]),
    ctx.lambert(CLAY, { side: THREE.DoubleSide }));
  cloth.geometry.computeVertexNormals();
  cloth.position.y = pole;
  group.add(staff, cloth);
  return { group, cloth };
}

/** A round stone tower with a cone roof and arrow slits, standing on y = 0. Its own materials, so it can fade alone. */
export function tower(ctx: RenderContext, r: number, h: number, roof: string, roofHeight = r * 1.4, wall = "#ffffff"): THREE.Group {
  const g = new THREE.Group();
  const body = new THREE.Mesh(tiledCylinder(r, h, 10, 0.8), ctx.lambert(wall, { map: ctx.tex.stone }));
  body.position.y = h / 2;
  const cap = new THREE.Mesh(new THREE.ConeGeometry(r * 1.2, roofHeight, 10), ctx.lambert(roof, { map: ctx.tex.shingles }));
  cap.position.y = h + roofHeight / 2;
  const slitMat = ctx.basic(IRON);
  for (let level = 0.45; level < 0.95; level += 0.3) for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + Math.PI / 4 + level, slit = new THREE.Mesh(box(0.09, 0.42, 0.05), slitMat);
    slit.position.set(Math.cos(a) * (r + 0.01), h * level, Math.sin(a) * (r + 0.01));
    slit.rotation.y = -a + Math.PI / 2;
    g.add(slit);
  }
  g.add(body, cap);
  return g;
}

/** Merlons (the teeth on top of a wall) along a run `len` long, on top of height `h`. */
export function merlons(len: number, h: number, depth: number, mat: THREE.Material): THREE.Group {
  const g = new THREE.Group(), n = Math.max(1, Math.floor(len / 0.7));
  for (let i = 0; i < n; i++) {
    const m = new THREE.Mesh(box(0.38, 0.4, depth), mat);
    m.position.set(-len / 2 + (i + 0.5) * (len / n), h + 0.2, 0);
    g.add(m);
  }
  return g;
}

/** An axis-aligned occluder around a group placed at (x, z), `w` wide and `d` deep. */
export const occluder = (object: THREE.Object3D, x: number, z: number, w: number, d: number, height: number): Occluder =>
  ({ object, x0: x - w / 2, x1: x + w / 2, z0: z - d / 2, z1: z + d / 2, height });

// ---------- Curtain walls ----------
/**
 * A defensive wall (see wallPlan): each run thick enough to walk along, behind a crenellated parapet on
 * its outer edge and a low rail on its inner one; a round tower at every point; and at each gate a
 * gatehouse: two tall towers and an arch you walk under, with a portcullis raised into it.
 */
export function buildCurtainWall(ctx: RenderContext, parent: THREE.Group, p: PropOf<"curtainWall">): PropView {
  const plan = wallPlan(p), H = p.height, D = p.thickness;
  const occluders: Occluder[] = [];
  // Each run of wall is its own object with its own material, so only the bit in front of you fades.
  for (const { a, b, out } of plan.runs) {
    const len = Math.hypot(b.x - a.x, b.z - a.z), seg = new THREE.Group(), yaw = Math.atan2(-(b.z - a.z), b.x - a.x);
    const outSide = Math.sin(yaw) * out.x + Math.cos(yaw) * out.z >= 0 ? 1 : -1;   // which local z is outward
    const stone = ctx.lambert("#ffffff", { map: ctx.tex.stone });
    const body = new THREE.Mesh(tiledBox(len, H, D, 0.8), stone);
    body.position.y = H / 2;
    const parapet = new THREE.Mesh(tiledBox(len, 0.9, 0.35, 0.8), stone);
    parapet.position.set(0, H + 0.45, outSide * (D / 2 - 0.175));
    const teeth = merlons(len, H + 0.9, 0.35, stone);
    teeth.position.z = outSide * (D / 2 - 0.175);
    const rail = new THREE.Mesh(box(len, 0.35, 0.2), stone);
    rail.position.set(0, H + 0.175, -outSide * (D / 2 - 0.1));
    seg.add(body, parapet, teeth, rail);
    seg.position.set((a.x + b.x) / 2, 0, (a.z + b.z) / 2);
    seg.rotation.y = yaw;
    parent.add(seg);
    occluders.push({ object: seg, x0: Math.min(a.x, b.x) - D / 2, x1: Math.max(a.x, b.x) + D / 2, z0: Math.min(a.z, b.z) - D / 2, z1: Math.max(a.z, b.z) + D / 2, height: H + 1.3 });
  }
  const flags: THREE.Mesh[] = [];
  for (const gate of plan.gates) {
    const g = new THREE.Group(), { gapW, towerR: r } = gate, th = p.tower.height + 1.2;
    for (const s of [-1, 1]) {
      const t = tower(ctx, r, th, p.tower.roof);
      t.position.set((s * gapW) / 2, 0, D * 0.3);
      const flagBanner = banner(ctx, r * 0.66, th * 0.35);
      flagBanner.position.set(0, th * 0.8, r * TOWER_FLARE + 0.04);
      const flag = pennant(ctx, 1.4, 0.9);
      flag.group.position.y = th + r * 1.4 * 1.05;
      flags.push(flag.cloth);
      t.add(flagBanner, flag.group);
      g.add(t);
    }
    const stone = ctx.lambert("#ffffff", { map: ctx.tex.stone }), archBottom = 3.4, archH = Math.max(1.4, H + 1.2 - archBottom);
    const arch = new THREE.Mesh(tiledBox(gapW, archH, D + 0.5, 0.8), stone);
    arch.position.set(0, archBottom + archH / 2, D * 0.15);
    const archTop = merlons(gapW, archBottom + archH, D + 0.5, stone);
    archTop.position.z = D * 0.15;
    const vault = new THREE.Mesh(new THREE.PlaneGeometry(gapW - r * 2 + 0.6, 0.3), ctx.basic(DOORWAY, { side: THREE.DoubleSide }));
    vault.position.set(0, archBottom - 0.15, D * 0.15 + (D + 0.5) / 2 + 0.01);
    g.add(arch, archTop, vault);
    // The portcullis, raised into the arch: iron bars with points, hanging just below it.
    const iron = ctx.basic(IRON), bars = Math.max(4, Math.round(gapW * 1.2));
    for (let k = 0; k < bars; k++) {
      const x = -gapW / 2 + r + 0.2 + (k * (gapW - 2 * r - 0.4)) / (bars - 1);
      const bar = new THREE.Mesh(box(0.07, 0.4, 0.07), iron);
      bar.position.set(x, archBottom - 0.2, D * 0.15 + (D + 0.5) / 2 - 0.2);
      const tip = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.14, 4).rotateX(Math.PI), iron);
      tip.position.set(x, archBottom - 0.47, D * 0.15 + (D + 0.5) / 2 - 0.2);
      g.add(bar, tip);
    }
    g.rotation.y = gate.yaw;                                 // local +x along the wall, +z outward
    g.position.set(gate.at.x, 0, gate.at.z);
    parent.add(g);
    // Its box: just round its towers and arch, turned with the wall (a square round the gate would reach
    // far enough in to contain you as you come through, and something round you never fades).
    const corners = [-1, 1].flatMap(sx => [-1, 1].map(sz => local(gate.at, gate.yaw, sx * (gapW / 2 + r), D * 0.3 + sz * (r + 0.3))));
    occluders.push({
      object: g, height: th + 1.5,
      x0: Math.min(...corners.map(c => c.x)), x1: Math.max(...corners.map(c => c.x)), z0: Math.min(...corners.map(c => c.z)), z1: Math.max(...corners.map(c => c.z)),
    });
  }
  for (const q of plan.towers) {
    const t = tower(ctx, p.tower.radius, p.tower.height, p.tower.roof), r = p.tower.radius;
    t.position.set(q.x, 0, q.z);
    parent.add(t);
    occluders.push({ object: t, x0: q.x - r, x1: q.x + r, z0: q.z - r, z1: q.z + r, height: p.tower.height + r * 1.4 });
  }
  return {
    occluders,
    update(t) { flags.forEach((f, i) => { f.rotation.y = Math.sin(t * 3 + i * 2) * 0.4; }); },   // flapping in the wind
  };
}

// ---------- Houses ----------
const STOREY = 1.15;                                         // floor to floor: the door is 1.35, the hero 1.1
const SHUTTER = "#5e4630";

/**
 * A timber-framed town house: jettied upper floors, gable end to the street when it's deeper than it's
 * wide (as most were), its door on the street. Most windows are shuttered (glass was dear); a few are
 * lit. A shop opens its ground floor onto the street over a counter of its goods, under a propped-up
 * shutter; an inn or shop hangs a sign; some keep a lantern by the door. Built facing south (door on
 * +z, frontage along x) and turned to its street.
 */
export function buildHouse(ctx: RenderContext, parent: THREE.Group, p: PropOf<"house">): PropView {
  const { lambert, basic, tex } = ctx, g = new THREE.Group(), seed = p.rect.x * 3 + p.rect.y * 7;
  const sideways = p.doorSide === "east" || p.doorSide === "west", body = houseBody(p.rect);
  const w = sideways ? body.d : body.w, d = sideways ? body.w : body.d, storeys = p.storeys;
  const timber = lambert("#ffffff", { map: tex.timber }), frame = lambert(DARK_WOOD), glass = basic(LIT), shutter = lambert(SHUTTER);
  const stone = lambert("#ffffff", { map: tex.stone });
  let lights = 0;
  // A window on the front (`facing` 1) or the back (-1): lit glass between shutters folded back, or shut.
  const windowAt = (x: number, y: number, z: number, facing: number) => {
    const lit = hash(seed + lights++, y * 10, 410) < 0.28, mk = (w0: number, h0: number, d0: number, m: THREE.Material, px: number, pz: number, py = y) => {
      const mesh = new THREE.Mesh(box(w0, h0, d0), m);
      mesh.position.set(x + px, py, z + pz);
      g.add(mesh);
    };
    if (lit) {
      mk(0.32, 0.4, 0.05, glass, 0, 0);
      for (const sx of [-1, 1]) mk(0.16, 0.42, 0.04, shutter, sx * 0.25, facing * 0.03);
    } else {
      mk(0.34, 0.42, 0.06, shutter, 0, 0);
      mk(0.03, 0.42, 0.07, frame, 0, 0);
    }
    mk(0.44, 0.07, 0.07, frame, 0, 0, y - 0.25);
  };
  // Each floor above the ground is jettied out a little further over the street (and only over the street:
  // its sides are party walls, flush with its neighbours'), with a beam along the overhang.
  const jetty = 0.12, doorX = houseDoor(p).along;           // where the door is: see houseDoor
  let y = 0;
  for (let floor = 0; floor < storeys; floor++) {
    const out = floor * jetty, h = floor === 0 ? STOREY + 0.1 : STOREY;
    const walls = new THREE.Mesh(tiledBox(w, h, d + out, 1.15), floor === 0 && p.stone ? stone : timber);
    walls.position.set(0, y + h / 2, out / 2);
    g.add(walls);
    if (floor > 0) {
      const beam = new THREE.Mesh(box(w, 0.1, 0.08), frame);
      beam.position.set(0, y + 0.02, d / 2 + out + 0.02);
      g.add(beam);
    }
    const front = d / 2 + out + 0.02, wy = y + (floor === 0 ? 0.75 : 0.6);
    for (let x = -w / 2 + 0.5; x < w / 2 - 0.3; x += 0.85) {
      if (floor === 0 && (Math.abs(x - doorX) < 0.5 || p.shop)) continue;
      windowAt(x, wy, front, 1);
    }
    if (floor > 0) for (let x = -w / 2 + 0.9; x < w / 2 - 0.5; x += 1.3) windowAt(x, wy, -d / 2 - 0.02, -1);   // and a few at the back
    y += h;
  }
  const top = y, outTop = (storeys - 1) * jetty;
  // The roof: its ridge runs along the longer side, so a narrow, deep house shows its gable to the street.
  // It overhangs its walls only a little (0.1 front and back, 0.05 over the party walls), well inside its
  // plot, so a terrace's roofs meet without running into each other.
  const along = w >= d + outTop, wallLen = along ? w : d + outTop, wallSpan = along ? d + outTop : w;
  const roofH = Math.min(2.4, wallSpan * 0.55 + 0.4), span = wallSpan + (along ? 0.2 : 0.1), length = wallLen + (along ? 0.1 : 0.2);
  const roof = new THREE.Mesh(roofGeometry(length, span, roofH, false), lambert(p.roof, { map: tex.shingles, side: THREE.DoubleSide }));
  roof.position.y = top;
  const ridge = new THREE.Mesh(box(length, 0.1, 0.12), frame);
  ridge.position.y = top + roofH;
  // The gable ends, timbered like the walls, flush with the top floor and up under the roof.
  const gable = gableGeometry(wallSpan / 2, span / 2, roofH);
  const gableMat = lambert("#ffffff", { map: tex.timber, side: THREE.DoubleSide }), roofGroup = new THREE.Group();
  for (const sx of [-1, 1]) {
    const m = new THREE.Mesh(gable, gableMat);
    m.position.set(sx * wallLen / 2, top, 0);
    roofGroup.add(m);
  }
  roofGroup.add(roof, ridge);
  roofGroup.position.z = outTop / 2;                        // over the walls' middle, front to back
  if (!along) roofGroup.rotation.y = Math.PI / 2;
  g.add(roofGroup);
  // The door onto the street, with a lintel and a step.
  const front = d / 2 + 0.02;
  const door = new THREE.Mesh(box(0.5, 1.35, 0.06), lambert(DARK_WOOD));
  door.position.set(doorX, 0.675, front);
  const lintel = new THREE.Mesh(box(0.66, 0.1, 0.08), frame);
  lintel.position.set(doorX, 1.4, front + 0.01);
  const step = new THREE.Mesh(box(0.7, 0.08, 0.24), lambert("#8a8378"));
  step.position.set(doorX, 0.04, d / 2 + 0.12);
  g.add(door, lintel, step);
  // A shop: the ground floor's front open over a counter of goods, the shutter propped up as an awning.
  if (p.shop) {
    const sw = Math.max(1.2, w - 1.6), sx = -w / 2 + 0.3 + sw / 2;
    const dark = new THREE.Mesh(box(sw, 0.95, 0.05), basic("#2a1e16"));
    dark.position.set(sx, 0.95, front);
    const counter = new THREE.Mesh(box(sw, 0.55, 0.4), lambert(WOOD));
    counter.position.set(sx, 0.275, front + 0.2);
    const flap = new THREE.Mesh(box(sw + 0.1, 0.05, 0.7), shutter);
    flap.position.set(sx, 1.5, front + 0.32);
    flap.rotation.x = 0.35;
    g.add(dark, counter, flap);
    const wares = WARES[p.shop], n = Math.max(3, Math.round(sw / 0.24));
    for (let i = 0; i < n; i++) {
      const m = wares.make(ctx, wares.colors[Math.floor(hash(seed + i, 1, 411) * wares.colors.length)]!);
      m.position.set(sx - sw / 2 + 0.15 + (i * (sw - 0.3)) / (n - 1), 0.62, front + 0.2 + ((i % 2) - 0.5) * 0.12);
      g.add(m);
    }
  }
  // An inn's or shop's sign, hanging from an iron bracket beside the door, its face to the street.
  const iron = lambert(IRON);
  if (p.sign) {
    const sx = doorX + (doorX < 0 ? 0.75 : -0.75);
    const arm = new THREE.Mesh(box(0.05, 0.05, 0.55), iron);
    arm.position.set(sx, 1.95, front + 0.27);
    const board = new THREE.Mesh(box(0.5, 0.38, 0.05), lambert(p.sign));
    board.position.set(sx, 1.68, front + 0.45);
    const trim = new THREE.Mesh(box(0.56, 0.44, 0.03), lambert(DARK_WOOD));
    trim.position.set(sx, 1.68, front + 0.43);
    const mark = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.16, 8), basic(PAL.Y));
    mark.position.set(sx, 1.68, front + 0.49);
    mark.rotation.x = Math.PI / 2;
    g.add(arm, board, trim, mark);
  }
  // A lantern on a bracket by the door: the light a street had at night.
  if (p.lantern) {
    const lx = doorX + (doorX < 0 ? -0.45 : 0.45) * (p.sign ? -1 : 1);
    const arm = new THREE.Mesh(box(0.04, 0.04, 0.28), iron);
    arm.position.set(lx, 1.75, front + 0.14);
    const lamp = new THREE.Mesh(box(0.14, 0.2, 0.14), basic(LIT));
    lamp.position.set(lx, 1.58, front + 0.26);
    const cap = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.1, 4), iron);
    cap.position.set(lx, 1.73, front + 0.26);
    cap.rotation.y = Math.PI / 4;
    g.add(arm, lamp, cap);
  }
  // A chimney on the bigger houses.
  if (w * d >= 16) {
    const chimney = new THREE.Mesh(tiledBox(0.38, roofH + 0.6, 0.38, 0.5), stone);
    chimney.position.set(w / 2 - 0.55, top + (roofH + 0.6) / 2, -d / 4);
    g.add(chimney);
  }
  const cx = (p.rect.x + p.rect.w / 2) / T, cz = (p.rect.y + p.rect.h / 2) / T;
  g.position.set(cx, 0, cz);
  g.rotation.y = FACING_YAW[p.doorSide];
  parent.add(g);
  const ow = (sideways ? d + outTop : w) + 0.2, od = (sideways ? w : d + outTop) + 0.2;
  return { occluders: [occluder(g, cx, cz, ow, od, top + roofH)] };
}

// ---------- The keep ----------
// The castle of the greatest kingdom left: a great hall ringed by towers on a rocky crag, a stair up to
// its door, and a great tower rising from its middle, its spire the tallest thing in the castle.
export function buildKeep(ctx: RenderContext, parent: THREE.Group, p: PropOf<"keep">): PropView {
  const { lambert, basic, tex } = ctx, root = new THREE.Group(), g = new THREE.Group();
  const stone = lambert("#ffffff", { map: tex.stone });
  const plan = keepPlan(p), { w, d, back, baseW, baseD } = plan, H = p.height, P = p.plinth;
  // The crag: a stone-faced base, boulders heaped around its foot, and a stair up the front.
  const face = new THREE.Mesh(tiledBox(baseW, P, baseD, 0.8), lambert("#b8b0a4", { map: tex.stone }));
  face.position.set(0, P / 2, back);
  root.add(face);
  const rock = lambert("#77706a"), boulders = Math.round((baseW + baseD) * 1.2);
  for (let i = 0; i < boulders; i++) {
    const a = (i / boulders) * Math.PI * 2, rx = baseW / 2 + 0.25, rz = baseD / 2 + 0.25;
    const x = Math.cos(a) * rx, z = back + Math.sin(a) * rz;
    if (z > back + baseD / 2 - 0.4 && Math.abs(x) < plan.stairW / 2 + 0.6) continue;   // leave the stair clear
    const b = new THREE.Mesh(new THREE.DodecahedronGeometry(0.45 + hash(i, 3, 500) * 0.5, 0), rock);
    b.position.set(x, 0.25 + hash(i, 4, 501) * 0.45, z);
    b.rotation.set(hash(i, 5, 502) * 3, hash(i, 6, 503) * 3, 0);
    root.add(b);
  }
  const steps = Math.round(P / 0.2), stepD = plan.stairD / steps;
  for (let i = 0; i < steps; i++) {
    const s = new THREE.Mesh(box(plan.stairW, 0.2 * (i + 1), stepD), lambert("#8a8378"));
    s.position.set(0, 0.1 * (i + 1), back + baseD / 2 + plan.stairD - (i + 0.5) * stepD);
    root.add(s);
  }
  g.position.set(0, P, back);
  root.add(g);
  const hall = new THREE.Mesh(tiledBox(w, H, d, 0.8), stone);
  hall.position.y = H / 2;
  g.add(hall);
  // Battlements round the hall's roof.
  for (const z of [d / 2 - 0.2, -d / 2 + 0.2]) { const m = merlons(w, H, 0.4, stone); m.position.z = z; g.add(m); }
  for (const x of [w / 2 - 0.2, -w / 2 + 0.2]) { const m = merlons(d, H, 0.4, stone); m.rotation.y = Math.PI / 2; m.position.x = x; g.add(m); }
  // The great tower and its spire.
  const ds = Math.min(w, d) * 0.45, dh = H * 0.85, sh = H * 0.75;
  const donjon = new THREE.Mesh(tiledBox(ds, dh, ds * 0.85, 0.8), stone);
  donjon.position.set(0, H + dh / 2, -0.4);
  const crown = merlons(ds, H + dh, ds * 0.85, stone);
  crown.position.z = -0.4;
  const spire = new THREE.Mesh(new THREE.ConeGeometry(ds * 0.62, sh, 4), lambert(SLATE, { map: tex.shingles }));
  spire.position.set(0, H + dh + sh / 2, -0.4);
  spire.rotation.y = Math.PI / 4;
  g.add(donjon, crown, spire);
  for (let i = -1; i <= 1; i++) for (const y of [H + dh * 0.35, H + dh * 0.7]) {
    const win = new THREE.Mesh(box(0.32, 0.75, 0.05), basic(LIT));
    win.position.set(i * ds * 0.28, y, -0.4 + ds * 0.425 + 0.02);
    g.add(win);
  }
  // Corner towers, taller than the hall, each flying a pennant, and a great standard on the spire.
  const flags: THREE.Mesh[] = [], tr = 1.25 * Math.sqrt(H / 5), th = H * 1.4;
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]] as const) {
    const t = tower(ctx, tr, th, SLATE, tr * 2.1);
    t.position.set(sx * (w / 2 - tr * 0.45), 0, sz * (d / 2 - tr * 0.45));
    const flag = pennant(ctx, 1.6, 1.0);
    flag.group.position.y = th + tr * 2.0;
    t.add(flag.group);
    flags.push(flag.cloth);
    g.add(t);
  }
  const standard = pennant(ctx, 2.6, 1.8);
  standard.group.position.set(0, H + dh + sh - 0.2, -0.4);
  flags.push(standard.cloth);
  g.add(standard.group);
  // The great door: a tall dark arch at the top of the stair, with banners either side.
  const front = d / 2 + 0.02;
  const door = new THREE.Mesh(box(2.0, 2.6, 0.08), basic(DOORWAY));
  door.position.set(0, 1.3, front);
  const arch = new THREE.Mesh(new THREE.CircleGeometry(1.0, 12, 0, Math.PI), basic(DOORWAY));
  arch.position.set(0, 2.6, front + 0.01);
  const surround = new THREE.Mesh(new THREE.RingGeometry(1.0, 1.3, 12, 1, 0, Math.PI), lambert("#8a8378"));
  surround.position.set(0, 2.6, front + 0.02);
  g.add(door, arch, surround);
  for (const x of [-2.8, 2.8]) {
    const b = banner(ctx, 1.1, H * 0.6);
    b.position.set(x, H - 0.5, front + 0.05);
    g.add(b);
  }
  // Rows of lit windows along the front, clear of the door, the banners and the towers.
  for (let y = 3.2; y < H - 0.8; y += 1.4) for (let x = -w / 2 + tr + 1.2; x <= w / 2 - tr - 1.2; x += 1.2) {
    if (Math.abs(x) < 1.9 || Math.abs(Math.abs(x) - 2.8) < 0.8) continue;
    const win = new THREE.Mesh(box(0.28, 0.6, 0.05), basic(LIT));
    win.position.set(x, y, front);
    g.add(win);
  }
  const cx = (p.rect.x + p.rect.w / 2) / T, cz = (p.rect.y + p.rect.h / 2) / T;
  root.position.set(cx, 0, cz);
  parent.add(root);
  return {
    update(t) { flags.forEach((f, i) => { f.rotation.y = Math.sin(t * 3 + i) * 0.4; }); },   // flapping in the wind
    occluders: [occluder(root, cx, cz + back, baseW + 1, baseD + 1, P + H + dh + sh)],
  };
}

// ---------- Bridge ----------
/** A plank bridge running north-south: a deck on piers, with railings. */
export function buildBridge(ctx: RenderContext, parent: THREE.Group, p: PropOf<"bridge">): PropView {
  const { lambert } = ctx, g = new THREE.Group();
  const w = p.rect.w / T + 0.5, len = p.rect.h / T + 1.2, wood = lambert(WOOD), dark = lambert(DARK_WOOD);
  const deck = new THREE.Mesh(box(w, 0.14, len), lambert(WOOD, onGround(GROUND.stain)));   // over the path at its ends, not through it
  deck.position.y = 0.07;
  g.add(deck);
  for (let z = -len / 2 + 0.2; z < len / 2; z += 0.4) {
    const gap = new THREE.Mesh(box(w + 0.01, 0.01, 0.04), lambert(DARK_WOOD, onGround(GROUND.shadow)));
    gap.position.set(0, 0.145, z);
    g.add(gap);
  }
  for (const s of [-1, 1]) {
    for (let z = -len / 2 + 0.15; z <= len / 2; z += 1.0) {
      const post = new THREE.Mesh(box(0.12, 0.75, 0.12), dark);
      post.position.set(s * (w / 2 - 0.06), 0.42, z);
      const pier = new THREE.Mesh(box(0.2, 0.7, 0.2), dark);
      pier.position.set(s * (w / 2 - 0.1), -0.3, z);
      g.add(post, pier);
    }
    const rail = new THREE.Mesh(box(0.1, 0.1, len), wood);
    rail.position.set(s * (w / 2 - 0.06), 0.78, 0);
    g.add(rail);
  }
  g.position.set((p.rect.x + p.rect.w / 2) / T, 0, (p.rect.y + p.rect.h / 2) / T);
  parent.add(g);
}
