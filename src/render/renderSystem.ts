// Keeps one view per renderable entity: creates views for new entities, updates them every frame
// (in the registry's order), and removes views whose entities are gone.
//
// A view out of the camera's reach is left as it was, hidden: not posed, and its matrices not worked out
// (a city has dozens of people about, most of them streets away, each a body of fifty-odd parts). When it
// comes back into reach it's shown as it was and updated at once, with the time it was away (up to a
// second) so that what eases (a turn, a sit, a fade) has caught up before it's seen.
import * as THREE from "three";
import type { Entity } from "../core/ecs.ts";
import type { Game } from "../game/game.ts";
import { toWorld, type RenderContext } from "./context.ts";
import { VIEWS, viewRoots, type EntityView, type Frame, type ViewKind } from "./views.ts";

const KINDS = Object.keys(VIEWS) as ViewKind[];
const viewOf = (kind: ViewKind) => VIEWS[kind] as EntityView<object>;
/** How far round an entity's spot its view may reach (a loot beam, a spell's ring), and a margin past that (world units). */
const REACH = 4;
/** The most time a view coming back into reach catches up in one go (s). */
const CATCH_UP = 1;

interface Live {
  kind: ViewKind;
  view: object;
  roots: THREE.Object3D[];
  /** Out of reach: hidden, with how its roots were (shown or not) to put back, and how long it's been away. */
  away: { shown: boolean[]; time: number } | null;
}

export function createRenderSystem(ctx: RenderContext, camera: THREE.Camera): (g: Game, frame: Frame) => void {
  const live = new Map<Entity, Live>();
  const frustum = new THREE.Frustum(), viewProj = new THREE.Matrix4(), reach = new THREE.Sphere(new THREE.Vector3(), REACH);
  const inReach = (g: Game, e: Entity) => {
    const o = g.world.get(e, "transform");
    if (!o) return true;
    const [x, z] = toWorld(o.x, o.y);
    reach.center.set(x, 1, z);
    return frustum.intersectsSphere(reach);
  };
  return (g, frame) => {
    frustum.setFromProjectionMatrix(viewProj.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse));
    const byKind = new Map<ViewKind, Entity[]>(KINDS.map(k => [k, []]));
    for (const [e, { renderable }] of g.world.query("renderable")) {
      if (renderable.kind !== "hero") byKind.get(renderable.kind)!.push(e);
    }
    const seen = new Set<Entity>();
    for (const kind of KINDS) {
      const def = viewOf(kind);
      for (const e of byKind.get(kind)!) {
        seen.add(e);
        let rec = live.get(e);
        if (!rec) {
          const view = def.create(ctx, e, g);
          live.set(e, (rec = { kind, view, roots: viewRoots(def, view), away: null }));
        }
        if (!inReach(g, e)) {
          if (rec.away) rec.away.time += frame.dt;
          else {
            rec.away = { shown: rec.roots.map(o => o.visible), time: 0 };
            for (const o of rec.roots) { o.visible = false; o.matrixWorldAutoUpdate = false; }
          }
          continue;
        }
        let f = frame;
        if (rec.away) {                                      // back in reach: as it was, caught up
          rec.roots.forEach((o, i) => { o.visible = rec!.away!.shown[i]!; o.matrixWorldAutoUpdate = true; });
          f = { ...frame, dt: Math.min(CATCH_UP, rec.away.time + frame.dt) };
          rec.away = null;
        }
        def.update(ctx, rec.view, e, g, f);
      }
    }
    for (const [e, rec] of live) {
      if (seen.has(e)) continue;
      viewOf(rec.kind).remove(ctx, rec.view);
      live.delete(e);
    }
  };
}
