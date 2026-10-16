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
  /** Seconds it takes to swell to full; a quick 10 ms (less for very short tones) if not given. */
  attack?: number;
}

export interface SoundRecipe {
  tones: Tone[];
  /** Random pitch spread (0.1 = +-10%) so repeats don't sound mechanical. */
  jitter?: number;
}

/**
 * The credits' tune: seconds a beat, and its notes (Hz, which beat, how many beats); and the low notes under it. It
 * comes round again and again under the whole reel (src/game/credits.ts), each time a little different: the air, an
 * answer to it, the air again over a rippling accompaniment, and the answer again with a softer voice a third above.
 */
type Notes = readonly (readonly [number, number, number])[];
const BEAT = 0.55;
const TUNE: Notes = [
  [440, 0, 1], [587, 1, 1], [740, 2, 1], [659, 3, 1], [587, 4, 1], [440, 5, 1], [494, 6, 1], [587, 7, 2],
  [392, 9, 1], [494, 10, 1], [587, 11, 1], [554, 12, 1], [587, 13, 2], [659, 15, 1], [740, 16, 1], [880, 17, 1],
  [740, 18, 1], [659, 19, 1], [587, 20, 4],
];
const BASS: Notes = [[147, 0, 4], [196, 4, 5], [196, 9, 4], [220, 13, 5], [147, 18, 6]];
/** The answer: up from D through B minor, and home. */
const ANSWER: Notes = [
  [587, 0, 1], [659, 1, 1], [740, 2, 2], [880, 4, 1], [740, 5, 1], [659, 6, 1], [587, 7, 2],
  [494, 9, 1], [587, 10, 1], [659, 11, 1], [554, 12, 1], [440, 13, 2], [494, 15, 1], [587, 16, 1], [659, 17, 1],
  [554, 18, 1], [494, 19, 1], [587, 20, 4],
];
const ANSWER_BASS: Notes = [[147, 0, 4], [247, 4, 5], [196, 9, 4], [220, 13, 5], [147, 18, 6]];
/** Under the air the second time: each low note broken into a slow ripple up its chord (root, fifth, octave, fifth). */
const RIPPLE: Notes = BASS.flatMap(([f, beat, beats]) => Array.from({ length: beats * 2 }, (_, i) => [f * [2, 3, 4, 3][i % 4]! / 2, beat + i / 2, 0.5] as const));
/** D major, an octave of it (Hz); and a note a third above any in it (two steps up the scale). */
const D_SCALE = [294, 330, 370, 392, 440, 494, 554];
const third = (f: number): number => {
  let o = 1;
  while (f / o > 554 * 1.02) o *= 2;
  const i = D_SCALE.findIndex(n => Math.abs(n - f / o) < 8);
  return i < 0 ? f : D_SCALE[(i + 2) % 7]! * o * (i + 2 >= 7 ? 2 : 1);
};

/** One time round: a lead (triangle) over low notes (sine), and maybe a second, softer voice. */
const air = (lead: Notes, low: Notes, gain = 0.07, voice?: Notes): SoundRecipe["tones"] => [
  ...lead.map(([f, beat, beats]) => ({ wave: "triangle" as const, from: f, dur: beats * BEAT * 0.95, gain, delay: beat * BEAT })),
  ...low.map(([f, beat, beats]) => ({ wave: "sine" as const, from: f, dur: beats * BEAT, gain: 0.05, delay: beat * BEAT })),
  ...(voice ?? []).map(([f, beat, beats]) => ({ wave: "sine" as const, from: f, dur: beats * BEAT * 0.95, gain: 0.035, delay: beat * BEAT })),
];
/** The credits' tune, in turn (sound ids), and how long (s) each time round is, with a breath after it. */
export const CREDITS_AIR = { turns: ["credits", "creditsAnswer", "creditsRipple", "creditsHigh"], every: 24 * BEAT + 1.1 } as const;

/**
 * The fair folk's sound: each note a slow swell (`attack`) gliding a little toward `bend` times its pitch, with a twin a
 * few hertz off it so the two shimmer, and two quieter echoes after it.
 */
