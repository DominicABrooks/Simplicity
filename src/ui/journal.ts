// The journal: a bestiary of every enemy. Undiscovered enemies are black silhouettes; the first kill
// of a kind reveals its portrait and its page. Discoveries are saved in the browser and kept across runs.
import { BESTIARY, emptyJournal, type BestiaryEntry, type BestiaryId, type Journal } from "../data/bestiary.ts";
import type { Game } from "../game/game.ts";
import { renderPortraits } from "../render/portraits.ts";
import { byId, markHandled } from "./dom.ts";

const STORAGE_KEY = "simplicity.journal";

export interface JournalView {
  toggle(): void;
  close(): void;
  isOpen(): boolean;
}

function load(): Journal {
  const journal = emptyJournal();
  try {
    const saved: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null");
    if (saved && typeof saved === "object")
      for (const id of Object.keys(journal) as BestiaryId[]) {
        const n = (saved as Record<string, unknown>)[id];
        if (typeof n === "number" && n >= 0) journal[id] = Math.floor(n);
      }
  } catch { /* nothing saved, or storage unavailable */ }
  return journal;
}

/**
 * Save, merged with what's already saved (the higher count wins), so two open tabs never erase
 * each other's discoveries. The merged counts are written back into `journal` too.
 */
function save(journal: Journal): void {
  const saved = load();
  for (const id of Object.keys(journal) as BestiaryId[]) journal[id] = Math.max(journal[id], saved[id]);
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(journal)); } catch { /* storage unavailable */ }
}

const el = <K extends keyof HTMLElementTagNameMap>(tag: K, className = "", text = ""): HTMLElementTagNameMap[K] => {
  const e = document.createElement(tag);
  if (className) e.className = className;
  if (text) e.textContent = text;
  return e;
};

/** `onNew` is told when there's an unread discovery (true) and when it's been seen (false). */
export function createJournal(g: Game, onNew: (unread: boolean) => void): JournalView {
  const panel = byId("journal"), list = byId("journalList"), page = byId("journalPage"), progress = byId("journalProgress");
  g.journal = load();
  let selected: BestiaryId = BESTIARY[0]!.id;
  let portraits: Record<BestiaryId, string> | null = null;

  const known = (id: BestiaryId) => g.journal[id] > 0;
  const portrait = (entry: BestiaryEntry, className: string) => {
    const frame = el("div", `${className}${known(entry.id) ? "" : " locked"}`);
    if (portraits) {
      const img = new Image();
      img.src = portraits[entry.id];
      img.alt = known(entry.id) ? entry.name : "Unknown";
      img.draggable = false;
      frame.append(img);
    }
    return frame;
  };

  function renderList(): void {
    list.replaceChildren(...BESTIARY.map(entry => {
      const item = el("li");
      const button = el("button", `entry${entry.id === selected ? " selected" : ""}`);
      button.type = "button";
      button.append(portrait(entry, "thumb"), el("span", "entry-name", known(entry.id) ? entry.name : "???"));
      button.addEventListener("click", () => { selected = entry.id; render(); });
      item.append(button);
      return item;
    }));
    const found = BESTIARY.filter(e => known(e.id)).length;
    progress.textContent = `${found} of ${BESTIARY.length} discovered`;
  }

  function renderPage(): void {
    const entry = BESTIARY.find(e => e.id === selected)!;
    const head = el("div", "head");
    if (!known(entry.id)) {
      head.classList.add("unknown");
      head.append(portrait(entry, "portrait"), el("h3", "", "???"));
      page.replaceChildren(head, el("p", "lore", "Defeat one to fill in this page."));
      return;
    }
    const stats = el("dl", "stats");
    for (const [label, value] of [["Health", entry.health], ["Experience", String(entry.xp)], ["Defeated", String(g.journal[entry.id])]]) {
      stats.append(el("dt", "", label!), el("dd", "", value!));
    }
    const abilities = el("ul", "abilities");
    abilities.append(...entry.abilities.map(a => el("li", "", a)));
    head.append(portrait(entry, "portrait"), el("h3", "", entry.name));
    page.replaceChildren(
      head, stats, el("p", "lore", entry.lore),
      el("h4", "", "Abilities"), abilities, el("h4", "", "Drops"), el("p", "drops", entry.drops),
    );
  }

  function render(): void {
    renderList();
    renderPage();
  }

  function setOpen(open: boolean): void {
    panel.hidden = !open;
    if (!open) return;
    if (!portraits) {
      try { portraits = renderPortraits(); } catch { /* no WebGL for portraits: show the pages without them */ }
    }
    onNew(false);
    render();
  }

  g.events.on("journal", ({ id, first }) => {
    save(g.journal);
    if (first) { selected = id; if (panel.hidden) onNew(true); }
    if (!panel.hidden) render();
  });
  panel.addEventListener("mousedown", ev => markHandled(ev));
  panel.addEventListener("contextmenu", ev => ev.preventDefault());
  panel.querySelector(".journal-close")!.addEventListener("click", () => setOpen(false));

  return {
    toggle: () => setOpen(Boolean(panel.hidden)),
    close: () => setOpen(false),
    isOpen: () => !panel.hidden,
  };
}
