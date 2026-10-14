// Town buildings, low-poly and hand-painted like everything else, at the hero's scale (the hero is
// about 1.1 units tall): curtain walls with round towers and gatehouses you walk under, timber-framed
// houses with jettied upper floors, a keep on a crag, a cathedral, a bridge and street lamps. (The
// market square's things are in market.ts.) Each builds into its area's scenery group (see props.ts); tall ones are occluders
// that fade when they'd hide the hero (see occlusion.ts).
import * as THREE from "three";
import { PAL } from "../data/palette.ts";
import { T } from "../data/world.ts";
import type { Prop } from "../world/area.ts";
import { TOWER_FLARE, WALL_D, cathedralPlan, houseBody, keepPlan, wallPlan } from "../world/plans.ts";
import { box, type RenderContext } from "./context.ts";
import type { Occluder } from "./occlusion.ts";
import type { PropView } from "./props.ts";
import { hash } from "./terrain.ts";

export type PropOf<K extends Prop["kind"]> = Extract<Prop, { kind: K }>;

export const SLATE = "#4a5a7a", CLAY = "#a8473a", WOOD = "#8b5a34", DARK_WOOD = "#4f3222", IRON = "#2b2438";
export const LIT = "#f5d562";                                       // lamplight in windows and lanterns
const DOORWAY = "#1a120d";

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
 * the ridge and down the slopes, so shingle rows lie parallel to the eaves.
 */
