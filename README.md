# Simplicity

A fantasy RPG drawn in 8×8 pixel sprites, playable in the browser.

## Play

Open `game/index.html` in a browser, or serve the folder:

```
python -m http.server 8123 -d game
```

WASD or arrows to move, Space to jump, J or click to attack. Walk into water to swim. Slimes chase you, and potions restore two hearts.

## Layout

- [ART_STYLE.md](ART_STYLE.md): the rules every sprite follows
- `palette/simplicity.txt`: the 16-colour palette
- `art/`: sprites as text, one file per entity (`art/tiles/` for ground)
- `tools/build.py`: turns `art/` into PNG sheets and previews in `build/`, and `game/sprites.js` for the game
- `game/`: the web game (plain HTML and JavaScript, no dependencies)

After editing anything in `art/`, rebuild:

```
pip install pillow
python tools/build.py
```
