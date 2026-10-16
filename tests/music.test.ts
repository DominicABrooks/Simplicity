import { describe, expect, it } from "vitest";
import { AREA_IDS } from "../src/areas/index.ts";
import { THEMES, daylight, moodOf, noteOf, playing, scaleOf, themeFor } from "../src/data/music.ts";

describe("music", () => {
  it("has a theme for every area, and the hearth inside a house", () => {
    for (const id of AREA_IDS) expect(themeFor("play", { id }), id).not.toBeNull();
    expect(themeFor("play", { id: "inside:capital:3,4", indoors: true })).toBe("hearth");
  });

  it("plays the title's theme on the title, and stops when he falls and for the credits' own tune", () => {
    expect(themeFor("title", { id: "witchwood" })).toBe("title");
    expect(themeFor("travel", { id: "witchwood" })).toBe("witchwood");
    expect(themeFor("dead", { id: "witchwood" })).toBeNull();
    expect(themeFor("credits", { id: "witchwood" })).toBeNull();
  });

  it("gives way to the fair folk's own music in a fairy ring's spell", () => {
    expect(themeFor("play", { id: "witchwood" }, { fey: true })).toBe("underhill");
    expect(themeFor("dead", { id: "witchwood" }, { fey: true })).toBeNull();
    expect(THEMES.underhill.mode).toEqual([0, 2, 4, 6, 8, 10]);
  });

  it("is the watchers' own once only they are under the hill", () => {
    expect(themeFor("play", { id: "underhill" })).toBe("underhill");
    expect(themeFor("play", { id: "underhill" }, { watched: true })).toBe("watchers");
  });

  it("plays the castle's all over Capital City, so it doesn't break off between districts; but the Throne Room has its own, day and night", () => {
    for (const id of ["capital", "kingsroad", "castle"]) {
      expect(themeFor("play", { id }, { hour: 12 }), id).toBe("castle");
      expect(themeFor("play", { id }, { hour: 23 }), id).toBe("castleNight");
    }
    for (const hour of [12, 23, 4]) expect(themeFor("play", { id: "throneroom", indoors: true }, { hour })).toBe("throneroom");
  });

  it("has the castle bright by day and something else after dark, changing over at dusk and dawn", () => {
    const castle = (hour: number) => themeFor("play", { id: "castle" }, { hour });
    expect([castle(12), castle(17)]).toEqual(["castle", "castle"]);
    expect([castle(23), castle(3)]).toEqual(["castleNight", "castleNight"]);
    expect(castle(21)).toBe("castleNight");
    expect(castle(8)).toBe("castle");
    expect(themeFor("play", { id: "witchwood" }, { hour: 23 })).toBe("witchwood");   // the rest only colour their own by night
    expect(THEMES.castle.bpm).toBeGreaterThan(THEMES.castleNight.bpm * 1.5);
  });

  it("is light by day, dark by night, and eases through dawn and dusk", () => {
    expect(daylight(12)).toBe(1);
    expect(daylight(2)).toBe(0);
    expect(daylight(23)).toBe(0);
    expect(daylight(6.5)).toBeCloseTo(0.5);
    expect(daylight(19.5)).toBeCloseTo(0.5);
  });

  it("is slower, sparser, darker and lower by night", () => {
    const t = THEMES.witchwood, still = { rain: 0, fog: 0 };
    const day = playing(t, moodOf(t, 12, still)), night = playing(t, moodOf(t, 2, still));
    expect(night.bpm).toBeLessThan(day.bpm);
    expect(night.density).toBeLessThan(day.density);
    expect(night.bright).toBeLessThan(day.bright);
    expect([day.dark, night.dark]).toEqual([false, true]);
    expect([day.lower, night.lower]).toEqual([0, 12]);
  });

  it("brings a drone under the rain, and thins out and echoes in fog", () => {
    const t = THEMES.castle, clear = playing(t, moodOf(t, 12, { rain: 0, fog: 0 }));
    const rain = playing(t, moodOf(t, 12, { rain: 1, fog: 0 })), fog = playing(t, moodOf(t, 12, { rain: 0, fog: 1 }));
    expect([clear.rain, rain.rain]).toEqual([0, 1]);
    expect(rain.dark).toBe(true);
    expect(fog.density).toBeLessThan(clear.density);
    expect(fog.echo).toBeGreaterThan(clear.echo);
  });

  it("isn't touched by the sky indoors or underground", () => {
    const t = THEMES.undercroft;
    expect(moodOf(t, 2, { rain: 1, fog: 1 })).toEqual({ day: 1, rain: 0, fog: 0 });
  });

  it("darkens a major mode into a minor one, and climbs the scale by octaves", () => {
    expect(scaleOf(THEMES.castle, true)).toEqual([0, 2, 3, 5, 7, 8, 10]);
    expect(noteOf(60, [0, 2, 4, 5, 7, 9, 11], 7)).toBe(72);
    expect(noteOf(60, [0, 2, 4, 5, 7, 9, 11], -1)).toBe(59);
  });
});