export function roofGeometry(w: number, d: number, h: number): THREE.BufferGeometry {
  const a = [-w / 2, 0, d / 2], b = [w / 2, 0, d / 2], c = [w / 2, 0, -d / 2], e = [-w / 2, 0, -d / 2];
  const r1 = [-w / 2, h, 0], r2 = [w / 2, h, 0];
  const tris = [a, b, r2, a, r2, r1, c, e, r1, c, r1, r2, e, a, r1, b, c, r2];
  const slope = Math.hypot(h, d / 2), SHINGLE = 0.55;          // world units per texture repeat
  const uv = tris.flatMap(([x, , z]) => [x! / SHINGLE, ((d / 2 - Math.abs(z!)) / (d / 2)) * (slope / SHINGLE)]);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(tris.flat(), 3));
  geo.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
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
function pennant(ctx: RenderContext, pole: number, size: number): { group: THREE.Group; cloth: THREE.Mesh } {
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
function tower(ctx: RenderContext, r: number, h: number, roof: string, roofHeight = r * 1.4): THREE.Group {
  const g = new THREE.Group();
  const body = new THREE.Mesh(tiledCylinder(r, h, 10, 0.8), ctx.lambert("#ffffff", { map: ctx.tex.stone }));
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
function merlons(len: number, h: number, depth: number, mat: THREE.Material): THREE.Group {
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
 * A defensive wall around a polygon: a run of crenellated wall along each edge, a round tower at every
 * corner, and a gatehouse (two tall towers and an arch you walk under) in the gate's edge.
 */
export function buildCurtainWall(ctx: RenderContext, parent: THREE.Group, p: PropOf<"curtainWall">): PropView {
  const plan = wallPlan(p), H = p.height;
  const occluders: Occluder[] = [];
  // Each run of wall is its own object with its own material, so only the bit in front of you fades.
  const run = (a: { x: number; z: number }, b: { x: number; z: number }) => {
    const len = Math.hypot(b.x - a.x, b.z - a.z), seg = new THREE.Group();
    const stone = ctx.lambert("#ffffff", { map: ctx.tex.stone });
    const body = new THREE.Mesh(tiledBox(len, H, WALL_D, 0.8), stone);
    body.position.y = H / 2;
    seg.add(body, merlons(len, H, WALL_D, stone));
    seg.position.set((a.x + b.x) / 2, 0, (a.z + b.z) / 2);
    seg.rotation.y = -Math.atan2(b.z - a.z, b.x - a.x);
    parent.add(seg);
    occluders.push({ object: seg, x0: Math.min(a.x, b.x) - WALL_D / 2, x1: Math.max(a.x, b.x) + WALL_D / 2, z0: Math.min(a.z, b.z) - WALL_D / 2, z1: Math.max(a.z, b.z) + WALL_D / 2, height: H + 0.4 });
  };
  const flags: THREE.Mesh[] = [];
  for (const [a, b] of plan.runs) run(a, b);
  // The gatehouse, built along the edge with its face outward (away from the walls' centre).
  const gate = new THREE.Group(), g0 = plan.gate.at, gapW = plan.gate.gapW, r = plan.gate.towerR, th = p.tower.height + 0.4;
  for (const s of [-1, 1]) {
    const t = tower(ctx, r, th, p.tower.roof);
    t.position.set((s * gapW) / 2, 0, 0.5);
    const b2 = banner(ctx, r * 0.66, th * 0.4);
    b2.position.set(0, th * 0.82, r * TOWER_FLARE + 0.04);          // clear of the flared foot
    const flag = pennant(ctx, 1.1, 0.7);
    flag.group.position.y = th + p.tower.radius * 1.4 * 1.05;
    flags.push(flag.cloth);
    t.add(b2, flag.group);
    gate.add(t);
  }
  const stone = ctx.lambert("#ffffff", { map: ctx.tex.stone }), archBottom = 2.85, archH = Math.max(1.1, H + 0.6 - archBottom);
  const arch = new THREE.Mesh(tiledBox(gapW, archH, WALL_D + 0.2, 0.8), stone);
  arch.position.set(0, archBottom + archH / 2, 0.25);
  const archTop = merlons(gapW, archBottom + archH, WALL_D + 0.2, stone);
  archTop.position.z = 0.25;
  const vault = new THREE.Mesh(new THREE.PlaneGeometry(gapW - 1.6, 0.25), ctx.basic(DOORWAY, { side: THREE.DoubleSide }));
  vault.position.set(0, archBottom - 0.13, 0.25 + (WALL_D + 0.2) / 2 + 0.01);
  gate.add(arch, archTop, vault);
  // The portcullis, raised into the arch: iron bars with points, hanging just below it.
  const iron = ctx.basic(IRON);
  for (let k = 0; k < 6; k++) {
    const x = -gapW / 2 + 0.95 + (k * (gapW - 1.9)) / 5;
    const bar = new THREE.Mesh(box(0.06, 0.35, 0.06), iron);
    bar.position.set(x, archBottom - 0.17, 0.25);
    const tip = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.12, 4).rotateX(Math.PI), iron);
    tip.position.set(x, archBottom - 0.41, 0.25);
    gate.add(bar, tip);
  }
  gate.rotation.y = plan.gate.yaw;                          // local +x along the edge, +z outward
  gate.position.set(g0.x, 0, g0.z);
  parent.add(gate);
  occluders.push({ object: gate, x0: g0.x - gapW / 2 - r, x1: g0.x + gapW / 2 + r, z0: g0.z - 1.5, z1: g0.z + 1.5, height: th + 1.5 });
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

export function buildHouse(ctx: RenderContext, parent: THREE.Group, p: PropOf<"house">): PropView {
  const { lambert, basic, tex } = ctx, g = new THREE.Group();
  const body = houseBody(p.rect), w = body.w, d = body.d, storeys = p.storeys ?? 2;
  const timber = lambert("#ffffff", { map: tex.timber }), frame = lambert(DARK_WOOD), glass = basic(LIT);
  const windowAt = (x: number, y: number, z: number, side: boolean) => {
    const pane = new THREE.Mesh(box(side ? 0.05 : 0.34, 0.4, side ? 0.34 : 0.05), glass);
    const sill = new THREE.Mesh(box(side ? 0.06 : 0.44, 0.07, side ? 0.44 : 0.06), frame);
    pane.position.set(x, y, z);
    sill.position.set(x, y - 0.24, z);
    g.add(pane, sill);
  };
  // Each floor above the ground is jettied out a little further over the street, as medieval town
  // houses were, with a beam along the overhang.
  const jetty = 0.12, doorX = w > 2.5 ? -w / 2 + 0.75 : 0;
  let y = 0;
  for (let floor = 0; floor < storeys; floor++) {
    const out = floor * jetty, h = floor === 0 ? STOREY + 0.1 : STOREY;
    const body = new THREE.Mesh(tiledBox(w + out * 2, h, d + out * 2, 1.15), timber);
    body.position.y = y + h / 2;
    g.add(body);
    if (floor > 0) {
      const beam = new THREE.Mesh(box(w + out * 2 + 0.04, 0.1, d + out * 2 + 0.04), frame);
      beam.position.y = y + 0.02;
      g.add(beam);
    }
    const front = d / 2 + out + 0.02;
    for (let x = -w / 2 + 0.5; x < w / 2 - 0.3; x += 0.85) {
      if (floor === 0 && Math.abs(x - doorX) < 0.5) continue;
      windowAt(x, y + (floor === 0 ? 0.75 : 0.6), front, false);
    }
    if (floor > 0) {
      for (const s of [-1, 1]) windowAt(s * (w / 2 + out + 0.02), y + 0.6, 0, true);
      for (let x = -w / 2 + 0.9; x < w / 2 - 0.5; x += 1.3) windowAt(x, y + 0.6, -front, false);   // and a few at the back
    }
    y += h;
  }
  const top = y, outTop = (storeys - 1) * jetty;
  // The roof runs along the longer side, overhanging the walls.
  const along = w >= d, roofH = 1.25;
  const roof = new THREE.Mesh(roofGeometry((along ? w : d) + outTop * 2 + 0.5, (along ? d : w) + outTop * 2 + 0.7, roofH), lambert(p.roof, { map: tex.shingles, side: THREE.DoubleSide }));
  roof.position.y = top;
  const ridge = new THREE.Mesh(box((along ? w : d) + outTop * 2 + 0.55, 0.1, 0.12), frame);
  ridge.position.y = top + roofH;
  if (!along) { roof.rotation.y = Math.PI / 2; ridge.rotation.y = Math.PI / 2; }
  g.add(roof, ridge);
  // A door onto the street, with a lintel and a step. (Built on the south face; a house whose street is
  // to the north is turned around.)
  const front = d / 2 + 0.02;
  const door = new THREE.Mesh(box(0.5, 1.35, 0.06), lambert(DARK_WOOD));
  door.position.set(doorX, 0.675, front);
  const lintel = new THREE.Mesh(box(0.66, 0.1, 0.08), frame);
  lintel.position.set(doorX, 1.4, front + 0.01);
  const step = new THREE.Mesh(box(0.7, 0.08, 0.24), lambert("#8a8378"));
  step.position.set(doorX, 0.04, d / 2 + 0.12);
  g.add(door, lintel, step);
  // An inn's or shop's sign, hanging from an iron bracket beside the door, its face to the street.
  if (p.sign) {
    const iron = lambert(IRON), sx = doorX + (doorX < 0 ? 0.75 : -0.75);
    const arm = new THREE.Mesh(box(0.05, 0.05, 0.55), iron);
    arm.position.set(sx, 1.95, front + 0.27);
    const board = new THREE.Mesh(box(0.5, 0.38, 0.05), lambert(p.sign));
    board.position.set(sx, 1.68, front + 0.45);
    const trim = new THREE.Mesh(box(0.56, 0.44, 0.03), lambert(DARK_WOOD));
    trim.position.set(sx, 1.68, front + 0.43);
    const mug = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.16, 8), basic(PAL.Y));   // a tankard
    mug.position.set(sx, 1.68, front + 0.49);
    mug.rotation.x = Math.PI / 2;
    const lamp = new THREE.Mesh(box(0.14, 0.18, 0.14), basic(LIT));                        // and a lantern by the door
    lamp.position.set(doorX + (doorX < 0 ? -0.45 : 0.45) * -1, 1.45, front + 0.1);
    g.add(arm, board, trim, mug, lamp);
  }
  // Wider houses get a chimney.
  if (p.rect.w >= 4 * T) {
    const chimney = new THREE.Mesh(tiledBox(0.35, 1.1, 0.35, 0.5), lambert("#ffffff", { map: tex.stone }));
    chimney.position.set(w / 2 - 0.7, top + 0.75, -d / 6);
    g.add(chimney);
  }
  const cx = (p.rect.x + p.rect.w / 2) / T, cz = (p.rect.y + p.rect.h / 2) / T;
  g.position.set(cx, 0, cz);
  if (p.doorSide === "north") g.rotation.y = Math.PI;
  parent.add(g);
  return { occluders: [occluder(g, cx, cz, w + outTop * 2 + 0.7, d + outTop * 2 + 0.7, top + roofH)] };
}

