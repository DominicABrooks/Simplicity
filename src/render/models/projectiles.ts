import * as THREE from "three";
import type { BoltKind } from "../../data/enemies.ts";
import { PAL } from "../../data/palette.ts";
import { box, col, type RenderContext } from "../context.ts";

/** Arrow: oak shaft along +X, stone head, ember fletching. The head glows on a power shot. */
export function makeArrowMesh(ctx: RenderContext, power = false): THREE.Group & { userData: { tip: THREE.Mesh<THREE.BufferGeometry, THREE.MeshLambertMaterial> } } {
  const { lambert } = ctx, g = new THREE.Group();
  const shaft = new THREE.Mesh(box(0.42, 0.025, 0.025), lambert(PAL.N)); shaft.position.x = 0.21;
  const tip = new THREE.Mesh(new THREE.ConeGeometry(0.035, 0.09, 4).rotateZ(-Math.PI / 2), lambert(PAL.w, { emissive: col(PAL.Y), emissiveIntensity: power ? 1 : 0 }));
  tip.position.x = 0.45;
  // Two vanes crossed, so the fletching still reads from above, not just side on.
  const feather = lambert(PAL.R);
  const fletch = [box(0.1, 0.06, 0.01), box(0.1, 0.01, 0.06)].map(geo => { const m = new THREE.Mesh(geo, feather); m.position.x = 0.04; return m; });
  g.add(shaft, tip, ...fletch);
  g.userData.tip = tip;
  return g as THREE.Group & { userData: { tip: typeof tip } };
}

/** Spell orbs: a solid core in a glowing shell. Mages hold them while charging; bolts fly as them. */
export const ORB_COLORS: Record<BoltKind, [string, string]> = { fire: [PAL.Y, PAL.R], poly: ["#e6d2ff", PAL.P], frost: [PAL.W, PAL.C], spark: ["#ffffff", PAL.Y], wisp: ["#eafff8", "#6fd3c0"], icicle: ["#f2fbff", "#9fe3ff"] };

/**
 * The cold ones (frost bolts, Rime's icicles) are fought on snow and ice, where a white core in an added-on glow
 * vanishes into the white. So they're solid instead: a deep blue body, a pale glint down it, and an ink outline all
 * round (a slightly bigger copy, drawn inside out), so they read on white as well as on grass.
 */
const COLD = new Set<BoltKind>(["frost", "icicle"]);
const COLD_BODY = "#2f6fe8", COLD_GLINT = "#e6f7ff", INK = "#14101e";

export function makeOrbMesh(ctx: RenderContext, kind: BoltKind = "fire"): THREE.Group {
  const g = new THREE.Group(), [core, shell] = ORB_COLORS[kind];
  const outline = () => ctx.basic(INK, { side: THREE.BackSide });
  if (kind === "icicle") {                                    // not an orb: an icicle, point along +X; big, to read at a glance
    g.add(new THREE.Mesh(new THREE.ConeGeometry(0.13, 0.8, 5).rotateZ(-Math.PI / 2), ctx.glow(COLD_BODY)));
    g.add(new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.6, 4).rotateZ(-Math.PI / 2).translate(0.04, 0.05, 0), ctx.glow(COLD_GLINT)));
    g.add(new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.95, 5).rotateZ(-Math.PI / 2).translate(-0.02, 0, 0), outline()));
    return g;
  }
  if (COLD.has(kind)) {                                       // a frost bolt: a pale core in a solid blue shell, outlined
    g.add(new THREE.Mesh(new THREE.IcosahedronGeometry(0.1, 0), ctx.glow(COLD_GLINT)));
    g.add(new THREE.Mesh(new THREE.IcosahedronGeometry(0.16, 0), ctx.glow(COLD_BODY, { transparent: true, opacity: 0.8, depthWrite: false })));
    g.add(new THREE.Mesh(new THREE.IcosahedronGeometry(0.2, 0), outline()));
    return g;
  }
  g.add(new THREE.Mesh(new THREE.IcosahedronGeometry(0.1, 0), ctx.glow(core)));
  g.add(new THREE.Mesh(new THREE.IcosahedronGeometry(0.17, 0), ctx.glow(shell, { transparent: true, opacity: 0.6, depthWrite: false, blending: THREE.AdditiveBlending })));
  return g;
}
