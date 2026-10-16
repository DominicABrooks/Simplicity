// Plays the music (src/data/music.ts) with WebAudio, a half-beat at a time, a little ahead of the clock. The tune is
// made up as it goes: a held chord a bar, a low note under it, now and then a ripple, and a tune that wanders the
// scale and leans on the chord's notes. Changing area fades one theme out and the next in; the hour and the weather
// change it gently as it plays. Like the sound effects, it waits for the first click or key press. N turns it off and
// on again, and that's remembered for the next visit. In a fairy ring's spell (src/game/fairyring.ts) the fair folk's
// own music takes over, a little quieter, under their bells; and under the hill with only the watchers there (the third
// time and after: src/game/underhill.ts), theirs, warped and distorted.
import { MUSIC_FADE, MUSIC_VOLUME, THEMES, hz, moodOf, noteOf, playing, scaleOf, themeFor, type Playing, type Theme, type ThemeId } from "../data/music.ts";
import { tranceOf } from "../game/fairyring.ts";
import { toast, type Game } from "../game/game.ts";
import { UNDERHILL_ID, visitsUnderhill } from "../game/underhill.ts";

export interface MusicPlayer {
  /** Keep the music going for the game as it is now: call it every frame. */
  update(g: Game): void;
}

/** Seconds ahead of the clock that notes are laid down. */
const LOOKAHEAD = 0.3;
/** Half-beats a bar. */
const STEPS = 8;
/** The key that turns the music off and on, and where that's kept. */
const MUTE_KEY = "n", STORAGE_KEY = "simplicity.musicOff";

/** What's playing, for looking at from the console. */
export const nowPlaying: { theme: ThemeId | null; playing: Playing | null; muted: boolean } = { theme: null, playing: null, muted: false };

