// The Vael as they really are, in the credits (src/game/credits.ts): the Old Mother, enormous, sweeping low over the
// King's Bridge or standing over her eggs under the Greyspines, and her three hatchlings, one red, one white and one
// indigo (HERO.md, "The end"). They're built like great wyverns: no forelegs, the wings are the arms, and at rest the
// folded wings are what they lean on in front; two thick legs with backward-bent shins and great claws; a long neck and
// a long, heavy tail of tapering segments that curl and sway, the tail ending in a spiked club; spikes all down the
// back; a long beaked head with swept-back horns, a crest, teeth and a jaw that drops when it roars; and wings fingered
// and scalloped, red out from the wrist and black at the tips. The Old Mother is crimson barred with black, with a tan
// belly; a hatchling is its own order's colour, marked darker, with a big head on a short neck, small wings and stubby
// horns. Each breathes its order's breath (fire, frost, or sparks) out of its mouth, lighting what's round it. All of
// it is a few low-poly shapes, flat-shaded, the way everything else is. The eggs are smooth and turned, under the
// King's gold leaf till it flakes off in a shower of sparks, then glowing their own colour, rocking in fits and starts
// as they crack, light showing through the crack round the middle; then the top's pushed up from inside on a hinge,
// tipped back and off into the grass, a few chips of shell flying, and the bottom half's left.
import * as THREE from "three";
import type { SparkColor } from "./particles.ts";
import { put } from "./castle.ts";
import { softDisc } from "./camp.ts";
import { GROUND, SHADOW_Y, addShadow, box, onGround, toWorld, type RenderContext } from "./context.ts";
import { disposeTree } from "./dispose.ts";
import type { EntityView } from "./views.ts";
import type { Dragon, Egg } from "../game/components.ts";

/**
 * Each dragon's colours, after the great wyverns of the old songs: hide, belly, the wing membrane (deep red out from the
 * arm) and where it runs pale (cream toward the trailing edge), the dark of the markings, spikes and claws, eyes; and
 * the breath it breathes. The Old Mother is crimson barred with black, a tan belly; her hatchlings each in their own
 * order's colour, marked darker. Flat colours in big pieces, like everything else in the world.
 */
const HIDES: Record<Dragon["hide"], {
  skin: string; belly: string; wing: string; pale: string; mark: string; horn: string; eye: string; breath: [SparkColor, SparkColor]; light: string;
}> = {
  mother: { skin: "#b3231c", belly: "#d9b98c", wing: "#9a1e16", pale: "#e6cb9c", mark: "#2a1816", horn: "#3a302c", eye: "#ffd23a", breath: ["fire", "ember"], light: "#ff9a40" },
  ember: { skin: "#d0391f", belly: "#f0b878", wing: "#c42a1c", pale: "#f2c08c", mark: "#5a160c", horn: "#f2e2c4", eye: "#fff1a8", breath: ["fire", "ember"], light: "#ff8a3a" },
  frost: { skin: "#eef2f4", belly: "#cfe6f2", wing: "#c4dcea", pale: "#f4f8fa", mark: "#8fb0c6", horn: "#9fc4dc", eye: "#5ab8f0", breath: ["ice", "snow"], light: "#cfeeff" },
  storm: { skin: "#3a368a", belly: "#8f86d8", wing: "#4a42b0", pale: "#a49ce0", mark: "#1c1a48", horn: "#e8e2ff", eye: "#fff6a0", breath: ["arcane", "arcaneLight"], light: "#9a8cff" },
};
type Hide = (typeof HIDES)[Dragon["hide"]];

interface DragonView {
  group: THREE.Group; shadow: THREE.Mesh; chest: THREE.Mesh;
  legs: THREE.Group[]; neck: THREE.Group[]; head: THREE.Group; jaw: THREE.Group; mouth: THREE.Object3D; tail: THREE.Group[];
  wings: [THREE.Group, THREE.Group]; wrists: [THREE.Group, THREE.Group];
  light: THREE.PointLight; k: number;
}

