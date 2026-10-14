// Every area, checked as a whole: these run over all of src/areas, so a thousand areas get the same
// guarantees as two. A broken link or an unreachable exit fails here, not in the game.
import { describe, expect, it } from "vitest";
import { AREA_IDS, HOME, loadArea } from "../src/areas/index.ts";
import { T } from "../src/data/world.ts";
import type { AreaDef } from "../src/world/area.ts";
import { FEET, blocked } from "../src/world/collision.ts";
import { reachableFrom } from "../src/world/map.ts";

const modules = import.meta.glob<{ area: AreaDef }>(["../src/areas/*.ts", "!../src/areas/index.ts"], { eager: true });
const AREAS = Object.entries(modules).map(([path, m]) => ({ file: path.split("/").pop()!.replace(/\.ts$/, ""), def: m.area }));
const byId = new Map(AREAS.map(a => [a.def.id, a.def]));

const overlaps = (a: { x: number; y: number; w: number; h: number }, b: typeof a) =>
  a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
/** The hero's feet box at a cell position. */
const feet = (p: { x: number; y: number }) => ({ x: p.x + FEET.x, y: p.y + FEET.y, w: FEET.w, h: FEET.h });

describe("the area registry", () => {
  it("lists every area module, with the home area first", () => {
    expect([...AREA_IDS].sort()).toEqual(AREAS.map(a => a.def.id).sort());
    expect(AREA_IDS[0]).toBe(HOME.id);
  });

  it("loads any area by id, and refuses unknown ones", async () => {
    for (const id of AREA_IDS) expect((await loadArea(id)).id).toBe(id);
    await expect(loadArea("nowhere")).rejects.toThrow();
  });
});

describe.each(AREAS)("area $def.id", ({ file, def }) => {
  const layout = def.build();
  const { map } = layout;

  it("is named after its file, and has a name to show", () => {
    expect(def.id).toBe(file);
    expect(def.name.length).toBeGreaterThan(0);
  });

  it("builds the same layout every time", () => {
    expect(def.build()).toEqual(layout);
  });

  it("has arrival points on open ground, outside every exit", () => {
    expect(Object.keys(layout.entries).length).toBeGreaterThan(0);
    for (const at of Object.values(layout.entries)) {
      expect(blocked(map, at.x, at.y, true)).toBe(false);
      for (const exit of layout.exits) expect(overlaps(feet(at), exit.rect)).toBe(false);
    }
  });

  it("links every exit to a real area and arrival point", () => {
    for (const exit of layout.exits) {
      const there = byId.get(exit.to.area);
      expect(there, `${def.id} -> ${exit.to.area}`).toBeDefined();
      expect(Object.keys(there!.build().entries)).toContain(exit.to.entry);
    }
  });

  it("can walk from every arrival point to every exit", () => {
    for (const at of Object.values(layout.entries)) {
      const reached = reachableFrom(map, Math.floor((at.x + 4) / T), Math.floor((at.y + 4) / T));
      for (const exit of layout.exits) {
        const r = exit.rect, tiles: number[] = [];
        for (let ty = Math.floor(r.y / T); ty <= Math.floor((r.y + r.h - 1) / T); ty++)
          for (let tx = Math.floor(r.x / T); tx <= Math.floor((r.x + r.w - 1) / T); tx++) tiles.push(ty * map.width + tx);
        expect(tiles.some(k => reached.has(k)), `${def.id}: exit to ${exit.to.area}`).toBe(true);
      }
    }
  });
});