function fey(notes: readonly (readonly [number, number])[], dur: number, gain: number, bend: number, wave: "sine" | "triangle" = "sine", attack = 0.25): Tone[] {
  const one = (f: number, delay: number, g: number): Tone[] => [
    { wave, from: f, to: f * bend, dur, gain: g, delay, attack },
    { wave: "sine", from: f + 3, to: (f + 3) * bend, dur, gain: g * 0.7, delay, attack },
  ];
  return notes.flatMap(([f, delay]) => [0, 1, 2].flatMap(echo => one(f, delay + echo * 0.38, gain * 0.45 ** echo)));
}

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

  // The fairy ring after dark (src/game/fairyring.ts): soft and strange, never sharp. Everything swells in slowly, in the
  // whole-tone scale (no note in it feels like home), each note with a twin a hair out of tune so it shimmers, and
  // echoes after it: a slow run up as he steps in and down as he steps out, a bell now and then while he stands in it,
  // a low wavering hum under them, and an "ooh" of far-off voices as they speak.
  feyEnter: { tones: fey([[294, 0], [330, 0.18], [370, 0.36], [415, 0.54], [466, 0.72], [587, 0.95]], 2.4, 0.03, 1.02) },
  feyLeave: { tones: fey([[587, 0], [466, 0.2], [415, 0.4], [370, 0.6], [330, 0.8]], 2, 0.022, 0.98) },
  feyChime: { tones: fey([[740, 0], [1047, 0.12]], 2.2, 0.022, 1.004), jitter: 0.12 },
  feyHum: { tones: [{ wave: "sine", from: 73.4, to: 75, dur: 2.8, gain: 0.07, attack: 0.9 }, { wave: "sine", from: 74, to: 72.6, dur: 2.8, gain: 0.07, attack: 0.9 },
    { wave: "triangle", from: 147, to: 149, dur: 2.6, gain: 0.015, attack: 1.1 }] },
  feyVoice: { tones: [...fey([[294, 0], [370, 0.15], [466, 0.3]], 2.8, 0.018, 1.03, "triangle", 0.8),
    { wave: "noise", from: 700, to: 1000, dur: 2.2, gain: 0.03, q: 1.5, attack: 0.9 }], jitter: 0.08 },

  // The watchers murmuring, under the hill (src/game/underhill.ts): a low, muffled voice, words you can't make out.
  murmur: { tones: [{ wave: "noise", from: 520, to: 380, dur: 1.4, gain: 0.12, q: 5, attack: 0.2 }, { wave: "noise", from: 900, to: 650, dur: 1.1, gain: 0.05, q: 6, delay: 0.25, attack: 0.15 },
    { wave: "triangle", from: 130, to: 110, dur: 1.5, gain: 0.05, attack: 0.25 }, { wave: "triangle", from: 123, to: 98, dur: 0.9, gain: 0.04, delay: 0.6, attack: 0.1 }], jitter: 0.15 },

  // A boss beaten (src/game/victory.ts): a fanfare, brass up the chord in a dotted rhythm (da, da-da, da, DAAA) with a
  // drum under it, then the whole chord held, ringing out; and the fireworks after it, each a thump, a crack and a
  // crackle of sparks.
  victory: { tones: [
    ...([[392, 0, 0.3], [392, 0.3, 0.12], [523, 0.42, 0.22], [659, 0.64, 0.22], [784, 0.86, 1.6]] as const).flatMap(([f, delay, dur]) => [
      { wave: "sawtooth" as const, from: f, dur, gain: 0.07, delay, attack: 0.02 },
      { wave: "square" as const, from: f / 2, dur, gain: 0.05, delay, attack: 0.02 },
    ]),
    ...[523, 659, 784, 1047].map(f => ({ wave: "triangle" as const, from: f, to: f * 1.004, dur: 2.2, gain: 0.05, delay: 0.86, attack: 0.04 })),
    ...[0, 0.42, 0.86].map(delay => ({ wave: "sine" as const, from: 110, to: 65, dur: 0.6, gain: 0.3, delay })),
    { wave: "noise", from: 4000, to: 1500, dur: 1.4, gain: 0.08, q: 0.6, delay: 0.86 },
  ] },
  firework: { tones: [{ wave: "sine", from: 140, to: 60, dur: 0.25, gain: 0.18 }, { wave: "noise", from: 2600, to: 900, dur: 0.35, gain: 0.2, q: 0.7 },
    ...[0.12, 0.2, 0.31, 0.4].map(delay => ({ wave: "noise" as const, from: 6000, dur: 0.05, gain: 0.07, q: 2, delay }))], jitter: 0.2 },

  // Pickups and fishing
  pickup: { tones: [{ wave: "square", from: 660, dur: 0.06, gain: 0.08 }, { wave: "square", from: 990, dur: 0.08, gain: 0.08, delay: 0.06 }] },
  drink: { tones: [0, 0.07, 0.14].map(delay => ({ wave: "sine" as const, from: 400, to: 700, dur: 0.07, gain: 0.15, delay })), jitter: 0.05 },
  castLine: { tones: [{ wave: "noise", from: 2500, to: 1000, dur: 0.25, gain: 0.12, q: 3 }] },
  bite: { tones: [{ wave: "noise", from: 900, to: 400, dur: 0.15, gain: 0.25, q: 2 }, { wave: "sine", from: 600, to: 300, dur: 0.1, gain: 0.1 }] },
  catch: { tones: [{ wave: "noise", from: 700, to: 300, dur: 0.3, gain: 0.25, q: 1 }, { wave: "square", from: 784, dur: 0.1, gain: 0.07, delay: 0.1 }, { wave: "square", from: 1047, dur: 0.14, gain: 0.07, delay: 0.18 }] },

  // The Old Mother and her eggs, in the credits (src/game/credits.ts): a great slow wingbeat, her roar, the gilding
  // ringing as it flakes off, and an egg cracking open with a chirp out of it.
  wingbeat: { tones: [{ wave: "noise", from: 320, to: 110, dur: 0.45, gain: 0.4, q: 0.8 }, { wave: "sine", from: 70, to: 45, dur: 0.35, gain: 0.2 }] },
  roar: { tones: [{ wave: "sawtooth", from: 120, to: 62, dur: 1.9, gain: 0.16 }, { wave: "noise", from: 700, to: 180, dur: 1.7, gain: 0.3, q: 0.6 },
    { wave: "square", from: 90, to: 48, dur: 1.8, gain: 0.07, delay: 0.05 }, { wave: "sine", from: 55, to: 40, dur: 2, gain: 0.25 }] },
  gilding: { tones: [1568, 2093, 2637, 3136].map((f, i) => ({ wave: "sine" as const, from: f, dur: 0.6, gain: 0.05, delay: i * 0.09 })) },
  hatch: { tones: [{ wave: "noise", from: 2600, to: 1400, dur: 0.07, gain: 0.25, q: 3 }, { wave: "noise", from: 1900, to: 900, dur: 0.1, gain: 0.2, q: 3, delay: 0.08 },
    { wave: "sine", from: 900, to: 1700, dur: 0.16, gain: 0.07, delay: 0.2 }, { wave: "sine", from: 1100, to: 1900, dur: 0.12, gain: 0.06, delay: 0.38 }], jitter: 0.08 },

  // And their song, the three new voices and hers under them, that seals the valley whole: a D chord, rising.
  song: { tones: [[147, 0, 3.2, 0.12], [294, 0.4, 2.8, 0.06], [440, 0.9, 2.6, 0.05], [587, 1.4, 2.4, 0.045], [740, 1.9, 2.2, 0.04], [880, 2.4, 2.4, 0.035]]
    .map(([f, delay, dur, gain]) => ({ wave: "sine" as const, from: f!, to: f! * 1.003, dur: dur!, gain: gain!, delay })) },

  // The credits (src/game/credits.ts): a slow, warm air in D as the run plays back, a soft low note under each phrase.
  credits: { tones: air(TUNE, BASS) },
  creditsAnswer: { tones: air(ANSWER, ANSWER_BASS, 0.06) },
  creditsRipple: { tones: air(TUNE, RIPPLE.map(([f, beat, beats]) => [f, beat, beats * 1.6] as const), 0.06) },
  creditsHigh: { tones: air(ANSWER, ANSWER_BASS, 0.055, ANSWER.map(([f, beat, beats]) => [third(f), beat, beats] as const)) },
} satisfies Record<string, SoundRecipe>;

export type SfxId = keyof typeof SFX;

/** How far (game pixels) a positioned sound carries before it's silent. */
export const HEARING = 200;
/** Master volume, 0-1. */
export const VOLUME = 0.5;
/** The same sound won't start twice within this many seconds (a sweep hitting five slimes is one hit). */
export const RETRIGGER = 0.03;
