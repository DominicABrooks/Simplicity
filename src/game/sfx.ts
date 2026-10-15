// One-shot sound effects. Like fx, gameplay pushes them and the audio player consumes each once, so
// gameplay never touches WebAudio (and runs in tests). A sound with a position is heard from the hero:
// quieter further off, panned to its side. One without plays flat, like a UI sound.
import type { SfxId } from "../data/sfx.ts";
import type { Game } from "./game.ts";

export interface Sfx {
  id: SfxId;
  x?: number;
  y?: number;
}

/** Play a sound, at a game position if it has one. */
export function sound(g: Game, id: SfxId, at?: { x: number; y: number }): void {
  g.sfx.push(at ? { id, x: at.x, y: at.y } : { id });
}
