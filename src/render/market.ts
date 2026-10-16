// The town's public spaces: the market square's flagstones, fountain, stalls, stock and bunting, and
// standards flying the kingdom's banner. Same low-poly, hand-painted look and hero scale (about 1.1
// units tall) as the buildings in town.ts.
import * as THREE from "three";
import { PAL } from "../data/palette.ts";
import { T } from "../data/world.ts";
import { GROUND, box, onGround, type RenderContext } from "./context.ts";
import type { PropView } from "./props.ts";
import { hash } from "./terrain.ts";
import { WARES } from "./wares.ts";
import { FACING_YAW, FOUNTAIN_POOL, stallBody } from "../world/plans.ts";
import { DARK_WOOD, IRON, WOOD, banner, occluder, tiledCylinder, type PropOf } from "./town.ts";

/** Turn a group built facing south (+z) to face a facing. */
export const TURN = FACING_YAW;

export const STATUE_STONE = "#d6cfc0", STRAW = "#d9b46a", GILT = "#d9a83a";

/** Where a prop given at a point (game px) stands, in world units. */
export const at = (p: { x: number; y: number }) => [p.x / T, p.y / T] as const;
export const centreOf = (r: { x: number; y: number; w: number; h: number }) => [(r.x + r.w / 2) / T, (r.y + r.h / 2) / T] as const;

// ---------- The fountain's king ----------
/**
 * A stone king about 1.75 tall, facing +z, feet at y = 0, all in one stone but for his gilding: a long
 * robe flaring to the ground under a gilded belt, a mantle hanging from his shoulders behind him with an
 * ermine collar, a bearded head under a gold crown, a sceptre raised high in his right hand and an orb
 * held at his waist in his left.
 */
function stoneKing(ctx: RenderContext, colour: string): THREE.Group {
  const g = new THREE.Group(), stone = ctx.lambert(colour), drape = ctx.lambert(colour, { side: THREE.DoubleSide }), gold = ctx.lambert(GILT);
  const add = (geo: THREE.BufferGeometry, x: number, y: number, z: number, m: THREE.Material = stone) => {
    const mesh = new THREE.Mesh(geo, m);
    mesh.position.set(x, y, z);
    g.add(mesh);
    return mesh;
  };
  // A limb (or a rod) from a to b, rounded at its ends.
  const limb = (a: THREE.Vector3, b: THREE.Vector3, r: number, m: THREE.Material = stone) => {
    const mesh = add(new THREE.CapsuleGeometry(r, Math.max(0.01, a.distanceTo(b)), 2, 6), (a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2, m);
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize());
    return mesh;
  };
  const v = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
  // The robe, turned on a profile: flaring at the hem, narrowing to the waist, the chest above it.
  const profile = [[0.0, 0], [0.4, 0], [0.38, 0.08], [0.3, 0.4], [0.22, 0.8], [0.2, 0.92], [0.23, 1.08], [0.21, 1.2], [0.0, 1.24]].map(([r, y]) => new THREE.Vector2(r!, y!));
  add(new THREE.LatheGeometry(profile, 10), 0, 0, 0);
  for (let i = -2; i <= 2; i++) {                                                      // folds down the front of the robe
    const a = (i / 2) * 0.7;
    limb(v(Math.sin(a) * 0.3, 0.38, Math.cos(a) * 0.3), v(Math.sin(a) * 0.37, 0.06, Math.cos(a) * 0.37), 0.025);
  }
  add(new THREE.CylinderGeometry(0.215, 0.215, 0.06, 10), 0, 0.9, 0, gold);           // the belt
  // The mantle: hung from the shoulders, open at the front, falling behind him to the ground.
  add(new THREE.CylinderGeometry(0.27, 0.44, 1.2, 10, 1, true, Math.PI * 0.42, Math.PI * 1.16), 0, 0.62, -0.02, drape);
  add(new THREE.TorusGeometry(0.21, 0.065, 5, 10), 0, 1.24, 0, stone).rotation.x = Math.PI / 2;   // the ermine collar
  limb(v(-0.24, 1.2, 0), v(0.24, 1.2, 0), 0.09);                                       // the shoulders
  // The head: neck, head, beard and hair, and the crown with its five points.
  add(new THREE.CylinderGeometry(0.06, 0.07, 0.1, 6), 0, 1.3, 0);
  add(new THREE.IcosahedronGeometry(0.13, 1), 0, 1.45, 0).scale.set(0.95, 1.1, 1);
  add(new THREE.ConeGeometry(0.1, 0.2, 6), 0, 1.33, 0.07).rotation.x = Math.PI + 0.25;
  add(new THREE.CylinderGeometry(0.135, 0.14, 0.08, 8), 0, 1.47, -0.02).scale.set(1, 1, 1.05);
  add(new THREE.CylinderGeometry(0.135, 0.13, 0.09, 10, 1, true), 0, 1.58, 0, gold);
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    add(new THREE.ConeGeometry(0.035, 0.1, 4), Math.sin(a) * 0.13, 1.67, Math.cos(a) * 0.13, gold);
  }
  // His right arm raised, the sceptre in his fist; his left bent, holding the orb.
  limb(v(0.25, 1.18, 0), v(0.34, 0.98, 0.1), 0.06);
  limb(v(0.34, 0.98, 0.1), v(0.33, 1.18, 0.24), 0.055);
  limb(v(0.33, 0.9, 0.26), v(0.33, 1.72, 0.22), 0.022, gold);
  add(new THREE.OctahedronGeometry(0.07, 0), 0.33, 1.78, 0.22, gold);
  limb(v(-0.25, 1.18, 0), v(-0.3, 0.96, 0.08), 0.06);
  limb(v(-0.3, 0.96, 0.08), v(-0.16, 0.98, 0.24), 0.055);
  add(new THREE.IcosahedronGeometry(0.075, 1), -0.13, 1.06, 0.27, gold);
  add(box(0.02, 0.09, 0.02), -0.13, 1.17, 0.27, gold);
  add(box(0.06, 0.02, 0.02), -0.13, 1.18, 0.27, gold);
  return g;
}

