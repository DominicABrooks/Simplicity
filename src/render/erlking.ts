// Under the hill (src/areas/underhill.ts): the Erl-King's throne, a great seat of old grey stone furred with moss, pale
// mushrooms at its foot; and on it, the first two times the hero comes (src/game/underhill.ts), the Erl-King: a giant
// four times his height, sitting with his hands on his knees, robed in bark and moss, antlers hung with small lights. His
// face is what every Pebbling's is, a patch of night with two eyes in it, only far bigger, and his eyes are gold. He
// breathes, slowly; he turns his head to the hero; and when he speaks his eyes burn brighter. After that, the throne is
// empty. The throne's more than stone: rune rings in its back, two living trunks arching over it hung with small lights,
// glowing mushrooms at its foot. And the air of the glade, whoever's there: wisps drifting, low mist, falling petals, and
// eyes that open now and then in the dark between the trees. Kept out of the scenery because whether he's there is the
// game's to say, not the area's.
import * as THREE from "three";
import { T } from "../data/world.ts";
import { GLADE_MID, THRONE } from "../data/underhill.ts";
import { erlKingHere, erlKingSays, UNDERHILL_ID } from "../game/underhill.ts";
import type { Game } from "../game/game.ts";
import { put } from "./castle.ts";
import { softDisc } from "./camp.ts";
import type { RenderContext } from "./context.ts";

export interface ErlKingView { update(g: Game, t: number, dt?: number): void }

/** How far the camera pulls back to take him in. */
const FOCUS_ZOOM = 1.55, WATCHED_ZOOM = 1.6;

/**
 * Where the camera should look under the hill: while the Erl-King's on his throne and the hero's in front of him, between
 * the two, pulled back, so the hero sees all of him and his words over his head; once he's gone, on the hero, pulled
 * back further, so he sees every one of the watchers standing round him. Null anywhere else (the hero, as usual).
 */
export function erlKingFocus(g: Game, px: number, pz: number): { x: number; z: number; zoom: number } | null {
  if (g.area.def.id !== UNDERHILL_ID) return null;
  if (!erlKingHere(g)) return { x: px, z: pz, zoom: WATCHED_ZOOM };
  if (pz - THRONE.y > 9) return null;
  return { x: (px + THRONE.x) / 2, z: pz + (THRONE.y - 0.5 - pz) * 0.62, zoom: FOCUS_ZOOM };
}

