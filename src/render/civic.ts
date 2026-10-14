// The city's great and holy buildings: parish churches and chapels, halls (a great hall, a guildhall
// over an open market arcade, a kitchen under its smoking louvre, a granary on staddle stones), the
// cathedral, its cloister and chapter house, a churchyard's graves, the market cross and a dovecote.
// Built from the ground plans in src/world/plans.ts (what you see is what you bump into), at the hero's
// scale (about 1.1 units tall): the cathedral dwarfs everything.
import * as THREE from "three";
import { PAL } from "../data/palette.ts";
import { T } from "../data/world.ts";
import { FACING_YAW, cathedralPlan, churchPlan, cloisterPlan, hallBody } from "../world/plans.ts";
import { LION_PLINTH, arcadePillars, gravePlan } from "../world/solids.ts";
import { box, type RenderContext } from "./context.ts";
import { put, shield } from "./castle.ts";
import type { Occluder } from "./occlusion.ts";
import type { PropView } from "./props.ts";
import { hash } from "./terrain.ts";
import { DARK_WOOD, DOORWAY, GOLD, LIT, MARBLE, SLATE, banner, gableGeometry, merlons, occluder, roofGeometry, tiledBox, tiledCylinder, type PropOf } from "./town.ts";

const LEAD = "#5a6470", TRIM = "#8a8378";
const GLASS = ["#3f6fd0", "#c8423a", "#f5d562", "#5fb04a", "#8a4fc0"] as const;

/** A pointed (lancet) window or doorway, `w` wide and `h` tall to its point, its face toward +z, base at y = 0. */
function lancet(mat: THREE.Material, w: number, h: number): THREE.Group {
  const g = new THREE.Group();
  put(g, arch(w, h), mat, 0, 0, 0);
  return g;
}

/** A flat pointed arch, `w` wide and `h` tall to its point, facing +z: straight sides, then two curves meeting at the top. */
const arches = new Map<string, THREE.ExtrudeGeometry>();
function arch(w: number, h: number): THREE.BufferGeometry {
  const key = `${w.toFixed(3)}x${h.toFixed(3)}`;
  let geo = arches.get(key);
  if (geo) return geo.clone();
  const spring = h - w * 0.6, shape = new THREE.Shape();
  shape.moveTo(-w / 2, 0);
  shape.lineTo(w / 2, 0);
  shape.lineTo(w / 2, spring);
  shape.quadraticCurveTo(w / 2, spring + w * 0.4, 0, h);
  shape.quadraticCurveTo(-w / 2, spring + w * 0.4, -w / 2, spring);
  shape.closePath();
  geo = new THREE.ExtrudeGeometry(shape, { depth: 0.05, bevelEnabled: false, curveSegments: 4 }).translate(0, 0, -0.025);
  arches.set(key, geo);
  return geo.clone();
}

/**
 * A doorway, `w` wide and `h` tall to its point, its face toward +z, base at y = 0: a pointed stone
 * surround standing proud of the wall, and heavy wooden doors in it, banded with iron.
 */
function portal(ctx: RenderContext, w: number, h: number): THREE.Group {
  const g = new THREE.Group(), surround = lancet(ctx.lambert(TRIM, { map: ctx.tex.stone }), w + 0.5, h + 0.35), doors = lancet(ctx.lambert(DARK_WOOD), w, h);
  surround.position.z = 0.02;
  doors.position.z = 0.06;
  g.add(surround, doors);
  const iron = ctx.lambert("#2b2438");
  for (let y = h * 0.2; y < h - w * 0.6; y += h * 0.25) put(g, box(w * 0.92, 0.07, 0.03), iron, 0, y, 0.1);
  put(g, box(0.05, h - w * 0.6, 0.03), iron, 0, (h - w * 0.6) / 2, 0.1);
  return g;
}

/** A rose window `r` across, its face toward +z: dark glass, a ring of colour, a gold heart, stone spokes and frame. Layers stand apart for the depth buffer. */
function rose(ctx: RenderContext, r: number): THREE.Group {
  const g = new THREE.Group(), layer = 0.03, stone = ctx.lambert(TRIM);
  put(g, new THREE.CircleGeometry(r, 16), ctx.basic("#2b3a7a"), 0, 0, 0);
  put(g, new THREE.RingGeometry(r * 0.58, r * 0.82, 16), ctx.basic(GLASS[1]), 0, 0, layer);
  put(g, new THREE.CircleGeometry(r * 0.26, 10), ctx.basic(GLASS[2]), 0, 0, layer * 2);
  put(g, new THREE.RingGeometry(r, r * 1.16, 16), stone, 0, 0, layer);
  for (let i = 0; i < 8; i++) put(g, box(r * 0.05, r * 1.9, 0.02), stone, 0, 0, layer * 3, 0, 0, (i / 8) * Math.PI);
  return g;
}

/** A row of pinnacles (little spires) along x, on top of a wall at height `y`. */
function pinnacles(g: THREE.Group, mat: THREE.Material, x0: number, x1: number, every: number, y: number, z: number): void {
  for (let x = x0; x <= x1 + 1e-6; x += every) put(g, new THREE.ConeGeometry(0.22, 1.1, 4), mat, x, y + 0.55, z, 0, Math.PI / 4, 0);
}

