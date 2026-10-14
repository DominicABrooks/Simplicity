// The pixel HUD, drawn on its own low-res canvas over the 3D view: hearts, the XP bar and combat text.
import { PAL } from "../data/palette.ts";
import { XP, xpToNext } from "../data/progression.ts";
import type { Game } from "../game/game.ts";
import type { Projector } from "../render/projector.ts";
import { byId } from "./dom.ts";
import { outlinedText, pixelDisc, pixelText, pixelTextWidth } from "./pixelFont.ts";
import { spriteFrame } from "./sprites.ts";

export interface Hud {
  /** Match the 3D view's pixel size. */
  resize(pixelSize: number): void;
  draw(): void;
}

export function createHud(g: Game, view: Projector): Hud {
  const canvas = byId<HTMLCanvasElement>("hudCanvas"), ctx = canvas.getContext("2d")!;

  function drawHearts(): void {
    const health = g.world.need(g.player, "health");
    for (let i = 0; i < health.maxHp; i++) {
      const heart = spriteFrame("heart", i < health.hp ? "full" : "empty");
      ctx.drawImage(heart, 3 + (i % 10) * 10, 3 + Math.floor(i / 10) * 10);
    }
  }

  // WoW-style XP bar along the bottom, as pixel art like the hearts: palette colours, a 1px ink
  // outline, a bark-and-oak frame, 20 notched segments, and the level in a gold-rimmed badge.
  function drawXPBar(W: number, H: number): void {
    const hero = g.world.need(g.player, "hero"), max = hero.level >= XP.maxLevel;
    const frac = max ? 1 : hero.xp / xpToNext(hero.level);
    const bw = Math.min(200, W - 40), x0 = Math.round((W - bw) / 2) + 6, y0 = H - 9, inner = 4;
    // Frame: ink outline, bark body, oak highlight on the top edge.
    ctx.fillStyle = PAL.K; ctx.fillRect(x0 - 2, y0 - 2, bw + 4, inner + 4);
    ctx.fillStyle = PAL.n; ctx.fillRect(x0 - 1, y0 - 1, bw + 2, inner + 2);
    ctx.fillStyle = PAL.N; ctx.fillRect(x0 - 1, y0 - 1, bw + 2, 1);
    // Track and fill: arcane purple with a light top row and a dark bottom row.
    ctx.fillStyle = PAL.k; ctx.fillRect(x0, y0, bw, inner);
    const fw = Math.round(bw * frac);
    if (fw > 0) {
      ctx.fillStyle = PAL.P; ctx.fillRect(x0, y0, fw, inner);
      ctx.fillStyle = "#b48ae0"; ctx.fillRect(x0, y0, fw, 1);
      ctx.fillStyle = "#5e2f8a"; ctx.fillRect(x0, y0 + inner - 1, fw, 1);
    }
    // 20 segments, split by bark notches.
    for (let i = 1; i < 20; i++) {
      ctx.fillStyle = PAL.n;
      ctx.fillRect(x0 + Math.round((bw * i) / 20), y0, 1, inner);
    }
    // Level badge on the left end: ink ring, gold rim, void centre, gold digits.
    const cx = x0 - 6, cy = y0 + 1;
    pixelDisc(ctx, cx, cy, 7.2, PAL.K);
    pixelDisc(ctx, cx, cy, 6.2, PAL.Y);
    pixelDisc(ctx, cx, cy, 5.2, PAL.O);
    pixelDisc(ctx, cx, cy, 4.4, PAL.k);
    const label = String(hero.level);
    pixelText(ctx, label, cx - Math.floor(pixelTextWidth(label) / 2), cy - 2, PAL.Y);   // 5 rows centred on cy
  }

  // Combat text rises from where it happened; crits pop in big, then settle.
  function drawCombatText(W: number, H: number): void {
    for (const f of g.floaters) {
      const k = 1 - f.t;                                     // 0 -> 1 over the number's life
      const s = view.gameToScreen(f.x, f.y, 0.9 + k * 0.9);
      const scale = f.crit ? (k < 0.12 ? 3 : 2) : 1;
      const w = pixelTextWidth(f.text, scale);
      const x = Math.round((s.x * W) / innerWidth - w / 2) + f.jx, y = Math.round((s.y * H) / innerHeight) - 5 * scale;
      ctx.globalAlpha = Math.min(1, f.t * 3);
      outlinedText(ctx, f.text, x, y, f.color, scale);
    }
    ctx.globalAlpha = 1;
  }

  return {
    resize(pixelSize) {
      canvas.width = Math.ceil(innerWidth / pixelSize);
      canvas.height = Math.ceil(innerHeight / pixelSize);
    },
    draw() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      drawHearts();
      drawXPBar(canvas.width, canvas.height);
      drawCombatText(canvas.width, canvas.height);
    },
  };
}
