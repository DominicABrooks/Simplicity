// Scenery props: one builder per kind of prop. An area lists its props as data (src/areas/*); the
// renderer builds each from this registry into the area's scenery group, which is freed when you leave.
// A new kind of building is a Prop variant (src/world/area.ts) plus one entry here.
import type * as THREE from "three";
import type { Prop } from "../world/area.ts";
import { buildCamp } from "./camp.ts";
import {
  buildBarbican, buildBrazier, buildCart, buildDrawbridge, buildHorse, buildRack, buildSmithy, buildStable, buildStairs,
  buildTorch, buildTrebuchet, buildTrough, buildWell,
} from "./castle.ts";
import { buildCave } from "./cave.ts";
import { buildCathedral, buildChapterHouse, buildChurch, buildCloister, buildCross, buildDovecote, buildGraves, buildHall, buildLion } from "./civic.ts";
import type { RenderContext } from "./context.ts";
import { buildBoat, buildCrane, buildFence, buildField, buildGrandstand, buildPavilion, buildStoneBridge, buildWatermill, buildWindmill } from "./country.ts";
import { buildFurniture, buildRoom } from "./interior.ts";
import { buildLamp } from "./lamp.ts";
import { buildBunting, buildFountain, buildPlaza, buildStall, buildStandard, buildStock } from "./market.ts";
import type { Occluder } from "./occlusion.ts";
import { buildBridge, buildCurtainWall, buildHouse, buildKeep } from "./town.ts";
import { buildArena, buildBarricade, buildCrack, buildGreatCrack } from "./wild.ts";
import { buildCrypt, buildCryptDoor, buildStoneRing, buildTomb, buildVaelNest } from "./undercroft.ts";
import { buildOldStone, buildRimeStage } from "./hollow.ts";
import { buildIceWalls } from "./grotto.ts";
import { buildFairyRing } from "./fey.ts";

/** What a built prop gives back: a per-frame update if it animates, and occluders if it's tall. */
export type PropView = { update?(t: number, dt: number): void; occluders?: Occluder[] } | void;

type Builder<K extends Prop["kind"]> = (ctx: RenderContext, parent: THREE.Group, prop: Extract<Prop, { kind: K }>) => PropView;

export const PROP_BUILDERS: { [K in Prop["kind"]]: Builder<K> } = {
  camp: buildCamp,
  cave: buildCave,
  // The town (town.ts) and its great buildings (civic.ts).
  curtainWall: buildCurtainWall,
  house: buildHouse,
  keep: buildKeep,
  bridge: buildBridge,
  hall: buildHall,
  church: buildChurch,
  cathedral: buildCathedral,
  cloister: buildCloister,
  chapterHouse: buildChapterHouse,
  graves: buildGraves,
  cross: buildCross,
  dovecote: buildDovecote,
  lion: buildLion,
  // Gates, walls and the castle (castle.ts).
  barbican: buildBarbican,
  drawbridge: buildDrawbridge,
  stairs: buildStairs,
  torch: buildTorch,
  stable: buildStable,
  guard: () => undefined,                                   // a game entity (see spawnGuard), drawn by its view
  king: () => undefined,                                    // a game entity too (see spawnKing)
  brazier: buildBrazier,
  dummy: () => undefined,                                   // a game entity (see spawnDummy), drawn by its view
  target: () => undefined,                                  // a game entity (see spawnTraining), drawn by its view
  rack: buildRack,
  well: buildWell,
  smithy: buildSmithy,
  trebuchet: buildTrebuchet,
  cart: buildCart,
  horse: buildHorse,
  trough: buildTrough,
  // The country and the river (country.ts).
  stoneBridge: buildStoneBridge,
  windmill: buildWindmill,
  watermill: buildWatermill,
  boat: buildBoat,
  crane: buildCrane,
  fence: buildFence,
  pavilion: buildPavilion,
  grandstand: buildGrandstand,
  field: buildField,
  // The market (market.ts).
  fountain: buildFountain,
  stall: buildStall,
  stock: buildStock,
  bunting: buildBunting,
  standard: buildStandard,
  lamp: buildLamp,
  plaza: buildPlaza,
  room: buildRoom,
  furniture: buildFurniture,
  barricade: buildBarricade,
  crack: buildCrack,
  greatCrack: buildGreatCrack,
  arena: buildArena,
  cryptDoor: buildCryptDoor,
  crypt: buildCrypt,
  vaelNest: buildVaelNest,
  tomb: buildTomb,
  stoneRing: buildStoneRing,
  oldStone: buildOldStone,
  rimeStage: buildRimeStage,
  iceWalls: buildIceWalls,
  fairyRing: buildFairyRing,
  boss: () => undefined,                                    // a game entity (see src/game/bosses.ts), drawn by its view
};

/** Build one prop; returns its per-frame update (if it animates) and occluders (if it's tall). */
export function buildProp(ctx: RenderContext, parent: THREE.Group, prop: Prop): { update: ((t: number, dt: number) => void) | null; occluders: Occluder[] } {
  const view = (PROP_BUILDERS[prop.kind] as Builder<Prop["kind"]>)(ctx, parent, prop as never);
  return { update: view && view.update ? view.update.bind(view) : null, occluders: (view && view.occluders) || [] };
}
