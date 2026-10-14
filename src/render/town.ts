// Town buildings, low-poly and hand-painted like everything else: crenellated stone walls with round
// towers and a gatehouse, timber-framed houses with lit windows and coloured roofs, a keep, a fountain,
// market stalls and street lamps. Each builds into its area's scenery group (see props.ts).
import * as THREE from "three";
import { PAL } from "../data/palette.ts";
import { T } from "../data/world.ts";
import type { Prop } from "../world/area.ts";
import { box, type RenderContext } from "./context.ts";
import type { PropView } from "./props.ts";
import { hash } from "./terrain.ts";

type PropOf<K extends Prop["kind"]> = Extract<Prop, { kind: K }>;

const SLATE = "#4a5a7a", CLAY = "#a8473a", WOOD = "#8b5a34", DARK_WOOD = "#4f3222", IRON = "#2b2438";
const LIT = "#f5d562";                                       // lamplight in windows and lanterns

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

/** A hanging banner: red cloth with a gold emblem, its face toward +z. */
function banner(ctx: RenderContext, w: number, h: number): THREE.Group {
  const g = new THREE.Group();
  const cloth = new THREE.Mesh(new THREE.PlaneGeometry(w, h), ctx.lambert(CLAY, { side: THREE.DoubleSide }));
  cloth.position.y = -h / 2;
  const emblem = new THREE.Mesh(new THREE.OctahedronGeometry(w * 0.28, 0), ctx.basic(PAL.Y));
  emblem.scale.z = 0.3;
  emblem.position.set(0, -h * 0.42, 0.02);
  const rod = new THREE.Mesh(box(w + 0.08, 0.04, 0.04), ctx.lambert(DARK_WOOD));
  g.add(cloth, emblem, rod);
  return g;
}

/** A round stone tower with a cone roof. */
function tower(ctx: RenderContext, r: number, h: number, roof: string): THREE.Group {
  const g = new THREE.Group();
  const body = new THREE.Mesh(tiledCylinder(r, h, 8, 0.8), ctx.lambert("#ffffff", { map: ctx.tex.stone }));
  body.position.y = h / 2;
  const cap = new THREE.Mesh(new THREE.ConeGeometry(r * 1.22, r * 1.3, 8), ctx.lambert(roof));
  cap.position.y = h + (r * 1.3) / 2;
  // A ring of arrow slits.
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + Math.PI / 4, slit = new THREE.Mesh(box(0.06, 0.28, 0.04), ctx.basic(IRON));
    slit.position.set(Math.cos(a) * (r + 0.01), h * 0.7, Math.sin(a) * (r + 0.01));
    slit.rotation.y = -a + Math.PI / 2;
    g.add(slit);
  }
  g.add(body, cap);
  return g;
}

/** Merlons (the teeth on top of a wall) along a run of wall `len` long, on top at height `h`. */
function merlons(len: number, h: number, depth: number, mat: THREE.Material): THREE.Group {
  const g = new THREE.Group(), n = Math.max(1, Math.floor(len / 0.55));
  for (let i = 0; i < n; i++) {
    const m = new THREE.Mesh(box(0.3, 0.26, depth), mat);
    m.position.set(-len / 2 + (i + 0.5) * (len / n), h + 0.13, 0);
    g.add(m);
  }
  return g;
}

