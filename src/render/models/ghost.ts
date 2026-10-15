// The Grey Ringer: Ismay Tollen's ghost, shared by her entity view and the journal's portrait. A tall,
// hooded shape in a ragged gown that thins to nothing at the hem, floating a little off the ground, ash
// grey with a faint sea-green glow; a black hollow under the hood with two pale eyes in it; one arm holding
// out the handbell she rings. Faces +X, like every model. Not added to the scene.
import * as THREE from "three";
import { box, col, type RenderContext } from "../context.ts";

export interface GhostModel {
  group: THREE.Group;
  /** Everything that floats (the root stays on the ground, for the toll's ring). */
  body: THREE.Group;
  /** Her gown and hood: fade in and out together, flash white when hit. */
  robe: THREE.MeshLambertMaterial;
  hood: THREE.MeshLambertMaterial;
  /** The glow around her. */
  shell: THREE.MeshBasicMaterial;
  /** Her eyes: pale, or red with anger. */
  eyes: THREE.Mesh[];
  calm: THREE.Material;
  angry: THREE.Material;
  head: THREE.Group;
  /** Arms hang from the shoulder (rotate z to raise them forward): the bell arm, and the reaching one. */
  bellArm: THREE.Group;
  reachArm: THREE.Group;
  /** The bell, hanging from her hand: it swings. */
  bell: THREE.Group;
}

const GOWN: [number, number][] = [[0.4, 0], [0.37, 0.14], [0.29, 0.46], [0.22, 0.8], [0.19, 1.0], [0.13, 1.1], [0, 1.14]];

/** A sleeve hanging from the shoulder, its pale hand at the end. */
function arm(robe: THREE.Material, skin: THREE.Material): THREE.Group {
  const g = new THREE.Group();
  const sleeve = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.1, 0.44, 5).translate(0, -0.22, 0), robe);
  const hand = new THREE.Mesh(box(0.06, 0.08, 0.05), skin);
  hand.position.y = -0.48;
  g.add(sleeve, hand);
  return g;
}

export function makeGhostModel(ctx: RenderContext): GhostModel {
  const group = new THREE.Group(), body = new THREE.Group();
  const robe = ctx.lambert("#aebdb8", { transparent: true, opacity: 0.8, emissive: col("#2f4a46") });
  const hood = ctx.lambert("#8c9b97", { transparent: true, opacity: 0.88, emissive: col("#24393a") });
  ctx.glowAtNight(robe, hood);                               // she shines a little of herself in the dark
  const shell = ctx.glow("#7fe0cc", { transparent: true, opacity: 0.16, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });

  // The gown, its hem torn ragged and trailing away to nothing.
  const gown = new THREE.LatheGeometry(GOWN.map(([r, y]) => new THREE.Vector2(r, y)), 7);
  const pos = gown.attributes.position!;
  for (let i = 0; i < pos.count; i++) if (pos.getY(i) < 0.01) pos.setY(i, i % 2 ? -0.16 : 0.06);
  gown.computeVertexNormals();
  body.add(new THREE.Mesh(gown, robe));
  const glow = new THREE.Mesh(gown, shell);
  glow.scale.set(1.14, 1.06, 1.14);
  glow.position.y = -0.03;
  body.add(glow);

  // The hood, the hollow under it and the eyes in the hollow; a few grey locks hanging out.
  const head = new THREE.Group();
  head.position.y = 1.14;
  const cowl = new THREE.Mesh(new THREE.ConeGeometry(0.21, 0.46, 6).translate(0, 0.16, 0), hood);
  cowl.position.x = -0.02;
  const hollow = new THREE.Mesh(box(0.06, 0.17, 0.17), ctx.glow("#081010"));
  hollow.position.set(0.15, 0.08, 0);
  const calm = ctx.glow("#d6fff6"), angry = ctx.glow("#ff7a66");
  const eyes = [-1, 1].map(s => { const e = new THREE.Mesh(box(0.03, 0.04, 0.035), calm); e.position.set(0.185, 0.1, s * 0.045); return e; });
  const lock = ctx.lambert("#c9cec8", { transparent: true, opacity: 0.8 });
  for (const s of [-1, 1]) { const l = new THREE.Mesh(box(0.035, 0.26, 0.04), lock); l.position.set(0.1, -0.06, s * 0.13); head.add(l); }
  head.add(cowl, hollow, ...eyes);
  body.add(head);

  // Her arms, and the handbell.
  const skin = ctx.lambert("#d9e4df", { transparent: true, opacity: 0.85 });
  const bellArm = arm(robe, skin), reachArm = arm(robe, skin);
  bellArm.position.set(0, 1.04, 0.2);
  reachArm.position.set(0, 1.04, -0.2);
  const bell = new THREE.Group();
  const bronze = ctx.lambert("#8a7444", { emissive: col("#2a2210") });
  ctx.glowAtNight(bronze);
  bell.add(new THREE.Mesh(new THREE.LatheGeometry([[0.1, -0.16], [0.085, -0.12], [0.06, -0.04], [0.03, -0.01], [0, 0]].map(([r, y]) => new THREE.Vector2(r!, y!)), 6), bronze));
  const handle = new THREE.Mesh(box(0.03, 0.1, 0.03), ctx.lambert("#3a2a1a"));
  handle.position.y = 0.05;
  const clapper = new THREE.Mesh(box(0.03, 0.04, 0.03), bronze);
  clapper.position.y = -0.17;
  bell.add(handle, clapper);
  bell.position.y = -0.56;
  bellArm.add(bell);
  body.add(bellArm, reachArm);

  group.add(body);
  return { group, body, robe, hood, shell, eyes, calm, angry, head, bellArm, reachArm, bell };
}