/** A tapered length, `r0` thick at its start (the origin) and `r1` at its end, `len` along +y. */
const limb = (len: number, r0: number, r1: number, sides = 7) => new THREE.CylinderGeometry(r1, r0, len, sides).translate(0, len / 2, 0);
const toX = (geo: THREE.BufferGeometry) => geo.rotateZ(-Math.PI / 2);
const toBack = (geo: THREE.BufferGeometry) => geo.rotateZ(Math.PI / 2);
const toZ = (geo: THREE.BufferGeometry) => geo.rotateX(Math.PI / 2);
const down = (geo: THREE.BufferGeometry) => geo.rotateX(Math.PI);
const ball = (r: number) => new THREE.IcosahedronGeometry(r, 1);
const cone = (r: number, len: number, sides = 4) => new THREE.ConeGeometry(r, len, sides).translate(0, len / 2, 0);
type P = readonly [number, number];
/** Flat triangles on the plane y = 0 (points are x, z). */
function flatTris(tris: readonly P[]): THREE.BufferGeometry {
  const geo = new THREE.BufferGeometry().setFromPoints(tris.map(([x, z]) => new THREE.Vector3(x, 0, z)));
  geo.computeVertexNormals();
  return geo;
}
/** A fan of triangles from the first point through the rest. */
const fan = (pts: readonly P[]) => flatTris(pts.slice(1, -1).flatMap((p, i) => [pts[0]!, p, pts[i + 2]!]));
/** The band between two runs of points, an inner and an outer, the same length. */
const band = (inner: readonly P[], outer: readonly P[]) =>
  flatTris(inner.slice(0, -1).flatMap((a, i) => [a, outer[i]!, outer[i + 1]!, a, outer[i + 1]!, inner[i + 1]!]));
/** Toward `o` from `p`, `k` of the way. */
const toward = (p: P, o: P, k: number): P => [p[0] + (o[0] - p[0]) * k, p[1] + (o[1] - p[1]) * k];
/** A bone on the plane y = 0 from a to b (x, z), tapering. */
function rod(o: THREE.Object3D, a: P, b: P, r0: number, r1: number, mat: THREE.Material, sides = 5): void {
  put(o, toZ(limb(Math.hypot(b[0] - a[0], b[1] - a[1]), r0, r1, sides)), mat, a[0], 0, a[1]).rotation.y = Math.atan2(b[0] - a[0], b[1] - a[1]);
}

/**
 * A wing, which is the arm too, built out along +z from the shoulder (the far one the same, mirrored), shaped on
 * Rathalos's: the arm reaching forward and out to a wrist held level with the head; from it the long first finger
 * along the leading edge, bowed forward, out to the tip, and two more fingers sweeping back to the trailing edge; the
 * membrane deep (as deep as the body is long, near the root), scalloped between the fingertips: red out from the arm,
 * cream toward the trailing edge. One sheet, in two flat colours side by side, nothing laid over it (anything that
 * close to it would flicker through it, with every vertex snapped to the screen's coarse grid). The fingers fold back
 * along the arm at the wrist, and at rest the folded wing is what she stands on in front, the wrist claw on the ground.
 */
function wing(bone: THREE.Material, claw: THREE.Material, top: THREE.Material, pale: THREE.Material, s: 1 | -1, span: number): { shoulder: THREE.Group; wrist: THREE.Group } {
  const shoulder = new THREE.Group(), m = new THREE.Group(), W: P = [0.2, 0.61];
  m.scale.set(span, span, s * span);
  shoulder.add(m);
  put(m, ball(0.08), bone, 0, 0, 0);
  rod(m, [0, 0], W, 0.07, 0.045, bone, 7);
  const wrist = new THREE.Group();
  wrist.position.set(W[0], 0, W[1]);
  m.add(wrist);
  put(wrist, ball(0.055), bone, 0, 0, 0);
  put(wrist, toX(cone(0.03, 0.13)), claw, 0.04, 0, 0);       // the wrist claw, forward
  // The hand, from the wrist: the leading edge bowed forward to the tip, two fingers back to the trailing edge,
  // and the scallops between, pulled in.
  const lead: P = [0.1, 0.64], tip: P = [-0.31, 1.13], f2: P = [-0.98, 0.69], f3: P = [-1.09, 0];
  const s1: P = [-0.41, 0.86], s2: P = [-0.82, 0.39];
  rod(wrist, [0, 0], lead, 0.04, 0.03, bone);
  rod(wrist, lead, tip, 0.03, 0.012, bone);
  rod(wrist, [0, 0], f2, 0.035, 0.012, bone);
  rod(wrist, [0, 0], f3, 0.035, 0.014, bone);
  const edge: P[] = [lead, tip, s1, f2, s2, f3];
  // Red out from the arm, cream the outer part toward the trailing edge.
  const inner = edge.map((p, i) => toward([0, 0], p, i === 0 || i === 1 ? 0.92 : 0.55));
  put(wrist, fan([[0, 0], ...inner]), top, 0, 0, 0);
  put(wrist, band(inner, edge), pale, 0, 0, 0);
  // Nearer the body: from the shoulder out to the wrist and the last fingertip, scalloped back in to the flank.
  const f3m: P = [W[0] + f3[0], W[1] + f3[1]], s3: P = [-0.66, 0.3], root: P = [-0.6, 0.02];
  put(m, fan([[0, 0], W, f3m, s3, root]), top, 0, 0, 0);
  return { shoulder, wrist };
}

