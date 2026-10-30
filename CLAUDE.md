# Axolotl Dungeon

A small browser game: a cartoon axolotl swims through a randomly generated, water-filled underground cave network, drawn on a 2D canvas. The art should feel like that: natural rock walls, with water in the open spaces. Plain JavaScript, no build step and no dependencies. The scripts in `index.html` are `defer`red and share globals, so their load order matters.

## Top priority: smooth frame rate

- **All code has to run very efficiently. No frames may be skipped during play.**
- When beautiful art and frames per second pull in different directions, choose the frame rate. Use blockier, less detailed art if that keeps play smooth.
- Treat everything called from `animate()` as the hot path. Don't allocate objects or arrays there when it can be avoided, keep per-frame loops tight, and do expensive work once, at startup or when the window resizes, never every frame.
- Every new drawing or effect has to be cheap compared with what's already drawn each frame.

## Running it

Serve the folder and open it, e.g. `python -m http.server 8123` then http://localhost:8123. Opening `index.html` directly from the file system doesn't work in the preview pane. Browsers cache the CSS and JS hard, so hard-refresh (Ctrl+Shift+R) after changing them.

## How it fits together

- `Terrain.js`: builds the cave from white noise smoothed by a cellular automaton, then adds a solid wall border. One cell is `PIXEL_RATIO` (50) px.
- Wall shape: `squareOutline` (marching squares) is the single source of the rock shape. Both drawing (`buildWallPaths`) and collision (`findContact`) use it, so the axolotl collides with exactly the rock you see. It writes into reused typed arrays, so it doesn't allocate.
- Drawing the world: everything is pre-rendered into 400px chunks (`renderChunk`). Chunks are built the first time they're needed and kept in a cache of up to 48, so each frame `drawView` is only a handful of `drawImage` calls.
  - Wall edges use marching squares through the cell centres, so the cave keeps the cell layout while the edges look like rock. Each edge's wobble comes from a hash of its position, so neighbouring chunks line up exactly.
  - Water is one tileable 800px caustic texture, generated once at startup (about 80 ms).
  - Keep new world art inside the chunk renderer, never in the per-frame path.
- `Meeple.js`: the player axolotl.
  - Movement is one signed `velocity` along the facing `angle` (negative means reversing). The player likes this steering, so don't swap it for a momentum model; one was tried and rejected.
  - Collision treats the body as three circles (head, body, tail, in `BODY_CIRCLES`) and pushes them out of the rock.
  - Bouncing (`bounce`): the path mirrors off the rock surface at full speed, which is as strong a bounce as the original game had. The axolotl then swings round to the new heading at `BOUNCE_TURN_RATE` per frame instead of snapping. It picks whichever is the smaller turn: swimming forwards along the new path or backing along it.
  - Angle 0 for the facing `angle` points down the screen (+y), and the angle grows towards +x.
  - `draw()` rotates the canvas so the head points along local +x. A single swimming wave (`swimOffset`) moves the head a little, the body more and the tail the most, all in sync; its speed follows `velocity`.
- `canvas.js`: sets up the canvas, the input listeners and the `animate()` loop. The camera keeps the axolotl at the canvas centre, and the terrain is drawn offset around it. The map is always north-up and never rotates: a rotating camera was tried and made the player feel sick, so don't bring it back.
- `responsive.js`: leftover code for an `#info` panel that's commented out, so it throws on load. `main.js` is empty.

## Layout

- The canvas is a square sized by the shorter screen side (normally the height, since the game is mostly played on laptops in landscape). It's pinned to the left with a `CANVAS_PADDING` gap.
- The border (2px black, 5px corners) lives in `styles.css`. `CANVAS_BORDER` in `canvas.js` must match the border width.
- Mouse coordinates are measured from inside the canvas border (`updateMousePosition`).

## Known quirks

- The collision circles don't bend with the swimming wave, so the tail tip can brush slightly into rock while it wiggles.
- Physics advances a fixed amount per frame and doesn't scale by elapsed time, so the game runs faster on high-refresh screens.