// ---------- Churches ----------
/** A parish church or chapel: west tower (and spire) or a bell-cote, nave, lower chancel, lancet windows, a south porch. */
export function buildChurch(ctx: RenderContext, parent: THREE.Group, p: PropOf<"church">): PropView {
  const { lambert, basic, tex } = ctx, c = churchPlan(p), body = new THREE.Group(), steeple = new THREE.Group();
  const stone = lambert("#ffffff", { map: tex.stone }), lead = lambert(LEAD, { map: tex.shingles, side: THREE.DoubleSide });
  const naveL = c.chancelX0 - c.naveX0, chancelL = c.W / 2 - c.chancelX0;
  // Nave and chancel, each under its own roof.
  put(body, tiledBox(naveL, c.naveH, c.naveD, 0.8), stone, c.naveX0 + naveL / 2, c.naveH / 2, 0);
  put(body, roofGeometry(naveL + 0.3, c.naveD + 0.6, c.naveD * 0.55, false), lead, c.naveX0 + naveL / 2, c.naveH, 0);
  put(body, tiledBox(chancelL, c.chancelH, c.chancelD, 0.8), stone, c.chancelX0 + chancelL / 2, c.chancelH / 2, 0);
  put(body, roofGeometry(chancelL + 0.3, c.chancelD + 0.5, c.chancelD * 0.55, false), lead, c.chancelX0 + chancelL / 2, c.chancelH, 0);
  const stoneGable = lambert("#ffffff", { map: tex.stone, side: THREE.DoubleSide });
  for (const x of [c.naveX0, c.chancelX0]) put(body, gableGeometry(c.naveD / 2, c.naveD / 2 + 0.3, c.naveD * 0.55, 0.8), stoneGable, x, c.naveH, 0);
  put(body, gableGeometry(c.chancelD / 2, c.chancelD / 2 + 0.25, c.chancelD * 0.55, 0.8), stoneGable, c.W / 2, c.chancelH, 0);
  const glass = (i: number) => basic(GLASS[i % GLASS.length]!);
  for (let x = c.naveX0 + 1.2, i = 0; x < c.chancelX0 - 0.6; x += 1.8, i++) for (const s of [-1, 1]) {
    const w = lancet(glass(i), 0.45, 2.4);
    w.position.set(x, 1.4, s * (c.naveD / 2 + 0.02));
    w.rotation.y = s > 0 ? 0 : Math.PI;
    body.add(w);
    put(body, tiledBox(0.4, c.naveH * 0.7, 0.45, 0.6), stone, x + 0.9, c.naveH * 0.35, s * (c.naveD / 2 + 0.2));   // buttresses
  }
  const east = lancet(glass(2), 1.1, 3.0);
  east.position.set(c.W / 2 + 0.02, 1.0, 0);
  east.rotation.y = Math.PI / 2;
  body.add(east);
  // The south porch.
  const px = c.naveX0 + naveL * 0.35;
  put(body, tiledBox(1.8, 2.2, 1.4, 0.6), stone, px, 1.1, c.naveD / 2 + 0.7);
  put(body, roofGeometry(1.5, 2.1, 0.9), lead, px, 2.2, c.naveD / 2 + 0.75, 0, Math.PI / 2, 0);
  const porchDoor = portal(ctx, 0.8, 1.6);
  porchDoor.position.set(px, 0, c.naveD / 2 + 1.4);
  body.add(porchDoor);
  if (c.towerS) {
    // The west tower: belfry openings near the top, battlements, and a spire or a low cap.
    const s = c.towerS, h = 9.5, tx = c.west + s / 2;
    put(steeple, tiledBox(s, h, s, 0.8), lambert("#ffffff", { map: tex.stone }), tx, h / 2, 0);
    for (const [fx, fz] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const o = lancet(basic(DOORWAY), 0.7, 1.6);
      o.position.set(tx + fx * (s / 2 + 0.02), h - 2.4, fz * (s / 2 + 0.02));
      o.rotation.y = fx ? fx * Math.PI / 2 : fz > 0 ? 0 : Math.PI;
      steeple.add(o);
    }
    const door = portal(ctx, 1.2, 2.4);
    door.position.set(c.west - 0.02, 0, 0);
    door.rotation.y = -Math.PI / 2;
    steeple.add(door);
    if (p.tower === "spire") put(steeple, new THREE.ConeGeometry(s * 0.66, 8, 8), lambert(LEAD, { map: tex.shingles }), tx, h + 4, 0, 0, Math.PI / 8, 0);
    else {
      for (const [mx, mz, ry] of [[0, s / 2 - 0.2, 0], [0, -s / 2 + 0.2, 0], [s / 2 - 0.2, 0, Math.PI / 2], [-s / 2 + 0.2, 0, Math.PI / 2]] as const) {
        const m = merlons(s, h, 0.4, stone); m.position.set(tx + mx, 0, mz); m.rotation.y = ry; steeple.add(m);
      }
      put(steeple, new THREE.ConeGeometry(s * 0.5, 1.6, 4), lambert(LEAD), tx, h + 0.8, 0, 0, Math.PI / 4, 0);
    }
    put(steeple, box(0.08, 0.7, 0.08), basic(PAL.Y), tx, h + (p.tower === "spire" ? 8.3 : 2.0), 0);
    put(steeple, box(0.4, 0.08, 0.08), basic(PAL.Y), tx, h + (p.tower === "spire" ? 8.4 : 2.1), 0);
  } else {
    // A bell-cote on the west gable: two stone posts, a little roof, a bell.
    const bx = c.naveX0 + 0.2, top = c.naveH + c.naveD * 0.55;
    for (const s of [-1, 1]) put(body, box(0.25, 1.2, 0.3), stone, bx, top + 0.3, s * 0.4);
    put(body, roofGeometry(0.6, 1.3, 0.4), lead, bx, top + 0.9, 0, 0, Math.PI / 2, 0);
    put(body, new THREE.CylinderGeometry(0.12, 0.2, 0.3, 8), lambert("#b08a4a"), bx, top + 0.5, 0);
    const door = portal(ctx, 1.0, 2.2);
    door.position.set(c.west - 0.02, 0, 0);
    door.rotation.y = -Math.PI / 2;
    body.add(door);
  }
  const occluders: Occluder[] = [];
  for (const g of [body, steeple]) {
    g.position.set(c.x, 0, c.z);
    parent.add(g);
  }
  occluders.push(occluder(body, c.x + (c.naveX0 + c.W / 2) / 2, c.z, c.W / 2 - c.naveX0, c.naveD + 1.5, c.naveH + c.naveD * 0.55));
  if (c.towerS) occluders.push(occluder(steeple, c.x + c.west + c.towerS / 2, c.z, c.towerS, c.towerS, p.tower === "spire" ? 18 : 12));
  return { occluders };
}

// ---------- Halls ----------
/**
 * A hall, built facing south (door on +z, its frontage along x) and turned to its door. Stone halls get
 * tall lancet windows; timber ones shutters. An arcade leaves the ground floor open on pillars under the
 * hall above. A louvre (kitchens) puts a pyramid roof on it with a vent letting out smoke; raised sets it
 * on staddle stones (granaries, out of the rats' reach); chimneys rise from the back.
 */