/**
 * A dragon facing +x, built like a great wyvern and shaped on Rathalos (seen from above, nose to tail is a little over
 * half its wingspan): no forelegs, the wings its arms, rooted just behind the head; a short neck and a small beaked head
 * with swept-back horns, a crest, teeth and a jaw that drops; a compact body, the chest high and the hips heavy on two
 * thick, bird-footed legs; spikes down the back; black bars across the back, neck and tail; and a tail no longer than
 * the body and neck together, ending in a broad spiked club. A hatchling is the same but young: a bigger head for its
 * size, small wings, stubby horns.
 */
function makeDragon(ctx: RenderContext, hide: Dragon["hide"]): Omit<DragonView, "shadow" | "light" | "k"> {
  const h: Hide = HIDES[hide], young = hide !== "mother", group = new THREE.Group(), flat = { flatShading: true }, both = { side: THREE.DoubleSide, ...flat };
  const skin = ctx.lambert(h.skin, flat), belly = ctx.lambert(h.belly, flat), horn = ctx.lambert(h.horn, flat), mark = ctx.lambert(h.mark, flat), eye = ctx.glow(h.eye);
  const top = ctx.lambert(h.wing, both), pale = ctx.lambert(h.pale, both), tooth = ctx.lambert("#f6f0e2", flat);
  // The body: compact, the chest high, the hips behind, the belly under both; a black saddle down the back, and spikes.
  // Narrow, as Rathalos is from above and below: about a seventh as wide as it's long.
  const chest = put(group, ball(0.3), skin, 0.12, 0.84, 0);
  chest.scale.set(1.2, 0.95, 0.5);
  put(group, ball(0.29), skin, -0.24, 0.78, 0).scale.set(1.15, 0.85, 0.48);
  put(group, ball(0.26), belly, -0.04, 0.68, 0).scale.set(1.75, 0.6, 0.44);   // pale all down the underside
  for (let i = 0; i < 5; i++) put(group, cone(0.04, 0.16 - Math.abs(i - 1.5) * 0.02), horn, 0.28 - i * 0.14, 1.12 - i * 0.04, 0, 0, 0, -0.45);
  // Two legs, thick in the thigh, a backward-bent shin, a long foot and three great claws.
  const legs = ([0.12, -0.12] as const).map(lz => {
    const hip = new THREE.Group(), y = 0.74, a = 0.6, b = -0.75, upper = 0.34, shin = 0.3;
    hip.position.set(-0.2, y, lz);
    group.add(hip);
    put(hip, ball(0.17), skin, 0, 0, 0).scale.set(1.2, 1.3, 0.55);
    put(hip, down(limb(upper, 0.095, 0.06)), skin, 0, 0, 0).rotation.z = a;
    const knee = new THREE.Group();
    knee.position.set(Math.sin(a) * upper, -Math.cos(a) * upper, 0);
    hip.add(knee);
    put(knee, ball(0.06), skin, 0, 0, 0);
    put(knee, down(limb(shin, 0.055, 0.04)), skin, 0, 0, 0).rotation.z = b;
    const ankle = new THREE.Group(), low = y - upper * Math.cos(a) - shin * Math.cos(b) - 0.03;
    ankle.position.set(Math.sin(b) * shin, -Math.cos(b) * shin, 0);
    knee.add(ankle);
    put(ankle, down(limb(Math.max(0.05, low / Math.cos(0.45)), 0.04, 0.032)), skin, 0, 0, 0).rotation.z = 0.45;
    const foot = new THREE.Group();
    foot.position.set(Math.tan(0.45) * low, -low, 0);
    ankle.add(foot);
    put(foot, box(0.13, 0.045, 0.1), skin, 0.03, 0, 0);
    for (const cz of [-0.035, 0, 0.035]) put(foot, toX(cone(0.02, 0.1)), horn, 0.09, -0.01, cz, 0, cz * 5, 0);
    put(foot, toBack(cone(0.02, 0.07)), horn, -0.04, -0.01, 0);   // the back toe
    return hip;
  });
  // The neck: short, three thick segments, each hung off the one before, so bending each curls the whole; the middle one black.
  const neck: THREE.Group[] = [], L = young ? 0.08 : 0.1;
  let parent: THREE.Object3D = group;
  for (let i = 0; i < 3; i++) {
    const seg = new THREE.Group(), r0 = 0.1 - i * 0.012, r1 = r0 - 0.012;
    seg.position.set(i ? L : 0.36, i ? 0 : 0.96, 0);
    put(seg, ball(r0 * 0.97), skin, 0, 0, 0);
    put(seg, toX(limb(L + 0.02, r0, r1)), i === 1 ? mark : skin, 0, 0, 0);
    put(seg, toX(limb(L + 0.02, r0 * 0.78, r1 * 0.78)), belly, 0, -r0 * 0.42, 0);   // paler underneath
    put(seg, cone(0.028, 0.1), horn, L * 0.5, r0 * 0.8, 0, 0, 0, -0.45);
    parent.add(seg);
    neck.push(seg);
    parent = seg;
  }
  // The head: small, long and beaked, the upper jaw hooked at the tip, a crest of spikes, horns swept right back.
  const head = new THREE.Group(), skull = new THREE.Group();
  head.position.set(L, 0, 0);
  skull.scale.setScalar(young ? 1.15 : 0.68);
  head.add(skull);
  parent.add(head);
  put(skull, ball(0.14), skin, 0.05, 0.03, 0).scale.set(1.3, 0.88, 0.85);
  put(skull, toX(limb(0.34, 0.1, 0.035, 6)), skin, 0.1, 0.01, 0).scale.set(1, 0.72, 1);   // the snout, long and tapering
  put(skull, down(cone(0.03, 0.07, 4)), horn, 0.43, 0.005, 0);                            // the hook at its tip
  for (let i = 0; i < 3; i++) put(skull, cone(0.025, 0.08 - i * 0.015), horn, 0.0 - i * 0.07, 0.13 - i * 0.01, 0, 0, 0, -0.6);   // the crest
  for (const s of [-1, 1]) {
    put(skull, box(0.13, 0.035, 0.06), mark, 0.12, 0.1, s * 0.075, s * 0.35, 0, -0.15);  // brows, black
    put(skull, box(0.05, 0.03, 0.02), eye, 0.13, 0.07, s * 0.12, 0, s * 0.3, 0);
    put(skull, box(0.022, 0.02, 0.02), mark, 0.36, 0.04, s * 0.03);                      // nostrils
    // Horns: from the back of the skull, swept right back and curving up at the tips (stubs on a hatchling).
    const hornAt = new THREE.Group();
    hornAt.position.set(-0.08, 0.08, s * 0.08);
    hornAt.rotation.set(s * 0.25, 0, 1.45);
    skull.add(hornAt);
    put(hornAt, cone(0.04, young ? 0.1 : 0.24, 5), horn, 0, 0, 0);
    if (!young) put(hornAt, cone(0.022, 0.14, 5), horn, 0, 0.23, 0, 0, 0, -0.45);
    put(skull, toBack(cone(0.025, young ? 0.06 : 0.11, 3)), horn, -0.04, -0.03, s * 0.11, s * 0.5, 0, 0);   // jowl spikes
    for (let i = 0; i < 4; i++) put(skull, down(cone(0.012, 0.045, 3)), tooth, 0.17 + i * 0.055, -0.03, s * (0.05 - i * 0.008));
  }
  const jaw = new THREE.Group();
  jaw.position.set(0.04, -0.05, 0);
  skull.add(jaw);
  put(jaw, toX(limb(0.36, 0.075, 0.03, 6)), skin, 0, -0.015, 0).scale.set(1, 0.5, 1);
  put(jaw, toX(limb(0.3, 0.05, 0.02, 6)), belly, 0, -0.03, 0).scale.set(1, 0.4, 1);
  for (const s of [-1, 1]) for (let i = 0; i < 3; i++) put(jaw, cone(0.011, 0.04, 3), tooth, 0.15 + i * 0.065, 0.005, s * (0.042 - i * 0.008));
  const mouth = new THREE.Object3D();
  mouth.position.set(0.44, -0.03, 0);
  skull.add(mouth);
  // The tail: no longer than the body, four segments thinning fast, every other one black, spiked along the top, and a broad
  // club at the end, spiked all round and widest side to side.
  const tail: THREE.Group[] = [];
  parent = group;
  for (let i = 0; i < 4; i++) {
    const seg = new THREE.Group(), r0 = 0.085 - i * 0.012, r1 = r0 - 0.012, T = 0.11;
    seg.position.set(i ? -T : -0.52, i ? 0 : 0.78, 0);
    put(seg, ball(r0 * 0.97), skin, 0, 0, 0);
    put(seg, toBack(limb(T + 0.02, r0, r1)), i % 2 ? mark : skin, 0, 0, 0);
    put(seg, toBack(limb(T + 0.02, r0 * 0.75, r1 * 0.75)), belly, 0, -r0 * 0.42, 0);
    put(seg, cone(0.028 - i * 0.003, 0.1 - i * 0.01), horn, -T * 0.5, r0 * 0.8, 0, 0, 0, 0.5);
    parent.add(seg);
    tail.push(seg);
    parent = seg;
  }
  const club = tail[3]!;
  put(club, ball(0.1), skin, -0.2, 0, 0).scale.set(1.6, 0.7, 1.3);
  for (const [a, b, len] of [[0, 1, 0.14], [0, -1, 0.14], [0.4, 1, 0.11], [0.4, -1, 0.11], [1, 0, 0.09], [-0.5, 1, 0.08], [-0.5, -1, 0.08]] as const) {
    const dir = Math.atan2(b, a);
    for (const dx of [-0.13, -0.24]) put(club, cone(0.03, len), horn, dx, a * 0.04, b * 0.1, dir, 0, 0);   // spikes all round it, longest to the sides
  }
  put(club, toBack(cone(0.04, 0.16)), horn, -0.33, 0, 0);
  const wings = [] as unknown as [THREE.Group, THREE.Group], wrists = [] as unknown as [THREE.Group, THREE.Group];
  for (const s of [1, -1] as const) {
    const w = wing(skin, horn, top, pale, s, young ? 0.62 : 1);
    w.shoulder.position.set(0.28, 1.0, s * 0.1);
    group.add(w.shoulder);
    wings.push(w.shoulder);
    wrists.push(w.wrist);
  }
  return { group, chest, legs, neck, head, jaw, mouth, tail, wings, wrists };
}