// ---------- Fountain ----------
/**
 * The square's centrepiece. A stepped octagonal basin with a thick coping, coins glinting on the pool's
 * floor; a pedestal in the middle with four lions' heads, each arcing a jet into the pool; two curved
 * bowls above it, each pouring a sheet of water from its rim into the one below; and a king on top.
 * The column stops at each bowl (nothing pokes through a water surface), the sheets land inside the
 * bowl or pool below them, and the splashes rise from where water lands.
 */
export function buildFountain(ctx: RenderContext, parent: THREE.Group, p: PropOf<"fountain">): PropView {
  const { lambert, basic, tex, particles } = ctx, g = new THREE.Group(), R = p.radius;
  const stone = lambert("#ffffff", { map: tex.stone }), trim = lambert("#8a8378", { map: tex.stone });
  const flowing = (opacity: number) => lambert("#ffffff", { map: tex.flow, transparent: true, opacity, depthWrite: false, side: THREE.DoubleSide });
  const add = (mesh: THREE.Mesh, y: number) => { mesh.position.y = y; g.add(mesh); return mesh; };
  const POOL = FOUNTAIN_POOL.y, WATER_R = R - FOUNTAIN_POOL.inset;   // the pool's surface, and its edge

  // The basin: a low step, an open stone wall with an inner face, a coping on top, the floor and the water.
  add(new THREE.Mesh(new THREE.CylinderGeometry(R + 0.32, R + 0.38, 0.12, 8), trim), 0.06);
  add(new THREE.Mesh(tiledCylinder(R, 0.52, 8, 0.6, true), lambert("#ffffff", { map: tex.stone, side: THREE.DoubleSide })), 0.38);
  add(new THREE.Mesh(tiledCylinder(WATER_R, 0.5, 8, 0.6, true), lambert("#ffffff", { map: tex.stone, side: THREE.BackSide })), 0.37);
  add(new THREE.Mesh(new THREE.RingGeometry(R - 0.2, R + 0.1, 8).rotateX(-Math.PI / 2), trim), 0.645);
  add(new THREE.Mesh(new THREE.CircleGeometry(WATER_R, 8).rotateX(-Math.PI / 2), lambert("#2f6f8a")), 0.14);
  const gold = basic(PAL.Y);
  for (let i = 0; i < 12; i++) {                             // wishes
    const a = hash(i, 1, 620) * Math.PI * 2, d = 0.7 + hash(i, 2, 621) * (R - 1.0);
    const coin = add(new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.015, 6), gold), 0.15);
    coin.position.x = Math.cos(a) * d;
    coin.position.z = Math.sin(a) * d;
  }
  add(new THREE.Mesh(new THREE.CircleGeometry(WATER_R, 16).rotateX(-Math.PI / 2), lambert("#ffffff", { map: tex.water, transparent: true, opacity: 0.7 })), POOL);

  // The pedestal, and its lions: each a head on the pedestal's face with a jet arcing out of its mouth.
  add(new THREE.Mesh(tiledCylinder(0.42, 0.95, 8, 0.5), stone), 0.14 + 0.475);
  const jets = flowing(0.85), jetEnds: { x: number; z: number }[] = [];
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + Math.PI / 4, cos = Math.cos(a), sin = Math.sin(a);
    const head = new THREE.Group();
    const face = new THREE.Mesh(box(0.24, 0.24, 0.12), trim);
    const mane = new THREE.Mesh(new THREE.IcosahedronGeometry(0.17, 0), trim);
    mane.position.z = -0.06;
    const snout = new THREE.Mesh(box(0.12, 0.09, 0.1), trim);
    snout.position.set(0, -0.04, 0.09);
    head.add(mane, face, snout);
    head.position.set(cos * 0.44, 0.9, sin * 0.44);
    head.rotation.y = Math.PI / 2 - a;
    g.add(head);
    const from = new THREE.Vector3(cos * 0.6, 0.86, sin * 0.6), land = R * 0.68;
    const to = new THREE.Vector3(cos * land, POOL, sin * land);
    const mid = new THREE.Vector3(cos * (0.6 + land) * 0.5, 1.15, sin * (0.6 + land) * 0.5);
    g.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.QuadraticBezierCurve3(from, mid, to), 10, 0.035, 5), jets));
    jetEnds.push({ x: to.x, z: to.z });
  }

  // Two bowls, each a turned dish whose water sits just inside its lip; a column between them.
  const bowl = (r: number) => new THREE.LatheGeometry([
    new THREE.Vector2(0.1, -0.3), new THREE.Vector2(0.28, -0.26), new THREE.Vector2(r * 0.72, -0.15),
    new THREE.Vector2(r * 0.96, -0.02), new THREE.Vector2(r, 0.08), new THREE.Vector2(r - 0.07, 0.1), new THREE.Vector2(r - 0.07, 0.03), new THREE.Vector2(0, 0.03),
  ], 12);
  const tiers = [{ y: 1.55, r: R * 0.52 }, { y: 2.3, r: R * 0.28 }];
  let below = 0.14 + 0.95;                                   // top of the pedestal
  for (const { y, r } of tiers) {
    add(new THREE.Mesh(tiledCylinder(0.14, y - 0.28 - below, 8, 0.4), stone), (below + y - 0.28) / 2);
    add(new THREE.Mesh(bowl(r), stone), y);
    add(new THREE.Mesh(new THREE.CircleGeometry(r - 0.07, 12).rotateX(-Math.PI / 2), lambert("#ffffff", { map: tex.water })), y + 0.05);
    below = y + 0.03;
  }
  // Streams of water pouring from notches round each bowl's lip into the water below it (gaps between
  // them, so you see the column and lions through them).
  const sheets = flowing(0.7);
  tiers.forEach(({ y, r }, i) => {
    const lands = i === 0 ? POOL : tiers[0]!.y + 0.05, drop = y + 0.08 - lands, n = i === 0 ? 8 : 6, arc = (Math.PI * 2) / n;
    for (let k = 0; k < n; k++)
      add(new THREE.Mesh(new THREE.CylinderGeometry(r + 0.02, r + 0.08, drop, 3, 1, true, k * arc + arc * 0.3, arc * 0.32), sheets), lands + drop / 2);
  });
  // The king on an octagonal plinth in the top bowl, a gilded band round its cornice.
  const top = tiers[1]!;
  add(new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.24, 0.3, 8), stone), top.y + 0.15);
  add(new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.05, 8), lambert(GILT)), top.y + 0.32);
  const king = stoneKing(ctx, STATUE_STONE);
  king.scale.setScalar(0.66);
  king.position.y = top.y + 0.34;
  g.add(king);

  const [cx, cz] = at(p);
  g.position.set(cx, 0, cz);
  parent.add(g);
  const splash = (x: number, y: number, z: number) => {
    const a = Math.random() * Math.PI * 2;
    particles.spawn("water", cx + x, y + 0.02, cz + z, Math.cos(a) * 0.35, 0.5 + Math.random() * 0.4, Math.sin(a) * 0.35, 0.3);
  };
  return {
    update(t, dt) {
      tex.flow.offset.set((-t * 1.4) % 1, (t * 1.1) % 1);   // water running along the jets and down the sheets
      // Where the streams land: in the pool, and in the lower bowl. (A stream's middle is at angle θ
      // round the bowl, at (sin θ, cos θ), as three.js lays out a cylinder.)
      tiers.forEach(({ r }, i) => {
        if (Math.random() > dt * (i === 0 ? 14 : 6)) return;
        const n = i === 0 ? 8 : 6, arc = (Math.PI * 2) / n, a = Math.floor(Math.random() * n) * arc + arc * 0.46;
        splash(Math.sin(a) * (r + 0.08), i === 0 ? POOL : tiers[0]!.y + 0.05, Math.cos(a) * (r + 0.08));
      });
      if (Math.random() < dt * 10) { const e = jetEnds[Math.floor(Math.random() * 4)]!; splash(e.x, POOL, e.z); }
    },
    occluders: [occluder(g, cx, cz, R * 1.2, R * 1.2, 2.8)],
  };
}