export function buildHall(ctx: RenderContext, parent: THREE.Group, p: PropOf<"hall">): PropView {
  const { lambert, basic, tex, particles } = ctx, g = new THREE.Group(), b = hallBody(p.rect);
  const sideways = p.door === "east" || p.door === "west", w = sideways ? b.d : b.w, d = sideways ? b.w : b.d;
  const wall = lambert("#ffffff", { map: p.stone ? tex.stone : tex.timber }), trim = lambert(p.stone ? TRIM : DARK_WOOD);
  const storeyH = p.stone ? 1.9 : 1.45, lift = p.raised ? 0.7 : 0, groundH = p.arcade ? 2.2 : 0;
  // On staddle stones: mushroom-shaped stones the floor stands on.
  if (p.raised) for (let x = -w / 2 + 0.3; x <= w / 2 - 0.29; x += Math.max(0.9, (w - 0.6) / Math.round((w - 0.6) / 1.2))) for (const z of [-d / 2 + 0.3, 0, d / 2 - 0.3]) {
    put(g, new THREE.CylinderGeometry(0.1, 0.16, 0.55, 6), lambert(TRIM), x, 0.28, z);
    put(g, new THREE.CylinderGeometry(0.24, 0.24, 0.12, 8), lambert(TRIM), x, 0.62, z);
  }
  // An open arcade on the ground: pillars, and beams along the top.
  if (p.arcade) {
    for (const [x, z] of arcadePillars(w, d)) put(g, tiledCylinder(0.2, groundH, 8, 0.5), lambert("#ffffff", { map: tex.stone }), x, groundH / 2, z);
    put(g, box(w, 0.25, d), trim, 0, groundH - 0.12, 0);
  }
  const base = lift + groundH, wallH = storeyH * p.storeys;
  put(g, tiledBox(w, wallH, d, p.stone ? 0.8 : 1.15), wall, 0, base + wallH / 2, 0);
  // Windows along the long sides, a floor at a time.
  for (let f = 0; f < p.storeys; f++) for (const [side, len] of [[1, w], [-1, w]] as const) {
    for (let x = -len / 2 + 0.9, i = 0; x < len / 2 - 0.6; x += p.stone ? 1.5 : 1.0, i++) {
      if (f === 0 && side > 0 && !p.arcade && Math.abs(x) < 0.9) continue;                  // the door
      const y = base + f * storeyH + (p.stone ? 0.45 : 0.55), z = side * (d / 2 + 0.02);
      if (p.stone) {
        // A tall square-headed window, as a house or hall has (pointed ones are for churches): a stone
        // frame, glass lit or dark, and a stone mullion and transom across it.
        const lit = hash(p.rect.x + i, p.rect.y + f, 420) < 0.45, h = storeyH * 0.62, out = side * 0.03;
        put(g, box(0.56, h + 0.14, 0.04), trim, x, y + h / 2, z);
        put(g, box(0.44, h, 0.04), basic(lit ? LIT : "#2b3a5a"), x, y + h / 2, z + out);
        put(g, box(0.05, h, 0.05), trim, x, y + h / 2, z + out * 1.6);
        put(g, box(0.44, 0.05, 0.05), trim, x, y + h * 0.62, z + out * 1.6);
      } else put(g, box(0.36, 0.44, 0.06), lambert("#5e4630"), x, y + 0.25, z);
    }
  }
  // The roof: a pyramid with a smoking louvre (a kitchen), or a gable along the longer side.
  const roofMat = lambert(p.roof, { map: tex.shingles, side: THREE.DoubleSide }), top = base + wallH;
  let roofTop = top;
  if (p.louvre) {
    const rh = Math.max(w, d) * 0.55;
    const roof = put(g, new THREE.ConeGeometry(Math.hypot(w, d) / 2 + 0.3, rh, 4), roofMat, 0, top + rh / 2, 0, 0, Math.PI / 4, 0);
    roof.scale.set(w / Math.max(w, d), 1, d / Math.max(w, d));
    put(g, box(0.8, 0.6, 0.8), trim, 0, top + rh - 0.1, 0);
    put(g, new THREE.ConeGeometry(0.75, 0.5, 4), roofMat, 0, top + rh + 0.45, 0, 0, Math.PI / 4, 0);
    roofTop = top + rh + 0.7;
  } else {
    const along = w >= d, span = (along ? d : w) + 0.6, length = (along ? w : d) + 0.4, rh = span * 0.48;
    const roofGroup = new THREE.Group();
    put(roofGroup, roofGeometry(length, span, rh, false), roofMat, 0, top, 0);
    const gableMat = lambert("#ffffff", { map: p.stone ? tex.stone : tex.timber, side: THREE.DoubleSide });
    for (const s of [-1, 1]) put(roofGroup, gableGeometry((along ? d : w) / 2, span / 2, rh, p.stone ? 0.8 : 1.15), gableMat, s * (along ? w : d) / 2, top, 0);
    if (!along) roofGroup.rotation.y = Math.PI / 2;
    g.add(roofGroup);
    roofTop = top + rh;
  }
  for (let i = 0; i < (p.chimneys ?? 0); i++) {
    const x = -w / 2 + ((i + 1) * w) / ((p.chimneys ?? 0) + 1);
    put(g, tiledBox(0.5, roofTop - top + 1.0, 0.5, 0.5), lambert("#ffffff", { map: tex.stone }), x, top + (roofTop - top + 1.0) / 2, -d / 4);
  }
  // The door, up steps if it's raised; or, over an arcade, a stair up to the hall on the side.
  if (!p.arcade) {
    const doorH = Math.min(p.stone ? 2.3 : 1.6, wallH - 0.45), door = portal(ctx, Math.min(p.stone ? 1.3 : 0.9, doorH * 0.56), doorH);   // under the eaves, however low
    door.position.set(0, lift, d / 2 + 0.03);
    g.add(door);
    if (p.raised) for (let i = 0; i < 3; i++) put(g, box(1.0, (i + 1) * 0.23, 0.25), lambert(TRIM), 0, ((i + 1) * 0.23) / 2, d / 2 + 0.7 - i * 0.25);
  }
  if (p.stone && !p.raised && w > 7 && (p.chimneys ?? 0) > 0) {                         // the grand halls fly banners
    const b1 = banner(ctx, 0.8, wallH * 0.6);
    b1.position.set(-w / 4, base + wallH - 0.3, d / 2 + 0.06);
    const b2 = banner(ctx, 0.8, wallH * 0.6);
    b2.position.set(w / 4, base + wallH - 0.3, d / 2 + 0.06);
    g.add(b1, b2);
  }
  const cx = b.x, cz = b.z;
  g.position.set(cx, 0, cz);
  g.rotation.y = FACING_YAW[p.door];
  parent.add(g);
  const smokeAt = { x: cx, z: cz };
  return {
    update: p.louvre ? (_t, dt) => { if (Math.random() < dt * 3) particles.spawn("dust", smokeAt.x + (Math.random() - 0.5) * 0.4, roofTop, smokeAt.z + (Math.random() - 0.5) * 0.4, 0, 0.7, 0, 1.2); } : undefined,
    occluders: [occluder(g, cx, cz, (sideways ? d : w) + 0.8, (sideways ? w : d) + 0.8, roofTop)],
  };
}

