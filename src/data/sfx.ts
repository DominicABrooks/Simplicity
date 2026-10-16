// Every sound effect, as a recipe for the synth: no audio files. A sound is one or more tones laid
// over each other; each tone is an oscillator (or noise) sliding from one pitch to another under a
// quick attack and an exponential fade. Tune them here.

export interface Tone {
  /** An oscillator shape, or "noise" for hiss, thuds and splashes (pitch then sets a band-pass filter). */
  wave: OscillatorType | "noise";
  /** Start and end pitch in Hz (or filter centre for noise). */
  from: number;
  to?: number;
  /** Seconds, from start to silence. */
  dur: number;
  /** Peak loudness, 0-1. */
  gain: number;
  /** Seconds to wait before this tone starts. */
  delay?: number;
  /** Band-pass width for noise (Q); higher is narrower. */
  q?: number;
}

export interface SoundRecipe {
  tones: Tone[];
  /** Random pitch spread (0.1 = +-10%) so repeats don't sound mechanical. */
  jitter?: number;
}

/** The credits' tune: seconds a beat, and its notes (Hz, which beat, how many beats); and the low notes under it. */
const BEAT = 0.55;
const TUNE: readonly (readonly [number, number, number])[] = [
  [440, 0, 1], [587, 1, 1], [740, 2, 1], [659, 3, 1], [587, 4, 1], [440, 5, 1], [494, 6, 1], [587, 7, 2],
  [392, 9, 1], [494, 10, 1], [587, 11, 1], [554, 12, 1], [587, 13, 2], [659, 15, 1], [740, 16, 1], [880, 17, 1],
  [740, 18, 1], [659, 19, 1], [587, 20, 4],
];
const BASS: readonly (readonly [number, number, number])[] = [[147, 0, 4], [196, 4, 5], [196, 9, 4], [220, 13, 5], [147, 18, 6]];

