// Lighting by the hour: the sky (and the fog that fades into it), the sky light and the sun, blended
// between a few key moments of the day. Night is dark and moonlit blue (lamps, windows and fires, being
// unlit materials, glow through it); dawn and dusk go warm.
import * as THREE from "three";
import { SUNRISE, SUNSET } from "../data/daylight.ts";
import { PAL } from "../data/palette.ts";

interface Key {
  hour: number;
  sky: string;
  /** Hemisphere light: sky colour and strength. */
  fill: number;
  fillI: number;
  /** The sun by day, the moon by night. */
  sun: number;
  sunI: number;
}

const NIGHT = { sky: "#0d0d1e", fill: 0x4a5aa0, fillI: 0.48, sun: 0x8aa0ff, sunI: 0.65 };
const DAY = { sky: PAL.k, fill: 0xcfe3ff, fillI: 1.5, sun: 0xffe2b0, sunI: 2.4 };
const KEYS: Key[] = [
  { hour: 0, ...NIGHT },
  { hour: SUNRISE - 1.5, ...NIGHT },
  { hour: SUNRISE, sky: "#3a2236", fill: 0xffb8a0, fillI: 0.8, sun: 0xff9a5a, sunI: 1.1 },   // dawn
  { hour: SUNRISE + 2, ...DAY },
  { hour: SUNSET - 2, ...DAY },
  { hour: SUNSET, sky: "#3a2236", fill: 0xffbca8, fillI: 0.8, sun: 0xff9a5a, sunI: 1.1 },    // dusk
  { hour: SUNSET + 1.5, ...NIGHT },
  { hour: 24, ...NIGHT },
];

export interface Daylight {
  update(hour: number): void;
}

export function createDaylight(sky: THREE.Color, fill: THREE.HemisphereLight, sun: THREE.DirectionalLight): Daylight {
  const a = new THREE.Color(), b = new THREE.Color();
  const mix = (target: THREE.Color, from: string | number, to: string | number, k: number): void => {
    target.copy(a.set(from).lerp(b.set(to), k));
  };
  return {
    update(hour) {
      const i = KEYS.findIndex(k => k.hour > hour), hi = KEYS[Math.max(1, i)]!, lo = KEYS[Math.max(0, i - 1)]!;
      const k = THREE.MathUtils.smoothstep(hour, lo.hour, hi.hour);
      mix(sky, lo.sky, hi.sky, k);
      mix(fill.color, lo.fill, hi.fill, k);
      fill.intensity = THREE.MathUtils.lerp(lo.fillI, hi.fillI, k);
      mix(sun.color, lo.sun, hi.sun, k);
      sun.intensity = THREE.MathUtils.lerp(lo.sunI, hi.sunI, k);
    },
  };
}