// ---------- The keep ----------
// The castle of the greatest kingdom left: a great hall ringed by towers on a rocky crag, a stair up to
// its door, and a great tower rising from its middle, its spire the tallest thing for miles.
export function buildKeep(ctx: RenderContext, parent: THREE.Group, p: PropOf<"keep">): PropView {
  const { lambert, basic, tex } = ctx, root = new THREE.Group(), g = new THREE.Group();
  const stone = lambert("#ffffff", { map: tex.stone });
  const plan = keepPlan(p), { w, d, back, baseW, baseD } = plan, H = 5.0, P = p.plinth;
  // The crag: a stone-faced base, boulders heaped around its foot, and a stair up the front.
  const face = new THREE.Mesh(tiledBox(baseW, P, baseD, 0.8), lambert("#b8b0a4", { map: tex.stone }));
  face.position.set(0, P / 2, back);
  root.add(face);
  const rock = lambert("#77706a");
  for (let i = 0; i < 26; i++) {
    const a = (i / 26) * Math.PI * 2, rx = baseW / 2 + 0.25, rz = baseD / 2 + 0.25;
    const x = Math.cos(a) * rx, z = back + Math.sin(a) * rz;
    if (z > back + baseD / 2 - 0.4 && Math.abs(x) < 1.8) continue;   // leave the stair clear
    const b = new THREE.Mesh(new THREE.DodecahedronGeometry(0.45 + hash(i, 3, 500) * 0.4, 0), rock);
    b.position.set(x, 0.25 + hash(i, 4, 501) * 0.35, z);
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
  // Battlements around the hall's roof.
  for (const z of [d / 2 - 0.2, -d / 2 + 0.2]) {
    const m = merlons(w, H, 0.4, stone);
    m.position.z = z;
    g.add(m);
  }
  for (const x of [w / 2 - 0.2, -w / 2 + 0.2]) {
    const m = merlons(d, H, 0.4, stone);
    m.rotation.y = Math.PI / 2;
    m.position.x = x;
    g.add(m);
  }
  // The great tower and its spire.
  const donjon = new THREE.Mesh(tiledBox(3.6, 4.2, 3.0, 0.8), stone);
  donjon.position.set(0, H + 2.1, -0.4);
  const crown = merlons(3.6, H + 4.2, 3.0, stone);
  crown.position.z = -0.4;
  const spire = new THREE.Mesh(new THREE.ConeGeometry(2.2, 3.6, 4), lambert(SLATE, { map: tex.shingles }));
  spire.position.set(0, H + 4.2 + 1.8, -0.4);
  spire.rotation.y = Math.PI / 4;
  g.add(donjon, crown, spire);
  for (let i = -1; i <= 1; i++) {
    const win = new THREE.Mesh(box(0.3, 0.7, 0.05), basic(LIT));
    win.position.set(i * 1.0, H + 2.6, -0.4 + 1.52);
    g.add(win);
  }
  // Corner towers, taller than the hall, each flying a pennant, and a great standard on the spire.
  const flags: THREE.Mesh[] = [];
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]] as const) {
    const t = tower(ctx, 1.25, 7.0, SLATE, 2.6);
    t.position.set(sx * (w / 2 - 0.55), 0, sz * (d / 2 - 0.55));
    const flag = pennant(ctx, 1.4, 0.9);
    flag.group.position.y = 7.0 + 2.5;
    t.add(flag.group);
    flags.push(flag.cloth);
    g.add(t);
  }
  const standard = pennant(ctx, 2.0, 1.4);
  standard.group.position.set(0, H + 4.2 + 3.5, -0.4);
  flags.push(standard.cloth);
  g.add(standard.group);
  // The great door: a tall dark arch at the top of the stair, with banners either side.
  const front = d / 2 + 0.02;
  const door = new THREE.Mesh(box(1.7, 2.3, 0.08), basic(DOORWAY));
  door.position.set(0, 1.15, front);
  const arch = new THREE.Mesh(new THREE.CircleGeometry(0.85, 12, 0, Math.PI), basic(DOORWAY));
  arch.position.set(0, 2.3, front + 0.005);
  const surround = new THREE.Mesh(new THREE.RingGeometry(0.85, 1.1, 12, 1, 0, Math.PI), lambert("#8a8378"));
  surround.position.set(0, 2.3, front + 0.01);
  g.add(door, arch, surround);
  for (const x of [-2.4, 2.4]) {
    const b = banner(ctx, 0.9, 3.2);
    b.position.set(x, H - 0.4, front + 0.05);
    g.add(b);
  }
  // Two rows of lit windows along the front, clear of the door, the banners and the towers.
  for (const y of [2.9, 4.0]) for (let x = -w / 2 + 2.2; x <= w / 2 - 2.2; x += 1.1) {
    if (Math.abs(x) < 1.6 || Math.abs(Math.abs(x) - 2.4) < 0.6) continue;
    const win = new THREE.Mesh(box(0.26, 0.55, 0.05), basic(LIT));
    win.position.set(x, y, front);
    g.add(win);
  }
  const cx = (p.rect.x + p.rect.w / 2) / T, cz = (p.rect.y + p.rect.h / 2) / T;
  root.position.set(cx, 0, cz);
  parent.add(root);
  return {
    update(t) { flags.forEach((f, i) => { f.rotation.y = Math.sin(t * 3 + i) * 0.4; }); },   // flapping in the wind
    occluders: [occluder(root, cx, cz + back, baseW + 1, baseD + 1, P + H + 4.2 + 3.6)],
  };
}

