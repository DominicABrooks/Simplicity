// Plays the game's sound effects with WebAudio, synthesized from the recipes in data/sfx.ts. Browsers
// keep audio locked until the first click or key press, so the context is made (or resumed) then;
// sounds raised before that are dropped.
import { HEARING, RETRIGGER, SFX, VOLUME, type SfxId, type Tone } from "../data/sfx.ts";
import type { Sfx } from "../game/sfx.ts";

export interface AudioPlayer {
  /** Play (and empty) this frame's queue, heard from the listener's position. */
  play(queue: Sfx[], listener: { x: number; y: number } | undefined): void;
}

export function createAudioPlayer(): AudioPlayer {
  let ctx: AudioContext | null = null, master: GainNode | null = null, noise: AudioBuffer | null = null;
  const lastAt = new Map<SfxId, number>();

  const unlock = (): void => {
    if (!ctx) {
      ctx = new AudioContext();
      master = ctx.createGain();
      master.gain.value = VOLUME;
      master.connect(ctx.destination);
      noise = whiteNoise(ctx);
    }
    if (ctx.state === "suspended") void ctx.resume();
  };
  addEventListener("pointerdown", unlock);
  addEventListener("keydown", unlock);

  function tone(t: Tone, at: number, pitch: number, out: AudioNode): void {
    const c = ctx!, start = at + (t.delay ?? 0), end = start + t.dur;
    const env = c.createGain();
    env.gain.setValueAtTime(0.0001, start);
    env.gain.exponentialRampToValueAtTime(t.gain, start + Math.min(0.01, t.dur / 4));
    env.gain.exponentialRampToValueAtTime(0.0001, end);
    env.connect(out);
    let src: AudioScheduledSourceNode, freq: AudioParam;
    if (t.wave === "noise") {
      const n = c.createBufferSource(), band = c.createBiquadFilter();
      n.buffer = noise; n.loop = true;
      band.type = "bandpass"; band.Q.value = t.q ?? 1;
      n.connect(band).connect(env);
      src = n; freq = band.frequency;
    } else {
      const o = c.createOscillator();
      o.type = t.wave;
      o.connect(env);
      src = o; freq = o.frequency;
    }
    freq.setValueAtTime(t.from * pitch, start);
    if (t.to !== undefined) freq.exponentialRampToValueAtTime(t.to * pitch, end);
    src.start(start);
    src.stop(end + 0.02);
  }

  return {
    play(queue, listener) {
      const sounds = queue.splice(0);
      if (!ctx || !master || ctx.state !== "running") return;
      const now = ctx.currentTime;
      for (const s of sounds) {
        if (now - (lastAt.get(s.id) ?? -1) < RETRIGGER) continue;
        let volume = 1, pan = 0;
        if (listener && s.x !== undefined && s.y !== undefined) {
          const dx = s.x - listener.x, d = Math.hypot(dx, s.y - listener.y);
          if (d >= HEARING) continue;
          volume = (1 - d / HEARING) ** 2;
          pan = Math.max(-1, Math.min(1, dx / (HEARING / 2))) * 0.7;
        }
        lastAt.set(s.id, now);
        const recipe = SFX[s.id], jitter = "jitter" in recipe ? recipe.jitter : 0;
        const pitch = 1 + (Math.random() * 2 - 1) * jitter;
        const gain = ctx.createGain(), panner = ctx.createStereoPanner();
        gain.gain.value = volume;
        panner.pan.value = pan;
        gain.connect(panner).connect(master);
        for (const t of recipe.tones) tone(t, now, pitch, gain);
      }
    },
  };
}

/** A second of white noise, looped for every hiss and thud. */
function whiteNoise(ctx: AudioContext): AudioBuffer {
  const buf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate), data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  return buf;
}