const forward = new THREE.Vector3(), at = new THREE.Vector3();
const ease = (k: number) => k * k * (3 - 2 * k);

export const dragon: EntityView<DragonView> = {
  create(ctx, e, g) {
    const d = g.world.need(e, "dragon"), parts = makeDragon(ctx, d.hide), shadow = addShadow(ctx, 1);
    const light = new THREE.PointLight(HIDES[d.hide].light, 0, 8, 1.2);
    parts.mouth.add(light);
    ctx.scene.add(parts.group, shadow);
    return { ...parts, shadow, light, k: (e * 1.37) % 10 };
  },
  update(ctx, v, e, g, f) {
    const d = g.world.need(e, "dragon"), [x, z] = toWorld(d.x, d.y), t = f.t + v.k, grow = Math.max(0.001, d.grow);
    const size = d.size * (grow < 1 ? grow * (1 + Math.sin(grow * Math.PI) * 0.25) : 1);   // a hatchling pops out a little big
    // The beat: a quick, strong downstroke and a slower recovery (the phase runs on faster through the bottom half).
    const flying = d.pose === "fly", p = d.flap + 0.45 * Math.cos(d.flap), beat = Math.sin(p), upstroke = Math.max(0, Math.cos(p));
    // Wings wide at rest, she rears up on her hind legs (rocking back about her middle, lifted to keep them on the ground);
    // head down, she bows forward over what's in front of her, so her face comes right down to it.
    const lift = flying ? 0.5 : d.neck, rear = flying ? 0 : d.spread * 0.42, bow = flying ? 0 : (1 - lift) * (1 - d.spread) * 0.26;
    v.group.position.set(x, d.height + (flying ? -beat * 0.07 * d.size : 0) + (Math.sin(rear) * 0.36 - Math.sin(bow) * 0.18) * size, z);
    v.group.rotation.set(0, -d.facing, rear - bow);
    v.group.scale.setScalar(size);
    v.chest.scale.set(1.2, 0.95 + Math.sin(t * 1.8) * 0.025, 0.5);   // breathing
    for (const leg of v.legs) leg.rotation.z = flying ? -1.1 : 0;   // tucked back under her in flight
    // Wings: beating in flight (up and down about the shoulder, swept a little back on the upstroke); folded at rest.
    v.wings.forEach((w, i) => {
      const s = i ? -1 : 1;
      const wrist = v.wrists[i]!;
      if (flying) {                                          // spread wide on the downstroke; on the way up, half folded and swept back
        w.rotation.set(-s * beat * 0.85, -s * upstroke * 0.25, 0);
        wrist.rotation.set(beat * 0.3, 0.04 - upstroke * 0.6, 0);
      } else {                                               // at rest, folded and leant on in front; or raised wide, rising and falling slowly
        const o = d.spread, up = 0.25 + Math.sin(t * 1.6) * 0.1;
        w.rotation.set(s * (1.2 * (1 - o) - up * o + Math.sin(t * 1.1) * 0.02 * (1 - o)), s * (0.5 * (1 - o) - 0.13 * o), 0);
        wrist.rotation.set(Math.sin(t * 1.6 + 0.6) * 0.08 * o, -1.3 * (1 - o), 0);
      }
    });
    // The neck: out straight in flight, holding the head steady against the beat; at rest, from curled right down (her
    // face nosing at what's in front of her) up to stretched at the sky.
    const curl = [[-0.6, -0.4, -0.15], [0.32, 0.2, 0.12]] as const, low = 1 - lift;
    v.neck.forEach((n, i) => {
      n.rotation.z = flying ? (i ? 0.06 : -0.12) + beat * 0.05 : curl[0][i]! + (curl[1][i]! - curl[0][i]!) * lift;
      n.rotation.y = Math.sin(t * 0.9 + i * 0.7) * (flying ? 0.03 : 0.06 + low * 0.04);
    });
    v.head.rotation.z = flying ? 0.05 - beat * 0.08 : 0.05 + lift * 0.3 + Math.sin(t * 1.3) * 0.06 * low;   // nosing, gently
    v.jaw.rotation.z = -Math.min(0.7, d.fire * 0.7 + (flying ? 0 : lift * 0.1));
    // The tail: streaming behind in flight; at rest held out behind her in a long curve, swaying.
    v.tail.forEach((s, i) => {
      s.rotation.y = (flying ? 0 : 0.14) + Math.sin(t * (flying ? 1.6 : 0.9) - i * 0.7) * (flying ? 0.06 : 0.09);
      s.rotation.z = flying ? Math.sin(p - 1 - i * 0.6) * 0.09 : (i < 2 ? -0.12 : 0.05) + bow * 0.3;   // a ripple down it after each beat
    });
    // The shadow: under her on the ground, as wide as she is.
    v.shadow.position.set(x, SHADOW_Y, z);
    v.shadow.scale.set(size * (flying ? 1.6 : 1.1), 1, size * (flying ? 2.2 : 0.9));
    v.shadow.rotation.y = -d.facing;
    // Her breath, out of her mouth along the way her head points, lighting what's round her.
    v.light.intensity = d.fire * 6 * Math.min(2, d.size);
    if (d.fire > 0.02) {
      v.group.updateMatrixWorld(true);
      v.mouth.getWorldPosition(at);
      forward.set(1, 0, 0).transformDirection(v.head.matrixWorld);
      const big = d.size > 2 ? 2 : 1;                       // the Old Mother's is a column of it
      const [c1, c2] = HIDES[d.hide].breath, speed = 2.2 + 2.2 * Math.sqrt(d.size), n = Math.ceil(d.fire * f.dt * 90 * Math.min(3, d.size) * big);
      for (let i = 0; i < n; i++) {
        const j = () => (Math.random() - 0.5) * 0.35 * speed;
        ctx.particles.spawn(Math.random() < 0.6 ? c1 : c2, at.x, at.y, at.z, forward.x * speed + j(), forward.y * speed + j(), forward.z * speed + j(), 0.45 + Math.random() * 0.5 * Math.sqrt(d.size));
      }
    }
  },
  remove(ctx, v) {
    ctx.scene.remove(v.group, v.shadow);
    disposeTree(v.group);
  },
};