// ---------- The cathedral ----------
/**
 * The cathedral, west to east (see cathedralPlan): a west front between two great towers with spires,
 * three portals and a rose window; a nave rising high over its aisles, lit by clerestory windows and
 * held up by flying buttresses; a transept with a rose window at each end; a crossing tower carrying the
 * tallest spire in the kingdom; and the choir ending in a rounded apse ringed by chapels. Each part has
 * its own materials, so only the part in front of you fades.
 */
export function buildCathedral(ctx: RenderContext, parent: THREE.Group, p: PropOf<"cathedral">): PropView {
  const { lambert, basic, tex } = ctx, c = cathedralPlan(p.rect);
  const parts = { west: new THREE.Group(), nave: new THREE.Group(), cross: new THREE.Group(), choir: new THREE.Group() };
  const mats = () => ({ stone: lambert("#e6dfd0", { map: tex.stone }), trim: lambert(TRIM, { map: tex.stone }), lead: lambert(LEAD, { map: tex.shingles, side: THREE.DoubleSide }) });
  const glass = (i: number) => basic(GLASS[i % GLASS.length]!), dark = basic(DOORWAY), gold = basic(PAL.Y);
  const naveX0 = c.west + c.towerS, naveX1 = c.crossX - c.transW / 2, choirX0 = c.crossX + c.transW / 2;
  const { naveW, aisleW, body, naveH, aisleH } = c;

  // A run of nave (or choir) with its aisles, windows, roofs and flying buttresses, from x0 to x1.
  const vessel = (g: THREE.Group, m: ReturnType<typeof mats>, x0: number, x1: number) => {
    const len = x1 - x0, mid = (x0 + x1) / 2;
    put(g, tiledBox(len, naveH, naveW, 0.8), m.stone, mid, naveH / 2, 0);
    put(g, roofGeometry(len + 0.2, naveW + 0.8, naveW * 0.7), m.lead, mid, naveH, 0);
    for (const s of [-1, 1]) {
      put(g, tiledBox(len, aisleH, aisleW, 0.8), m.stone, mid, aisleH / 2, s * (naveW / 2 + aisleW / 2));
      const lean = put(g, box(len + 0.2, 0.12, aisleW + 0.5), m.lead, mid, aisleH + 0.9, s * (naveW / 2 + aisleW / 2));
      lean.rotation.x = s * 0.35;
      for (let x = x0 + 1.4, i = 0; x < x1 - 0.8; x += 2.6, i++) {
        const aw = lancet(glass(i + (s > 0 ? 0 : 2)), 0.7, aisleH * 0.6);          // aisle windows
        aw.position.set(x, 1.2, s * (body + 0.02));
        aw.rotation.y = s > 0 ? 0 : Math.PI;
        g.add(aw);
        const cw = lancet(glass(i + 1), 0.8, naveH - aisleH - 2.6);                  // clerestory
        cw.position.set(x, aisleH + 1.6, s * (naveW / 2 + 0.02));
        cw.rotation.y = s > 0 ? 0 : Math.PI;
        g.add(cw);
        // A flying buttress: a pier beyond the aisle, a pinnacle on top, and an arm leaning in to the nave.
        const bx = x + 1.3, pz = s * (body + c.buttress * 0.55);
        put(g, tiledBox(0.8, aisleH + 2.4, 0.9, 0.6), m.stone, bx, (aisleH + 2.4) / 2, pz);
        put(g, new THREE.ConeGeometry(0.4, 1.6, 4), m.trim, bx, aisleH + 3.2, pz, 0, Math.PI / 4, 0);
        const reach = Math.abs(pz) - naveW / 2, rise = naveH - 1.5 - (aisleH + 1.6), arm = Math.hypot(reach, rise);
        const fly = put(g, box(0.35, 0.35, arm), m.trim, bx, (aisleH + 1.6 + naveH - 1.5) / 2, s * (naveW / 2 + reach / 2));
        fly.rotation.x = s * Math.atan2(rise, reach);
      }
    }
    pinnacles(g, m.trim, x0 + 0.5, x1 - 0.5, 2.6, naveH, naveW / 2 - 0.2);
    pinnacles(g, m.trim, x0 + 0.5, x1 - 0.5, 2.6, naveH, -naveW / 2 + 0.2);
  };

  // The west front and its towers.
  {
    const g = parts.west, m = mats(), s = c.towerS, x = c.west + s / 2;
    for (const side of [-1, 1]) {
      const z = side * (naveW / 2 + s / 2);
      put(g, tiledBox(s, c.towerH, s, 0.8), m.stone, x, c.towerH / 2, z);
      for (let level = 0; level < 3; level++) {                                       // tiers of windows up the tower
        const ww = lancet(level === 2 ? dark : glass(level + 1), 0.9, level === 2 ? 3.2 : 2.6);
        ww.position.set(c.west - 0.02, aisleH + 1 + level * 5, z);
        ww.rotation.y = -Math.PI / 2;
        g.add(ww);
        const sw = lancet(level === 2 ? dark : glass(level + 3), 0.9, level === 2 ? 3.2 : 2.6);
        sw.position.set(x, aisleH + 1 + level * 5, z + side * (s / 2 + 0.02));
        sw.rotation.y = side > 0 ? 0 : Math.PI;
        g.add(sw);
      }
      for (const [px, pz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]] as const) put(g, new THREE.ConeGeometry(0.35, 2.2, 4), m.trim, x + px * (s / 2 - 0.3), c.towerH + 1.1, z + pz * (s / 2 - 0.3), 0, Math.PI / 4, 0);
      put(g, new THREE.ConeGeometry(s * 0.55, 14, 8), m.lead, x, c.towerH + 7, z, 0, Math.PI / 8, 0);
      put(g, new THREE.OctahedronGeometry(0.3, 0), gold, x, c.towerH + 14.3, z);
      const sideDoor = portal(ctx, 2.0, 4.2);                                         // the side portals
      sideDoor.position.set(c.west - 0.04, 0, z);
      sideDoor.rotation.y = -Math.PI / 2;
      g.add(sideDoor);
    }
    // Between the towers: the west wall up to a gable, the great portal and the rose window over it.
    const fw = naveW;
    put(g, tiledBox(s, naveH + 2, fw, 0.8), m.stone, x, (naveH + 2) / 2, 0);
    const gable = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0, -fw / 2), new THREE.Vector3(0, 0, fw / 2), new THREE.Vector3(0, naveW * 0.7, 0)]);
    gable.computeVertexNormals();
    put(g, gable, lambert("#e6dfd0", { map: tex.stone, side: THREE.DoubleSide }), c.west + 0.3, naveH + 2, 0);
    const main = portal(ctx, 3.2, 6.0);
    main.position.set(c.west - 0.05, 0, 0);
    main.rotation.y = -Math.PI / 2;
    g.add(main);
    const r = rose(ctx, naveW * 0.32);
    r.position.set(c.west - 0.06, naveH - 2.5, 0);
    r.rotation.y = -Math.PI / 2;
    g.add(r);
    for (let i = -2; i <= 2; i++) {                                                     // a row of kings in niches above the portals
      put(g, box(0.05, 1.6, 0.7), dark, c.west - 0.04, 7.6, i * 1.1);
      put(g, new THREE.CylinderGeometry(0.16, 0.24, 1.3, 6), m.trim, c.west - 0.2, 7.5, i * 1.1);
    }
  }
  // The nave.
  vessel(parts.nave, mats(), naveX0, naveX1);
  // The crossing, its transept, tower and spire.
  {
    const g = parts.cross, m = mats(), x = c.crossX, tw = c.transW, tl = c.D - 0.4;
    put(g, tiledBox(tw, naveH, tl, 0.8), m.stone, x, naveH / 2, 0);
    put(g, roofGeometry(tl + 0.2, tw + 0.8, tw * 0.7), m.lead, x, naveH, 0, 0, Math.PI / 2, 0);
    for (const s of [-1, 1]) {
      const r = rose(ctx, tw * 0.32);
      r.position.set(x, naveH - 3, s * (tl / 2 + 0.06));
      r.rotation.y = s > 0 ? 0 : Math.PI;
      g.add(r);
      const door = portal(ctx, 2.2, 4.0);
      door.position.set(x, 0, s * (tl / 2 + 0.05));
      door.rotation.y = s > 0 ? 0 : Math.PI;
      g.add(door);
      for (const px of [-tw / 2 + 0.4, tw / 2 - 0.4]) put(g, new THREE.ConeGeometry(0.35, 2.0, 4), m.trim, x + px, naveH + 1, s * (tl / 2 - 0.4), 0, Math.PI / 4, 0);
    }
    put(g, tiledBox(tw, c.crossH, tw, 0.8), m.stone, x, c.crossH / 2, 0);
    for (const [fx, fz] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) for (const off of [-1.4, 1.4]) {
      const o = lancet(dark, 0.8, 3.4);
      o.position.set(x + fx * (tw / 2 + 0.02) + (fz ? off : 0), c.crossH - 5, fz * (tw / 2 + 0.02) + (fx ? off : 0));
      o.rotation.y = fx ? fx * Math.PI / 2 : fz > 0 ? 0 : Math.PI;
      g.add(o);
    }
    for (const [px, pz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]] as const) put(g, new THREE.ConeGeometry(0.45, 3.0, 4), m.trim, x + px * (tw / 2 - 0.4), c.crossH + 1.5, pz * (tw / 2 - 0.4), 0, Math.PI / 4, 0);
    put(g, new THREE.ConeGeometry(tw * 0.55, 24, 8), m.lead, x, c.crossH + 12, 0, 0, Math.PI / 8, 0);
    put(g, box(0.18, 1.6, 0.18), gold, x, c.crossH + 24.6, 0);
    put(g, box(0.9, 0.18, 0.18), gold, x, c.crossH + 24.8, 0);
  }
  // The choir and its rounded east end, ringed by chapels.
  {
    const g = parts.choir, m = mats();
    vessel(g, m, choirX0, c.east);
    put(g, new THREE.CylinderGeometry(naveW / 2, naveW / 2, naveH, 12, 1, false, 0, Math.PI), m.stone, c.east, naveH / 2, 0);
    put(g, new THREE.ConeGeometry(naveW / 2 + 0.4, naveW * 0.7, 12, 1, false, 0, Math.PI), m.lead, c.east, naveH + naveW * 0.35, 0);
    put(g, new THREE.CylinderGeometry(body, body, aisleH, 14, 1, false, 0, Math.PI), m.stone, c.east, aisleH / 2, 0);
    for (let i = 0; i < 5; i++) {
      const a = (i / 4) * Math.PI;                                                    // radiating chapels
      const cx = c.east + Math.sin(a) * (body + 0.6), cz = Math.cos(a) * (body + 0.6);
      put(g, new THREE.CylinderGeometry(1.2, 1.2, aisleH - 1.2, 8), m.stone, cx, (aisleH - 1.2) / 2, cz);
      put(g, new THREE.ConeGeometry(1.4, 1.4, 8), m.lead, cx, aisleH - 0.5, cz);
      const win = lancet(glass(i), 0.5, 2.6);
      win.position.set(c.east + Math.sin(a) * (body + 1.82), 1.2, Math.cos(a) * (body + 1.82));
      win.rotation.y = a;
      g.add(win);
    }
    for (let i = 0; i < 7; i++) {
      const a = (i / 6) * Math.PI, wx = c.east + Math.sin(a) * (naveW / 2 + 0.02), wz = Math.cos(a) * (naveW / 2 + 0.02);
      const win = lancet(glass(i + 2), 0.6, naveH - aisleH - 2.6);
      win.position.set(wx, aisleH + 1.6, wz);
      win.rotation.y = a;
      g.add(win);
    }
  }
  const occluders: Occluder[] = [];
  for (const g of Object.values(parts)) { g.position.set(c.x, 0, c.z); parent.add(g); }
  occluders.push(
    occluder(parts.west, c.x + c.west + c.towerS / 2, c.z, c.towerS, (naveW / 2 + c.towerS) * 2, c.towerH + 14),
    occluder(parts.nave, c.x + (naveX0 + naveX1) / 2, c.z, naveX1 - naveX0, (body + c.buttress) * 2, naveH + naveW * 0.7),
    occluder(parts.cross, c.x + c.crossX, c.z, c.transW, c.D, c.crossH + 24),
    occluder(parts.choir, c.x + (choirX0 + c.east + c.apseR) / 2, c.z, c.east + c.apseR - choirX0, (body + c.buttress) * 2 + 2, naveH + naveW * 0.7),
  );
  return { occluders };
}

