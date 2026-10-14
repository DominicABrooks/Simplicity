// Town buildings, low-poly and hand-painted like everything else, at the hero's scale (the hero is
// about 1.1 units tall): crenellated stone walls with round towers and a gatehouse you walk under,
// two-storey timber-framed houses with jettied upper floors, a towering keep, a fountain, market stalls
// and street lamps. Each builds into its area's scenery group (see props.ts); tall ones are occluders
// that fade when they'd hide the hero (see occlusion.ts).
import * as THREE from "three";
import { PAL } from "../data/palette.ts";
import { T } from "../data/world.ts";
import type { Prop } from "../world/area.ts";
import { box, type RenderContext } from "./context.ts";
import type { Occluder } from "./occlusion.ts";
import type { PropView } from "./props.ts";
import { hash } from "./terrain.ts";

type PropOf<K extends Prop["kind"]> = Extract<Prop, { kind: K }>;

const SLATE = "#4a5a7a", CLAY = "#a8473a", WOOD = "#8b5a34", DARK_WOOD = "#4f3222", IRON = "#2b2438";
const LIT = "#f5d562";                                       // lamplight in windows and lanterns
const DOORWAY = "#1a120d";

/** A box whose texture repeats once per `unit` world units on every face, instead of stretching. */
function tiledBox(w: number, h: number, d: number, unit = 1): THREE.BoxGeometry {
  const geo = new THREE.BoxGeometry(w, h, d), uv = geo.attributes.uv!;
  // Faces in order: +x, -x, +y, -y, +z, -z; four vertices each.
  const spans: [number, number][] = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
  for (let f = 0; f < 6; f++) for (let i = 0; i < 4; i++) {
    const k = f * 4 + i, [su, sv] = spans[f]!;
    uv.setXY(k, (uv.getX(k) * su) / unit, (uv.getY(k) * sv) / unit);
  }
  return geo;
}

/** A cylinder whose texture repeats once per `unit` around and up. */
function tiledCylinder(r: number, h: number, segments = 8, unit = 1): THREE.CylinderGeometry {
  const geo = new THREE.CylinderGeometry(r, r * 1.06, h, segments), uv = geo.attributes.uv!;
  const around = (Math.PI * 2 * r) / unit;
  for (let k = 0; k < uv.count; k++) uv.setXY(k, uv.getX(k) * around, (uv.getY(k) * h) / unit);
  return geo;
}

/**
 * A gabled roof: ridge along X, `w` long and `d` deep, `h` high, sitting on y = 0. Its UVs run along
 * the ridge and down the slopes, so shingle rows lie parallel to the eaves.
 */