// ---------- Market stall ----------
/** Each kind of stall's wares: shape, colours and how they're laid out on the counter. */
export function buildStall(ctx: RenderContext, parent: THREE.Group, p: PropOf<"stall">): PropView {
  const { lambert } = ctx, g = new THREE.Group();
  const { w, d } = stallBody(p.rect), seed = p.rect.x + p.rect.y * 7;
  const counter = new THREE.Mesh(box(w, 0.8, d * 0.6), lambert(WOOD));
  counter.position.set(0, 0.4, d * 0.15);
  const top = new THREE.Mesh(box(w + 0.06, 0.05, d * 0.6 + 0.06), lambert(p.goods === "fish" ? "#e8f0f4" : DARK_WOOD));   // fish on ice
  top.position.set(0, 0.82, d * 0.15);
  g.add(counter, top);
  // The wares, in two rows along the counter.
  const wares = WARES[p.goods], n = Math.round(w / 0.2);
  for (let row = 0; row < 2; row++) for (let i = 0; i < n; i++) {
    const c = wares.colors[Math.floor(hash(seed + i, row, 400) * wares.colors.length)]!;
    const m = wares.make(ctx, c);
    m.position.set(-w / 2 + 0.15 + (i * (w - 0.3)) / Math.max(1, n - 1), 0.92 + (p.goods === "pottery" ? 0.04 : 0), d * 0.15 + (row - 0.5) * 0.2);
    g.add(m);
  }
  // A basket or crate of more by the counter's end, and a stool behind it for the stallholder.
  const spare = new THREE.Mesh(box(0.3, 0.26, 0.3), lambert(p.goods === "cloth" || p.goods === "pottery" ? WOOD : STRAW));
  spare.position.set(w / 2 + 0.05, 0.13, d * 0.45);
  const stool = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.4, 6), lambert(DARK_WOOD));
  stool.position.set(-w / 4, 0.2, -d * 0.3);
  g.add(spare, stool);
  // Four posts and a striped awning sloping down toward the customers.
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]] as const) {
    const post = new THREE.Mesh(box(0.07, 1.75, 0.07), lambert(DARK_WOOD));
    post.position.set(sx * (w / 2 - 0.04), 0.875, sz * (d / 2 - 0.04));
    g.add(post);
  }
  const awning = new THREE.Group(), stripes = 6;
  for (let i = 0; i < stripes; i++) {
    const s = new THREE.Mesh(box(w / stripes, 0.04, d + 0.4), lambert(i % 2 ? "#e6dcc4" : p.awning));
    s.position.x = -w / 2 + (i + 0.5) * (w / stripes);
    awning.add(s);
  }
  awning.position.set(0, 1.78, 0.05);
  awning.rotation.x = 0.3;
  g.add(awning);
  const [cx, cz] = centreOf(p.rect);
  g.position.set(cx, 0, cz);
  g.rotation.y = TURN[p.facing];
  parent.add(g);
  return { occluders: [occluder(g, cx, cz, w + 0.4, d + 0.6, 2.0)] };
}