// ---------- Cloister ----------
/** A covered walk round a green garth: an outer wall with a doorway, a lean-to roof, and an arcade of pillars on a low wall. */
export function buildCloister(ctx: RenderContext, parent: THREE.Group, p: PropOf<"cloister">): PropView {
  const { lambert, tex } = ctx, c = cloisterPlan(p.rect), occluders: Occluder[] = [];
  const hw = c.W / 2, hd = c.D / 2, iw = hw - c.walk - c.wall, id = hd - c.walk - c.wall, wallH = 3.4, arcadeH = 2.3;
  const sides = [["north", 0, -1], ["south", 0, 1], ["west", -1, 0], ["east", 1, 0]] as const;
  for (const [side, sx, sz] of sides) {
    const g = new THREE.Group(), stone = lambert("#e6dfd0", { map: tex.stone }), lead = lambert(LEAD, { map: tex.shingles });
    const horizontal = sz !== 0, len = horizontal ? c.W : c.D, inner = (horizontal ? iw : id) * 2;
    // Build along local x, the garth toward -z, then turn into place.
    const door = side === p.door;
    const wallAt = (from: number, to: number) => put(g, tiledBox(to - from, wallH, c.wall, 0.8), stone, (from + to) / 2, wallH / 2, 0);
    if (door) { wallAt(-len / 2, -c.doorW / 2); wallAt(c.doorW / 2, len / 2); } else wallAt(-len / 2, len / 2);
    const roof = put(g, box(len, 0.12, c.walk + 0.9), lead, 0, (wallH + arcadeH) / 2 + 0.1, -(c.walk + c.wall) / 2);
    roof.rotation.x = Math.atan2(wallH - arcadeH, c.walk + c.wall);
    const az = -(c.walk + c.wall / 2);
    for (let x = -inner / 2; x <= inner / 2 + 1e-6; x += 1.2) {
      put(g, tiledCylinder(0.13, arcadeH, 6, 0.4), stone, x, arcadeH / 2, az);
      if (Math.abs(x) > 1.1 && x < inner / 2) put(g, box(1.2, 0.6, 0.35), stone, x + 0.6, 0.3, az);
    }
    put(g, box(inner + 0.3, 0.25, 0.4), stone, 0, arcadeH, az);
    const turn = side === "north" ? Math.PI : side === "south" ? 0 : side === "west" ? -Math.PI / 2 : Math.PI / 2;
    const at = { x: c.x + sx * (hw - c.wall / 2), z: c.z + sz * (hd - c.wall / 2) };
    g.position.set(at.x, 0, at.z);
    g.rotation.y = turn;
    parent.add(g);
    occluders.push(occluder(g, at.x - (horizontal ? hw : c.walk), at.z, horizontal ? c.W : c.walk * 2 + 1, horizontal ? c.walk * 2 + 1 : c.D, wallH));
  }
  return { occluders };
}