export function createErlKingView(ctx: RenderContext): ErlKingView {
  const { lambert, glow, basic } = ctx, root = new THREE.Group();
  root.visible = false;
  root.position.set(THRONE.x, 0, THRONE.y);
  ctx.scene.add(root);

  // The throne: a seat, a tall back and two arms of grey stone, moss on every top, mushrooms round its foot.
  const stone = lambert("#77736c"), dark = lambert("#5a5752"), moss = lambert("#4f7d38");
  const box = (w: number, h: number, d: number, m: THREE.Material, x: number, y: number, z: number) => put(root, new THREE.BoxGeometry(w, h, d), m, x, y + h / 2, z);
  box(2.6, 0.85, 1.6, stone, 0, 0, 0.05);
  box(2.9, 3.4, 0.55, dark, 0, 0, -0.85);
  for (const s of [-1, 1]) { box(0.45, 1.35, 1.5, stone, s * 1.45, 0, 0.05); box(0.5, 0.1, 1.55, moss, s * 1.45, 1.35, 0.05); }
  box(2.62, 0.08, 1.62, moss, 0, 0.85, 0.05);
  box(2.95, 0.12, 0.6, moss, 0, 3.4, -0.85);
  const throne = dressThrone(ctx, root);
  const air = createAir(ctx);
  air.group.visible = false;
  ctx.scene.add(air.group);
  const cap = lambert("#e8d8b8"), stalk = lambert("#efe6d2");
  ctx.glowAtNight(cap);
  for (let i = 0; i < 9; i++) {
    const a = Math.PI * (0.15 + (i / 8) * 0.7), r = 1.7 + (i % 3) * 0.18, k = 0.8 + (i % 4) * 0.25;
    const x = Math.cos(a) * r, z = Math.sin(a) * r * 0.8 + 0.2;
    put(root, new THREE.CylinderGeometry(0.05 * k, 0.07 * k, 0.24 * k, 5), stalk, x, 0.12 * k, z);
    put(root, new THREE.SphereGeometry(0.16 * k, 7, 3, 0, Math.PI * 2, 0, Math.PI / 2), cap, x, 0.22 * k, z).scale.y = 0.6;
  }

  // The Erl-King, sitting, facing south (+z), the way the hero comes.
  const king = new THREE.Group();
  root.add(king);
  const bark = lambert("#5b3f2a"), barkDark = lambert("#3e2a1c"), mossy = lambert("#3f6a30"), wood = lambert("#a88a62");
  const part = (geo: THREE.BufferGeometry, m: THREE.Material, x: number, y: number, z: number, rx = 0, ry = 0, rz = 0, to: THREE.Object3D = king) => put(to, geo, m, x, y, z, rx, ry, rz);
  // Legs: thighs out over the seat's edge, shins down to the ground, great bark feet.
  for (const s of [-1, 1]) {
    part(new THREE.BoxGeometry(0.62, 0.55, 1.35), bark, s * 0.5, 1.15, 0.45);
    part(new THREE.BoxGeometry(0.55, 1.2, 0.55), bark, s * 0.52, 0.6, 1.05);
    part(new THREE.BoxGeometry(0.62, 0.22, 0.85), barkDark, s * 0.52, 0.11, 1.2);
  }
  // His body, robed: bark below, a mantle of moss over his shoulders.
  const body = new THREE.Group();
  body.position.y = 0.9;
  king.add(body);
  part(new THREE.CylinderGeometry(0.62, 0.95, 1.9, 8), bark, 0, 0.95, -0.15, 0, 0, 0, body);
  part(new THREE.SphereGeometry(0.85, 8, 5, 0, Math.PI * 2, 0, Math.PI / 2), mossy, 0, 1.65, -0.15, 0, 0, 0, body).scale.set(1.15, 0.7, 0.95);
  // Arms down to his knees, his hands resting on them.
  for (const s of [-1, 1]) {
    part(new THREE.CylinderGeometry(0.2, 0.24, 1.6, 6), bark, s * 0.95, 1.05, 0.15, 0.55, 0, s * 0.12, body);
    part(new THREE.SphereGeometry(0.24, 6, 4), wood, s * 0.62, 0.38, 1.15).scale.set(1, 0.7, 1.25);
  }
  // His head: a deep hood, and in it his face, a patch of night with two great gold eyes; a crown of pale mushrooms.
  const head = new THREE.Group();
  head.position.set(0, 2.9, -0.05);
  body.add(head);
  part(new THREE.SphereGeometry(0.62, 9, 7), barkDark, 0, 0, 0, 0, 0, 0, head).scale.set(1, 1.15, 1);
  part(new THREE.CircleGeometry(0.44, 14), basic("#07050f"), 0, -0.02, 0.6, 0, 0, 0, head).scale.y = 1.15;
  const eyes = glow("#ffd76a", { transparent: true, opacity: 0.9 });
  for (const s of [-1, 1]) part(new THREE.CircleGeometry(0.085, 8), eyes, s * 0.17, 0.05, 0.615, 0, 0, 0, head).scale.y = 1.4;
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    part(new THREE.SphereGeometry(0.1, 6, 3, 0, Math.PI * 2, 0, Math.PI / 2), cap, Math.cos(a) * 0.5, 0.55, Math.sin(a) * 0.45, 0, 0, 0, head).scale.y = 0.6;
  }
  // Antlers: a main tine up and out on each side, two smaller off it, a small light at every tip.
  const tipLight = glow("#d8f4a8", { transparent: true, opacity: 0.8, depthWrite: false, blending: THREE.AdditiveBlending });
  const tips: THREE.Mesh[] = [];
  for (const s of [-1, 1]) {
    const antler = new THREE.Group();
    antler.position.set(s * 0.35, 0.5, -0.05);
    antler.rotation.z = -s * 0.5;
    head.add(antler);
    part(new THREE.CylinderGeometry(0.04, 0.07, 1.2, 5).translate(0, 0.6, 0), wood, 0, 0, 0, 0, 0, 0, antler);
    tips.push(part(new THREE.OctahedronGeometry(0.07, 0), tipLight, 0, 1.22, 0, 0, 0, 0, antler));
    for (const [y, rot, len] of [[0.45, -s * 0.9, 0.55], [0.8, s * 0.7, 0.45]] as const) {
      const tine = new THREE.Group();
      tine.position.y = y;
      tine.rotation.z = rot;
      antler.add(tine);
      part(new THREE.CylinderGeometry(0.025, 0.045, len, 5).translate(0, len / 2, 0), wood, 0, 0, 0, 0, 0, 0, tine);
      tips.push(part(new THREE.OctahedronGeometry(0.06, 0), tipLight, 0, len + 0.02, 0, 0, 0, 0, tine));
    }
  }
  /** A soft pool of green light round the throne's foot. */
  const pool = put(root, new THREE.CircleGeometry(2.6, 24).rotateX(-Math.PI / 2), glow("#9cffc8", { transparent: true, opacity: 0.12, depthWrite: false }), 0, 0.02, 0.6);

  let shown = false;
  return {
    update(g, t, dt = 1 / 60) {
      const here = g.area.def.id === UNDERHILL_ID;
      if (here !== shown) { root.visible = air.group.visible = shown = here; }
      if (!here) return;
      throne(t);
      air.update(t, dt);
      king.visible = erlKingHere(g);
      pool.visible = king.visible;
      if (!king.visible) return;
      const speaking = !!erlKingSays(g), p = g.world.get(g.player, "transform");
      body.scale.y = 1 + Math.sin(t * 0.8) * 0.015;                                   // breathing, slowly
      if (p) head.rotation.y = THREE.MathUtils.clamp(Math.atan2(p.x / T - THRONE.x, p.y / T - THRONE.y + 0.01), -0.6, 0.6);
      head.rotation.x = Math.sin(t * 0.5) * 0.04 + (speaking ? Math.sin(t * 3.1) * 0.025 : 0);
      eyes.opacity = (speaking ? 0.85 + Math.sin(t * 6) * 0.15 : 0.65) * (t % 6.1 < 0.15 ? 0.05 : 1);   // and now and then, he blinks
      tips.forEach((m, i) => m.scale.setScalar(0.8 + Math.sin(t * 2.2 + i * 1.7) * 0.3));
    },
  };
}

