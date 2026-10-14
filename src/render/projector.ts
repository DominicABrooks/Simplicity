import type { Point } from "../world/collision.ts";

/** Converts between the game's ground plane and the screen. Provided by the 3D view. */
export interface Projector {
  /** A game position (cell top-left) at a height in world units -> CSS pixels on screen. */
  gameToScreen(x: number, y: number, height?: number): Point;
  /** A screen point -> the cell (top-left) under it on the ground, or null if the ray misses the ground. */
  screenToGame(clientX: number, clientY: number): Point | null;
}