// ---------- Chapter house ----------
/** An eight-sided chapter house: buttressed corners, tall windows on every face, a steep eight-sided roof and a finial. */
export function buildChapterHouse(ctx: RenderContext, parent: THREE.Group, p: PropOf<"chapterHouse">): PropView {
  const { lambert, basic, tex } = ctx, g = new THREE.Group(), r = p.radius, h = 6.5;
  put(g, tiledCylinder(r, h, 8, 0.8), lambert("#e6dfd0", { map: tex.stone }), 0, h / 2, 0, 0, Math.PI / 8, 0);
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2, face = a + Math.PI / 8;
    put(g, tiledBox(0.6, h - 0.5, 0.8, 0.6), lambert("#e6dfd0", { map: tex.stone }), Math.sin(a) * (r + 0.1), (h - 0.5) / 2, Math.cos(a) * (r + 0.1), 0, a, 0);
    put(g, new THREE.ConeGeometry(0.3, 1.4, 4), lambert(TRIM), Math.sin(a) * (r + 0.1), h + 0.2, Math.cos(a) * (r + 0.1), 0, Math.PI / 4, 0);
    const win = lancet(basic(GLASS[i % GLASS.length]!), 0.8, 3.6);
    win.position.set(Math.sin(face) * (r * Math.cos(Math.PI / 8) + 0.02), 1.4, Math.cos(face) * (r * Math.cos(Math.PI / 8) + 0.02));
    win.rotation.y = face;
    g.add(win);
  }
  put(g, new THREE.ConeGeometry(r + 0.4, r * 1.3, 8), lambert(LEAD, { map: tex.shingles }), 0, h + r * 0.65, 0, 0, Math.PI / 8, 0);
  put(g, new THREE.OctahedronGeometry(0.25, 0), basic(PAL.Y), 0, h + r * 1.3 + 0.2, 0);
  const x = p.x / T, z = p.y / T;
  g.position.set(x, 0, z);
  parent.add(g);
  return { occluders: [occluder(g, x, z, r * 2 + 1, r * 2 + 1, h + r * 1.3)] };
}

// ---------- Graves ----------
/**
 * A churchyard's graves in rows, each facing +z with its grave in front of it. Mostly headstones,
 * round-topped on a plinth with a cross cut in the face, or small and pointed; stone crosses on stepped
 * bases, some with a wheel; here and there a chest tomb with carved panels and a cross on its lid; and
 * the newest, a wooden cross over fresh earth with flowers on it. The older stones lean a little and
 * some have flowers left at their foot; the mounds are grassed over and rounded.
 */