// ---------- Market stock ----------
export function buildStock(ctx: RenderContext, parent: THREE.Group, p: PropOf<"stock">): PropView {
  const { lambert } = ctx, g = new THREE.Group(), [x, z] = at(p);
  const place = (geo: THREE.BufferGeometry, mat: THREE.Material, px: number, py: number, pz: number, ry = 0) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(px, py, pz);
    m.rotation.y = ry;
    g.add(m);
  };
  if (p.what === "barrels") {
    const wood = lambert(WOOD), hoop = lambert(IRON);
    for (const [bx, bz, by] of [[-0.2, -0.15, 0], [0.22, -0.1, 0], [0, 0.22, 0], [0.02, -0.12, 0.62]] as const) {
      place(new THREE.CylinderGeometry(0.22, 0.2, 0.6, 9), wood, bx, by + 0.3, bz);
      for (const hy of [0.12, 0.48]) place(new THREE.CylinderGeometry(0.225, 0.225, 0.04, 9), hoop, bx, by + hy, bz);
    }
  } else if (p.what === "crates") {
    const wood = lambert("#a8794a");
    for (const [bx, bz, by, s] of [[-0.18, -0.1, 0, 0.42], [0.22, 0.05, 0, 0.36], [-0.14, -0.08, 0.42, 0.34], [0.05, 0.28, 0, 0.3]] as const)
      place(box(s, s, s), wood, bx, by + s / 2, bz, hash(bx, bz, 610) * 0.5);
  } else if (p.what === "sacks") {
    const cloth = lambert("#c9b48a");
    for (const [bx, bz, by] of [[-0.2, 0, 0], [0.18, -0.12, 0], [0.05, 0.22, 0], [0, -0.04, 0.3]] as const) {
      const sack = new THREE.Mesh(new THREE.IcosahedronGeometry(0.22, 0), cloth);
      sack.scale.set(1, 0.85, 0.9);
      sack.position.set(bx, by + 0.18, bz);
      g.add(sack);
    }
  } else {
    const straw = lambert(STRAW);
    place(box(0.8, 0.4, 0.5), straw, 0, 0.2, 0.1);
    place(box(0.6, 0.36, 0.45), straw, 0.05, 0.58, 0.08, 0.2);
    const fork = new THREE.Mesh(box(0.04, 1.1, 0.04), lambert(DARK_WOOD));
    fork.position.set(0.35, 0.5, -0.2);
    fork.rotation.z = -0.35;
    g.add(fork);
  }
  g.position.set(x, 0, z);
  parent.add(g);
}