function roofGeometry(w: number, d: number, h: number): THREE.BufferGeometry {
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
function banner(ctx: RenderContext, w: number, h: number): THREE.Group {
  const g = new THREE.Group();
  const cloth = new THREE.Mesh(new THREE.PlaneGeometry(w, h), ctx.lambert(CLAY, { side: THREE.DoubleSide }));
  cloth.position.y = -h / 2;
  const trim = new THREE.Mesh(new THREE.PlaneGeometry(w, h * 0.06), ctx.basic(PAL.Y, { side: THREE.DoubleSide }));
  trim.position.set(0, -h + h * 0.03, 0.005);
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
const occluder = (object: THREE.Object3D, x: number, z: number, w: number, d: number, height: number): Occluder =>
  ({ object, x0: x - w / 2, x1: x + w / 2, z0: z - d / 2, z1: z + d / 2, height });

// ---------- City wall ----------
const WALL_H = 2.6, WALL_D = 0.9;

export function buildCityWall(ctx: RenderContext, parent: THREE.Group, p: PropOf<"cityWall">): PropView {
  const x0 = p.rect.x / T + 0.5, z0 = p.rect.y / T + 0.5, x1 = (p.rect.x + p.rect.w) / T - 0.5, z1 = (p.rect.y + p.rect.h) / T - 0.5;
  const gateL = p.gate.x / T - 1, gateR = (p.gate.x + p.gate.w) / T + 1;   // the gatehouse towers' centres
  const occluders: Occluder[] = [];
  // Each run of wall is its own object with its own material, so only the bit in front of you fades.
  const run = (ax: number, az: number, bx: number, bz: number) => {
    const len = Math.hypot(bx - ax, bz - az), seg = new THREE.Group();
    const stone = ctx.lambert("#ffffff", { map: ctx.tex.stone });
    const body = new THREE.Mesh(tiledBox(len, WALL_H, WALL_D, 0.8), stone);
    body.position.y = WALL_H / 2;
    seg.add(body, merlons(len, WALL_H, WALL_D, stone));
    const cx = (ax + bx) / 2, cz = (az + bz) / 2, horizontal = az === bz;
    seg.position.set(cx, 0, cz);
    seg.rotation.y = -Math.atan2(bz - az, bx - ax);
    parent.add(seg);
    occluders.push(occluder(seg, cx, cz, horizontal ? len : WALL_D, horizontal ? WALL_D : len, WALL_H + 0.4));
  };
  run(x0, z0, x1, z0);                                       // north
  run(x0, z0, x0, z1);                                       // west
  run(x1, z0, x1, z1);                                       // east
  run(x0, z1, gateL, z1);                                    // south, either side of the gate
  run(gateR, z1, x1, z1);
  const place = (obj: THREE.Group, x: number, z: number, w: number, d: number, h: number) => {
    obj.position.set(x, 0, z);
    parent.add(obj);
    occluders.push(occluder(obj, x, z, w, d, h));
  };
  for (const [x, z] of [[x0, z0], [x1, z0], [x0, z1], [x1, z1]] as const) place(tower(ctx, 1.15, 4.0, SLATE), x, z, 2.3, 2.3, 5.6);
  // The gatehouse: two tall towers with red roofs, banners and pennants, joined by an arch you walk under.
  const gate = new THREE.Group(), flags: THREE.Mesh[] = [];
  for (const x of [gateL, gateR]) {
    const t = tower(ctx, 1.05, 4.8, CLAY);
    t.position.set(x - (gateL + gateR) / 2, 0, 0.5);
    const b = banner(ctx, 0.7, 1.9);
    b.position.set(0, 3.9, 1.07);
    const flag = pennant(ctx, 1.1, 0.7);
    flag.group.position.y = 4.8 + 1.45;
    flags.push(flag.cloth);
    t.add(b, flag.group);
    gate.add(t);
  }
  const gapW = gateR - gateL, stone = ctx.lambert("#ffffff", { map: ctx.tex.stone });
  const arch = new THREE.Mesh(tiledBox(gapW, 1.1, WALL_D + 0.2, 0.8), stone);
  arch.position.set(0, 2.85 + 0.55, 0.25);
  const archTop = merlons(gapW, 3.95, WALL_D + 0.2, stone);
  archTop.position.z = 0.25;
  const vault = new THREE.Mesh(new THREE.PlaneGeometry(gapW - 1.6, 0.25), ctx.basic(DOORWAY, { side: THREE.DoubleSide }));
  vault.position.set(0, 2.72, 0.25 + (WALL_D + 0.2) / 2 + 0.01);
  gate.add(arch, archTop, vault);
  // The portcullis, raised into the arch: iron bars with points, hanging just below it.
  const iron = ctx.basic(IRON);
  for (let i = 0; i < 6; i++) {
    const x = -gapW / 2 + 0.95 + (i * (gapW - 1.9)) / 5;
    const bar = new THREE.Mesh(box(0.06, 0.35, 0.06), iron);
    bar.position.set(x, 2.68, 0.25);
    const tip = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.12, 4).rotateX(Math.PI), iron);
    tip.position.set(x, 2.44, 0.25);
    gate.add(bar, tip);
  }
  place(gate, (gateL + gateR) / 2, z1, gapW + 2.1, 3, 6.5);
  return {
    occluders,
    update(t) { flags.forEach((f, i) => { f.rotation.y = Math.sin(t * 3 + i * 2) * 0.4; }); },   // flapping in the wind
  };
}

