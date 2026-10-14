// Scenery props: one builder per kind of prop. An area lists its props as data (src/areas/*); the
// renderer builds each from this registry into the area's scenery group, which is freed when you leave.
// A new kind of building is a Prop variant (src/world/area.ts) plus one entry here.
import type * as THREE from "three";
import type { Prop } from "../world/area.ts";
import { buildCamp } from "./camp.ts";
import { buildCave } from "./cave.ts";
import type { RenderContext } from "./context.ts";
import { buildCityWall, buildFountain, buildHouse, buildKeep, buildLamp, buildStall } from "./town.ts";

/** What a built prop needs every frame, if it animates. */
export type PropView = { update?(t: number, dt: number): void } | void;

type Builder<K extends Prop["kind"]> = (ctx: RenderContext, parent: THREE.Group, prop: Extract<Prop, { kind: K }>) => PropView;

export const PROP_BUILDERS: { [K in Prop["kind"]]: Builder<K> } = {
  camp: buildCamp,
  cave: buildCave,
  cityWall: buildCityWall,
  house: buildHouse,
  keep: buildKeep,
  fountain: buildFountain,
  stall: buildStall,
  lamp: buildLamp,
};

/** Build one prop; returns its per-frame update, if it has one. */
export function buildProp(ctx: RenderContext, parent: THREE.Group, prop: Prop): ((t: number, dt: number) => void) | null {
  const view = (PROP_BUILDERS[prop.kind] as Builder<Prop["kind"]>)(ctx, parent, prop as never);
  return view && view.update ? view.update.bind(view) : null;
}
