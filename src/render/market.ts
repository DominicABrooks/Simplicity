// The town's public spaces: the market square's flagstones, fountain, stalls, stock, benches, planters
// and bunting, and the statues and standards along the way up to the castle. Same low-poly, hand-painted
// look and hero scale (about 1.1 units tall) as the buildings in town.ts.
import * as THREE from "three";
import { PAL } from "../data/palette.ts";
import { T } from "../data/world.ts";
import type { Facing, Goods } from "../world/area.ts";
import { GROUND, box, onGround, type RenderContext } from "./context.ts";
import type { PropView } from "./props.ts";
import { hash } from "./terrain.ts";
import { benchLength, stallBody } from "../world/plans.ts";
import { DARK_WOOD, IRON, WOOD, banner, occluder, tiledBox, tiledCylinder, type PropOf } from "./town.ts";

/** Turn a group built facing south (+z) to face `facing`. */
const TURN: Record<Facing, number> = { south: 0, north: Math.PI, east: Math.PI / 2, west: -Math.PI / 2 };

const STATUE_STONE = "#d6cfc0", BRONZE = "#5f8a78", STRAW = "#d9b46a";

/** Where a prop given at a point (game px) stands, in world units. */
const at = (p: { x: number; y: number }) => [p.x / T, p.y / T] as const;
const centreOf = (r: { x: number; y: number; w: number; h: number }) => [(r.x + r.w / 2) / T, (r.y + r.h / 2) / T] as const;

// ---------- Figures ----------
/**
 * A standing figure about 1.4 tall, facing +z, feet at y = 0, all in one material (stone or bronze) but
 * for gold details: a king in a long robe and cape with a crown and a raised sceptre, or a knight in a
 * tabard and helm, both hands resting on a sword planted point-down in front of him.
 */
function figure(ctx: RenderContext, kind: "king" | "knight", mat: THREE.Material): THREE.Group {
  const g = new THREE.Group(), gold = ctx.basic(PAL.Y);
  const add = (geo: THREE.BufferGeometry, x: number, y: number, z: number, m: THREE.Material = mat) => {
    const mesh = new THREE.Mesh(geo, m);
    mesh.position.set(x, y, z);
    g.add(mesh);
    return mesh;
  };
  add(new THREE.IcosahedronGeometry(0.15, 1), 0, 1.22, 0);                       // head
  if (kind === "king") {
    add(new THREE.CylinderGeometry(0.2, 0.36, 0.95, 8), 0, 0.48, 0);           // robe
    add(new THREE.CylinderGeometry(0.17, 0.21, 0.3, 8), 0, 1.0, 0);            // chest
    const cape = add(box(0.5, 0.95, 0.06), 0, 0.62, -0.24);
    cape.rotation.x = -0.12;
    add(new THREE.CylinderGeometry(0.15, 0.13, 0.12, 8, 1, true), 0, 1.38, 0, gold);   // crown
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      add(new THREE.ConeGeometry(0.035, 0.1, 4), Math.cos(a) * 0.13, 1.48, Math.sin(a) * 0.13, gold);
    }
    const arm = add(box(0.09, 0.42, 0.09), 0.24, 1.18, 0.04);                   // raised arm and sceptre
    arm.rotation.z = -0.35;
    add(box(0.04, 0.62, 0.04), 0.33, 1.5, 0.06, gold);
    add(new THREE.IcosahedronGeometry(0.06, 0), 0.33, 1.84, 0.06, gold);
    const other = add(box(0.09, 0.4, 0.09), -0.22, 0.86, 0.04);
    other.rotation.z = 0.15;
  } else {
    for (const s of [-1, 1]) add(box(0.13, 0.5, 0.15), s * 0.1, 0.25, 0);      // legs
    add(box(0.42, 0.5, 0.26), 0, 0.75, 0);                                     // body
    add(box(0.34, 0.42, 0.03), 0, 0.68, 0.14, ctx.basic(PAL.Y));               // tabard's emblem
    for (const s of [-1, 1]) add(new THREE.IcosahedronGeometry(0.12, 0), s * 0.25, 0.98, 0);   // pauldrons
    for (const s of [-1, 1]) { const a = add(box(0.09, 0.4, 0.09), s * 0.17, 0.78, 0.13); a.rotation.x = -0.5; }
    add(new THREE.CylinderGeometry(0.16, 0.15, 0.22, 8), 0, 1.25, 0);          // helm
    add(box(0.2, 0.03, 0.02), 0, 1.24, 0.15, ctx.basic(IRON));                 // visor slit
    add(new THREE.ConeGeometry(0.05, 0.3, 4), 0, 1.48, -0.02, ctx.lambert("#c8423a"));   // plume
    add(box(0.06, 0.9, 0.02), 0, 0.42, 0.3);                                   // the sword, point down
    add(box(0.3, 0.05, 0.05), 0, 0.88, 0.3, gold);
    add(box(0.05, 0.16, 0.05), 0, 0.98, 0.3, gold);
  }
  return g;
}