// ---------- Houses ----------
const STOREY = 1.15;                                         // floor to floor: the door is 1.35, the hero 1.1

export function buildHouse(ctx: RenderContext, parent: THREE.Group, p: PropOf<"house">): PropView {
  const { lambert, basic, tex } = ctx, g = new THREE.Group();
  const w = p.rect.w / T - 0.2, d = p.rect.h / T - 0.25;
  const timber = lambert("#ffffff", { map: tex.timber }), frame = lambert(DARK_WOOD);
  // A ground floor, and an upper floor jettied out over the street, as medieval town houses were.
  const ground = new THREE.Mesh(tiledBox(w, STOREY + 0.1, d, 1.15), timber);
  ground.position.y = (STOREY + 0.1) / 2;
  const jetty = 0.14;
  const upper = new THREE.Mesh(tiledBox(w + jetty * 2, STOREY, d + jetty * 2, 1.15), timber);
  upper.position.y = STOREY + 0.1 + STOREY / 2;
  const beam = new THREE.Mesh(box(w + jetty * 2 + 0.04, 0.1, d + jetty * 2 + 0.04), frame);
  beam.position.y = STOREY + 0.12;
  g.add(ground, upper, beam);
  const top = STOREY * 2 + 0.1;
  // The roof runs along the longer side, overhanging the walls.
  const along = w >= d, roofH = 1.25;
  const roof = new THREE.Mesh(roofGeometry((along ? w : d) + 0.5, (along ? d : w) + 0.7, roofH), lambert(p.roof, { map: tex.shingles, side: THREE.DoubleSide }));
  roof.position.y = top;
  const ridge = new THREE.Mesh(box((along ? w : d) + 0.55, 0.1, 0.12), frame);
  ridge.position.y = top + roofH;
  if (!along) { roof.rotation.y = Math.PI / 2; ridge.rotation.y = Math.PI / 2; }
  g.add(roof, ridge);
  // A door facing the street (south, toward the camera), a step, and lit windows on both floors.
  const front = d / 2 + 0.02, doorX = w > 2.5 ? -w / 2 + 0.75 : 0;
  const door = new THREE.Mesh(box(0.5, 1.35, 0.06), lambert(DARK_WOOD));
  door.position.set(doorX, 0.675, front);
  const lintel = new THREE.Mesh(box(0.66, 0.1, 0.08), frame);
  lintel.position.set(doorX, 1.4, front + 0.01);
  const step = new THREE.Mesh(box(0.7, 0.08, 0.24), lambert("#8a8378"));
  step.position.set(doorX, 0.04, d / 2 + 0.12);
  g.add(door, lintel, step);
  const glass = basic(LIT);
  const windowAt = (x: number, y: number, z: number, side: boolean) => {
    const pane = new THREE.Mesh(box(side ? 0.05 : 0.34, 0.4, side ? 0.34 : 0.05), glass);
    const sill = new THREE.Mesh(box(side ? 0.06 : 0.44, 0.07, side ? 0.44 : 0.06), frame);
    pane.position.set(x, y, z);
    sill.position.set(x, y - 0.24, z);
    g.add(pane, sill);
  };
  for (let x = -w / 2 + 0.5; x < w / 2 - 0.3; x += 0.85) {
    if (Math.abs(x - doorX) > 0.5) windowAt(x, 0.75, front, false);
    windowAt(x, STOREY + 0.1 + 0.6, front + jetty, false);
  }
  for (const s of [-1, 1]) windowAt(s * (w / 2 + jetty + 0.02), STOREY + 0.7, 0, true);
  // Wider houses get a chimney.
  if (p.rect.w >= 4 * T) {
    const chimney = new THREE.Mesh(tiledBox(0.35, 1.1, 0.35, 0.5), lambert("#ffffff", { map: tex.stone }));
    chimney.position.set(w / 2 - 0.7, top + 0.75, -d / 6);
    g.add(chimney);
  }
  const cx = (p.rect.x + p.rect.w / 2) / T, cz = (p.rect.y + p.rect.h / 2) / T;
  g.position.set(cx, 0, cz);
  parent.add(g);
  return { occluders: [occluder(g, cx, cz, w + 0.7, d + 0.7, top + roofH)] };
}

