/** An element from index.html that must exist. */
export function byId<T extends HTMLElement = HTMLElement>(id: string): T {
  const el = document.getElementById(id);
  if (!el) throw new Error(`#${id} is missing from index.html`);
  return el as T;
}

// Mouse events the UI has dealt with, so the game doesn't also treat them as attacks.
const handled = new WeakSet<Event>();
export const markHandled = (e: Event): void => void handled.add(e);
export const isHandled = (e: Event): boolean => handled.has(e);