// ---------- Statue ----------
export function buildStatue(ctx: RenderContext, parent: THREE.Group, p: PropOf<"statue">): PropView {
  const { lambert, tex } = ctx, g = new THREE.Group();
  const stone = lambert("#ffffff", { map: tex.stone });
  const plinth = new THREE.Mesh(tiledBox(0.8, 1.0, 0.8, 0.6), stone);
  plinth.position.y = 0.5;
  const foot = new THREE.Mesh(box(0.96, 0.16, 0.96), lambert("#8a8378"));
  foot.position.y = 0.08;
  const cap = new THREE.Mesh(box(0.94, 0.1, 0.94), lambert("#8a8378"));
  cap.position.y = 1.05;
  const plaque = new THREE.Mesh(box(0.42, 0.24, 0.03), ctx.basic(PAL.Y));
  plaque.position.set(0, 0.6, 0.41);
  const body = figure(ctx, p.figure, lambert(p.figure === "king" ? STATUE_STONE : BRONZE));
  body.position.y = 1.1;
  g.add(plinth, foot, cap, plaque, body);
  const [x, z] = at(p);
  g.position.set(x, 0, z);
  g.rotation.y = TURN[p.facing];
  parent.add(g);
  return { occluders: [occluder(g, x, z, 1, 1, 2.9)] };
}

// ---------- Fountain ----------
/** The square's centrepiece: an octagonal basin, two tiers of bowls spilling into it, and a king on top. */
export function buildFountain(ctx: RenderContext, parent: THREE.Group, p: PropOf<"fountain">): PropView {
  const { lambert, tex, particles } = ctx, g = new THREE.Group(), stone = lambert("#ffffff", { map: tex.stone });
  const water = lambert("#ffffff", { map: tex.water, transparent: true, opacity: 0.85 }), R = p.radius;
  // An open stone ring (a closed one would put a lid over the pool), lit inside too.
  const rim = new THREE.Mesh(tiledCylinder(R, 0.55, 8, 0.6, true), lambert("#ffffff", { map: tex.stone, side: THREE.DoubleSide }));
  rim.position.y = 0.275;
  const inner = new THREE.Mesh(new THREE.RingGeometry(R - 0.12, R + 0.1, 8).rotateX(-Math.PI / 2), lambert("#8a8378"));
  inner.position.y = 0.6;
  const pool = new THREE.Mesh(new THREE.CircleGeometry(R - 0.12, 16).rotateX(-Math.PI / 2), water);
  pool.position.y = 0.46;
  g.add(rim, inner, pool);
  // Two bowls on a column, each spilling into the one below.
  const tiers = [{ y: 1.25, r: R * 0.48 }, { y: 2.0, r: R * 0.24 }];
  const column = new THREE.Mesh(tiledCylinder(0.2, 2.1, 8, 0.4), stone);
  column.position.y = 1.05;
  g.add(column);
  for (const { y, r } of tiers) {
    const bowl = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 0.4, 0.22, 10), stone);
    bowl.position.y = y;
    const top = new THREE.Mesh(new THREE.CircleGeometry(r - 0.06, 12).rotateX(-Math.PI / 2), lambert("#ffffff", { map: tex.water }));
    top.position.y = y + 0.115;
    g.add(bowl, top);
  }
  const king = figure(ctx, "king", lambert(STATUE_STONE));
  king.scale.setScalar(0.62);
  king.position.y = 2.12;
  g.add(king);
  const [cx, cz] = at(p);
  g.position.set(cx, 0, cz);
  parent.add(g);
  return {
    update(_t, dt) {
      for (const { y, r } of tiers) if (Math.random() < dt * 16) {   // water spilling over each bowl's rim
        const a = Math.random() * Math.PI * 2;
        particles.spawn("water", cx + Math.cos(a) * r, y + 0.1, cz + Math.sin(a) * r, Math.cos(a) * 0.5, 0.6, Math.sin(a) * 0.5, 0.55);
      }
    },
    occluders: [occluder(g, cx, cz, R * 1.2, R * 1.2, 2.6)],
  };
}