// ---------- Bunting ----------
const FLAGS = ["#c8423a", "#f5d562", "#3f6fd0", "#5fb04a", "#ffffff"] as const;

/**
 * Little triangular flags on a sagging string between two points; they flutter. With `masts`, each end
 * is tied to a tall pole (the string runs high, clear of stalls and trees); without, it's tied to
 * something already there, like a lamp post.
 */
export function buildBunting(ctx: RenderContext, parent: THREE.Group, p: PropOf<"bunting">): PropView {
  const [x0, z0] = at(p.from), [x1, z1] = at(p.to), len = Math.hypot(x1 - x0, z1 - z0), sag = Math.min(p.masts ? 0.3 : 0.5, len * 0.04);
  if (p.masts) for (const [x, z] of [[x0, z0], [x1, z1]] as const) {
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.06, p.height + 0.15, 6), ctx.lambert(DARK_WOOD));
    mast.position.set(x, (p.height + 0.15) / 2, z);
    const knob = new THREE.Mesh(new THREE.OctahedronGeometry(0.08, 0), ctx.basic(PAL.Y));
    knob.position.set(x, p.height + 0.22, z);
    parent.add(mast, knob);
  }
  const along = (t: number) => new THREE.Vector3(x0 + (x1 - x0) * t, p.height - sag * 4 * t * (1 - t), z0 + (z1 - z0) * t);
  const n = Math.max(2, Math.floor(len / 0.45)), angle = -Math.atan2(z1 - z0, x1 - x0);
  const string = new THREE.Line(new THREE.BufferGeometry().setFromPoints(Array.from({ length: 17 }, (_, i) => along(i / 16))), new THREE.LineBasicMaterial({ color: "#3a2a20" }));
  parent.add(string);
  const tri = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(-0.13, 0, 0), new THREE.Vector3(0.13, 0, 0), new THREE.Vector3(0, -0.3, 0)]);
  tri.computeVertexNormals();
  const mats = FLAGS.map(c => ctx.lambert(c, { side: THREE.DoubleSide }));
  const flags: THREE.Mesh[] = [];
  for (let i = 1; i < n; i++) {
    const f = new THREE.Mesh(tri, mats[i % mats.length]!);
    f.position.copy(along(i / n));
    f.rotation.set(0, angle, 0, "YXZ");
    parent.add(f);
    flags.push(f);
  }
  return { update(t) { flags.forEach((f, i) => { f.rotation.x = Math.sin(t * 2.6 + i * 0.9) * 0.35; }); } };
}

