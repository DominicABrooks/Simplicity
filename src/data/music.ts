// The music: a tune for every area, made up as it plays (no audio files), like the sound effects. Each area has a
// theme (a key, a mode, a run of chords, a pace and the voices that play it), and the sky colours it: by night it's
// slower, sparser, lower and in a darker mode; rain brings a low drone and drops of high notes; fog thins the tune
// out and lets it echo. Indoors and under the ground the sky can't reach it. In a fairy ring's spell, whatever was
// playing gives way to the fair folk's own music, Under the Hill's. Tune it here; the synth that plays it is
// src/audio/music.ts.
import type { Weather } from "./weather.ts";

export interface Theme {
  /** The key's home note, as a MIDI number (60 is middle C). */
  root: number;
  /** The mode, as semitones above the root. */
  mode: readonly number[];
  /** The chords, one a bar, as degrees of the mode counted from 0. */
  chords: readonly number[];
  /** Beats a minute, by day and in fair weather. */
  bpm: number;
  /** Voices: the held chord, the low note under it and the tune over it. */
  pad: OscillatorType;
  lead: OscillatorType;
  /** How likely the tune is to play on each half-beat, 0-1. */
  density: number;
  /** Plays the chord as a ripple of half-beats under the tune. */
  arp?: boolean;
  /** A low drone held under it all: the root and the note a tritone above it, wavering. */
  drone?: boolean;
  /** Each held chord note doubled, the twin this many cents out of tune, so they beat against each other. */
  detune?: number;
  /** The tune wavers, this many cents either way, like a voice or a theremin; and slides from each note to the next. */
  wobble?: number;
  /** How bright it sounds: the low-pass filter's cutoff, Hz. */
  bright: number;
  /** Loudness, about 1. */
  gain?: number;
  /** Whether the hour and the weather reach it (false indoors and underground). Defaults to true. */
  sky?: boolean;
}

const IONIAN = [0, 2, 4, 5, 7, 9, 11], DORIAN = [0, 2, 3, 5, 7, 9, 10], AEOLIAN = [0, 2, 3, 5, 7, 8, 10];
const WHOLE_TONE = [0, 2, 4, 6, 8, 10], LYDIAN = [0, 2, 4, 6, 7, 9, 11], MIXOLYDIAN = [0, 2, 4, 5, 7, 9, 10], PHRYGIAN = [0, 1, 3, 5, 7, 8, 10];

export const THEMES = {
  /** The title: slow and open, waiting. */
  title: { root: 50, mode: DORIAN, chords: [0, 3, 6, 0], bpm: 60, pad: "triangle", lead: "sine", density: 0.25, bright: 1800, sky: false },
  /** Home: a folk air in the woods. */
  witchwood: { root: 55, mode: MIXOLYDIAN, chords: [0, 3, 6, 0, 4, 3, 0, 6], bpm: 84, pad: "triangle", lead: "triangle", density: 0.45, bright: 2400 },
  /** The capital: stately, major, a little march. */
  capital: { root: 60, mode: IONIAN, chords: [0, 3, 4, 0, 5, 3, 4, 0], bpm: 96, pad: "sawtooth", lead: "square", density: 0.5, bright: 2000 },
  castle: { root: 58, mode: IONIAN, chords: [0, 5, 3, 4], bpm: 80, pad: "sawtooth", lead: "triangle", density: 0.4, bright: 1700 },
  kingsroad: { root: 62, mode: MIXOLYDIAN, chords: [0, 6, 3, 0], bpm: 100, pad: "sawtooth", lead: "square", density: 0.45, bright: 2100 },
  throneroom: { root: 58, mode: IONIAN, chords: [0, 3, 4, 0, 5, 1, 4, 0], bpm: 66, pad: "sawtooth", lead: "triangle", density: 0.3, bright: 1500, sky: false },
  /** The cold places: glassy ripples. */
  hollow: { root: 57, mode: AEOLIAN, chords: [0, 5, 2, 6], bpm: 70, pad: "sine", lead: "sine", density: 0.3, arp: true, bright: 3200 },
  grotto: { root: 64, mode: LYDIAN, chords: [0, 1, 0, 4], bpm: 64, pad: "sine", lead: "sine", density: 0.25, arp: true, bright: 3000, sky: false },
  /** Ash and fire: low and uneasy. */
  ashwild: { root: 45, mode: PHRYGIAN, chords: [0, 1, 0, 6], bpm: 76, pad: "sawtooth", lead: "square", density: 0.35, bright: 1300 },
  /** The storm that never stops. */
  rift: { root: 43, mode: AEOLIAN, chords: [0, 5, 6, 4], bpm: 88, pad: "sawtooth", lead: "sawtooth", density: 0.4, bright: 1200, gain: 0.9 },
  /** St Mary's below: hardly a tune, a drone and a few notes in the dark. */
  undercroft: { root: 48, mode: DORIAN, chords: [0, 0, 6, 0], bpm: 52, pad: "triangle", lead: "sine", density: 0.15, bright: 1100, sky: false },
  sealchamber: { root: 46, mode: PHRYGIAN, chords: [0, 1, 0, 0], bpm: 48, pad: "sawtooth", lead: "sine", density: 0.12, bright: 900, sky: false },
  /**
   * The fair folk's music, Under the Hill and in a fairy ring's spell: slow, and in the whole-tone scale, so nothing in
   * it ever comes home; out-of-tune twins shimmering in the chords, a wavering drone a tritone wide under them, and a
   * thin voice sliding and wavering over the top.
   */
  underhill: { root: 50, mode: WHOLE_TONE, chords: [0, 1, 0, 4, 3, 1], bpm: 52, pad: "triangle", lead: "sine", density: 0.22, arp: true, bright: 2400, sky: false,
    drone: true, detune: 16, wobble: 30, gain: 1.1 },
  /** Inside someone's house: by the fire. */
  hearth: { root: 53, mode: IONIAN, chords: [0, 3, 0, 4], bpm: 72, pad: "triangle", lead: "triangle", density: 0.35, bright: 1600, sky: false },
} satisfies Record<string, Theme>;

