# Simplicity

A fantasy RPG that plays in 2D and looks like a late-90s 3D game: chunky low-poly models with PlayStation-style rendering, in the browser.

## Play

Serve the `game` folder (ES modules need a local server; three.js loads from a CDN):

```
python -m http.server 8123 -d game
```

WASD or arrows to move, Space to jump, J or click to attack. Walk into water to swim. Slimes chase you, and potions restore two hearts.

## Layout

- [ART_STYLE.md](ART_STYLE.md): the rules every sprite follows
- `palette/simplicity.txt`: the 16-colour palette
- `art/`: pixel sprites as text, used for HUD icons and as reference designs
- `tools/build.py`: turns `art/` into PNG sheets and previews in `build/`, and `game/sprites.js` for the game
- `game/main.js`: gameplay (2D, 8 px per tile)
- `game/view.js`: the low-poly 3D renderer (three.js)

After editing anything in `art/`, rebuild:

```
pip install pillow
python tools/build.py
```