// ---------- City wall ----------
export function buildCityWall(ctx: RenderContext, parent: THREE.Group, p: PropOf<"cityWall">): PropView {
  const stone = ctx.lambert("#ffffff", { map: ctx.tex.stone }), WH = 1.2, D = 0.9;
  const x0 = p.rect.x / T + 0.5, z0 = p.rect.y / T + 0.5, x1 = (p.rect.x + p.rect.w) / T - 0.5, z1 = (p.rect.y + p.rect.h) / T - 0.5;
  const gateL = p.gate.x / T - 1, gateR = (p.gate.x + p.gate.w) / T + 1;   // the gatehouse towers' centres
  const wall = new THREE.Group();
  const run = (ax: number, az: number, bx: number, bz: number) => {
    const len = Math.hypot(bx - ax, bz - az), seg = new THREE.Group();
    const body = new THREE.Mesh(tiledBox(len, WH, D, 0.8), stone);
    body.position.y = WH / 2;
    seg.add(body, merlons(len, WH, D, stone));
    seg.position.set((ax + bx) / 2, 0, (az + bz) / 2);
    seg.rotation.y = -Math.atan2(bz - az, bx - ax);
    wall.add(seg);
  };
  run(x0, z0, x1, z0);                                       // north
  run(x0, z0, x0, z1);                                       // west
  run(x1, z0, x1, z1);                                       // east
  run(x0, z1, gateL, z1);                                    // south, either side of the gate
  run(gateR, z1, x1, z1);
  for (const [x, z] of [[x0, z0], [x1, z0], [x0, z1], [x1, z1]] as const) {
    const t = tower(ctx, 0.95, 1.9, SLATE);
    t.position.set(x, 0, z);
    wall.add(t);
  }
  // The gatehouse: two taller towers with red roofs and banners, and an arch over the gate.
  for (const x of [gateL, gateR]) {
    const t = tower(ctx, 1.0, 2.3, CLAY);
    t.position.set(x, 0, z1 + 0.5);
    const b = banner(ctx, 0.45, 1.0);
    b.position.set(0, 1.95, 1.02);
    t.add(b);
    wall.add(t);
  }
  const gapW = gateR - gateL;
  const arch = new THREE.Mesh(tiledBox(gapW, 0.45, D, 0.8), stone);
  arch.position.set((gateL + gateR) / 2, 1.5, z1 + 0.25);
  const archTop = merlons(gapW, 1.72, D, stone);
  archTop.position.set((gateL + gateR) / 2, 0, z1 + 0.25);
  // The portcullis, raised: iron bars hanging just below the arch.
  for (let i = 0; i < 5; i++) {
    const bar = new THREE.Mesh(box(0.05, 0.3, 0.05), ctx.basic(IRON));
    bar.position.set(gateL + 0.7 + (i * (gapW - 1.4)) / 4, 1.13, z1 + 0.25);
    wall.add(bar);
  }
  wall.add(arch, archTop);
  parent.add(wall);
}

// ---------- Houses ----------
export function buildHouse(ctx: RenderContext, parent: THREE.Group, p: PropOf<"house">): PropView {
  const { lambert, basic, tex } = ctx, g = new THREE.Group();
  const w = p.rect.w / T - 0.18, d = p.rect.h / T - 0.18, wallH = 0.95;
  const walls = new THREE.Mesh(tiledBox(w, wallH, d, 0.9), lambert("#ffffff", { map: tex.timber }));
  walls.position.y = wallH / 2;
  // The roof runs along the longer side, overhanging the walls.
  const along = w >= d;
  const roof = new THREE.Mesh(roofGeometry((along ? w : d) + 0.24, (along ? d : w) + 0.34, 0.85), lambert(p.roof, { map: tex.shingles, side: THREE.DoubleSide }));
  roof.position.y = wallH;
  if (!along) roof.rotation.y = Math.PI / 2;
  const ridge = new THREE.Mesh(box((along ? w : d) + 0.28, 0.06, 0.08), lambert(DARK_WOOD));
  ridge.position.y = wallH + 0.86;
  if (!along) ridge.rotation.y = Math.PI / 2;
  g.add(walls, roof, ridge);
  // A door facing the street (south, toward the camera), a step, and lit windows either side.
  const doorX = w > 2.5 ? -w / 2 + 0.75 : 0;
  const door = new THREE.Mesh(box(0.3, 0.55, 0.05), lambert(DARK_WOOD));
  door.position.set(doorX, 0.275, d / 2 + 0.02);
  const step = new THREE.Mesh(box(0.42, 0.06, 0.16), lambert("#8a8378"));
  step.position.set(doorX, 0.03, d / 2 + 0.08);
  g.add(door, step);
  const glass = basic(LIT), frame = lambert(DARK_WOOD);
  const windowAt = (x: number, y: number, z: number, side: boolean) => {
    const pane = new THREE.Mesh(box(side ? 0.04 : 0.2, 0.2, side ? 0.2 : 0.04), glass);
    const sill = new THREE.Mesh(box(side ? 0.05 : 0.26, 0.04, side ? 0.26 : 0.05), frame);
    pane.position.set(x, y, z);
    sill.position.set(x, y - 0.12, z);
    g.add(pane, sill);
  };
  for (let x = -w / 2 + 0.45; x < w / 2 - 0.3; x += 0.75) if (Math.abs(x - doorX) > 0.35) windowAt(x, 0.58, d / 2 + 0.02, false);
  windowAt(w / 2 + 0.02, 0.58, 0, true);
  windowAt(-w / 2 - 0.02, 0.58, 0, true);
  // Wider houses get a chimney.
  if (p.rect.w >= 4 * T) {
    const chimney = new THREE.Mesh(tiledBox(0.22, 0.6, 0.22, 0.5), lambert("#ffffff", { map: tex.stone }));
    chimney.position.set(w / 2 - 0.55, wallH + 0.42, -d / 5);
    g.add(chimney);
  }
  g.position.set((p.rect.x + p.rect.w / 2) / T, 0, (p.rect.y + p.rect.h / 2) / T);
  parent.add(g);
}