export const SFX = {
  // The hero
  swing: { tones: [{ wave: "noise", from: 1800, to: 700, dur: 0.14, gain: 0.25, q: 1.2 }], jitter: 0.15 },
  punch: { tones: [{ wave: "noise", from: 900, to: 500, dur: 0.1, gain: 0.2, q: 1 }], jitter: 0.15 },
  bowRelease: { tones: [{ wave: "triangle", from: 420, to: 180, dur: 0.12, gain: 0.25 }, { wave: "noise", from: 3000, to: 1500, dur: 0.1, gain: 0.12, q: 2 }], jitter: 0.08 },
  powerShot: { tones: [{ wave: "triangle", from: 520, to: 160, dur: 0.16, gain: 0.3 }, { wave: "noise", from: 4000, to: 1200, dur: 0.18, gain: 0.18, q: 1.5 }], jitter: 0.05 },
  dud: { tones: [{ wave: "triangle", from: 220, to: 120, dur: 0.1, gain: 0.15 }], jitter: 0.1 },
  cast: { tones: [{ wave: "noise", from: 1200, to: 2400, dur: 0.18, gain: 0.15, q: 3 }], jitter: 0.1 },
  dash: { tones: [{ wave: "noise", from: 600, to: 2200, dur: 0.16, gain: 0.2, q: 1.5 }], jitter: 0.1 },
  jump: { tones: [{ wave: "square", from: 220, to: 440, dur: 0.12, gain: 0.08 }], jitter: 0.05 },
  hurt: { tones: [{ wave: "square", from: 300, to: 90, dur: 0.22, gain: 0.18 }, { wave: "noise", from: 500, dur: 0.12, gain: 0.25, q: 0.8 }] },
  death: { tones: [{ wave: "square", from: 330, to: 55, dur: 0.9, gain: 0.2 }, { wave: "triangle", from: 247, to: 41, dur: 1.1, gain: 0.2, delay: 0.1 }] },
  levelUp: { tones: [523, 659, 784, 1047].map((f, i) => ({ wave: "square" as const, from: f, dur: 0.22, gain: 0.1, delay: i * 0.08 })) },

  // Hitting things
  hit: { tones: [{ wave: "noise", from: 700, to: 300, dur: 0.09, gain: 0.35, q: 1 }, { wave: "square", from: 160, to: 70, dur: 0.07, gain: 0.12 }], jitter: 0.12 },
  crit: { tones: [{ wave: "noise", from: 1200, to: 300, dur: 0.16, gain: 0.45, q: 0.8 }, { wave: "square", from: 220, to: 60, dur: 0.14, gain: 0.18 }, { wave: "triangle", from: 1600, to: 1400, dur: 0.12, gain: 0.08 }], jitter: 0.06 },

  // Enemies
  slimeDie: { tones: [{ wave: "sine", from: 500, to: 90, dur: 0.22, gain: 0.3 }, { wave: "noise", from: 400, dur: 0.15, gain: 0.15, q: 2 }], jitter: 0.15 },
  mageDie: { tones: [{ wave: "noise", from: 900, to: 200, dur: 0.4, gain: 0.35, q: 0.7 }, { wave: "sawtooth", from: 400, to: 80, dur: 0.35, gain: 0.1 }], jitter: 0.08 },
  spell: { tones: [{ wave: "sine", from: 300, to: 900, dur: 0.2, gain: 0.12 }, { wave: "noise", from: 2500, dur: 0.15, gain: 0.06, q: 4 }], jitter: 0.1 },
  boltPop: { tones: [{ wave: "noise", from: 1500, to: 600, dur: 0.12, gain: 0.2, q: 1.5 }], jitter: 0.15 },
  nova: { tones: [{ wave: "noise", from: 5000, to: 1500, dur: 0.5, gain: 0.25, q: 1 }, { wave: "sine", from: 1400, to: 900, dur: 0.4, gain: 0.08 }] },
  thunder: { tones: [{ wave: "noise", from: 2500, to: 120, dur: 0.6, gain: 0.5, q: 0.5 }, { wave: "sawtooth", from: 90, to: 40, dur: 0.5, gain: 0.15 }], jitter: 0.1 },
  blink: { tones: [{ wave: "sine", from: 1200, to: 300, dur: 0.15, gain: 0.1 }, { wave: "sine", from: 300, to: 1200, dur: 0.15, gain: 0.1, delay: 0.08 }] },
  toll: { tones: [{ wave: "sine", from: 196, dur: 1.6, gain: 0.3 }, { wave: "sine", from: 466, dur: 1.2, gain: 0.12 }, { wave: "sine", from: 784, dur: 0.8, gain: 0.06 }] },

  // The city after dark (src/game/eerie.ts)
  shutter: { tones: [{ wave: "noise", from: 260, to: 120, dur: 0.16, gain: 0.45, q: 1.4 }, { wave: "square", from: 90, to: 50, dur: 0.1, gain: 0.12 }, { wave: "noise", from: 300, to: 140, dur: 0.1, gain: 0.2, q: 1.4, delay: 0.14 }], jitter: 0.1 },
  footstep: { tones: [{ wave: "noise", from: 380, to: 180, dur: 0.07, gain: 0.3, q: 2.2 }], jitter: 0.12 },
  whisper: { tones: [{ wave: "noise", from: 3200, to: 2400, dur: 0.7, gain: 0.07, q: 6 }, { wave: "noise", from: 2000, to: 2800, dur: 0.5, gain: 0.05, q: 6, delay: 0.25 }], jitter: 0.2 },
  handbell: { tones: [{ wave: "sine", from: 1318, dur: 0.9, gain: 0.12 }, { wave: "sine", from: 3150, dur: 0.4, gain: 0.04 }] },

  // Pickups and fishing
  pickup: { tones: [{ wave: "square", from: 660, dur: 0.06, gain: 0.08 }, { wave: "square", from: 990, dur: 0.08, gain: 0.08, delay: 0.06 }] },
  drink: { tones: [0, 0.07, 0.14].map(delay => ({ wave: "sine" as const, from: 400, to: 700, dur: 0.07, gain: 0.15, delay })), jitter: 0.05 },
  castLine: { tones: [{ wave: "noise", from: 2500, to: 1000, dur: 0.25, gain: 0.12, q: 3 }] },
  bite: { tones: [{ wave: "noise", from: 900, to: 400, dur: 0.15, gain: 0.25, q: 2 }, { wave: "sine", from: 600, to: 300, dur: 0.1, gain: 0.1 }] },
  catch: { tones: [{ wave: "noise", from: 700, to: 300, dur: 0.3, gain: 0.25, q: 1 }, { wave: "square", from: 784, dur: 0.1, gain: 0.07, delay: 0.1 }, { wave: "square", from: 1047, dur: 0.14, gain: 0.07, delay: 0.18 }] },

  // The credits (src/game/credits.ts): a slow, warm air in D as the run plays back, a soft low note under each phrase.
  credits: { tones: [...TUNE.map(([f, beat, beats]) => ({ wave: "triangle" as const, from: f, dur: beats * BEAT * 0.95, gain: 0.07, delay: beat * BEAT })),
    ...BASS.map(([f, beat, beats]) => ({ wave: "sine" as const, from: f, dur: beats * BEAT, gain: 0.05, delay: beat * BEAT }))] },
} satisfies Record<string, SoundRecipe>;

export type SfxId = keyof typeof SFX;

/** How far (game pixels) a positioned sound carries before it's silent. */
export const HEARING = 200;
/** Master volume, 0-1. */
export const VOLUME = 0.5;
/** The same sound won't start twice within this many seconds (a sweep hitting five slimes is one hit). */
export const RETRIGGER = 0.03;
