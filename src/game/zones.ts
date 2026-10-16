// Where to arrive in each area, for getting about quickly in development (src/debug.ts, ?area=hollow): the way in a
// player would usually come, the level and gear they'd have by then, and the gates behind them already open. Areas
// not listed here are reached by a fresh run's hero, with the starter kit, through their first way in.
import { CINDER_READY } from "../data/ashwild.ts";
import { CINDERS_BRAND, RIME_CIRCLET, RIME_READY } from "../data/hollow.ts";
import type { KitPiece } from "../data/items.ts";
import type { Game } from "./game.ts";
import { passBarricade } from "./watchword.ts";
import { passYssa } from "./yssa.ts";

export interface Zone {
  /** The way in a player would come (one of the area's arrival points). */
  entry: string;
  /** The level, what he's wearing, and anything else he'd be carrying by then (besides the starter kit). */
  ready?: { level: number; kit: readonly KitPiece[]; bag?: readonly KitPiece[] };
  /** Open the gates he'd have come through to get here. */
  passed?(g: Game): void;
}

export const ZONES: Record<string, Zone> = {
  witchwood: { entry: "start" },
  kingsroad: { entry: "cave" },
  capital: { entry: "southgate" },
  castle: { entry: "town" },
  throneroom: { entry: "door" },
  undercroft: { entry: "steps" },
  sealchamber: { entry: "door" },
  /** Under the hill, where a Fey Acorn takes him (src/game/underhill.ts): straight in, without the journey (so it doesn't count as a visit). */
  underhill: { entry: "arrive" },
  /** Through the barricade, kitted as he'd be on the way to Cinder. */
  ashwild: { entry: "witchwood", ready: CINDER_READY, passed: passBarricade },
  /** Down Yssa's track, with Cinder's Brand in hand and Rime's gear on; the hunter's longbow is still in his hut. */
  hollow: {
    entry: "ashwild",
    ready: { level: 6, kit: [CINDERS_BRAND, ...RIME_READY.kit.filter(([type]) => type !== "bow")] },
    passed: g => { passBarricade(g); passYssa(g, "name"); },
  },
  /** In from the Hollow, kitted as he'd be on first coming down there (the starter kit has the pole). */
  grotto: {
    entry: "hollow",
    ready: { level: 6, kit: [CINDERS_BRAND, ...RIME_READY.kit.filter(([type]) => type !== "bow")] },
    passed: g => { passBarricade(g); passYssa(g, "name"); },
  },
  /** Up the frozen stream, with everything from the Hollow: the longbow in hand, Rime's circlet on, Cinder's Brand in the bag. */
  rift: {
    entry: "hollow",
    ready: { level: 8, kit: RIME_READY.kit.map(piece => (piece[0] === "hood" ? RIME_CIRCLET : piece)), bag: RIME_READY.bag },
    passed: g => { passBarricade(g); passYssa(g, "name"); passYssa(g, "river"); },
  },
};