// ---------- The cathedral ----------
// A long nave running east-west, buttressed, with tall stained-glass windows; a transept crossing it
// with a rose window over the south portal; a rounded apse at the east end; and at the west end a
// bell tower with open belfry arches, corner pinnacles and a spire topped with a gold cross.
const GLASS = ["#3f6fd0", "#c8423a", "#f5d562", "#5fb04a", "#8a4fc0"] as const;

export function buildCathedral(ctx: RenderContext, parent: THREE.Group, p: PropOf<"cathedral">): PropView {
  const { lambert, basic, tex } = ctx, g = new THREE.Group();
  const stone = lambert("#e0d8c8", { map: tex.stone }), lead = lambert("#5a6470", { map: tex.shingles, side: THREE.DoubleSide });
  const { W, D, naveD, towerS, west, east, naveL, naveX, crossX, transW, transD, towerX: tx } = cathedralPlan(p.rect), naveH = 4.6, roofH = 2.8;
  // The nave.
  const nave = new THREE.Mesh(tiledBox(naveL, naveH, naveD, 0.8), stone);
  nave.position.set(naveX, naveH / 2, 0);
  const naveRoof = new THREE.Mesh(roofGeometry(naveL + 0.3, naveD + 0.6, roofH), lead);
  naveRoof.position.set(naveX, naveH, 0);
  g.add(nave, naveRoof);
  // Buttresses and tall stained-glass windows along both sides.
  const bays = Math.floor(naveL / 1.6);
  for (let i = 0; i <= bays; i++) {
    const x = west + 0.2 + (i * (naveL - 0.4)) / bays;
    for (const s of [-1, 1]) {
      const but = new THREE.Mesh(tiledBox(0.38, naveH * 0.8, 0.7, 0.8), stone);
      but.position.set(x, naveH * 0.4, s * (naveD / 2 + 0.33));
      const cap = new THREE.Mesh(new THREE.ConeGeometry(0.3, 0.5, 4), lead);
      cap.position.set(x, naveH * 0.8 + 0.25, s * (naveD / 2 + 0.33));
      cap.rotation.y = Math.PI / 4;
      g.add(but, cap);
      if (i < bays) {
        const lancet = new THREE.Mesh(box(0.36, 1.9, 0.05), basic(GLASS[(i + (s > 0 ? 0 : 2)) % GLASS.length]!));
        lancet.position.set(x + (naveL - 0.4) / bays / 2, naveH * 0.55, s * (naveD / 2 + 0.02));
        const point = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.3, 4), basic(GLASS[(i + 1) % GLASS.length]!));
        point.position.set(lancet.position.x, naveH * 0.55 + 1.1, s * (naveD / 2 + 0.02));
        point.rotation.y = Math.PI / 4;
        point.scale.z = 0.2;
        g.add(lancet, point);
      }
    }
  }
  // The transept, crossing the nave, with its gable and rose window facing south over the portal.
  const trans = new THREE.Mesh(tiledBox(transW, naveH, transD, 0.8), stone);
  trans.position.set(crossX, naveH / 2, 0);
  const transRoof = new THREE.Mesh(roofGeometry(transD + 0.3, transW + 0.6, roofH), lead);
  transRoof.position.set(crossX, naveH, 0);
  transRoof.rotation.y = Math.PI / 2;
  const gable = new THREE.Mesh(new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(-transW / 2, 0, 0), new THREE.Vector3(transW / 2, 0, 0), new THREE.Vector3(0, roofH, 0)]), stone);
  gable.geometry.computeVertexNormals();
  gable.position.set(crossX, naveH, transD / 2 + 0.01);
  g.add(trans, transRoof, gable);
  // The window's layers stand clear of each other: any closer and the depth buffer can't tell them apart
  // from up at the camera, and the colours flicker through one another.
  const roseY = naveH - 0.6, roseZ = transD / 2 + 0.04, layer = 0.03;
  const rose = new THREE.Mesh(new THREE.CircleGeometry(0.95, 16), basic("#2b3a7a"));
  rose.position.set(crossX, roseY, roseZ);
  const roseRing = new THREE.Mesh(new THREE.RingGeometry(0.55, 0.78, 16), basic(GLASS[1]));
  roseRing.position.set(crossX, roseY, roseZ + layer);
  const roseHeart = new THREE.Mesh(new THREE.CircleGeometry(0.25, 10), basic(GLASS[2]));
  roseHeart.position.set(crossX, roseY, roseZ + layer * 2);
  const roseFrame = new THREE.Mesh(new THREE.RingGeometry(0.95, 1.1, 16), lambert("#8a8378"));
  roseFrame.position.set(crossX, roseY, roseZ + layer);
  g.add(rose, roseRing, roseHeart, roseFrame);
  for (let i = 0; i < 8; i++) {
    const spoke = new THREE.Mesh(box(0.05, 1.8, 0.02), lambert("#8a8378"));
    spoke.position.set(crossX, roseY, roseZ + layer * 3);
    spoke.rotation.z = (i / 8) * Math.PI;
    g.add(spoke);
  }
  const portal = new THREE.Mesh(box(1.1, 1.9, 0.06), basic(DOORWAY));
  portal.position.set(crossX, 0.95, roseZ);
  const portalArch = new THREE.Mesh(new THREE.CircleGeometry(0.55, 10, 0, Math.PI), basic(DOORWAY));
  portalArch.position.set(crossX, 1.9, roseZ + layer);
  const portalFrame = new THREE.Mesh(new THREE.RingGeometry(0.55, 0.75, 10, 1, 0, Math.PI), lambert("#8a8378"));
  portalFrame.position.set(crossX, 1.9, roseZ + layer * 2);
  g.add(portal, portalArch, portalFrame);
  // The apse: a rounded east end under a half-cone roof.
  const apse = new THREE.Mesh(new THREE.CylinderGeometry(naveD / 2, naveD / 2, naveH, 10, 1, false, 0, Math.PI), stone);
  apse.position.set(east, naveH / 2, 0);
  const apseRoof = new THREE.Mesh(new THREE.ConeGeometry(naveD / 2 + 0.3, roofH, 10, 1, false, 0, Math.PI), lead);
  apseRoof.position.set(east, naveH + roofH / 2, 0);
  g.add(apse, apseRoof);
  // The bell tower at the west end: belfry arches, corner pinnacles, a spire and a gold cross.
  const towerH = 9.0;
  const belltower = new THREE.Mesh(tiledBox(towerS, towerH, towerS, 0.8), stone);
  belltower.position.set(tx, towerH / 2, 0);
  g.add(belltower);
  for (const [fx, fz] of [[0, 1], [0, -1], [1, 0], [-1, 0]] as const) {
    const opening = new THREE.Mesh(box(fz ? 0.8 : 0.05, 1.4, fz ? 0.05 : 0.8), basic(DOORWAY));
    opening.position.set(tx + fx * (towerS / 2 + 0.02), towerH - 1.3, fz * (towerS / 2 + 0.02));
    g.add(opening);
  }
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]] as const) {
    const pin = new THREE.Mesh(new THREE.ConeGeometry(0.26, 1.2, 4), lead);
    pin.position.set(tx + sx * (towerS / 2 - 0.2), towerH + 0.6, sz * (towerS / 2 - 0.2));
    pin.rotation.y = Math.PI / 4;
    g.add(pin);
  }
  const spire = new THREE.Mesh(new THREE.ConeGeometry(towerS * 0.62, 5.5, 4), lead);
  spire.position.set(tx, towerH + 2.75, 0);
  spire.rotation.y = Math.PI / 4;
  const gold = basic(PAL.Y);
  const crossV = new THREE.Mesh(box(0.1, 0.8, 0.1), gold);
  crossV.position.set(tx, towerH + 5.5 + 0.4, 0);
  const crossH = new THREE.Mesh(box(0.5, 0.1, 0.1), gold);
  crossH.position.set(tx, towerH + 5.5 + 0.55, 0);
  g.add(spire, crossV, crossH);
  const cx = (p.rect.x + p.rect.w / 2) / T, cz = (p.rect.y + p.rect.h / 2) / T;
  g.position.set(cx, 0, cz);
  parent.add(g);
  return { occluders: [occluder(g, cx, cz, W, D, towerH + 6)] };
}

