// Plays the music (src/data/music.ts) with WebAudio, a half-beat at a time, a little ahead of the clock. The tune is
// made up as it goes: a held chord a bar, a low note under it, now and then a ripple, and a tune that wanders the
// scale and leans on the chord's notes. Changing area fades one theme out and the next in; the hour and the weather
// change it gently as it plays. Like the sound effects, it waits for the first click or key press.
import { MUSIC_FADE, MUSIC_VOLUME, THEMES, hz, moodOf, noteOf, playing, scaleOf, themeFor, type Playing, type Theme, type ThemeId } from "../data/music.ts";
import type { Game } from "../game/game.ts";

export interface MusicPlayer {
  /** Keep the music going for the game as it is now: call it every frame. */
  update(g: Game): void;
}

/** Seconds ahead of the clock that notes are laid down. */
const LOOKAHEAD = 0.3;
/** Half-beats a bar. */
const STEPS = 8;

/** What's playing, for looking at from the console. */
export const nowPlaying: { theme: ThemeId | null; playing: Playing | null } = { theme: null, playing: null };

export function createMusicPlayer(): MusicPlayer {
  let ctx: AudioContext | null = null, filter: BiquadFilterNode | null = null, echo: GainNode | null = null;
  const unlock = (): void => {
    if (!ctx) {
      ctx = new AudioContext();
      const master = ctx.createGain(), delay = ctx.createDelay(1), feedback = ctx.createGain();
      master.gain.value = MUSIC_VOLUME;
      master.connect(ctx.destination);
      filter = ctx.createBiquadFilter();
      filter.type = "lowpass";
      filter.Q.value = 0.5;
      filter.connect(master);
      echo = ctx.createGain();
      echo.gain.value = 0;
      delay.delayTime.value = 0.42;
      feedback.gain.value = 0.38;
      filter.connect(echo).connect(delay).connect(feedback).connect(delay);
      delay.connect(master);
    }
    if (ctx.state === "suspended") void ctx.resume();
  };
  addEventListener("pointerdown", unlock);
  addEventListener("keydown", unlock);

  let id: ThemeId | null = null, out: GainNode | null = null;
  let step = 0, bar = 0, nextAt = 0, tune = 7;

  /** One note: a quick (or slow) swell, then a fade to nothing by `start + dur`. */
  function note(midi: number, wave: OscillatorType, start: number, dur: number, peak: number, attack: number): void {
    const c = ctx!, o = c.createOscillator(), env = c.createGain();
    o.type = wave;
    o.frequency.value = hz(midi);
    env.gain.setValueAtTime(0, start);
    env.gain.linearRampToValueAtTime(peak, start + attack);
    env.gain.exponentialRampToValueAtTime(0.0001, start + dur);
    o.connect(env).connect(out!);
    o.start(start);
    o.stop(start + dur + 0.05);
  }

  /** Lay down one half-beat of the theme, at `t`. */
  function playStep(theme: Theme, p: Playing, t: number, half: number): void {
    const scale = scaleOf(theme, p.dark), at = (d: number, up = 0) => noteOf(theme.root + up, scale, d);
    const chord = theme.chords[bar % theme.chords.length]!, g = p.gain;
    // Saw and square are loud for their size: take them down to sit with the soft waves.
    const soft = (w: OscillatorType) => (w === "sawtooth" || w === "square" ? 0.4 : 1);
    if (step === 0) {
      for (const d of [chord, chord + 2, chord + 4]) note(at(d), theme.pad, t, half * STEPS * 1.1, 0.07 * g * soft(theme.pad), half * 3);
      if (p.rain > 0.05) note(theme.root - 24, "sine", t, half * STEPS * 1.2, 0.12 * p.rain * g, half * 4);
    }
    if (step === 0 || step === 4) note(at(chord, -12), "triangle", t, half * 3.5, 0.16 * g, 0.02);
    if (theme.arp) note(at([chord, chord + 2, chord + 4, chord + 7][step % 4]!, 12 - p.lower), "sine", t, half * 1.6, 0.05 * g, 0.01);
    // The tune: a step or two along the scale, or a leap back toward the chord if it strays; on the beat, a chord note.
    if (Math.random() < p.density * (step % 2 === 0 ? 1.2 : 0.6)) {
      tune += [-2, -1, -1, 1, 1, 2][Math.floor(Math.random() * 6)]!;
      if (Math.abs(tune - (chord + 7)) > 5) tune = chord + 7 + (Math.random() < 0.5 ? 0 : 2);
      if (step % 2 === 0 && Math.random() < 0.6) tune = chord + 7 + [0, 2, 4][Math.floor(Math.random() * 3)]!;
      const len = Math.random() < 0.3 ? 3 : Math.random() < 0.5 ? 2 : 1;
      note(at(tune, -p.lower), theme.lead, t, half * len * 1.4, 0.11 * g * soft(theme.lead), 0.015);
    }
    // Rain: a drop or two of high notes.
    if (Math.random() < 0.12 * p.rain) note(at(chord + 14 + Math.floor(Math.random() * 5)), "sine", t + Math.random() * half, 0.5, 0.04 * g, 0.005);
  }

  return {
    update(g) {
      if (!ctx || !filter || !echo || ctx.state !== "running") return;
      const now = ctx.currentTime, want = themeFor(g.state, g.area.def);
      if (want !== id) {
        if (out) {
          out.gain.setValueAtTime(out.gain.value, now);
          out.gain.linearRampToValueAtTime(0, now + MUSIC_FADE);
          const old = out;
          setTimeout(() => old.disconnect(), (MUSIC_FADE + 3) * 1000);
        }
        id = want;
        out = null;
        if (id) {
          out = ctx.createGain();
          out.gain.setValueAtTime(0, now);
          out.gain.linearRampToValueAtTime(1, now + MUSIC_FADE);
          out.connect(filter);
          step = 0; bar = 0; tune = 7; nextAt = now + 0.1;
        }
      }
      nowPlaying.theme = id;
      if (!id) { nowPlaying.playing = null; return; }
      const theme: Theme = THEMES[id], p = playing(theme, moodOf(theme, g.hour, g.weather));
      nowPlaying.playing = p;
      filter.frequency.setTargetAtTime(p.bright, now, 1.5);
      echo.gain.setTargetAtTime(p.echo, now, 1.5);
      if (nextAt < now - 0.5) nextAt = now + 0.05;                    // back from a hidden tab: don't play the missed notes all at once
      const half = 30 / p.bpm;
      while (nextAt < now + LOOKAHEAD) {
        playStep(theme, p, nextAt, half);
        nextAt += half;
        if (++step === STEPS) { step = 0; bar++; }
      }
    },
  };
}
