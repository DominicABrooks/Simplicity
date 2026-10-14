// The pixel HUD, drawn on its own low-res canvas over the 3D view: hearts, the day dial, the XP bar and combat text.
import { dialPosition, isDay } from "../data/daylight.ts";
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
  /** `reserveRight`: CSS pixels on the right of the bottom edge to keep clear (the menu bar). */
  draw(reserveRight?: number): void;
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
  function drawXPBar(W: number, H: number, reserve: number): void {
    const hero = g.world.need(g.player, "hero"), max = hero.level >= XP.maxLevel;
    const frac = max ? 1 : hero.xp / xpToNext(hero.level);
    // Centred along the bottom, narrowing if needed to stay clear of the menu bar on the right.
    const bw = Math.max(40, Math.min(200, W - 40, W - 2 * (reserve + 10))), x0 = Math.round((W - bw) / 2) + 6, y0 = H - 9, inner = 4;
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

  // The time of day, top centre, on a bark plate like the XP bar's frame: no numbers, just a notch
  // sliding along a groove between the sun (left) and the moon (right). By day it creeps from the sun
  // toward the moon, by night back again; whichever is up is lit and the other dimmed.
  function drawClock(W: number): void {
    const day = isDay(g.hour), groove = 40, w = groove + 30, x0 = Math.round((W - w) / 2), y0 = 2, h = 11, cy = y0 + 5;
    ctx.fillStyle = PAL.K; ctx.fillRect(x0 - 1, y0 - 1, w + 2, h + 2);
    ctx.fillStyle = PAL.n; ctx.fillRect(x0, y0, w, h);
    ctx.fillStyle = PAL.N; ctx.fillRect(x0, y0, w, 1);
    ctx.globalAlpha = day ? 1 : 0.35;
    drawSun(x0 + 7, cy);
    ctx.globalAlpha = day ? 0.35 : 1;
    drawMoon(x0 + w - 8, cy);
    ctx.globalAlpha = 1;
    // The groove, with oak ticks at the quarters, like marks scratched on a sundial.
    const gx = x0 + 15;
    ctx.fillStyle = PAL.K; ctx.fillRect(gx - 1, cy - 1, groove + 2, 3);
    ctx.fillStyle = PAL.k; ctx.fillRect(gx, cy, groove, 1);
    ctx.fillStyle = PAL.N;
    for (let i = 0; i <= 4; i++) ctx.fillRect(gx + Math.round(((groove - 1) * i) / 4), cy + 3, 1, 1);
    // The notch: gold by day, moonlit by night, inked all round.
    const nx = gx + Math.round((groove - 1) * dialPosition(g.hour));
    ctx.fillStyle = PAL.K; ctx.fillRect(nx - 2, cy - 4, 5, 9);
    ctx.fillStyle = day ? PAL.Y : PAL.C; ctx.fillRect(nx - 1, cy - 3, 3, 7);
    ctx.fillStyle = PAL.W; ctx.fillRect(nx, cy - 2, 1, 5);
  }

  function drawSun(cx: number, cy: number): void {
    ctx.fillStyle = PAL.O;
    for (const [dx, dy] of [[0, -4], [0, 4], [-4, 0], [4, 0], [-3, -3], [3, -3], [-3, 3], [3, 3]] as const) ctx.fillRect(cx + dx, cy + dy, 1, 1);
    pixelDisc(ctx, cx, cy, 2.3, PAL.Y);
    ctx.fillStyle = PAL.W; ctx.fillRect(cx - 1, cy - 1, 1, 1);
  }

  // A crescent: a pale disc with an offset disc cut out of it.
  function drawMoon(cx: number, cy: number): void {
    ctx.fillStyle = PAL.W;
    for (let y = -3; y <= 3; y++) for (let x = -3; x <= 3; x++) {
      if (x * x + y * y > 3.3 * 3.3 || (x - 2) ** 2 + (y + 1) ** 2 <= 2.6 * 2.6) continue;
      ctx.fillRect(cx + x, cy + y, 1, 1);
    }
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
    draw(reserveRight = 0) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      drawHearts();
      drawClock(canvas.width);
      drawXPBar(canvas.width, canvas.height, (reserveRight * canvas.width) / innerWidth);
      drawCombatText(canvas.width, canvas.height);
    },
  };
}