// ---------- Standard ----------
/** A tall pole flying the kingdom's banner, with a gold finial. */
export function buildStandard(ctx: RenderContext, parent: THREE.Group, p: PropOf<"standard">): PropView {
  const { lambert } = ctx, g = new THREE.Group(), [x, z] = at(p);
  const foot = new THREE.Mesh(box(0.4, 0.2, 0.4), lambert("#8a8378"));
  foot.position.y = 0.1;
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 3.4, 6), lambert(DARK_WOOD));
  pole.position.y = 1.7;
  const bar = new THREE.Mesh(box(0.9, 0.06, 0.06), lambert(DARK_WOOD));
  bar.position.y = 3.2;
  const finial = new THREE.Mesh(new THREE.OctahedronGeometry(0.1, 0), ctx.basic(PAL.Y));
  finial.position.y = 3.5;
  const flag = banner(ctx, 0.8, 1.5);
  flag.position.set(0, 3.2, 0.06);
  g.add(foot, pole, bar, finial, flag);
  g.position.set(x, 0, z);
  parent.add(g);
  return { update(t) { flag.rotation.x = Math.sin(t * 1.7 + x) * 0.06; } };
}

// ---------- Plaza ----------
/** Big pale flagstones laid over the square, a kerb round its edge and rings of darker paving round its centre. */
export function buildPlaza(ctx: RenderContext, parent: THREE.Group, p: PropOf<"plaza">): PropView {
  const { lambert, tex } = ctx, g = new THREE.Group(), [cx, cz] = centreOf(p.rect), [ox, oz] = at(p.centre);
  const w = p.rect.w / T, d = p.rect.h / T;
  // Just above the paths and paving, below shadows and markers (see GROUND in context.ts).
  const flat = (c: string, layer: number) => lambert(c, { map: tex.stone, ...onGround(layer) });
  const slabs = new THREE.PlaneGeometry(w, d).rotateX(-Math.PI / 2), uv = slabs.attributes.uv!;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, (uv.getX(i) * w) / 1.6, (uv.getY(i) * d) / 1.6);   // big slabs
  const floor = new THREE.Mesh(slabs, flat("#e4dccb", GROUND.plaza));
  floor.position.set(cx, 0.008, cz);
  g.add(floor);
  for (const [r0, r1, c] of [[2.4, 2.9, "#9a9082"], [4.2, 4.5, "#b0a796"]] as const) {
    const ring = new THREE.Mesh(new THREE.RingGeometry(r0, r1, 24).rotateX(-Math.PI / 2), flat(c, GROUND.plazaRings));
    ring.position.set(ox, 0.01, oz);
    g.add(ring);
  }
  const kerb = lambert("#8a8378", { map: tex.stone });
  for (const [kx, kz, kw, kd] of [[cx, cz - d / 2, w, 0.16], [cx, cz + d / 2, w, 0.16], [cx - w / 2, cz, 0.16, d - 0.16], [cx + w / 2, cz, 0.16, d - 0.16]] as const) {   // the sides stop at the ends', not overlapping them
    const k = new THREE.Mesh(box(kw, 0.06, kd), kerb);
    k.position.set(kx, 0.03, kz);
    g.add(k);
  }
  parent.add(g);
}
