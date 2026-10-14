# Simplicity

A fantasy RPG that plays in 2D and looks like a late-90s 3D game: chunky low-poly models with PlayStation-style rendering, in the browser.

**Play it in your browser: https://dominicabrooks.github.io/Simplicity/**

Every push to `main` republishes the game there (see `.github/workflows/pages.yml`).

## Run it locally

You need [Node.js](https://nodejs.org) 20 or newer.

```
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
| `npm run typecheck` | TypeScript, strict |
| `npm run lint` | ESLint |
| `npm run format` | Prettier |
| `npm run assets` | Rebuild sprites and the font from `art/`, `palette/` and `font/` (runs automatically before `dev`, `build` and `test`) |

CI runs lint, typecheck, tests and the build on every push and pull request; a push to `main` deploys only if they all pass.

## Play

WASD or arrows to move (double-tap a direction to dash), the mouse to aim, Space to jump, J or click to attack in the aimed direction. The buttons in the bottom-right open your inventory (I) and the map (M). Walk into water to swim. Hold R for a second to restart the run. Slimes chase you, and potions restore two hearts.

**Map:** press M (or the map button) for a parchment map of the area you're in, showing where you are and which way you're facing, the camp and the caves.

**Areas:** you start in **Witchwood**. A dirt path leads north from the camp through the woods to a cave; walk in to come out at **the King's Bridge** below **Capital City**, the seat of the kingdom of men and the richest city in it, a city of four districts:

- **The King's Bridge**, before the walls: out of the cave and straight onto the King's Bridge, a broad stone bridge over the great river with pinnacled parapets, banner standards and braziers, and a great gate tower standing in the stream at either end; the harbour quay beyond it (cogs and rowing boats moored, treadwheel cranes, the customs house on its arcade, the merchants' guildhall), the merchant palaces in their gardens, the Gate Plaza with its two great fountains, the barbican, the drawbridge over the moat, and Southgate in the great south wall.
- **The Market Quarter**: the high street up to the market square (the great fountain, the market cross, four rows of stalls under bunting, the guildhall over its open arcade, the Crown and the Bell), St Mary's and St Giles', and lanes of tall timber-framed houses, gable end to the street, shops on the main streets.
- **The Cathedral Close**, along East Street: the cathedral (twin west towers, flying buttresses, a crossing spire, chapels round its east end), the cloister and chapter house, the bishop's palace, the canons' houses and the churchyard.
- **The Castle**, up Castle Street, built into the city wall: a barbican and drawbridge, the outer bailey (barracks, armoury, granary, training yard, stables, smithy, storehouse, a trebuchet, kennels, mews and a dovecote), and through the inner gatehouse the keep on its crag, the great hall and kitchen, the chapel, lodgings and bakehouse.

Guards in the kingdom's colours keep the gates; nothing hostile lives in the city. Walk back into the cave to return. Your gear and level go with you; each area keeps its own creatures.

**Journal (coming soon):** greyed out on the menu bar for now; it's built and switched off in `src/data/features.ts`. A bestiary of every enemy. Each starts as a black silhouette; kill one and its page fills in with its portrait, a little about it, its health, experience, abilities and drops, and how many you've defeated. Your discoveries are saved in the browser and kept across runs. The book button glows when there's a new entry.

**Combat text and crits:** WoW-style numbers float up as pixel text: white for your hits, red for damage you take, green for healing, lilac for XP. Every hit (sword, punch, arrow) has a 10% chance to **crit** for double damage, shown as a big gold number with a "!", with a little extra hitstop, shake and gold sparks.

**Experience:** kills give XP (10 per slime, 50 per mage), shown on the purple bar along the bottom, with your level in the medallion at its left end. Level 2 takes 50 XP and each level needs 40 more, up to level 20. Each level gives raw stats on top of your gear (+2% movement speed per level, +1 life every 2 levels, +1 damage every 4 levels) and, as in WoW, a full heal.

**Mages:** once you've killed a few slimes, a rare mage may appear: a robed twin of you that keeps its distance, telegraphs every spell with a charge-up in its hands, and casts. There are three schools:

- **Ember Mage** (red robes): fireballs, and sometimes a purple orb, **polymorph**, which turns you into a sheep for 5 seconds (a sheep can only walk; any damage breaks it).
- **Frost Mage** (icy white robes): frostbolts that **chill** you to about half speed for 2.5 s. Get close and it casts **Frost Nova**: a frost ring grows on the ground around it, and if you're still inside when it goes off you're **frozen** in ice for 1.6 s.
- **Storm Mage** (indigo and gold robes): fast **spark** bolts with a short wind-up, and **Lightning Strike**: three glowing circles appear on and around you, and lightning hits each one 0.9 s later. Keep moving.

Dash or jump through bolts and the nova; only a dash's invulnerability beats lightning. Get close and a mage blinks away (6 s cooldown), including when you pin it against trees or water. Catch it up close while blink is on cooldown and it draws a sword and chases you, swinging (watch for the raised blade), until blink is ready and it escapes. Outrun it (more than about 5.5 tiles) and it goes back to casting. Mages scale with your level: they appear more often (15% of spawns at level 1, up to 50%), more can be out at once (one more every 5 levels, up to 4), and they get tougher (6 health at level 1, +2 per level). They always drop a magic or better item.

**Sword:** every attack is a wide swipe that alternates direction and steps you forward. Pressing during a swipe queues the next one, so mashing chains smoothly, and swipes and dashes feed each other: a dash cancels a swipe at any point and readies your next swipe, and every swipe resets your dash cooldown, so you can weave swipe, dash, swipe, dash. Hits briefly freeze the action and shake the camera.

Slimes drop loot. Walk over it to pick it up, and press I (or Tab) for the inventory: drag an item to a cell or an equipment slot (or click to pick it up and click to place it), right-click to equip or unequip, and drop it outside the panel to leave it on the ground. Drag the panel by its title to move it; it remembers where you put it. Equipment adds damage, life, movement speed and faster dash recovery, and every piece shows on your character. You start with nothing equipped and a plain starter set in your bag.

**Bows:** equip a bow (you start with an Old Short Bow; more drop as loot). Hold the left mouse button to draw: you can still move, at about half speed. Release to shoot at the cursor. A longer draw shoots faster and further, but only a full draw (0.6 s) hits hard: a power shot with your full damage +1 and a glowing arrowhead. A partial draw deals at most half your damage, and if that would be nothing (always, early on) the arrow just flops out and drops to the ground, further the longer you drew; if it reaches an enemy it glances off for 0. Arrows hit the first slime in their path and stick in trees.

**Fishing:** equip the Old Fishing Pole (weapon slot), then hold the left mouse button to wind up: a ring marks where the cast will land (blue over water). Release to cast exactly there, up to about 5 tiles away. When the bobber dips and a **!** appears, click within a second to hook the fish; click early or walk away to reel in. Catches go in your bag: Pond, Silver and Golden Koi. Right-click a koi to eat it for 1, 2 or 4 life. Releasing over land swings a weak attack instead.

## Layout

The game is TypeScript with an entity-component-system design; see [ARCHITECTURE.md](ARCHITECTURE.md) for how it fits together and how to add enemies, items, spells and systems.

- `src/main.ts`: wires everything together and runs the loop
- `src/core/`: the ECS (`World`), a typed event bus, the seeded RNG and math helpers
- `src/data/`: tuning and content as typed tables: player, enemies and spells, items and affixes, tiers, progression
- `src/areas/`: the areas, one module each (the world map is the links between them)
- `src/world/`: areas, tile maps and collision
- `src/items/`: items, loot rolls and the inventory model
- `src/game/`: components, entity factories and shared combat rules
- `src/systems/`: gameplay systems (hero, weapons, enemies, mages, spells), run in order by `step()`
- `src/input/`: keyboard and mouse
- `src/render/`: the low-poly three.js view, from terrain to critters, with one view per kind of entity
- `src/ui/`: HUD, inventory panel, tooltip, labels, toasts and overlay
- `tests/`: Vitest specs, with fixtures captured from the original game
- `tools/`: asset builders (`build-sprites.ts`, `build-font.ts`), run with `npm run assets`
- `art/`, `palette/`, `font/`: sprite, palette and font sources as text; [ART_STYLE.md](ART_STYLE.md) has the rules
- `docs/contact-sheet.png`: every sprite, built from `art/`
