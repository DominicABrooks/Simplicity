# Simplicity

A fantasy RPG that plays in 2D and looks like a late-90s 3D game: chunky low-poly models with PlayStation-style rendering, in the browser.

**Play it in your browser: https://dominicabrooks.github.io/Simplicity/**

Every push to `main` republishes the game there (see `.github/workflows/pages.yml`).

## Run it locally

You need **Python 3**. Nothing else to install, and no internet connection: three.js is bundled in `game/vendor`.

1. Open a terminal in this folder (the one with this README).
2. Run the dev server:

   ```
   python tools/serve.py
   ```

   On macOS or Linux, use `python3` if `python` isn't found.
3. Open http://localhost:8123 in a browser.

The game is already built: `game/sprites.js` is generated from `art/` and committed. Rebuild only after changing the art (see the end of this file). The server disables browser caching, so a reload always picks up your edits. Opening `game/index.html` directly as a file won't work, because browsers block ES modules from `file://`.

## Play

WASD or arrows to move (double-tap a direction to dash), the mouse to aim, Space to jump, J or click to attack in the aimed direction. Walk into water to swim. Hold R for a second to restart the run. Slimes chase you, and potions restore two hearts.

**Combat text and crits:** WoW-style numbers float up as pixel text: white for your hits, red for damage you take, green for healing, lilac for XP. Every hit (sword, punch, arrow) has a 10% chance to **crit** for double damage, shown as a big gold number with a "!", with a little extra hitstop, shake and gold sparks.

**Experience:** kills give XP (10 per slime, 50 per mage), shown on the purple bar along the bottom, with your level in the medallion at its left end. Level 2 takes 50 XP and each level needs 40 more, up to level 20. Each level gives raw stats on top of your gear (+2% movement speed per level, +1 life every 2 levels, +1 damage every 4 levels) and, as in WoW, a full heal.

**Mages:** once you've killed a few slimes, a rare mage may appear: a robed twin of you that keeps its distance, telegraphs every spell with a charge-up in its hands, and casts. There are three schools:

- **Ember Mage** (red robes): fireballs, and sometimes a purple orb, **polymorph**, which turns you into a sheep for 5 seconds (a sheep can only walk; any damage breaks it).
- **Frost Mage** (icy white robes): frostbolts that **chill** you to about half speed for 2.5 s. Get close and it casts **Frost Nova**: a frost ring grows on the ground around it, and if you're still inside when it goes off you're **frozen** in ice for 1.6 s.
- **Storm Mage** (indigo and gold robes): fast **spark** bolts with a short wind-up, and **Lightning Strike**: three glowing circles appear on and around you, and lightning hits each one 0.9 s later. Keep moving.

Dash or jump through bolts and the nova; only a dash's invulnerability beats lightning. Get close and a mage blinks away (6 s cooldown), including when you pin it against trees or water. Catch it up close while blink is on cooldown and it draws a sword and chases you, swinging (watch for the raised blade), until blink is ready and it escapes. Outrun it (more than about 5.5 tiles) and it goes back to casting. Mages scale with your level: they appear more often (15% of spawns at level 1, up to 50%), more can be out at once (one more every 5 levels, up to 4), and they get tougher (6 health at level 1, +2 per level). They always drop a magic or better item.

**Sword:** every attack is a wide swipe that alternates direction and steps you forward. Pressing during a swipe queues the next one, so mashing chains smoothly, and swipes and dashes feed each other: a dash cancels a swipe at any point and readies your next swipe, and every swipe resets your dash cooldown, so you can weave swipe, dash, swipe, dash. Hits briefly freeze the action and shake the camera.

Slimes drop loot. Walk over it to pick it up, and press I (or Tab) for the inventory: drag an item to a cell or an equipment slot (or click to pick it up and click to place it), right-click to equip or unequip, and drop it outside the panel to leave it on the ground. Drag the panel by its title to move it; it remembers where you put it. Equipment adds damage, life, movement speed and faster dash recovery, and every piece shows on your character. You start with nothing equipped and a plain starter set in your bag.

**Bows:** equip a bow (you start with an Old Short Bow; more drop as loot). Hold the left mouse button to draw: you can still move, at about half speed. Release to shoot at the cursor. A longer draw shoots faster and further, and a full draw (0.6 s) is a power shot with +1 damage and a glowing arrowhead. Arrows hit the first slime in their path and stick in trees.

**Fishing:** equip the Old Fishing Pole (weapon slot), then hold the left mouse button to wind up: a ring marks where the cast will land (blue over water). Release to cast exactly there, up to about 5 tiles away. When the bobber dips and a **!** appears, click within a second to hook the fish; click early or walk away to reel in. Catches go in your bag: Pond, Silver and Golden Koi. Right-click a koi to eat it for 1, 2 or 4 life. Releasing over land swings a weak attack instead.

## Layout

- [ART_STYLE.md](ART_STYLE.md): the rules every sprite follows
- `palette/simplicity.txt`: the 16-colour palette
- `art/`: pixel sprites as text, used for HUD icons and as reference designs
- `tools/build.py`: turns `art/` into PNG sheets and previews in `build/`, and `game/sprites.js` for the game
- `game/main.js`: gameplay (2D, 8 px per tile)
- `game/view.js`: the low-poly 3D renderer (three.js)
- `game/inventory.js`: items, loot rolls, the inventory grid and equipment
- `game/tiers.js`: rarity colours shared by worn gear and inventory icons
- `game/ambient.js`: critters (bunnies, birds, butterflies, frogs) and environmental detail (grass, reeds, lily pads, mushrooms, logs, cloud shadows, falling leaves)
- `tools/serve.py`: no-cache dev server
- `game/vendor/three.module.js`: three.js r160 (MIT), bundled so the game has no outside dependencies
- `font/pixel.txt` and `tools/build_font.py`: the game's pixel font (builds `game/fonts/simplicity-pixel.ttf` and `game/font.js`)

After editing anything in `art/`, rebuild:

```
pip install pillow
python tools/build.py
```

After editing `font/pixel.txt`, rebuild the font (no extra packages needed):

```
python tools/build_font.py
```
