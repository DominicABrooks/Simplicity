// The target ring: a slowly turning, dashed circle on the ground under whatever you're targeting.
// Red for hostile targets, yellow for neutral ones, WoW style.
import * as THREE from "three";
import { PAL } from "../data/palette.ts";
import type { Game } from "../game/game.ts";
import { GROUND, MARKER_Y, PX_PER_TILE, onGround, toWorld, type RenderContext } from "./context.ts";

export interface TargetRing {
  update(g: Game, t: number): void;
}

export function createTargetRing(ctx: RenderContext): TargetRing {
  const mat = ctx.basic(PAL.R, { transparent: true, opacity: 0.85, depthWrite: false, side: THREE.DoubleSide, ...onGround(GROUND.marker) });
  const ring = new THREE.Group();
  // Four arcs with gaps between them, on a unit circle; scaled to each target's radius. Each sits on
  // a slightly bigger ink arc, so the ring reads on any ground (even in the campfire's glow).
  const ink = ctx.basic(PAL.K, { transparent: true, opacity: 0.6, depthWrite: false, side: THREE.DoubleSide, ...onGround(GROUND.marker) });
  for (let i = 0; i < 4; i++) {
    const start = (i * Math.PI) / 2 + 0.18, len = Math.PI / 2 - 0.36;
    const outline = new THREE.Mesh(new THREE.RingGeometry(0.8, 1.06, 8, 1, start - 0.06, len + 0.12).rotateX(-Math.PI / 2), ink);
    const arc = new THREE.Mesh(new THREE.RingGeometry(0.86, 1, 8, 1, start, len).rotateX(-Math.PI / 2), mat);
    arc.position.y = 0.004;
    outline.renderOrder = 1;
    arc.renderOrder = 2;
    ring.add(outline, arc);
  }
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
      ring.position.set(x, MARKER_Y, z);
      ring.rotation.y = t * 0.8;
      ring.scale.setScalar((target.radius / PX_PER_TILE) * (1 + Math.sin(t * 4) * 0.04));
    },
  };
}
