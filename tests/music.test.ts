import { describe, expect, it } from "vitest";
import { AREA_IDS } from "../src/areas/index.ts";
import { THEMES, daylight, moodOf, noteOf, playing, scaleOf, themeFor } from "../src/data/music.ts";

describe("music", () => {
  it("has a theme for every area, and the hearth inside a house", () => {
    for (const id of AREA_IDS) expect(themeFor("play", { id }), id).toBe(id);
    expect(themeFor("play", { id: "inside:capital:3,4", indoors: true })).toBe("hearth");
  });

  it("plays the title's theme on the title, and stops when he falls and for the credits' own tune", () => {
    expect(themeFor("title", { id: "witchwood" })).toBe("title");
    expect(themeFor("travel", { id: "witchwood" })).toBe("witchwood");
    expect(themeFor("dead", { id: "witchwood" })).toBeNull();
    expect(themeFor("credits", { id: "witchwood" })).toBeNull();
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
    const t = THEMES.capital, clear = playing(t, moodOf(t, 12, { rain: 0, fog: 0 }));
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
    expect(scaleOf(THEMES.capital, true)).toEqual([0, 2, 3, 5, 7, 8, 10]);
    expect(noteOf(60, [0, 2, 4, 5, 7, 9, 11], 7)).toBe(72);
    expect(noteOf(60, [0, 2, 4, 5, 7, 9, 11], -1)).toBe(59);
  });
});
