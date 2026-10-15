// The target ring: a slowly turning, dashed circle on the ground under whatever you're targeting.
// Red for hostile targets, yellow for neutral ones, WoW style.
import * as THREE from "three";
import { PAL } from "../data/palette.ts";
import { T } from "../data/world.ts";
import type { Game } from "../game/game.ts";
import type { Prop } from "../world/area.ts";
import { GROUND, MARKER_Y, PX_PER_TILE, onGround, toWorld, type RenderContext } from "./context.ts";

export interface TargetRing {
  /** The area's props: the ring lifts onto any bridge deck its target stands on. */
  setProps(props: readonly Prop[]): void;
  update(g: Game, t: number): void;
}

/** Each bridge's deck: how high its top stands, and how far it runs past its rect each way (see their builders). */
const DECKS = {
  bridge: { top: 0.15, w: 0.5, len: 1.2 },
  stoneBridge: { top: 0.06, w: 0.6, len: 1.2 },
  drawbridge: { top: 0.045, w: 0.4, len: 0.6 },
} as const;

export function createTargetRing(ctx: RenderContext): TargetRing {
  const mat = ctx.glow(PAL.R, { transparent: true, opacity: 0.85, depthWrite: false, side: THREE.DoubleSide, ...onGround(GROUND.marker) });
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
  let decks: { x0: number; x1: number; z0: number; z1: number; top: number }[] = [];

  return {
    setProps(props) {
      decks = props.flatMap(p => {
        if (p.kind !== "bridge" && p.kind !== "stoneBridge" && p.kind !== "drawbridge") return [];
        const d = DECKS[p.kind], cx = (p.rect.x + p.rect.w / 2) / T, cz = (p.rect.y + p.rect.h / 2) / T;
        const hw = (p.rect.w / T + d.w) / 2, hl = (p.rect.h / T + d.len) / 2;
        return [{ x0: cx - hw, x1: cx + hw, z0: cz - hl, z1: cz + hl, top: d.top }];
      });
    },

    update(g, t) {
      const e = g.target, at = e !== null ? g.world.get(e, "transform") : undefined, target = e !== null ? g.world.get(e, "targetable") : undefined;
      ring.visible = !!(at && target);
      if (!at || !target) return;
      if (colorFor !== target.hostile) { mat.color.set(target.hostile ? PAL.R : PAL.Y); colorFor = target.hostile; }
      const [x, z] = toWorld(at.x, at.y);
      const deck = decks.reduce((top, d) => (x >= d.x0 && x <= d.x1 && z >= d.z0 && z <= d.z1 ? Math.max(top, d.top) : top), 0);
      ring.position.set(x, deck + MARKER_Y, z);
      ring.rotation.y = t * 0.8;
      ring.scale.setScalar((target.radius / PX_PER_TILE) * (1 + Math.sin(t * 4) * 0.04));
    },
  };
}
