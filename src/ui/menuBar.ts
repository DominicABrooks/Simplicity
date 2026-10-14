// The menu bar in the bottom-right, WoW style: a framed button per panel with a pixel icon, its key
// in the corner and a tooltip. A button lights up while its panel is open, and can pulse for attention.
import { byId, markHandled } from "./dom.ts";
import { spriteFrame } from "./sprites.ts";

export interface MenuButton {
  /** Sprite name from art/ (16x16 icons in art/ui). */
  icon: string;
  label: string;
  key: string;
  onClick(): void;
  /** Greyed out and inert; the tooltip says this instead (e.g. "Coming Soon"). */
  disabled?: string;
}

export interface MenuBar {
  /** Light a button while its panel is open. */
  setActive(index: number, on: boolean): void;
  /** Pulse a button (something new to look at) until it's opened. */
  setAlert(index: number, on: boolean): void;
  /** Its width in CSS pixels (the HUD keeps clear of it). */
  width(): number;
}

export function createMenuBar(buttons: MenuButton[]): MenuBar {
  const bar = byId("menuBar");
  const tip = document.createElement("div");
  tip.className = "bar-tip";
  tip.hidden = true;
  bar.addEventListener("mousedown", ev => markHandled(ev));
  const els = buttons.map(b => {
    const el = document.createElement("button");
    el.type = "button";
    el.className = `bar-btn${b.disabled ? " disabled" : ""}`;
    el.setAttribute("aria-label", b.disabled ? `${b.label}: ${b.disabled}` : `${b.label} (${b.key})`);
    if (b.disabled) el.setAttribute("aria-disabled", "true");
    const img = new Image();
    img.src = spriteFrame(b.icon, "idle").toDataURL();
    img.alt = "";
    img.draggable = false;
    const key = document.createElement("span");
    key.className = "key";
    key.textContent = b.key;
    el.append(img, key);
    // Clicking never focuses the button, or Space (jump) and Enter (attack) would press it again.
    el.addEventListener("mousedown", ev => ev.preventDefault());
    el.addEventListener("click", () => { if (!b.disabled) b.onClick(); });
    el.addEventListener("mouseenter", () => {
      tip.textContent = b.disabled ?? `${b.label} (${b.key})`;
      tip.hidden = false;
      tip.style.right = `${bar.getBoundingClientRect().right - el.getBoundingClientRect().right}px`;
    });
    el.addEventListener("mouseleave", () => { tip.hidden = true; });
    return el;
  });
  bar.append(tip, ...els);

  return {
    setActive: (i, on) => els[i]?.classList.toggle("active", on),
    setAlert: (i, on) => els[i]?.classList.toggle("alert", on),
    width: () => bar.getBoundingClientRect().width,
  };
}
