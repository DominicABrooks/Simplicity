// HUD colours and sizes.
import { PAL } from "./palette.ts";

/** WoW-style combat text: white for your hits, gold for crits, red for damage taken, green for healing, lilac for XP. */
export const COMBAT_COLORS = { hit: PAL.W, crit: PAL.Y, taken: PAL.R, heal: PAL.G, xp: "#c79cf0" } as const;

/** How long a toast stays up, in ms. */
export const TOAST_MS = 1500;
