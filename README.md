# Simplicity

A fantasy RPG that plays in 2D and looks like a late-90s 3D game: chunky low-poly models with PlayStation-style rendering, in the browser.

## Quick start

You need **Python 3** and an internet connection (three.js and the UI font load from CDNs). Nothing else to install to play.

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

**Ember Mage:** once you've killed a few slimes, a rare red-robed twin of you may appear. It keeps its distance and throws fireballs: watch for the fireball growing in its hands, then dash or jump through the shot. Get close and it blinks away (6 s cooldown), including when you pin it against trees or water. If you catch it up close while blink is on cooldown, it draws a sword and chases you, swinging (watch for the raised blade), until blink is ready and it escapes. Every so often it charges a purple orb instead: that's **polymorph**, which turns you into a sheep for 5 seconds. A sheep can only walk, but taking any damage breaks the spell. It has twice a slime's health and always drops a magic or better item.

**Sword:** every attack is a wide swipe that alternates direction and steps you forward. Pressing during a swipe queues the next one, so mashing chains smoothly, and a dash cancels a swipe's recovery. Hits briefly freeze the action and shake the camera.

Slimes drop loot. Walk over it to pick it up, and press I (or Tab) for the inventory: click an item to pick it up, click to place it, right-click to equip or unequip, and click outside the panel to drop what you're holding. Equipment adds damage, life, movement speed and faster dash recovery, and every piece shows on your character. You start with nothing equipped and a plain starter set in your bag.

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
- `tools/serve.py`: no-cache dev server

After editing anything in `art/`, rebuild:

```
pip install pillow
python tools/build.py
```