export function createMusicPlayer(): MusicPlayer {
  let ctx: AudioContext | null = null, master: GainNode | null = null, filter: BiquadFilterNode | null = null, echo: GainNode | null = null;
  const unlock = (): void => {
    if (!ctx) {
      ctx = new AudioContext();
      master = ctx.createGain();
      const delay = ctx.createDelay(1), feedback = ctx.createGain();
      master.gain.value = muted ? 0 : MUSIC_VOLUME;
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

  let muted = false, game: Game | null = null;
  try { muted = localStorage.getItem(STORAGE_KEY) === "1"; } catch { /* storage unavailable */ }
  addEventListener("keydown", e => {
    if (e.key.toLowerCase() !== MUTE_KEY || e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
    muted = !muted;
    try { localStorage.setItem(STORAGE_KEY, muted ? "1" : "0"); } catch { /* storage unavailable */ }
    if (ctx && master) master.gain.setTargetAtTime(muted ? 0 : MUSIC_VOLUME, ctx.currentTime, 0.1);
    if (game) toast(game, muted ? "Music off (N)" : "Music on (N)");
  });

  let id: ThemeId | null = null, out: GainNode | null = null;
  let step = 0, bar = 0, nextAt = 0, tune = 7, lastLead: number | null = null;

  /**
   * One note: a quick (or slow) swell, then a fade to nothing by `start + dur`. It can be `detune`d (cents), `wobble`
   * (cents either way, a few times a second, or `rate`), slide in from the note before (`from`, MIDI), and `sag`
   * (semitones down as it sounds).
   */
  function voice(midi: number, wave: OscillatorType, start: number, dur: number, peak: number, attack: number,
    opts: { detune?: number; wobble?: number; rate?: number; from?: number | null; sag?: number } = {}): void {
    const c = ctx!, o = c.createOscillator(), env = c.createGain();
    o.type = wave;
    o.detune.value = opts.detune ?? 0;
    if (opts.from != null) {
      o.frequency.setValueAtTime(hz(opts.from), start);
      o.frequency.exponentialRampToValueAtTime(hz(midi), start + Math.min(0.25, dur / 3));
    } else o.frequency.setValueAtTime(hz(midi), start);
    if (opts.sag) o.frequency.exponentialRampToValueAtTime(hz(midi - opts.sag), start + dur);
    if (opts.wobble) {
      const lfo = c.createOscillator(), depth = c.createGain();
      lfo.frequency.value = opts.rate ? opts.rate * (0.8 + Math.random() * 0.4) : 3 + Math.random() * 2.5;
      depth.gain.value = opts.wobble;
      lfo.connect(depth).connect(o.detune);
      lfo.start(start);
      lfo.stop(start + dur + 0.05);
    }
    env.gain.setValueAtTime(0, start);
    env.gain.linearRampToValueAtTime(peak, start + attack);
    env.gain.exponentialRampToValueAtTime(0.0001, start + dur);
    o.connect(env).connect(out!);
    o.start(start);
    o.stop(start + dur + 0.05);
  }

  /** A kettle drum struck: a thump that drops onto its note (`midi`) and rings away. */
  function drum(midi: number, start: number, peak: number): void {
    const c = ctx!;
    for (const [wave, mul, ring, gain] of [["sine", 1, 1.1, 1], ["triangle", 1.5, 0.25, 0.35]] as const) {
      const o = c.createOscillator(), env = c.createGain();
      o.type = wave;
      o.frequency.setValueAtTime(hz(midi) * mul * 1.5, start);
      o.frequency.exponentialRampToValueAtTime(hz(midi) * mul, start + 0.05);
      env.gain.setValueAtTime(0, start);
      env.gain.linearRampToValueAtTime(peak * gain, start + 0.006);
      env.gain.exponentialRampToValueAtTime(0.0001, start + ring);
      o.connect(env).connect(out!);
      o.start(start);
      o.stop(start + ring + 0.05);
    }
  }

  /** Lay down one half-beat of the theme, at `t`. */
  function playStep(theme: Theme, p: Playing, t: number, half: number): void {
    // Each note as the theme has it: in a warped theme, a little out of tune and sagging.
    const warp = theme.warp ?? 0;
    const note: typeof voice = (midi, wave, start, dur, peak, attack, opts = {}) =>
      voice(midi, wave, start, dur, peak, attack, { ...opts, detune: (opts.detune ?? 0) + (Math.random() * 2 - 1) * warp, sag: theme.sag, rate: theme.wobbleRate });
    const scale = scaleOf(theme, p.dark), at = (d: number, up = 0) => noteOf(theme.root + up, scale, d);
    const chord = theme.chords[bar % theme.chords.length]!, g = p.gain, up = scale.length;   // `up` degrees: an octave
    // Saw and square are loud for their size: take them down to sit with the soft waves.
    const soft = (w: OscillatorType) => (w === "sawtooth" || w === "square" ? 0.4 : 1);
    if (step === 0) {
      for (const d of [chord, chord + 2, chord + 4]) {
        const twin = theme.detune ?? 0, each = twin ? 0.6 : 1;
        const [dur, attack] = theme.swell ? [half * STEPS * 1.02, half * STEPS * 0.95] : [half * STEPS * 1.1, half * 3];
        note(at(d), theme.pad, t, dur, 0.07 * g * soft(theme.pad) * each, attack, { detune: -twin / 2 });
        if (twin) note(at(d), theme.pad, t, dur, 0.07 * g * soft(theme.pad) * each, attack, { detune: twin / 2 });
      }
      if (theme.drone) for (const [n, peak] of [[theme.root - 12, 0.1], [theme.root - 6, 0.04]] as const) {
        note(n, "sine", t, half * STEPS * 1.4, peak * g, half * 4, { wobble: 8 });
      }
      if (p.rain > 0.05) note(theme.root - 24, "sine", t, half * STEPS * 1.2, 0.12 * p.rain * g, half * 4);
    }
    if (step === 0 || step === 4) note(at(chord, -12), "triangle", t, half * 3.5, 0.16 * g, 0.02);
    // A royal theme: the fanfare opening each phrase, and the kettle drums.
    const phrase = bar % 4, fanfaring = theme.fanfare && phrase === 0;
    if (fanfaring && step === 0) {
      // Da, da-da, da, DAAA: up the chord to its octave, the trumpets an octave over the tune and a fourth voice under.
      for (const [d, at0, len] of [[0, 0, 1.5], [0, 1.5, 0.5], [2, 2, 1], [4, 3, 1], [up, 4, 4]] as const) {
        const m = at(chord + d, 12 - p.lower);
        note(m, "sawtooth", t + at0 * half, len * half * 1.15, 0.12 * g * 0.4, 0.025);
        note(m - 12, "square", t + at0 * half, len * half * 1.15, 0.07 * g * 0.4, 0.025);
      }
    }
    if (theme.timpani) {
      const low = at(chord, -12);
      if (step === 0) drum(low, t, 0.3 * g);
      if (step === 4 && bar % 2 === 1) drum(at(chord + 4, -12), t, 0.22 * g);
      if (phrase === 3 && step >= 4) for (const k of [0, 0.5]) drum(at(4, -12), t + k * half, (0.08 + 0.05 * (step - 4 + k)) * g);   // the roll, swelling into the next phrase
    }
    if (theme.arp) note(at([chord, chord + 2, chord + 4, chord + up][step % 4]!, 12 - p.lower), "sine", t, half * 1.6, 0.05 * g, 0.01);
    // The tune: a step or two along the scale, or a leap back toward the chord if it strays; on the beat, a chord note.
    // (A stately one only on the beat; and not over a fanfare.)
    const offBeat = step % 2 === 1;
    if (!fanfaring && !(theme.stately && offBeat) && Math.random() < p.density * (offBeat ? 0.6 : 1.2)) {
      tune += [-2, -1, -1, 1, 1, 2][Math.floor(Math.random() * 6)]!;
      if (Math.abs(tune - (chord + up)) > 5) tune = chord + up + (Math.random() < 0.5 ? 0 : 2);
      if (step % 2 === 0 && Math.random() < 0.6) tune = chord + up + [0, 2, 4][Math.floor(Math.random() * 3)]!;
      const len = theme.stately ? [2, 3, 4][Math.floor(Math.random() * 3)]! : (Math.random() < 0.3 ? 3 : Math.random() < 0.5 ? 2 : 1) * (theme.wobble ? 2 : 1);
      const m = at(tune, -p.lower);
      note(m, theme.lead, t, half * len * 1.4, 0.11 * g * soft(theme.lead), theme.wobble ? half * 0.8 : 0.015,
        theme.wobble ? { wobble: theme.wobble, from: lastLead } : {});
      lastLead = m;
    }
    // Rain: a drop or two of high notes.
    if (Math.random() < 0.12 * p.rain) note(at(chord + 14 + Math.floor(Math.random() * 5)), "sine", t + Math.random() * half, 0.5, 0.04 * g, 0.005);
  }

  return {
    update(g) {
      game = g;
      nowPlaying.muted = muted;
      if (!ctx || !master || !filter || !echo || ctx.state !== "running") return;
      const trance = tranceOf(g), now = ctx.currentTime;
      const want = themeFor(g.state, g.area.def, { fey: trance > 0, watched: g.area.def.id === UNDERHILL_ID && visitsUnderhill(g) >= 3, hour: g.hour });
      master.gain.setTargetAtTime(muted ? 0 : MUSIC_VOLUME * (1 - 0.35 * trance), now, 0.4);
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
          const drive = (THEMES[id] as Theme).distort;
          if (drive) {
            const d = distortion(ctx, drive);
            out.connect(d.input);
            d.output.connect(filter);
          } else out.connect(filter);
          step = 0; bar = 0; tune = 7; lastLead = null; nextAt = now + 0.1;
        }
      }
      nowPlaying.theme = id;
      if (!id) { nowPlaying.playing = null; return; }
      const theme: Theme = THEMES[id], p = playing(theme, moodOf(theme, g.hour, g.weather));
      nowPlaying.playing = p;
      if (muted) { nextAt = now + 0.05; return; }                    // nothing's laid down while it's off
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

/** Driven hard into a soft clip and brought back down to about the loudness it went in at: `amount` 0-1. */
function distortion(ctx: AudioContext, amount: number): { input: AudioNode; output: AudioNode } {
  const drive = ctx.createGain(), shaper = ctx.createWaveShaper(), trim = ctx.createGain(), k = 1 + amount * 60;
  const curve = new Float32Array(1024);
  for (let i = 0; i < curve.length; i++) {
    const x = (i / (curve.length - 1)) * 2 - 1;
    curve[i] = Math.tanh(k * x) / Math.tanh(k);
  }
  shaper.curve = curve;
  shaper.oversample = "4x";
  drive.gain.value = 2;
  trim.gain.value = 0.2;
  drive.connect(shaper).connect(trim);
  return { input: drive, output: trim };
}