export function buildGraves(ctx: RenderContext, parent: THREE.Group, p: PropOf<"graves">): PropView {
  const { lambert, tex } = ctx, g = new THREE.Group();
  const greys = ["#f2ede2", "#e2dccf", "#d4cdbf", "#c6bfb2"].map(c => lambert(c, { map: tex.stone })), cut = lambert("#4e4a45");
  const turf = lambert("#4f7a35"), earth = lambert("#6b4a2e"), wood = lambert(DARK_WOOD);
  const blooms = ["#e8d23a", "#e05a7a", "#f2f0e6", "#9a6ad6"].map(c => lambert(c)), stem = lambert("#3d6a2a");
  const mound = new THREE.SphereGeometry(1, 7, 3, 0, Math.PI * 2, 0, Math.PI / 2);
  // A cross cut into a stone's face, `y` up it.
  const carve = (to: THREE.Group, y: number, s: number, z: number) => {
    put(to, box(0.035 * s, 0.17 * s, 0.01), cut, 0, y, z);
    put(to, box(0.11 * s, 0.035 * s, 0.01), cut, 0, y + 0.03 * s, z);
  };
  const flowers = (to: THREE.Group, z: number, n: number, k: number) => {
    for (let i = 0; i < n; i++) {
      const fx = (hash(k, i, 431) - 0.5) * 0.3, fz = z + (hash(k, i, 432) - 0.5) * 0.12;
      put(to, box(0.015, 0.1, 0.015), stem, fx, 0.05, fz);
      put(to, new THREE.OctahedronGeometry(0.035, 0), blooms[Math.floor(hash(k, i, 433) * blooms.length)]!, fx, 0.11, fz);
    }
  };
  for (const [i, s] of gravePlan(p.rect).entries()) {
    const m = greys[Math.floor(hash(s.x, s.z, 434) * greys.length)]!, k = hash(s.x, s.z, 430), stone = new THREE.Group();
    switch (s.kind) {
      case 0: {                                                                         // a tall headstone on a plinth
        put(stone, box(0.52, 0.08, 0.2), m, 0, 0.04, 0);
        put(stone, box(0.42, 0.5, 0.09), m, 0, 0.33, 0);
        put(stone, new THREE.CylinderGeometry(0.21, 0.21, 0.09, 10, 1, false, -Math.PI / 2, Math.PI), m, 0, 0.58, 0, -Math.PI / 2, 0, 0);   // its rounded head, upward
        carve(stone, 0.42, 1, 0.05);
        break;
      }
      case 1: case 4: {                                                                 // a cross on stepped bases, or a wheel cross
        put(stone, box(0.4, 0.08, 0.3), m, 0, 0.04, 0);
        put(stone, box(0.26, 0.08, 0.2), m, 0, 0.12, 0);
        put(stone, box(0.09, 0.78, 0.09), m, 0, 0.55, 0);
        put(stone, box(0.42, 0.09, 0.09), m, 0, 0.7, 0);
        if (s.kind === 4) put(stone, new THREE.TorusGeometry(0.13, 0.025, 4, 12), m, 0, 0.7, 0);
        break;
      }
      case 2: {                                                                         // a small stone with a pointed head
        put(stone, box(0.36, 0.3, 0.08), m, 0, 0.15, 0);
        put(stone, box(0.255, 0.255, 0.08), m, 0, 0.3, 0, 0, 0, Math.PI / 4);
        carve(stone, 0.18, 0.7, 0.045);
        break;
      }
      case 3: {                                                                         // a chest tomb over the grave
        const z = 0.35;
        put(stone, box(0.64, 0.08, 1.06), m, 0, 0.04, z);
        put(stone, tiledBox(0.54, 0.4, 0.96, 0.5), m, 0, 0.28, z);
        put(stone, box(0.66, 0.07, 1.08), m, 0, 0.515, z);
        for (const pz of [-0.25, 0.25]) for (const sx of [-1, 1]) put(stone, box(0.01, 0.22, 0.32), cut, sx * 0.272, 0.27, z + pz);   // carved panels
        put(stone, box(0.3, 0.22, 0.01), cut, 0, 0.27, z + 0.482);
        put(stone, box(0.05, 0.012, 0.6), cut, 0, 0.555, z);                           // a cross on the lid
        put(stone, box(0.3, 0.012, 0.05), cut, 0, 0.555, z - 0.1);
        break;
      }
      case 5: {                                                                         // a wooden cross over fresh earth
        put(stone, box(0.07, 0.6, 0.05), wood, 0, 0.3, 0);
        put(stone, box(0.32, 0.06, 0.05), wood, 0, 0.45, 0);
        break;
      }
    }
    if (s.kind !== 3) {                                                                 // the grave: a rounded mound
      const fresh = s.kind === 5, heap = put(stone, mound, fresh ? earth : turf, 0, 0, 0.45);
      heap.scale.set(0.2, fresh ? 0.11 : 0.06, 0.38);
      if (fresh) flowers(stone, 0.45, 5, i);
      else if (k < 0.3) flowers(stone, 0.12, 3, i);
    }
    stone.position.set(s.x, 0, s.z);
    if (s.kind !== 3) {
      stone.rotation.z = (k - 0.5) * 0.16;                                              // the old ones lean
      stone.rotation.x = (hash(s.x, s.z, 435) - 0.6) * 0.12;
    }
    g.add(stone);
  }
  parent.add(g);
}

// ---------- Market cross ----------
/** A market cross: three octagonal steps, a tall shaft, a little gabled head and a gold cross. */
export function buildCross(ctx: RenderContext, parent: THREE.Group, p: PropOf<"cross">): PropView {
  const { lambert, basic, tex } = ctx, g = new THREE.Group(), stone = lambert("#e6dfd0", { map: tex.stone });
  [1.05, 0.8, 0.55].forEach((r, i) => put(g, new THREE.CylinderGeometry(r, r, 0.25, 8), lambert(TRIM), 0, 0.125 + i * 0.25, 0, 0, Math.PI / 8, 0));
  put(g, new THREE.CylinderGeometry(0.12, 0.17, 3.2, 8), stone, 0, 0.75 + 1.6, 0);
  put(g, tiledBox(0.5, 0.6, 0.5, 0.4), stone, 0, 4.25, 0);
  for (const ry of [0, Math.PI / 2]) put(g, roofGeometry(0.62, 0.62, 0.35), lambert(SLATE), 0, 4.55, 0, 0, ry, 0);
  put(g, box(0.07, 0.55, 0.07), basic(PAL.Y), 0, 5.15, 0);
  put(g, box(0.32, 0.07, 0.07), basic(PAL.Y), 0, 5.25, 0);
  const x = p.x / T, z = p.y / T;
  g.position.set(x, 0, z);
  parent.add(g);
  return { occluders: [occluder(g, x, z, 2.1, 2.1, 5.4)] };
}

