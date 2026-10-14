// The target ring: a slowly turning, dashed circle on the ground under whatever you're targeting.
// Red for hostile targets, yellow for neutral ones, WoW style.
import * as THREE from "three";
import { PAL } from "../data/palette.ts";
import type { Game } from "../game/game.ts";
import { PX_PER_TILE, toWorld, type RenderContext } from "./context.ts";

export interface TargetRing {
  update(g: Game, t: number): void;
}

/**
 * A soft dashed ring, white on a soft dark halo, so it reads on any ground (even in firelight)
 * without hard edges. The material colour tints the white; the halo stays dark.
 */
function ringTexture(): THREE.CanvasTexture {
  const N = 128, c = document.createElement("canvas");
  c.width = c.height = N;
  const g = c.getContext("2d")!, img = g.createImageData(N, N);
  const smooth = (a: number, b: number, x: number) => { const k = Math.max(0, Math.min(1, (x - a) / (b - a))); return k * k * (3 - 2 * k); };
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const dx = ((x + 0.5) / N) * 2 - 1, dy = ((y + 0.5) / N) * 2 - 1, r = Math.hypot(dx, dy);
    // Four dashes with feathered ends.
    const a = (Math.atan2(dy, dx) + Math.PI * 2) % (Math.PI / 2), dash = smooth(0.1, 0.24, a) * smooth(0.1, 0.24, Math.PI / 2 - a);
    const band = smooth(0.6, 0.72, r) * (1 - smooth(0.84, 0.94, r));     // the bright ring
    const halo = smooth(0.46, 0.64, r) * (1 - smooth(0.9, 1.0, r));      // a soft dark edge around it
    const light = band * dash, alpha = Math.max(light, halo * dash * 0.6);
    const i = (y * N + x) * 4, v = Math.round(255 * (alpha > 0 ? light / alpha : 0));
    img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
    img.data[i + 3] = Math.round(255 * alpha);
  }
  g.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function createTargetRing(ctx: RenderContext): TargetRing {
  const mat = ctx.basic(PAL.R, {
    map: ringTexture(), transparent: true, opacity: 1, depthWrite: false,
    // Pull it toward the camera in depth so it never fights the ground, scorch marks or glows.
    polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -16,
  });
  const ring = new THREE.Mesh(new THREE.PlaneGeometry(2, 2).rotateX(-Math.PI / 2), mat);
  ring.renderOrder = 2;
  ring.visible = false;
  ctx.scene.add(ring);
  let colorFor: boolean | null = null;

  return {
    update(g, t) {
      const e = g.target, at = e !== null ? g.world.get(e, "transform") : undefined, target = e !== null ? g.world.get(e, "targetable") : undefined;
      ring.visible = !!(at && target);
      if (!at || !target) return;
      if (colorFor !== target.hostile) { mat.color.set(target.hostile ? PAL.R : PAL.Y); colorFor = target.hostile; }
      const [x, z] = toWorld(at.x, at.y);
      ring.position.set(x, 0.03, z);
      ring.rotation.y = t * 0.8;
      ring.scale.setScalar((target.radius / PX_PER_TILE) * 1.1 * (1 + Math.sin(t * 4) * 0.03));
    },
  };
}
