// The Fells' house in the Wallside (src/data/fells.ts): Meg Fell's own lines, and her husband's grey cloak hung from
// the window, as the Ranger's note says, so whoever has the note can find the house. It hangs there till the King lets
// Wystan out (src/game/ending.ts: the head laid at his feet); then Meg takes it in for good.
import { MEG_TALK } from "../data/fells.ts";
import { HALF, T } from "../data/world.ts";
import type { Prop } from "../world/area.ts";
import { FACING_YAW, houseBody, houseDoor, local } from "../world/plans.ts";
import type { Resident } from "../world/residents.ts";
import { beaten } from "./bosses.ts";
import { headLaid } from "./ending.ts";
import type { Game } from "./game.ts";
import { loadCensus } from "./townsfolk.ts";

/** Is this Meg Fell: the Ranger's wife, the grown woman of the Fells at home? */
export const isMeg = (r: Resident): boolean => r.family === "fell" && !r.prisoner && r.name.startsWith("Meg ");

/** What she says: all of it the first time; after, a line at a time; and once Calder's beaten, the news. */
export function megLines(g: Game, visits: number): string[] {
  if (beaten(g, "calder")) return [...MEG_TALK.quiet];
  if (visits === 0) return [...MEG_TALK.first];
  return [MEG_TALK.again[(visits - 1) % MEG_TALK.again.length]!];
}

/** How high the cloak hangs (world units): from the sill of a window upstairs; downstairs, if there's no upstairs. How far
 *  the upstairs is jettied out over the street, and how far off the wall the cloak hangs, clear of the beam and shutters. */
const UP = 1.85, DOWN = 0.75, JETTY = 0.12, CLEAR = 0.11;

/** Hang the cloak at the Fells' window whenever he comes into the part of the city they live in, till Wystan's home. */
export function watchFells(g: Game): void {
  g.events.on("area", () => {
    if (headLaid(g)) return;
    const area = g.area.def.id;
    void loadCensus().then(people => {
      if (g.area.def.id !== area || headLaid(g)) return;
      const home = people.find(r => r.family === "fell" && !r.prisoner)?.home;
      if (!home || home.area !== area) return;
      const px = (home.x + 0.5) * T, py = (home.y + 0.5) * T;
      const house = g.area.layout.props.find((p): p is Extract<Prop, { kind: "house" }> =>
        p.kind === "house" && px >= p.rect.x && py >= p.rect.y && px <= p.rect.x + p.rect.w && py <= p.rect.y + p.rect.h);
      if (!house) return;
      // On the front, at a window as far from the door as there is (the cloak hanging down clear of it): upstairs, out
      // on the jetty, the windows where the renderer puts them (src/render/town.ts: from 0.5 in, 0.85 apart); or, on a
      // single storey, a step along from the door. Stood off the wall past the jetty's beam and the shutters.
      const body = houseBody(house.rect), sideways = house.doorSide === "east" || house.doorSide === "west";
      const w = sideways ? body.d : body.w, d = sideways ? body.w : body.d, door = houseDoor(house).along, up = house.storeys > 1, yaw = FACING_YAW[house.doorSide];
      const windows: number[] = [];
      for (let x = -w / 2 + 0.5; x < w / 2 - 0.3; x += 0.85) windows.push(x);
      const along = up ? windows.reduce((a, b) => (Math.abs(b - door) > Math.abs(a - door) ? b : a), windows[0] ?? 0) : door + 0.85;
      const at = local({ x: body.x, z: body.z }, yaw, along, d / 2 + (up ? JETTY : 0) + CLEAR);
      g.world.create({ transform: { x: at.x * T - HALF, y: at.z * T - HALF }, cloak: { yaw, y: up ? UP : DOWN }, renderable: { kind: "cloak" } });
    });
  });
}