export type ThemeId = keyof typeof THEMES;

/** The music's overall loudness, under the sound effects' (data/sfx.ts VOLUME). */
export const MUSIC_VOLUME = 0.16;
/** Seconds one area's music takes to fade out and the next in. */
export const MUSIC_FADE = 2.5;

/** Which theme plays: the area's own, a house's hearth, the fair folk's in their ring's spell, or none (an area with no theme yet is quiet). */
export function themeFor(state: string, area: { id: string; indoors?: boolean }, fey = false): ThemeId | null {
  if (state === "title") return "title";
  if (state !== "play" && state !== "travel") return null;           // dead, and the credits, which have their own tune
  if (fey) return "underhill";
  if (area.id in THEMES && area.id !== "title" && area.id !== "hearth") return area.id as ThemeId;
  if (area.id.startsWith("inside:")) return "hearth";
  return null;
}

/** How light it is, 0 (the dead of night) to 1 (day), easing through dawn (5-8) and dusk (18-21). */
export function daylight(hour: number): number {
  const h = ((hour % 24) + 24) % 24;
  const ease = (t: number) => t * t * (3 - 2 * t);
  if (h < 5 || h >= 21) return 0;
  if (h < 8) return ease((h - 5) / 3);
  if (h < 18) return 1;
  return 1 - ease((h - 18) / 3);
}

/** How the sky colours a theme right now. Everything is 0-1 and changes smoothly. */
export interface Mood {
  /** 1 by day, 0 by night. */
  day: number;
  rain: number;
  fog: number;
}

export function moodOf(theme: Theme, hour: number, weather: Pick<Weather, "rain" | "fog">): Mood {
  if (theme.sky === false) return { day: 1, rain: 0, fog: 0 };
  return { day: daylight(hour), rain: weather.rain, fog: weather.fog };
}

/** How it plays in that mood: the pace, how busy the tune is, how bright, and so on. */
export interface Playing {
  bpm: number;
  density: number;
  /** Low-pass cutoff, Hz. */
  bright: number;
  /** Semitones the tune drops by night (an octave in the small hours). */
  lower: number;
  /** Whether the mode darkens: its third, sixth and seventh flattened, as at night or in heavy rain. */
  dark: boolean;
  /** How much of it echoes, 0-1. */
  echo: number;
  /** The rain's drone and drops, 0-1. */
  rain: number;
  gain: number;
}

export function playing(theme: Theme, m: Mood): Playing {
  const night = 1 - m.day;
  return {
    bpm: theme.bpm * (1 - 0.2 * night) * (1 - 0.1 * m.rain),
    density: theme.density * (1 - 0.5 * night) * (1 - 0.3 * m.rain) * (1 - 0.6 * m.fog),
    bright: theme.bright * (1 - 0.45 * night) * (1 - 0.35 * m.rain) * (1 - 0.25 * m.fog),
    lower: night > 0.85 ? 12 : 0,
    dark: night > 0.5 || m.rain > 0.7,
    echo: 0.2 + 0.25 * night + 0.45 * m.fog,
    rain: m.rain,
    gain: (theme.gain ?? 1) * (1 - 0.25 * night),
  };
}

/** The mode a step at a time, darkened if need be (its major third, sixth and seventh brought down a semitone). */
export function scaleOf(theme: Theme, dark: boolean): number[] {
  if (!dark) return [...theme.mode];
  return theme.mode.map((s, i) => ((i === 2 && s === 4) || (i === 5 && s === 9) || (i === 6 && s === 11) ? s - 1 : s));
}

/** A degree of the scale (any whole number: past 6 climbs an octave, below 0 drops one) as a MIDI note. */
export function noteOf(root: number, scale: readonly number[], degree: number): number {
  const n = scale.length, octave = Math.floor(degree / n);
  return root + 12 * octave + scale[degree - octave * n]!;
}

export const hz = (midi: number): number => 440 * 2 ** ((midi - 69) / 12);