// ---------- The keep ----------
export function buildKeep(ctx: RenderContext, parent: THREE.Group, p: PropOf<"keep">): PropView {
  const { lambert, basic, tex } = ctx, g = new THREE.Group();
  const stone = lambert("#ffffff", { map: tex.stone });
  const w = p.rect.w / T - 0.6, d = p.rect.h / T - 0.6, H = 1.9;
  const hall = new THREE.Mesh(tiledBox(w, H, d, 0.8), stone);
  hall.position.y = H / 2;
  g.add(hall);
  for (const [z, len] of [[d / 2 - 0.15, w], [-d / 2 + 0.15, w]] as const) {
    const m = merlons(len, H, 0.3, stone);
    m.position.z = z;
    g.add(m);
  }
  // The great tower rising from the middle, with a slate spire.
  const donjon = new THREE.Mesh(tiledBox(1.8, 1.3, 1.6, 0.8), stone);
  donjon.position.y = H + 0.65;
  const spire = new THREE.Mesh(new THREE.ConeGeometry(1.35, 1.3, 4), lambert(SLATE));
  spire.position.y = H + 1.3 + 0.65;
  spire.rotation.y = Math.PI / 4;
  g.add(donjon, spire);
  // Corner towers.
  const flags: THREE.Mesh[] = [];
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]] as const) {
    const t = tower(ctx, 0.68, 2.7, SLATE);
    t.position.set(sx * (w / 2), 0, sz * (d / 2));
    // A pennant on a pole on each tower's spire.
    const pole = new THREE.Mesh(box(0.03, 0.5, 0.03), basic(IRON));
    pole.position.y = 2.7 + 0.88 + 0.25;
    const flag = new THREE.Mesh(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0.42, -0.09, 0), new THREE.Vector3(0, -0.2, 0)]),
      lambert(CLAY, { side: THREE.DoubleSide }));
    flag.geometry.computeVertexNormals();
    flag.position.y = 2.7 + 0.88 + 0.48;
    flags.push(flag);
    t.add(pole, flag);
    g.add(t);
  }
  // The great door: a dark arch with steps, banners either side, and lit windows above.
  const door = new THREE.Mesh(box(0.9, 0.95, 0.06), basic("#1a120d"));
  door.position.set(0, 0.475, d / 2 + 0.02);
  const arch = new THREE.Mesh(new THREE.CircleGeometry(0.45, 10, 0, Math.PI), basic("#1a120d"));
  arch.position.set(0, 0.95, d / 2 + 0.025);
  g.add(door, arch);
  for (let i = 0; i < 2; i++) {
    const s = new THREE.Mesh(box(1.4 - i * 0.25, 0.08, 0.25), lambert("#8a8378"));
    s.position.set(0, 0.04 + i * 0.08, d / 2 + 0.28 - i * 0.12);
    g.add(s);
  }
  for (const x of [-1.3, 1.3]) {
    const b = banner(ctx, 0.5, 1.15);
    b.position.set(x, 1.75, d / 2 + 0.03);
    g.add(b);
  }
  for (const x of [-w / 2 + 0.6, -w / 2 + 1.3, w / 2 - 1.3, w / 2 - 0.6]) {
    const win = new THREE.Mesh(box(0.14, 0.32, 0.04), basic(LIT));
    win.position.set(x, 1.3, d / 2 + 0.02);
    g.add(win);
  }
  g.position.set((p.rect.x + p.rect.w / 2) / T, 0, (p.rect.y + p.rect.h / 2) / T);
  parent.add(g);
  return {
    update(t) {
      flags.forEach((f, i) => { f.rotation.y = Math.sin(t * 3 + i) * 0.35; });   // flapping in the wind
    },
  };
}

