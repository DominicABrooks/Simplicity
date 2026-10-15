// The King in his throne room: up the keep's stairs from the castle ward, on the dais before his throne, and
// the first time you go before him, he gives you your task; after that, he reminds you.
import { describe, expect, it } from "vitest";
import { loadArea } from "../src/areas/index.ts";
import { area as castle } from "../src/areas/castle.ts";
import { area as throneroom } from "../src/areas/throneroom.ts";
import { TALK } from "../src/data/dialogue.ts";
import { KING, KING_AGAIN, KING_AUDIENCE, KINGS_TASK } from "../src/data/king.ts";
import { T } from "../src/data/world.ts";
import { createGame, setState } from "../src/game/game.ts";
import { resetGame } from "../src/game/reset.ts";
import { endTalk, startTalk, talking } from "../src/game/talk.ts";
import { enterArea } from "../src/game/travel.ts";
import { reachableFrom } from "../src/world/map.ts";

describe("the throne room", () => {
  it("is up the keep's stairs, from the castle ward, and back out to them", () => {
    expect(castle.build().exits.some(x => x.to.area === "throneroom" && x.to.entry === "door")).toBe(true);
    expect(throneroom.build().exits.map(x => x.to)).toEqual([{ area: "castle", entry: "keep" }]);
  });

  it("is lavish: a marble floor, the throne on its dais, pillars, chandeliers, candelabras, lions and guards", () => {
    const props = throneroom.build().props;
    const items = new Set(props.flatMap(p => (p.kind === "furniture" ? [p.item] : [])));
    for (const item of ["throne", "dais", "carpet", "pillar", "tapestry", "window", "candelabra", "chandelier", "urn"] as const) expect(items).toContain(item);
    expect(props.find(p => p.kind === "room")).toMatchObject({ floor: "marble" });
    expect(props.filter(p => p.kind === "lion")).toHaveLength(2);
    expect(props.filter(p => p.kind === "guard").length).toBeGreaterThanOrEqual(4);
    expect(props.filter(p => p.kind === "king")).toHaveLength(1);
  });

  it("lets you walk from the doors to within talking distance of the King", () => {
    const layout = throneroom.build(), king = layout.props.find(p => p.kind === "king")!, door = layout.entries.door!;
    const reached = reachableFrom(layout.map, Math.floor((door.x + 4) / T), Math.floor((door.y + 4) / T));
    const near = [...reached].some(k => {
      const x = (k % layout.map.width) * T + 4, y = Math.floor(k / layout.map.width) * T + 4;
      return Math.hypot(x - king.x, y - king.y) < TALK.reach;
    });
    expect(near).toBe(true);
  });
});

describe("the King", () => {
  async function before() {
    const g = createGame();
    resetGame(g);
    setState(g, "play");
    enterArea(g, await loadArea("throneroom"), "door");
    const [king, { transform }] = g.world.query("renderable", "transform").find(([, c]) => c.renderable.kind === "king")!;
    Object.assign(g.world.need(g.player, "transform"), { x: transform.x, y: transform.y + 14 });
    return { g, king };
  }

  it("is there, on his dais, someone you can talk to", async () => {
    const { g, king } = await before();
    expect(g.world.need(king, "targetable")).toMatchObject({ hostile: false, name: KING.name });
  });

  it("gives you your task the first time, and reminds you after", async () => {
    const { g, king } = await before();
    const toasts: string[] = [];
    g.events.on("toast", ({ text }) => toasts.push(text));
    expect(startTalk(g, king)).toBe(true);
    expect(talking(g)!.lines).toEqual(KING_AUDIENCE);
    expect(toasts).toContain(KINGS_TASK);
    endTalk(g);
    startTalk(g, king);
    expect(talking(g)!.lines).toEqual([KING_AGAIN[0]]);
    expect(toasts.filter(t => t === KINGS_TASK)).toHaveLength(1);
  });
});
