// Under the hill (src/areas/underhill.ts): the Erl-King's throne, a great seat of old grey stone furred with moss, pale
// mushrooms at its foot; and on it, the first two times the hero comes (src/game/underhill.ts), the Erl-King: a giant
// four times his height, sitting with his hands on his knees, robed in bark and moss, antlers hung with small lights. His
// face is what every Pebbling's is, a patch of night with two eyes in it, only far bigger, and his eyes are gold. He
// breathes, slowly; he turns his head to the hero; and when he speaks his eyes burn brighter. After that, the throne is
// empty. Kept out of the scenery because whether he's there is the game's to say, not the area's.
import * as THREE from "three";
import { T } from "../data/world.ts";
import { THRONE } from "../data/underhill.ts";
import { erlKingHere, erlKingSays, UNDERHILL_ID } from "../game/underhill.ts";
import type { Game } from "../game/game.ts";
import { put } from "./castle.ts";
import type { RenderContext } from "./context.ts";

export interface ErlKingView { update(g: Game, t: number): void }

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
    update(g, t) {
      const here = g.area.def.id === UNDERHILL_ID;
      if (here !== shown) { root.visible = shown = here; }
      if (!here) return;
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