// ---------- Bridge ----------
/** A plank bridge running north-south: a deck on piers, with railings. */
export function buildBridge(ctx: RenderContext, parent: THREE.Group, p: PropOf<"bridge">): PropView {
  const { lambert } = ctx, g = new THREE.Group();
  const w = p.rect.w / T + 0.5, len = p.rect.h / T + 1.2, wood = lambert(WOOD), dark = lambert(DARK_WOOD);
  const deck = new THREE.Mesh(box(w, 0.14, len), wood);
  deck.position.y = 0.07;
  g.add(deck);
  for (let z = -len / 2 + 0.2; z < len / 2; z += 0.4) {
    const gap = new THREE.Mesh(box(w + 0.01, 0.01, 0.04), dark);
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

// ---------- Street lamp ----------
export function buildLamp(ctx: RenderContext, parent: THREE.Group, p: PropOf<"lamp">): PropView {
  const { lambert, basic } = ctx, g = new THREE.Group(), iron = lambert(IRON);
  const base = new THREE.Mesh(box(0.2, 0.12, 0.2), iron);
  base.position.y = 0.06;
  const post = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.06, 1.85, 6), iron);
  post.position.y = 0.95;
  const lantern = new THREE.Mesh(box(0.2, 0.26, 0.2), basic(LIT));
  lantern.position.y = 2.0;
  const cap = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.16, 4), iron);
  cap.position.y = 2.21;
  cap.rotation.y = Math.PI / 4;
  g.add(base, post, lantern, cap);
  g.position.set(p.x / T, 0, p.y / T);
  parent.add(g);
}