// ---------- Market stall ----------
/** Each kind of stall's wares: shape, colours and how they're laid out on the counter. */
const WARES: Record<Goods, { colors: string[]; make: (ctx: RenderContext, c: string) => THREE.Mesh }> = {
  produce: { colors: ["#c8423a", "#5fb04a", "#e8963a", "#a8c84a"], make: (ctx, c) => new THREE.Mesh(new THREE.IcosahedronGeometry(0.09, 0), ctx.lambert(c)) },
  bread: { colors: ["#c8964a", "#b07a3a", "#d9b46a"], make: (ctx, c) => { const m = new THREE.Mesh(new THREE.CapsuleGeometry(0.06, 0.14, 2, 6), ctx.lambert(c)); m.rotation.z = Math.PI / 2; return m; } },
  cloth: { colors: ["#3f6fd0", "#8a4fc0", "#c8423a", "#f5d562"], make: (ctx, c) => { const m = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.3, 8), ctx.lambert(c)); m.rotation.z = Math.PI / 2; return m; } },
  pottery: { colors: ["#b8613a", "#a8473a", "#d08a5a"], make: (ctx, c) => new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.08, 0.2, 7), ctx.lambert(c)) },
  fish: { colors: ["#9fb4c8", "#7f96b0", "#c0ccd8"], make: (ctx, c) => { const m = new THREE.Mesh(new THREE.OctahedronGeometry(0.08, 0), ctx.lambert(c)); m.scale.set(2.2, 0.6, 0.8); return m; } },
  flowers: { colors: ["#e85a8a", "#f5d562", "#ffffff", "#c8423a", "#8a4fc0"], make: (ctx, c) => new THREE.Mesh(new THREE.IcosahedronGeometry(0.07, 0), ctx.basic(c)) },
};

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
    const s = new THREE.Mesh(box(w / stripes + 0.01, 0.04, d + 0.4), lambert(i % 2 ? "#e6dcc4" : p.awning));
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

// ---------- Planter ----------
export function buildPlanter(ctx: RenderContext, parent: THREE.Group, p: PropOf<"planter">): PropView {
  const { lambert, tex } = ctx, g = new THREE.Group(), [x, z] = at(p), k = hash(x, z, 600);
  const tub = new THREE.Mesh(tiledBox(0.9, 0.45, 0.9, 0.6), lambert("#ffffff", { map: tex.stone }));
  tub.position.y = 0.225;
  const rim = new THREE.Mesh(box(1.0, 0.08, 1.0), lambert("#8a8378"));
  rim.position.y = 0.47;
  const soil = new THREE.Mesh(box(0.8, 0.02, 0.8), lambert("#5a3e2a"));
  soil.position.y = 0.46;
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.1, 0.9, 5), lambert("#ffffff", { map: tex.bark }));
  trunk.position.y = 0.9;
  const leaf = lambert("#ffffff", { map: tex.leaf });
  const crown = new THREE.Mesh(new THREE.IcosahedronGeometry(0.5 + k * 0.1, 0), leaf);
  crown.position.y = 1.55;
  const top = new THREE.Mesh(new THREE.IcosahedronGeometry(0.32, 0), leaf);
  top.position.set(0.08, 1.95, 0.05);
  g.add(tub, rim, soil, trunk, crown, top);
  g.position.set(x, 0, z);
  g.rotation.y = Math.floor(k * 4) * (Math.PI / 2);         // quarter turns: the tub stays square to its footprint
  parent.add(g);
  return { occluders: [occluder(g, x, z, 1, 1, 2.2)] };
}

// ---------- Bench ----------
/** A stone-legged wooden bench along the rect's long side, its back away from where you'd look. */
export function buildBench(ctx: RenderContext, parent: THREE.Group, p: PropOf<"bench">): PropView {
  const { lambert } = ctx, g = new THREE.Group();
  const len = benchLength(p.rect), wood = lambert(WOOD), stone = lambert("#8a8378");
  const seat = new THREE.Mesh(box(len, 0.08, 0.38), wood);
  seat.position.y = 0.42;
  const back = new THREE.Mesh(box(len, 0.32, 0.06), wood);
  back.position.set(0, 0.7, -0.17);
  back.rotation.x = -0.15;
  g.add(seat, back);
  for (const s of [-1, 1]) {
    const leg = new THREE.Mesh(box(0.12, 0.4, 0.34), stone);
    leg.position.set(s * (len / 2 - 0.15), 0.2, 0);
    g.add(leg);
  }
  const [x, z] = centreOf(p.rect);
  g.position.set(x, 0, z);
  g.rotation.y = TURN[p.facing];
  parent.add(g);
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

/** Little triangular flags on a sagging string between two points; they flutter. */
export function buildBunting(ctx: RenderContext, parent: THREE.Group, p: PropOf<"bunting">): PropView {
  const [x0, z0] = at(p.from), [x1, z1] = at(p.to), len = Math.hypot(x1 - x0, z1 - z0), sag = Math.min(0.6, len * 0.05);
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
  for (const [kx, kz, kw, kd] of [[cx, cz - d / 2, w, 0.16], [cx, cz + d / 2, w, 0.16], [cx - w / 2, cz, 0.16, d], [cx + w / 2, cz, 0.16, d]] as const) {
    const k = new THREE.Mesh(box(kw, 0.06, kd), kerb);
    k.position.set(kx, 0.03, kz);
    g.add(k);
  }
  parent.add(g);
}
