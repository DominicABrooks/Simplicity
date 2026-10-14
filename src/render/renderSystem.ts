// Keeps one view per renderable entity: creates views for new entities, updates them every frame
// (in the registry's order), and removes views whose entities are gone.
import type { Entity } from "../core/ecs.ts";
import type { Game } from "../game/game.ts";
import type { RenderContext } from "./context.ts";
import { VIEWS, type EntityView, type Frame, type ViewKind } from "./views.ts";

const KINDS = Object.keys(VIEWS) as ViewKind[];
const viewOf = (kind: ViewKind) => VIEWS[kind] as EntityView<object>;

export function createRenderSystem(ctx: RenderContext): (g: Game, frame: Frame) => void {
  const live = new Map<Entity, { kind: ViewKind; view: object }>();
  return (g, frame) => {
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
        if (!rec) live.set(e, (rec = { kind, view: def.create(ctx, e, g) }));
        def.update(ctx, rec.view, e, g, frame);
      }
    }
    for (const [e, rec] of live) {
      if (seen.has(e)) continue;
      viewOf(rec.kind).remove(ctx, rec.view);
      live.delete(e);
    }
  };
}
