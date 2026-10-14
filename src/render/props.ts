// Scenery props: one builder per kind of prop. An area lists its props as data (src/areas/*); the
// renderer builds each from this registry into the area's scenery group, which is freed when you leave.
// A new kind of building is a Prop variant (src/world/area.ts) plus one entry here.
import type * as THREE from "three";
import type { Prop } from "../world/area.ts";
import { buildCamp } from "./camp.ts";
import { buildBrazier, buildCart, buildDummy, buildGuard, buildHorse, buildRack, buildSmithy, buildTarget, buildTrebuchet, buildTrough, buildWell } from "./castle.ts";
import { buildCave } from "./cave.ts";
import type { RenderContext } from "./context.ts";
import type { Occluder } from "./occlusion.ts";
import { buildBench, buildBunting, buildFountain, buildPlanter, buildPlaza, buildStall, buildStandard, buildStatue, buildStock } from "./market.ts";
import { buildBridge, buildCathedral, buildCurtainWall, buildHouse, buildKeep, buildLamp } from "./town.ts";

/** What a built prop gives back: a per-frame update if it animates, and occluders if it's tall. */
export type PropView = { update?(t: number, dt: number): void; occluders?: Occluder[] } | void;

type Builder<K extends Prop["kind"]> = (ctx: RenderContext, parent: THREE.Group, prop: Extract<Prop, { kind: K }>) => PropView;

export const PROP_BUILDERS: { [K in Prop["kind"]]: Builder<K> } = {
  camp: buildCamp,
  cave: buildCave,
  curtainWall: buildCurtainWall,
  cathedral: buildCathedral,
  bridge: buildBridge,
  house: buildHouse,
  keep: buildKeep,
  lamp: buildLamp,
  fountain: buildFountain,
  stall: buildStall,
  statue: buildStatue,
  planter: buildPlanter,
  bench: buildBench,
  stock: buildStock,
  bunting: buildBunting,
  standard: buildStandard,
  plaza: buildPlaza,
  guard: buildGuard,
  brazier: buildBrazier,
  dummy: buildDummy,
  target: buildTarget,
  rack: buildRack,
  well: buildWell,
  smithy: buildSmithy,
  trebuchet: buildTrebuchet,
  cart: buildCart,
  horse: buildHorse,
  trough: buildTrough,
};

/** Build one prop; returns its per-frame update (if it animates) and occluders (if it's tall). */
export function buildProp(ctx: RenderContext, parent: THREE.Group, prop: Prop): { update: ((t: number, dt: number) => void) | null; occluders: Occluder[] } {
  const view = (PROP_BUILDERS[prop.kind] as Builder<Prop["kind"]>)(ctx, parent, prop as never);
  return { update: view && view.update ? view.update.bind(view) : null, occluders: (view && view.occluders) || [] };
}