// ---------- The keep ----------
// The castle of the greatest kingdom left: a great hall behind a ring of towers, and a great tower
// rising from its middle, its spire the tallest thing for miles.
export function buildKeep(ctx: RenderContext, parent: THREE.Group, p: PropOf<"keep">): PropView {
  const { lambert, basic, tex } = ctx, g = new THREE.Group();
  const stone = lambert("#ffffff", { map: tex.stone });
  const w = p.rect.w / T - 1.6, d = p.rect.h / T - 1.6, H = 5.0;
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
  // Corner towers, taller than the hall, each flying a pennant, and a great banner on the spire.
  const flags: THREE.Mesh[] = [];
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]] as const) {
    const t = tower(ctx, 1.25, 7.0, SLATE, 2.6);
    t.position.set(sx * (w / 2), 0, sz * (d / 2));
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
  // The great door: a tall dark arch up a flight of steps, with banners either side.
  const front = d / 2 + 0.02;
  const door = new THREE.Mesh(box(1.7, 2.3, 0.08), basic(DOORWAY));
  door.position.set(0, 1.15, front);
  const arch = new THREE.Mesh(new THREE.CircleGeometry(0.85, 12, 0, Math.PI), basic(DOORWAY));
  arch.position.set(0, 2.3, front + 0.005);
  const surround = new THREE.Mesh(new THREE.RingGeometry(0.85, 1.1, 12, 1, 0, Math.PI), lambert("#8a8378"));
  surround.position.set(0, 2.3, front + 0.01);
  g.add(door, arch, surround);
  for (let i = 0; i < 3; i++) {
    const s = new THREE.Mesh(box(3.0 - i * 0.4, 0.12, 0.35), lambert("#8a8378"));
    s.position.set(0, 0.06 + i * 0.12, d / 2 + 0.6 - i * 0.18);
    g.add(s);
  }
  for (const x of [-2.4, 2.4, -w / 2 + 1.6, w / 2 - 1.6]) {
    const b = banner(ctx, 0.9, 3.2);
    b.position.set(x, H - 0.4, front + 0.01);
    g.add(b);
  }
  // Two rows of lit windows along the front, clear of the door and the banners.
  for (const y of [2.9, 4.0]) for (let x = -w / 2 + 1.2; x <= w / 2 - 1.2; x += 1.1) {
    if (Math.abs(x) < 1.6 || Math.abs(Math.abs(x) - 2.4) < 0.6 || Math.abs(Math.abs(x) - (w / 2 - 1.6)) < 0.6) continue;
    const win = new THREE.Mesh(box(0.26, 0.55, 0.05), basic(LIT));
    win.position.set(x, y, front);
    g.add(win);
  }
  g.position.set((p.rect.x + p.rect.w / 2) / T, 0, (p.rect.y + p.rect.h / 2) / T);
  parent.add(g);
  return {
    update(t) { flags.forEach((f, i) => { f.rotation.y = Math.sin(t * 3 + i) * 0.4; }); },   // flapping in the wind
  };
}

