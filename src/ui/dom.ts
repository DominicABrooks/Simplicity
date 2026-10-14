/** An element from index.html that must exist. */
export function byId<T extends HTMLElement = HTMLElement>(id: string): T {
  const el = document.getElementById(id);
  if (!el) throw new Error(`#${id} is missing from index.html`);
  return el as T;
}

/** Is this inside a UI panel (anything marked data-ui), rather than the game world? */
export const isUiTarget = (target: EventTarget | null): boolean => target instanceof Element && !!target.closest("[data-ui]");

// Mouse events the UI has dealt with, so the game doesn't also treat them as attacks.
const handled = new WeakSet<Event>();
export const markHandled = (e: Event): void => void handled.add(e);
export const isHandled = (e: Event): boolean => handled.has(e);