/** An egg's profile, turned: [radius, height]. The bottom half up to the widest; the top from there. */
const EGG: [number, number][] = [[0, 0], [0.1, 0.015], [0.16, 0.07], [0.185, 0.15], [0.18, 0.22]];
const EGG_TOP: [number, number][] = [[0.18, 0.22], [0.16, 0.3], [0.12, 0.37], [0.065, 0.42], [0, 0.445]];
const GOLD = new THREE.Color("#e2b33c"), SHELLS: Record<Egg["school"], string> = { ember: "#d9472a", frost: "#f2f6f8", storm: "#4a44a8" };
/** The light through each one's crack: hot gold, cold blue, a violet flicker. */
const SEAMS: Record<Egg["school"], string> = { ember: "#ffd27a", frost: "#6fcaff", storm: "#d0c0ff" };
const BURST: Record<Egg["school"], [SparkColor, SparkColor]> = { ember: ["fire", "ember"], frost: ["ice", "snow"], storm: ["arcane", "arcaneLight"] };

/** A chip of shell, flying off as it opens: where it is and how fast it's going (world units, the egg's own frame). */
interface Chip { mesh: THREE.Mesh; v: THREE.Vector3; spin: THREE.Vector3 }
interface EggView {
  group: THREE.Group; shadow: THREE.Mesh; lid: THREE.Group; shell: THREE.MeshLambertMaterial; pool: THREE.MeshBasicMaterial; seam: THREE.MeshBasicMaterial;
  light: THREE.PointLight; hue: THREE.Color; gilt: number; open: boolean; chips: Chip[]; k: number;
}