// ---------- Fountain ----------
export function buildFountain(ctx: RenderContext, parent: THREE.Group, p: PropOf<"fountain">): PropView {
  const { lambert, tex, particles } = ctx, g = new THREE.Group(), stone = lambert("#ffffff", { map: tex.stone });
  const basin = new THREE.Mesh(tiledCylinder(0.98, 0.5, 12, 0.6), stone);
  basin.position.y = 0.25;
  const pool = new THREE.Mesh(new THREE.CircleGeometry(0.86, 12).rotateX(-Math.PI / 2), lambert("#ffffff", { map: tex.water, transparent: true, opacity: 0.85 }));
  pool.position.y = 0.44;
  const pillar = new THREE.Mesh(tiledCylinder(0.15, 1.3, 6, 0.4), stone);
  pillar.position.y = 0.65;
  const bowl = new THREE.Mesh(new THREE.CylinderGeometry(0.48, 0.22, 0.18, 10), stone);
  bowl.position.y = 1.35;
  const bowlWater = new THREE.Mesh(new THREE.CircleGeometry(0.4, 10).rotateX(-Math.PI / 2), lambert("#ffffff", { map: tex.water }));
  bowlWater.position.y = 1.445;
  const spout = new THREE.Mesh(tiledCylinder(0.07, 0.35, 6, 0.3), stone);
  spout.position.y = 1.6;
  const finial = new THREE.Mesh(new THREE.IcosahedronGeometry(0.12, 0), lambert(PAL.Y));
  finial.position.y = 1.82;
  g.add(basin, pool, pillar, bowl, bowlWater, spout, finial);
  const cx = p.x / T, cz = p.y / T;
  g.position.set(cx, 0, cz);
  parent.add(g);
  return {
    update(_t, dt) {
      if (Math.random() < dt * 18) {                        // water spilling over the bowl's rim
        const a = Math.random() * Math.PI * 2;
        particles.spawn("water", cx + Math.cos(a) * 0.46, 1.42, cz + Math.sin(a) * 0.46, Math.cos(a) * 0.55, 0.7, Math.sin(a) * 0.55, 0.5);
      }
    },
  };
}

// ---------- Market stall ----------
export function buildStall(ctx: RenderContext, parent: THREE.Group, p: PropOf<"stall">): PropView {
  const { lambert } = ctx, g = new THREE.Group();
  const w = p.rect.w / T - 0.2, d = p.rect.h / T - 0.15;
  const counter = new THREE.Mesh(box(w, 0.8, d * 0.6), lambert(WOOD));
  counter.position.set(0, 0.4, d * 0.15);
  g.add(counter);
  // Wares on the counter: apples, loaves and bolts of cloth.
  const wares = [["#c8423a", "ball"], ["#d9b46a", "box"], ["#3f6fd0", "box"], ["#5fb04a", "ball"], ["#e8963a", "ball"]] as const;
  for (let i = 0; i < 5; i++) {
    const [c, shape] = wares[Math.floor(hash(p.rect.x + i, p.rect.y, 400) * wares.length)]!;
    const m = new THREE.Mesh(shape === "ball" ? new THREE.IcosahedronGeometry(0.1, 0) : box(0.22, 0.12, 0.16), lambert(c));
    m.position.set(-w / 2 + 0.25 + (i * (w - 0.5)) / 4, 0.88, d * 0.15 + (hash(i, p.rect.x, 401) - 0.5) * 0.15);
    g.add(m);
  }
  // Four posts and a striped awning sloping down toward the street.
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]] as const) {
    const post = new THREE.Mesh(box(0.07, 1.75, 0.07), lambert(DARK_WOOD));
    post.position.set(sx * (w / 2 - 0.04), 0.875, sz * (d / 2 - 0.04));
    g.add(post);
  }
  const awning = new THREE.Group(), stripes = 6;
  for (let i = 0; i < stripes; i++) {
    const s = new THREE.Mesh(box(w / stripes + 0.01, 0.04, d + 0.4), lambert(i % 2 ? "#e6dcc4" : p.awning));
    s.position.x = -w / 2 + (i + 0.5) * (w / stripes);
    awning.add(s);
  }
  awning.position.set(0, 1.78, 0.05);
  awning.rotation.x = 0.3;
  g.add(awning);
  const cx = (p.rect.x + p.rect.w / 2) / T, cz = (p.rect.y + p.rect.h / 2) / T;
  g.position.set(cx, 0, cz);
  parent.add(g);
  return { occluders: [occluder(g, cx, cz, w + 0.2, d + 0.6, 2.0)] };
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