// ---------- The throne, dressed ----------
/**
 * More to the throne than its stone: rune rings carved in its back, glowing the fair folk's green; a pointed head to it;
 * two living trunks rising either side and arching over it, bound in moss, small lights hung from the arch on threads;
 * moss draped over its arms, carved knobs at their ends; glowing mushrooms in clusters at its foot; and flagstones,
 * half sunk in the grass, leading up to it. Returns its per-frame update.
 */
function dressThrone(ctx: RenderContext, root: THREE.Group): (t: number) => void {
  const { lambert, glow } = ctx;
  const stone = lambert("#77736c"), dark = lambert("#5a5752"), moss = lambert("#4f7d38"), mossDeep = lambert("#3a6a2c");
  const trunk = lambert("#4a3424"), trunkDark = lambert("#36261a");
  const rune = glow("#7dffb0", { transparent: true, opacity: 0.6, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
  // The back's head: a pointed gable of stone over it, moss along its edges.
  put(root, new THREE.ConeGeometry(1.75, 1.1, 4, 1).rotateY(Math.PI / 4), dark, 0, 3.95, -0.85).scale.set(1.15, 1, 0.32);
  put(root, new THREE.BoxGeometry(0.5, 0.5, 0.62), stone, 0, 4.55, -0.85, 0, 0, Math.PI / 4);
  // Rune rings in its face, round where his head is: the fair folk's marks, breathing light.
  const rings = [[0, 3.05, 0.55], [-0.95, 2.35, 0.32], [0.95, 2.35, 0.32], [0, 1.7, 0.22]] as const;
  for (const [x, y, r] of rings) {
    put(root, new THREE.RingGeometry(r * 0.78, r, 18), rune, x, y, -0.565);
    put(root, new THREE.RingGeometry(r * 0.3, r * 0.42, 12), rune, x, y, -0.565);
  }
  // Moss over the arms, hanging down their sides, and a carved knob at each arm's end.
  for (const s of [-1, 1]) {
    for (let i = 0; i < 4; i++) put(root, new THREE.BoxGeometry(0.06, 0.45 + (i % 3) * 0.2, 0.18), mossDeep, s * (1.45 + 0.24), 1.15 - (i % 3) * 0.1, -0.5 + i * 0.35);
    put(root, new THREE.DodecahedronGeometry(0.28, 0), stone, s * 1.45, 1.5, 0.82).scale.y = 0.8;
    put(root, new THREE.SphereGeometry(0.3, 8, 3, 0, Math.PI * 2, 0, Math.PI / 2), moss, s * 1.45, 1.58, 0.82).scale.y = 0.45;
  }
  // The living trunks either side, twisting up, and the bough they make arching over the throne.
  for (const s of [-1, 1]) {
    let x = s * 1.95, z = -0.95;
    for (let i = 0; i < 6; i++) {
      const h = 0.8, nx = s * (1.95 - Math.sin(i * 0.9) * 0.1 - (i > 3 ? (i - 3) * 0.12 : 0)), nz = -0.95 + Math.sin(i * 1.4) * 0.12;
      const seg = put(root, new THREE.CylinderGeometry(0.2 - i * 0.012, 0.24 - i * 0.012, h + 0.05, 6), i % 2 ? trunk : trunkDark, (x + nx) / 2, i * h + h / 2, (z + nz) / 2);
      seg.rotation.z = (x - nx) * 0.6;
      x = nx; z = nz;
    }
    for (let i = 0; i < 3; i++) put(root, new THREE.TorusGeometry(0.24, 0.05, 4, 8), mossDeep, s * (1.95 - i * 0.05), 0.9 + i * 1.5, -0.95, Math.PI / 2, 0, 0);   // moss binding it
    put(root, new THREE.DodecahedronGeometry(0.35, 0), trunkDark, s * 1.75, 0.15, -0.6).scale.set(1.4, 0.5, 1.2);   // its roots, gripping the ground
  }
  const ARCH = { r: 1.72, y: 4.75, squash: 0.42 };            // low enough to stay in the picture over his antlers
  const bough = put(root, new THREE.TorusGeometry(ARCH.r, 0.17, 5, 14, Math.PI), trunk, 0, ARCH.y, -0.95);
  bough.scale.set(1, ARCH.squash, 1);
  // Moss hanging from the bough in strands, and small lights hung on threads between.
  const lights: THREE.Mesh[] = [];
  const lantern = glow("#ffe9a8", { transparent: true, opacity: 0.9 }), thread = lambert("#c8c0a8");
  for (let i = 0; i < 9; i++) {
    const a = Math.PI * (0.08 + (i / 8) * 0.84), x = Math.cos(a) * ARCH.r, y = ARCH.y + Math.sin(a) * ARCH.r * ARCH.squash;
    if (i % 2) {
      const len = 0.35 + (i % 3) * 0.2;
      put(root, new THREE.BoxGeometry(0.012, len, 0.012), thread, x, y - len / 2, -0.95);
      lights.push(put(root, new THREE.OctahedronGeometry(0.09, 0), lantern, x, y - len - 0.08, -0.95));
    } else {
      const len = 0.5 + (i % 4) * 0.22;
      put(root, new THREE.BoxGeometry(0.08, len, 0.05), mossDeep, x, y - len / 2, -0.92);
    }
  }
  // Glowing mushrooms in clusters at the throne's foot, the fair folk's kind: a cold blue-green under their caps.
  const shroom = glow("#6ef0d0", { transparent: true, opacity: 0.85 }), shroomStalk = lambert("#d8efe6");
  for (const [cx, cz] of [[-2.3, 0.6], [2.4, 0.4], [-1.2, 1.4], [1.6, 1.5]] as const) {
    for (let i = 0; i < 4; i++) {
      const k = 0.6 + ((i * 7) % 5) * 0.12, x = cx + Math.cos(i * 2.2) * 0.22, z = cz + Math.sin(i * 2.2) * 0.18;
      put(root, new THREE.CylinderGeometry(0.035 * k, 0.05 * k, 0.32 * k, 5), shroomStalk, x, 0.16 * k, z);
      put(root, new THREE.SphereGeometry(0.13 * k, 7, 3, 0, Math.PI * 2, 0, Math.PI / 2), shroom, x, 0.3 * k, z).scale.y = 0.55;
    }
  }
  // Flagstones half sunk in the grass, leading up to the throne from the great ring.
  const flag = lambert("#8a867c");
  for (let i = 0; i < 6; i++) {
    const z = 1.7 + i * 0.75, x = Math.sin(i * 1.3) * 0.18;
    put(root, new THREE.CylinderGeometry(0.42 + (i % 2) * 0.08, 0.45 + (i % 2) * 0.08, 0.05, 6), flag, x, 0.025, z, 0, i * 0.7, 0).scale.z = 0.75;
  }
  return t => {
    rune.opacity = 0.45 + Math.sin(t * 0.9) * 0.2;
    lights.forEach((m, i) => { m.position.x += Math.sin(t * 1.3 + i) * 0.0008; m.scale.setScalar(0.85 + Math.sin(t * 2.5 + i * 1.9) * 0.2); });
    shroom.opacity = 0.75 + Math.sin(t * 0.6) * 0.12;
  };
}

// ---------- The air under the hill ----------
/** Wisps, mist, petals and the eyes in the trees: how many of each. */
const WISPS = 46, MISTS = 12, PETALS = 34, EYES = 7;

/**
 * The air of the glade, whoever's on the throne: will-o'-the-wisps drifting and bobbing all about it, gold and green and
 * violet; low mist creeping slow over the grass; petals falling, turning; and in the dark between the trees round it,
 * now and then, a pair of eyes that opens, watches a while, and shuts. A group of its own, shown only under the hill.
 */
function createAir(ctx: RenderContext): { group: THREE.Group; update(t: number, dt: number): void } {
  const { glow, basic } = ctx, group = new THREE.Group(), cx = GLADE_MID.x, cz = GLADE_MID.y;
  const h = (i: number, k: number) => { const s = Math.sin(i * 127.1 + k * 311.7) * 43758.5453; return s - Math.floor(s); };
  // Wisps.
  const colours = ["#ffe38a", "#a8ffcf", "#d2a8ff"].map(c => glow(c, { transparent: true, opacity: 0.85, depthWrite: false, blending: THREE.AdditiveBlending }));
  const wispGeo = new THREE.OctahedronGeometry(0.08, 0), haloGeo = new THREE.SphereGeometry(0.22, 6, 4);
  const halo = colours.map(m => { const c = m.clone(); c.opacity = 0.18; return c; });
  const wisps = Array.from({ length: WISPS }, (_, i) => {
    const m = new THREE.Group(), kind = i % 3;
    m.add(new THREE.Mesh(wispGeo, colours[kind]!), new THREE.Mesh(haloGeo, halo[kind]!));
    group.add(m);
    return { m, r: 1.5 + h(i, 1) * 8, a: h(i, 2) * Math.PI * 2, y: 0.3 + h(i, 3) * 2.4, speed: (h(i, 4) - 0.5) * 0.16, bob: h(i, 5) * 6 };
  });
  // Mist.
  const mistMat = basic("#cbb8ff", { transparent: true, opacity: 0.14, depthWrite: false, map: softDisc() });
  const mists = Array.from({ length: MISTS }, (_, i) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(2, 2).rotateX(-Math.PI / 2), mistMat);
    m.scale.set(2 + h(i, 6) * 2.5, 1, 1.5 + h(i, 7) * 2);
    group.add(m);
    return { m, r: 2 + h(i, 8) * 6.5, a: h(i, 9) * Math.PI * 2, y: 0.12 + h(i, 10) * 0.25, speed: 0.02 + h(i, 11) * 0.03 };
  });
  // Petals.
  const petalMats = ["#ffd6ec", "#fff4fb", "#e8d0ff"].map(c => basic(c, { transparent: true, opacity: 0.9, side: THREE.DoubleSide }));
  const petalGeo = new THREE.PlaneGeometry(0.09, 0.06);
  const petals = Array.from({ length: PETALS }, (_, i) => {
    const m = new THREE.Mesh(petalGeo, petalMats[i % 3]!);
    group.add(m);
    return { m, x: cx + (h(i, 12) - 0.5) * 16, z: cz + (h(i, 13) - 0.5) * 14, fall: 0.25 + h(i, 14) * 0.25, k: h(i, 15) * 6, y: h(i, 16) * 4 };
  });
  // Eyes in the dark between the trees, round the glade's edge.
  const eyeMat = glow("#f4e98a", { transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending });
  const eyes = Array.from({ length: EYES }, (_, i) => {
    const pair = new THREE.Group(), mat = eyeMat.clone(), a = Math.PI * (0.05 + 0.9 * h(i, 17)) * (i % 2 ? 1 : -1) + Math.PI / 2 + Math.PI;
    for (const s of [-1, 1]) pair.add(new THREE.Mesh(new THREE.CircleGeometry(0.045, 6), mat)).children.at(-1)!.position.set(s * 0.07, 0, 0);
    const r = 10.6 + h(i, 18) * 1.2;
    pair.position.set(cx + Math.cos(a) * r, 0.7 + h(i, 19) * 0.9, cz + Math.sin(a) * r * 0.86);
    pair.lookAt(cx, pair.position.y, cz);
    group.add(pair);
    return { mat, period: 7 + h(i, 20) * 9, offset: h(i, 21) * 20, open: 1.5 + h(i, 22) * 2.5 };
  });

  return {
    group,
    update(t, dt) {
      for (const w of wisps) {
        w.a += w.speed * dt;
        w.m.position.set(cx + Math.cos(w.a) * w.r, w.y + Math.sin(t * 1.1 + w.bob) * 0.25, cz + Math.sin(w.a) * w.r * 0.86);
        w.m.scale.setScalar(0.8 + Math.sin(t * 3 + w.bob) * 0.25);
      }
      for (const m of mists) {
        m.a += m.speed * dt;
        m.m.position.set(cx + Math.cos(m.a) * m.r, m.y, cz + Math.sin(m.a) * m.r * 0.86);
        m.m.rotation.y = m.a * 0.5;
      }
      for (const p of petals) {
        p.y -= p.fall * dt;
        if (p.y < 0) p.y = 4;
        p.m.position.set(p.x + Math.sin(t * 0.7 + p.k) * 0.5, p.y, p.z + Math.cos(t * 0.5 + p.k) * 0.3);
        p.m.rotation.set(t * 1.7 + p.k, t * 1.1 + p.k, 0);
      }
      mistMat.opacity = 0.12 + Math.sin(t * 0.3) * 0.03;
      for (const e of eyes) {                                  // open a while, then shut; a blink partway through
        const into = (t + e.offset) % e.period, on = into < e.open ? Math.min(1, into * 2, (e.open - into) * 2) : 0;
        e.mat.opacity = on * (Math.abs(into - e.open / 2) < 0.07 ? 0.1 : 0.85);
      }
    },
  };
}