export const egg: EntityView<EggView> = {
  create(ctx, e, g) {
    const s = g.world.need(e, "egg"), hue = new THREE.Color(SHELLS[s.school]), group = new THREE.Group();
    const shell = ctx.lambert(SHELLS[s.school]), pool = ctx.glow(SHELLS[s.school], { transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, ...onGround(GROUND.marker) });
    pool.map = softDisc();
    const egg = new THREE.Group();
    egg.scale.setScalar(1.35);
    group.add(egg);
    egg.add(ctx.lathe(EGG, shell));
    // The top, on a hinge at the back of the crack, so it can be pushed up from inside and tipped off.
    const lid = new THREE.Group();
    lid.position.set(0, 0.22, -0.18);
    egg.add(lid);
    lid.add(ctx.lathe(EGG_TOP, shell));
    lid.children[0]!.position.set(0, -0.22, 0.18);
    // The crack, round its middle where it'll split: a zigzag that glows through as it comes.
    const seam = ctx.glow(SEAMS[s.school], { transparent: true, opacity: 0, depthWrite: false }), up = new THREE.Vector3(0, 0, 1), N = 14;
    const ring = Array.from({ length: N + 1 }, (_, i) => {
      const a = (i / N) * Math.PI * 2;
      return new THREE.Vector3(Math.cos(a) * 0.186, 0.22 + (i % 2 ? 0.028 : -0.02), Math.sin(a) * 0.186);
    });
    for (let i = 0; i < N; i++) {
      const a = ring[i]!, b = ring[i + 1]!, along = b.clone().sub(a), m = new THREE.Mesh(box(0.022, 0.022, along.length()), seam);
      m.position.copy(a).add(b).multiplyScalar(0.5);
      m.quaternion.setFromUnitVectors(up, along.normalize());
      egg.add(m);
    }
    put(group, new THREE.PlaneGeometry(2, 2).rotateX(-Math.PI / 2), pool, 0, 0.03, 0).scale.setScalar(0.8);
    const light = new THREE.PointLight(SHELLS[s.school], 0, 4, 1.5);
    light.position.y = 0.4;
    group.add(light);
    const shadow = addShadow(ctx, 0.45), t = g.world.need(e, "transform"), [x, z] = toWorld(t.x, t.y);
    group.position.set(x, 0, z);
    shadow.position.set(x, SHADOW_Y, z);
    ctx.scene.add(group, shadow);
    // Chips of shell, hidden till it breaks.
    const chips = Array.from({ length: 6 }, () => {
      const mesh = new THREE.Mesh(new THREE.TetrahedronGeometry(0.045, 0).scale(1, 0.35, 1), shell);
      mesh.visible = false;
      group.add(mesh);
      return { mesh, v: new THREE.Vector3(), spin: new THREE.Vector3() };
    });
    return { group, shadow, lid, shell, pool, seam, light, hue, gilt: s.gilt, open: false, chips, k: (e * 0.77) % 10 };
  },
  update(ctx, v, e, g, f) {
    const s = g.world.need(e, "egg"), p = v.group.position, t = f.t + v.k, [a, b] = BURST[s.school];
    // The gilding: gold over its own colour; as it comes off, flakes of gold go up off it.
    v.shell.color.copy(v.hue).lerp(GOLD, s.gilt);
    v.shell.emissive.copy(v.hue).multiplyScalar(s.glow * 0.45);
    const flaked = v.gilt - s.gilt;
    if (flaked > 0) for (let i = 0; i < Math.ceil(flaked * 60); i++) {
      const ang = Math.random() * Math.PI * 2;
      ctx.particles.spawn(Math.random() < 0.5 ? "spark" : "sparkLight", p.x + Math.cos(ang) * 0.2, 0.15 + Math.random() * 0.45, p.z + Math.sin(ang) * 0.2, Math.cos(ang) * 0.6, 0.8 + Math.random(), Math.sin(ang) * 0.6, 0.9);
    }
    v.gilt = s.gilt;
    const pale = s.school === "frost" ? 0.4 : 1;              // white glows white-hot: less of it
    v.pool.opacity = s.glow * pale * (0.7 + Math.sin(t * 3) * 0.15);
    v.light.intensity = s.glow * pale * 2.5;
    // Near hatching: it rocks in fits and starts (a bout of little wobbles, then still), more and harder the nearer, the
    // crack glowing brighter with each bout.
    const bout = Math.pow(Math.max(0, Math.sin(t * (1.6 + s.crack * 1.6))), 6), rock = s.open ? 0 : s.crack * (0.03 + 0.2 * bout);
    v.seam.opacity = s.hatch > 0.3 ? 0 : Math.max(0, (s.crack - 0.2) / 0.8) * (0.55 + 0.45 * bout);
    v.group.rotation.set(Math.sin(t * 21) * rock, 0, Math.cos(t * 17) * rock);
    // Breaking open: the top pushed up from inside and tipped back on its hinge; then off it goes, tumbling down into
    // the grass behind; a few chips of shell fly and land, and a little puff of its colour.
    const up = Math.min(1, s.hatch / 0.35), off = ease(Math.max(0, (s.hatch - 0.35) / 0.65));
    v.lid.position.set(0.04 * off, 0.22 + 0.04 * up - 0.42 * off * off, -0.18 - 0.22 * off);
    v.lid.rotation.set(-0.75 * up - 1.9 * off, 0, 0.5 * off);
    if (s.open && !v.open) {
      for (const c of v.chips) {
        const ang = Math.random() * Math.PI * 2, sp = 0.5 + Math.random() * 0.9;
        c.mesh.visible = true;
        c.mesh.position.set(Math.cos(ang) * 0.15, 0.38, Math.sin(ang) * 0.15);
        c.v.set(Math.cos(ang) * sp, 1.2 + Math.random() * 1.2, Math.sin(ang) * sp);
        c.spin.set(Math.random() * 12, Math.random() * 12, Math.random() * 12);
      }
      for (let i = 0; i < 14; i++) {
        const ang = Math.random() * Math.PI * 2, sp = 0.3 + Math.random() * 0.8;
        ctx.particles.spawn(i % 2 ? a : b, p.x, 0.4, p.z, Math.cos(ang) * sp, 0.6 + Math.random(), Math.sin(ang) * sp, 0.5 + Math.random() * 0.4);
      }
    }
    for (const c of v.chips) {                               // falling, and lying where they land
      if (!c.mesh.visible || c.mesh.position.y <= 0.012) continue;
      c.v.y -= 7 * f.dt;
      c.mesh.position.addScaledVector(c.v, f.dt);
      c.mesh.rotation.x += c.spin.x * f.dt; c.mesh.rotation.y += c.spin.y * f.dt; c.mesh.rotation.z += c.spin.z * f.dt;
      if (c.mesh.position.y <= 0.012) { c.mesh.position.y = 0.012; c.mesh.rotation.set(0, c.mesh.rotation.y, 0); }
    }
    v.open = s.open;
  },
  remove(ctx, v) {
    ctx.scene.remove(v.group, v.shadow);
    disposeTree(v.group);
  },
};
