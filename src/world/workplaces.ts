// Where a craft is worked out in the open, shared by the townsfolk who work there (src/game/townsfolk.ts)
// and the scenery drawn for it (src/render/castle.ts), so the smith and the anvil meet.
import { T, type Rect } from "../data/world.ts";
import type { TileXY } from "./walkways.ts";

/**
 * A smithy's anvil and where the smith stands to work it. The anvil stands out in front of the smithy (it faces
 * south), on its own stump just in the yard; the smith stands on the tile to its west, hammering east, so he's
 * side-on to the camera with the anvil in plain view. `x`, `y`: the anvil's middle, in tiles.
 */
export function anvilOf(rect: Rect): { stand: TileXY; x: number; y: number } {
  const tx = Math.floor((rect.x + rect.w / 2) / T), ty = Math.floor((rect.y + rect.h) / T);
  return { stand: [tx - 1, ty], x: tx + 0.15, y: ty + 0.45 };
}

/** Who works an anvil: smiths, armourers and farriers, not their apprentices or helpers (they fetch and carry). */
export const ANVIL_WORK = /^(master )?(armourer|blacksmith|smith|farrier)$/i;

/** The other trades of a smithy's yard, and the work each is seen at there. */
export type YardTask = "stave" | "fletch" | "stitch" | "grind";
/**
 * What someone who works at a smithy does in its yard, if not at the anvil: bowyers (and their people) shave
 * bow staves; fletchers fletch arrows; the harness-maker stitches leather; and the smith's journeymen, the
 * farriers, and a smith whose anvil's taken grind blades at the grindstone.
 */
export function yardTask(job: string): YardTask | null {
  if (/bowyer/i.test(job)) return "stave";
  if (/fletcher/i.test(job)) return "fletch";
  if (/harness-maker/i.test(job)) return "stitch";
  if (ANVIL_WORK.test(job) || /^journeyman\b|farrier|armourer/i.test(job)) return "grind";
  return null;
}

/**
 * The stations round a smithy's yard (the smithy faces south, its anvil out front: anvilOf): two bowyers'
 * places along its west wall and the fletchers' and harness-maker's along its east, each turned to the camera
 * to show their hands' work; and a grindstone out front to the east of the anvil, its grinder side-on facing
 * west, its wheel between him and the smith.
 */
export function yardOf(rect: Rect): { tile: TileXY; face: number; task: YardTask }[] {
  const x0 = Math.floor(rect.x / T), y0 = Math.floor(rect.y / T), R = Math.ceil((rect.x + rect.w) / T), B = Math.ceil((rect.y + rect.h) / T), south = Math.PI / 2;
  return [
    // Staggered, never one straight behind another, where the camera would see only the one in front.
    { tile: [x0 - 1, y0 + 1], face: south, task: "stave" }, { tile: [x0 - 2, y0 + 2], face: south, task: "stave" },
    { tile: [R, y0 + 1], face: south, task: "fletch" }, { tile: [R + 2, y0 + 2], face: south, task: "fletch" },
    { tile: [R + 1, y0], face: south, task: "stitch" },
    { tile: [R + 1, B], face: Math.PI, task: "grind" },
  ];
}

/** Who plays to the market crowd at the fountain. */
export const MUSIC_WORK = /^(minstrel|bard)\b/i;

