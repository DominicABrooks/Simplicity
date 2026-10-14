// Types for the legacy three.js view while the render layer is ported (see src/render/legacyBridge.ts).
export interface LegacyView {
  setMap(tiles: number[][]): void;
  render(state: unknown, dt: number): void;
  resize(pixelSize: number): void;
  snapCamera(x: number, y: number): void;
  /** Note: legacy screenToGame returns the cell centre space (top-left + 4). */
  screenToGame(clientX: number, clientY: number): { x: number; y: number } | null;
  gameToScreen(x: number, y: number, height?: number): { x: number; y: number };
  critters(): unknown;
}

export function createView(canvas: HTMLCanvasElement, PAL: Record<string, string>, C: Record<string, number>): LegacyView;