// ---------- Fountain ----------
export function buildFountain(ctx: RenderContext, parent: THREE.Group, p: PropOf<"fountain">): PropView {
  const { lambert, tex, particles } = ctx, g = new THREE.Group(), stone = lambert("#ffffff", { map: tex.stone });
  const basin = new THREE.Mesh(tiledCylinder(0.95, 0.34, 12, 0.6), stone);
  basin.position.y = 0.17;
  const pool = new THREE.Mesh(new THREE.CircleGeometry(0.84, 12).rotateX(-Math.PI / 2), lambert("#ffffff", { map: tex.water, transparent: true, opacity: 0.85 }));
  pool.position.y = 0.3;
  const pillar = new THREE.Mesh(tiledCylinder(0.13, 0.75, 6, 0.4), stone);
  pillar.position.y = 0.375;
  const bowl = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.2, 0.14, 8), stone);
  bowl.position.y = 0.8;
  const bowlWater = new THREE.Mesh(new THREE.CircleGeometry(0.33, 8).rotateX(-Math.PI / 2), lambert("#ffffff", { map: tex.water }));
  bowlWater.position.y = 0.875;
  const finial = new THREE.Mesh(new THREE.IcosahedronGeometry(0.09, 0), lambert(PAL.Y));
  finial.position.y = 0.98;
  g.add(basin, pool, pillar, bowl, bowlWater, finial);
  const cx = p.x / T, cz = p.y / T;
  g.position.set(cx, 0, cz);
  parent.add(g);
  return {
    update(_t, dt) {
      if (Math.random() < dt * 14) {                        // water spilling over the bowl's rim
        const a = Math.random() * Math.PI * 2;
        particles.spawn("water", cx + Math.cos(a) * 0.38, 0.86, cz + Math.sin(a) * 0.38, Math.cos(a) * 0.5, 0.6, Math.sin(a) * 0.5, 0.4);
      }
    },
  };
}

// ---------- Market stall ----------
export function buildStall(ctx: RenderContext, parent: THREE.Group, p: PropOf<"stall">): PropView {
  const { lambert } = ctx, g = new THREE.Group();
  const w = p.rect.w / T - 0.25, d = p.rect.h / T - 0.2;
  const counter = new THREE.Mesh(box(w, 0.45, d * 0.65), lambert(WOOD));
  counter.position.set(0, 0.225, d * 0.12);
  g.add(counter);
  // Wares on the counter: apples, loaves and bolts of cloth.
  const wares = [["#c8423a", "ball"], ["#d9b46a", "box"], ["#3f6fd0", "box"], ["#5fb04a", "ball"], ["#e8963a", "ball"]] as const;
  for (let i = 0; i < 5; i++) {
    const [c, shape] = wares[Math.floor(hash(p.rect.x + i, p.rect.y, 400) * wares.length)]!;
    const m = new THREE.Mesh(shape === "ball" ? new THREE.IcosahedronGeometry(0.07, 0) : box(0.16, 0.08, 0.12), lambert(c));
    m.position.set(-w / 2 + 0.2 + (i * (w - 0.4)) / 4, 0.5, d * 0.12 + (hash(i, p.rect.x, 401) - 0.5) * 0.15);
    g.add(m);
  }
  // Four posts and a striped awning sloping down toward the street.
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]] as const) {
    const post = new THREE.Mesh(box(0.05, 1.0, 0.05), lambert(DARK_WOOD));
    post.position.set(sx * (w / 2 - 0.03), 0.5, sz * (d / 2 - 0.03));
    g.add(post);
  }
  const awning = new THREE.Group(), stripes = 6;
  for (let i = 0; i < stripes; i++) {
    const s = new THREE.Mesh(box(w / stripes + 0.01, 0.03, d + 0.3), lambert(i % 2 ? "#e6dcc4" : p.awning));
    s.position.x = -w / 2 + (i + 0.5) * (w / stripes);
    awning.add(s);
  }
  awning.position.set(0, 1.02, 0.05);
  awning.rotation.x = 0.28;
  g.add(awning);
  g.position.set((p.rect.x + p.rect.w / 2) / T, 0, (p.rect.y + p.rect.h / 2) / T);
  parent.add(g);
}

// ---------- Street lamp ----------
export function buildLamp(ctx: RenderContext, parent: THREE.Group, p: PropOf<"lamp">): PropView {
  const { lambert, basic } = ctx, g = new THREE.Group(), iron = lambert(IRON);
  const base = new THREE.Mesh(box(0.14, 0.08, 0.14), iron);
  base.position.y = 0.04;
  const post = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.045, 1.05, 5), iron);
  post.position.y = 0.55;
  const lantern = new THREE.Mesh(box(0.13, 0.17, 0.13), basic(LIT));
  lantern.position.y = 1.15;
  const cap = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.1, 4), iron);
  cap.position.y = 1.29;
  cap.rotation.y = Math.PI / 4;
  g.add(base, post, lantern, cap);
  g.position.set(p.x / T, 0, p.y / T);
  parent.add(g);
}