/** Who sweeps the square (and their helpers): the sweeps, the dung-carters, the lamplighter by day. */
export const BROOM_WORK = /\bsweep\b|dung-carter/i;
/** Who does the washing at a well: laundresses and washerwomen (and their helpers), whoever takes it in. */
export const WASH_WORK = /laundress|washerwoman|washing/i;
/** Who draws water at a well, winding up the bucket. */
export const WATER_WORK = /water-carrier|carries water/i;
/** Travellers who ply their trade on the square: grinding knives, mending pots, telling tales. */
export const SQUARE_TRADES: readonly [RegExp, "grind" | "tinker" | "tell"][] = [[/^knife-grinder\b/i, "grind"], [/^tinker\b/i, "tinker"], [/^storyteller\b/i, "tell"]];
/** Who carves stone in St Mary's churchyard: the masons and the carver, not their labourers (they fetch and carry). */
export const MASON_WORK = /^(master |journeyman )?mason$|carver/i;
/**
 * The trades worked at home, and what each is seen at on a bench by the front door in working hours (as a
 * medieval shop opened onto the street): a cooper hammering the hoops down a barrel; shoemakers, saddlers,
 * glovers and net-menders stitching; tailors and seamstresses sewing; pewterers, goldsmiths and ironmongers
 * tapping out their wares; a carpenter at his saw; a dyer and a brewer stirring their vats; a spinner with
 * her spindle. The masters and their apprentices, not the helpers or the retired.
 */
export const HOME_TRADES: readonly [RegExp, "hoop" | "stitch" | "sew" | "pewter" | "saw" | "stir" | "dye" | "spin"][] = [
  [/^(apprentice |journeyman )?cooper$/i, "hoop"],
  [/^(apprentice )?(shoemaker|saddler|glover)$|^mends nets$/i, "stitch"],
  [/^(apprentice )?(tailor|seamstress)$|^sews for/i, "sew"],
  [/^(apprentice )?(pewterer|goldsmith|ironmonger)$/i, "pewter"],
  [/^(apprentice )?carpenter$/i, "saw"],
  [/^(apprentice )?brewer$|^brews ale/i, "stir"],
  [/^(apprentice )?dyer$/i, "dye"],
  [/^spinner$|^spins wool$|, a spinner$/i, "spin"],
];

/** What someone carries about on the job (see src/render/work.ts). */
export type Load = "sack" | "yoke" | "sticks" | "washing" | "bread";
/** Who carries what, out on the job: porters a sack on the shoulder, water-carriers a yoke and buckets, wood-carriers a bundle of sticks, laundresses a basket of washing, bakers their bread. */
const LOADS: readonly [RegExp, Load][] = [
  [/porter/i, "sack"], [/water-carrier|carries water/i, "yoke"], [/wood-carrier/i, "sticks"],
  [/laundress|washerwoman|washing/i, "washing"], [/baker|delivers bread|at the oven/i, "bread"],
];
/** What someone carries on the job, by their trade (nothing, once they're retired from it). */
export const loadOf = (job: string): Load | null => (/^retired/i.test(job) ? null : LOADS.find(([re]) => re.test(job))?.[1] ?? null);

/** Who lights the street lamps at dusk: the lamplighter, and the sweeps' helpers, who help him round. */
export const LAMP_WORK = /lamplighter/i;
export const LAMP_HELP = /helps with the sweep/i;

/** Who fishes off the King's Bridge, from the refuges in its parapets. */
export const FISH_WORK = /^fisherman\b/i;
/** Who flies the King's hawks, out by the castle gate, a bird on the fist. */
export const HAWK_WORK = /^(master )?falconer\b|, falconer$/i;

/**
 * Where people work at a well (its middle `x`, `y` in tiles): one at the crank, on the east side (where it is)
 * facing west to wind it, side-on to the camera, two tiles out (the well's footing fills the tile beside it:
 * they step in to the crank once they're there, see src/render/work.ts); the washing's done round it at
 * tubs, each laundress a couple of tiles out and facing the well, her tub on the ground between, not in the
 * crank's way.
 */
export function wellOf(x: number, y: number): { crank: TileXY; tubs: TileXY[] } {
  const crank: TileXY = [Math.floor(x) + 2, Math.floor(y)], tubs: TileXY[] = [];
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2, t: TileXY = [Math.floor(x + Math.cos(a) * 2), Math.floor(y + Math.sin(a) * 2)];
    if (Math.abs(t[0] - crank[0]) + Math.abs(t[1] - crank[1]) <= 1 || tubs.some(u => u[0] === t[0] && u[1] === t[1])) continue;
    tubs.push(t);
  }
  return { crank, tubs };
}
