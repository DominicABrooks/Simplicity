# Simplicity

**A solo game jam entry: a one-hour fantasy RPG built in 72 hours.** It plays in 2D and looks like a late-90s 3D game, with chunky low-poly models and PlayStation-style rendering, right in the browser.

**▶ Play it: https://dominicabrooks.github.io/Simplicity/**

## The jam

Simplicity was made for a self-imposed, 72-hour solo game jam. There was no theme; the only rules were the clock and doing it alone.

The goal going in was a whole game, start to credits, rather than a demo: about an hour of story for a player who goes straight from beat to beat, with exploring, fishing and loot-hunting on top for anyone who wants them. That meant keeping the play simple (move, swing, shoot, talk, all on a flat 2D map) and spending the time on the world instead: the look, the city and its people, the fights and the story.

What got made in the 72 hours:

- **A complete story**, from waking on a stone in the woods to the credits, with cutscenes, dialogue and an ending.
- **Twelve areas** across the woods, the capital and what's under it, with interiors you can walk into, each one downloaded the first time you travel there.
- **Five bosses**, each with its own fight: Cinder, Rime, Calder, the Great Koi and the Grey Ringer.
- **Real-time combat** with sword, bow and three schools of enemy mage, plus loot, levels and gear that shows on your character.
- **A living capital**: townsfolk with homes, jobs and gossip, doors to knock on, a day and night cycle and weather.
- **Music made up as it plays**, which follows the hour and the weather.
- **No asset packs**: every sprite, palette and the pixel font are text files in this repo, built by the project's own tools, and every 3D model is built in code.

It was built fast and it shows in places. Rough edges are part of the jam.

## The game

You wake on an old stone in the Witchwood, a stranger who can't speak. The way deeper into the woods is barred by the King's woodwardens, so you go north instead, over the King's Bridge into **Kingsholm**, the capital, and up to the castle to stand before the King. He reads the Ranger's note you carry, works out what you are, and asks you for the one thing his frightened kingdom needs: go deep into the Witchwood and kill **Calder**, the leader of the Greyed, the robed mages haunting it.

With the King's watchword the barricade opens, and the forest goes more and more wrong the further in you go:

| Area | What's there |
| --- | --- |
| **The Witchwood** | Where you wake: the camp, the woods, a pond full of koi, the woodwardens' barricade |
| **The King's Bridge** | White marble and gold leaf over the great river, up to the city wall |
| **The Market Quarter** | The market square and fountain, two churches, timber-framed lanes, shops and townsfolk |
| **The Castle** | Barbican, drawbridge and ward, and the King in his Throne Room |
| **The Ashwild** | Ash-grey trees and cracked ground. Ember mages, and **Cinder** at the Greyed's first camp |
| **The Frozen Hollow** | Always winter: a frozen lake under falling snow. Frost mages, and **Rime** at the middle of the ice |
| **The Koi Grotto** | Where something very large has been swimming under the Hollow's ice: **the Great Koi** |
| **The Thunder Rift** | A storm out of a clear sky, and **Calder** at the edge of the great crack |
| **St Mary's churchyard** | After dark, if the rumours are true: **the Grey Ringer** |
| **…and three more** | Off the story path, for whoever goes looking. No spoilers |

Old stones along the way are checkpoints: fall, and you wake on the last one you touched with your gear and level kept.

## How to play

| Control | Action |
| --- | --- |
| **WASD** / arrows | Move (double-tap a direction to dash) |
| **Mouse** | Aim |
| **Left click** / **J** | Attack where you aim; with a bow, hold to draw and release to shoot |
| **Space** | Jump |
| **E** | Talk, knock on a door, rest, pet |
| **I** / **Tab** | Inventory |
| **M** | Map |
| **N** | Music on or off |
| **Esc** | Close panels, skip a cutscene |
| **Hold R** | Restart the run |

Some things worth knowing:

- **The sword** swipes wide and alternates direction. Mash to chain swipes, and weave in dashes: a dash cancels a swipe, and every swipe resets your dash.
- **The bow** only hits hard on a full draw (0.6 s), which fires a glowing power shot. A short draw just flops out.
- **Mages** keep their distance and telegraph every spell. Ember mages throw fire and can turn you into a sheep, Frost mages slow and freeze you, Storm mages call lightning onto where you stand. Dash or jump through bolts; only a dash beats lightning.
- **Loot** drops from what you kill. Drag items into your equipment slots, or right-click to equip. Every piece shows on your character.
- **Levels** come from kills, up to 20. Each one makes you a little faster and tougher, and heals you fully.
- **Fishing:** equip the Old Fishing Pole, hold to wind up a cast, release over water, and click when the **!** appears. Right-click a koi to eat it.
- **Talk to people.** The city's townsfolk have rumours, gossip and the odd errand, and some of them matter.

## Run it locally

You need [Node.js](https://nodejs.org) 20 or newer.

```bash
npm ci
npm run dev
```

Then open http://localhost:8123/Simplicity/. The dev server reloads as you edit.

| Command | What it does |
| --- | --- |
| `npm run dev` | Dev server with hot reload |
| `npm run build` | Type-check, then build the site into `dist/` |
| `npm run preview` | Serve the built `dist/` locally |
| `npm test` | Run the tests (Vitest) |
| `npm run e2e` | Play the story's big beats in headless Chromium (Playwright); the first time, `npx playwright install chromium` |
| `npm run typecheck` | TypeScript, strict |
| `npm run lint` | ESLint |
| `npm run format` | Prettier |
| `npm run assets` | Rebuild sprites and the font from `art/`, `palette/` and `font/` (runs automatically before `dev`, `build` and `test`) |

CI runs lint, typecheck, tests and the build on every push and pull request, and every push to `main` that passes republishes the game to GitHub Pages (`.github/workflows/pages.yml`).

### Skipping ahead

For judges short on time, and for playtesting, a few URL parameters jump straight to the good parts. They work on the published site too.

| Parameter | What it does |
| --- | --- |
| `?boss=cinder` | Straight into a boss fight, levelled and geared as you'd be by then: `cinder`, `rime`, `koi`, `calder` or `ringer` |
| `&god` | You can't be hurt |
| `&freeze` | The boss stands still |
| `?area=hollow` | Start a fresh run in an area (`&entry=stone` for another way in) |
| `?hour=23` | Set the time of day, 0 to 24 |
| `?ending=home` | Watch the ending |

For example: https://dominicabrooks.github.io/Simplicity/?boss=calder&god

## How it's built

TypeScript with an entity-component-system design, rendered with [three.js](https://threejs.org), bundled with Vite. There are no other runtime dependencies. See [ARCHITECTURE.md](ARCHITECTURE.md) for how it fits together, [ART_STYLE.md](ART_STYLE.md) for the look, and [STORY.md](STORY.md) for the hour, beat by beat. The world's background is in [LORE.md](LORE.md), [HISTORY.md](HISTORY.md), [HERO.md](HERO.md) and [FAMILIES.md](FAMILIES.md).

- `src/main.ts`: wires everything together and runs the loop
- `src/core/`: the ECS (`World`), a typed event bus, the seeded RNG and math helpers
- `src/data/`: tuning and content as typed tables: player, enemies and spells, items, dialogue, the story's beats
- `src/areas/`: the areas, one module each (the world map is the links between them)
- `src/world/`: tile maps, collision and the city's layouts and residents
- `src/items/`: items, loot rolls and the inventory model
- `src/game/`: components, entity factories, bosses, cutscenes and shared combat rules
- `src/systems/`: gameplay systems (hero, weapons, enemies, mages, spells), run in order by `step()`
- `src/render/`: the low-poly three.js view, from terrain to critters, with one view per kind of entity
- `src/audio/`: the generated music and sound
- `src/ui/`: HUD, inventory, map, dialogue, tooltips and credits
- `tests/`: Vitest specs
- `e2e/`: Playwright specs that play the real game in a browser: the road to the King, his audience, the ghost fight, knocking at doors
- `tools/`: asset builders (`build-sprites.ts`, `build-font.ts`), run with `npm run assets`, and the townsfolk outfit lineup (`/Simplicity/lineup.html` on the dev server)
- `art/`, `palette/`, `font/`: sprite, palette and font sources as text
- `docs/contact-sheet.png`: every sprite, built from `art/`
