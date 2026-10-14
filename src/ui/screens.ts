// The title / death overlay, toasts and the hold-R reset bar.
import { RESET_HOLD } from "../data/player.ts";
import { TOAST_MS } from "../data/ui.ts";
import type { Game } from "../game/game.ts";
import { byId } from "./dom.ts";

/** Show the overlay on the title screen and after a fall. */
export function bindOverlay(g: Game): void {
  const overlay = byId("overlay"), message = byId("message");
  g.events.on("state", ({ state }) => {
    overlay.hidden = state !== "title" && state !== "dead";
    if (state === "dead") message.textContent = "Press R to rise again.";
  });
}

/** Short messages across the top of the screen ("Level 3!", "Inventory full"). */
export function bindToasts(g: Game): void {
  const el = byId("toast");
  let timer: ReturnType<typeof setTimeout> | undefined;
  g.events.on("toast", ({ text, good }) => {
    el.textContent = text;
    el.hidden = false;
    el.classList.toggle("good", good);
    clearTimeout(timer);
    timer = setTimeout(() => { el.hidden = true; }, TOAST_MS);
  });
}

/** The bar that fills while R is held. Quick taps don't show it. */
export function createResetBar(g: Game): { draw(): void } {
  const el = byId("resetHold"), fill = el.querySelector("i")!;
  return {
    draw() {
      el.hidden = g.resetHold < 0.08;
      fill.style.width = `${Math.min(100, (g.resetHold / RESET_HOLD) * 100)}%`;
    },
  };
}

/** Fade to black while travelling between areas, and back in on arrival. */
export function bindFade(g: Game): void {
  const el = byId("fade");
  g.events.on("state", ({ state }) => el.classList.toggle("on", state === "travel"));
}