// ---------- Lion ----------
/** A gilded lion sitting up on guard on a marble plinth, the kingdom's arms on the plinth's face, looking out along its facing. */
export function buildLion(ctx: RenderContext, parent: THREE.Group, p: PropOf<"lion">): PropView {
  const { lambert, tex } = ctx, g = new THREE.Group(), gold = lambert(GOLD), marble = lambert(MARBLE, { map: tex.stone }), dark = lambert("#8a6420");
  const v = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
  // A rounded limb from a to b.
  const limb = (a: THREE.Vector3, b: THREE.Vector3, r: number) => {
    const m = put(g, new THREE.CapsuleGeometry(r, a.distanceTo(b), 2, 6), gold, (a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2);
    m.quaternion.setFromUnitVectors(v(0, 1, 0), b.clone().sub(a).normalize());
  };
  // The plinth: a marble block on a footing, a gilded band under its cap, the kingdom's arms on its face.
  put(g, box(1.3, 0.12, LION_PLINTH + 0.1), marble, 0, 0.06, 0);
  put(g, tiledBox(1.2, 0.8, LION_PLINTH, 0.6), marble, 0, 0.52, 0);
  put(g, box(1.26, 0.08, LION_PLINTH + 0.06), gold, 0, 0.88, 0);
  put(g, box(1.3, 0.1, LION_PLINTH + 0.1), marble, 0, 0.97, 0);
  const arms = shield(ctx, 0.5);
  arms.position.set(0, 0.52, LION_PLINTH / 2 + 0.02);
  g.add(arms);
  // The lion, sitting up on guard: haunches and hind paws, its chest raised on straight forelegs.
  const y0 = 1.02;
  for (const s of [-1, 1]) {
    put(g, new THREE.IcosahedronGeometry(0.27, 1), gold, s * 0.2, y0 + 0.24, -0.3).scale.set(0.85, 0.9, 1.25);     // haunches
    put(g, box(0.16, 0.08, 0.26), gold, s * 0.3, y0 + 0.04, 0.02);                                                     // hind paws
    limb(v(s * 0.14, y0 + 0.62, 0.22), v(s * 0.14, y0 + 0.08, 0.32), 0.07);                                         // forelegs
    put(g, box(0.15, 0.08, 0.2), gold, s * 0.14, y0 + 0.04, 0.4);                                                     // forepaws
  }
  limb(v(0, y0 + 0.28, -0.28), v(0, y0 + 0.72, 0.12), 0.25);                                                          // the body, upright
  put(g, new THREE.IcosahedronGeometry(0.25, 1), gold, 0, y0 + 0.66, 0.2).scale.set(1, 1.05, 0.9);                  // the chest
  // The head: a great mane, the face out of it, muzzle, nose and ears.
  put(g, new THREE.IcosahedronGeometry(0.33, 1), gold, 0, y0 + 1.0, 0.16).scale.set(1.05, 1.05, 0.8);
  for (let i = 0; i < 7; i++) {                                                                                       // locks of the mane
    const a = -Math.PI * 0.8 + (i / 6) * Math.PI * 1.6;
    put(g, new THREE.ConeGeometry(0.09, 0.22, 4), gold, Math.sin(a) * 0.3, y0 + 1.0 + Math.cos(a) * 0.3, 0.12, 0, 0, -a);
  }
  put(g, new THREE.IcosahedronGeometry(0.19, 1), gold, 0, y0 + 1.02, 0.36);
  put(g, box(0.2, 0.13, 0.16), gold, 0, y0 + 0.94, 0.5);
  put(g, box(0.07, 0.05, 0.03), dark, 0, y0 + 0.99, 0.585);
  for (const s of [-1, 1]) {
    put(g, new THREE.ConeGeometry(0.06, 0.1, 4), gold, s * 0.13, y0 + 1.2, 0.3);
    put(g, box(0.05, 0.03, 0.02), dark, s * 0.075, y0 + 1.07, 0.53);                                                 // eyes
  }
  // The tail, curled round its hip to lie along the plinth, ending in a tuft.
  const tail = new THREE.CatmullRomCurve3([v(0, y0 + 0.1, -0.55), v(0.3, y0 + 0.05, -0.55), v(0.42, y0 + 0.05, -0.2), v(0.42, y0 + 0.08, 0.1)]);
  put(g, new THREE.TubeGeometry(tail, 10, 0.04, 5, false), gold, 0, 0, 0);
  put(g, new THREE.IcosahedronGeometry(0.08, 0), gold, 0.42, y0 + 0.1, 0.14);
  const x = p.x / T, z = p.y / T;
  g.position.set(x, 0, z);
  g.rotation.y = FACING_YAW[p.facing];
  parent.add(g);
  return { occluders: [occluder(g, x, z, 1.8, 1.8, 2.3)] };
}

// ---------- Dovecote ----------
/** A round stone dovecote with a conical roof and a little open lantern on top, doves wheeling round it. */
export function buildDovecote(ctx: RenderContext, parent: THREE.Group, p: PropOf<"dovecote">): PropView {
  const { lambert, basic, tex } = ctx, g = new THREE.Group(), h = 4.2, r = 1.1;
  put(g, tiledCylinder(r, h, 12, 0.6), lambert("#efe8da", { map: tex.stone }), 0, h / 2, 0);
  put(g, new THREE.ConeGeometry(r + 0.3, 1.8, 12), lambert("#a8473a", { map: tex.shingles }), 0, h + 0.9, 0);
  for (const s of [-1, 1]) put(g, box(0.06, 0.5, 0.06), lambert(DARK_WOOD), s * 0.18, h + 1.9, 0);
  put(g, new THREE.ConeGeometry(0.32, 0.4, 4), lambert("#a8473a"), 0, h + 2.3, 0, 0, Math.PI / 4, 0);
  for (let i = 0; i < 16; i++) {                                                       // rows of nesting holes
    const a = (i / 16) * Math.PI * 2, y = h - 0.8 - (i % 2) * 0.45;
    put(g, box(0.14, 0.16, 0.05), basic(DOORWAY), Math.sin(a) * (r + 0.01), y, Math.cos(a) * (r + 0.01), 0, a, 0);
  }
  put(g, box(0.6, 1.3, 0.05), basic(DOORWAY), 0, 0.65, r + 0.01);
  const doves = Array.from({ length: 5 }, () => put(g, new THREE.OctahedronGeometry(0.1, 0), basic("#f4f0e8"), 0, 0, 0));
  const x = p.x / T, z = p.y / T;
  g.position.set(x, 0, z);
  parent.add(g);
  return {
    update(t) {
      doves.forEach((d, i) => {
        const a = t * (0.9 + i * 0.13) + i * 1.3, rr = 1.8 + (i % 3) * 0.5;
        d.position.set(Math.cos(a) * rr, h + 1.5 + Math.sin(t * 2 + i) * 0.4 + (i % 2) * 0.6, Math.sin(a) * rr);
        d.scale.set(1.6, 0.5 + Math.abs(Math.sin(t * 9 + i)) * 0.5, 1);
      });
    },
    occluders: [occluder(g, x, z, 2.4, 2.4, h + 2.5)],
  };
}
