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

- `GameSettings.js` (loaded first): `GAME_SPEED`, normally 1, which the player raises to test later stages quickly.
  - It multiplies gameplay pace: top speed, acceleration, bounce speed, the post-bounce swing rate, and calories per food. Any new pace-related value (speeds, rewards, rates of progress) should be multiplied by it too.
  - Don't scale looks, sizes, animation timing or per-frame fractions like water drag; a fraction above 1 would make things speed up by themselves.
  - Movement is split into steps of at most `COLLISION_STEP_PX` with a rock check after each (`move` in `Meeple.js`), so high speeds can't tunnel through thin walls.
- Map hacks (`MAP_HACKS` in `GameSettings.js`, normally false): a testing mode the player asks Claude to switch on or off; there's no in-game control.
  - It only changes starting constants: `STARTING_CALORIES` becomes 1,000,000, and `revealAfterEating(n)` returns 0, so every upgrade and the Spend Calories area show at 0 eaten.
  - Every new "appears at N eaten" threshold must go through `revealAfterEating` so map hacks cover it.
- `Terrain.js`: builds the cave from white noise smoothed by a cellular automaton, then adds a solid wall border. One cell is `PIXEL_RATIO` (50) px.
- Wall shape: `squareOutline` (marching squares) is the single source of the rock shape. Both drawing (`buildWallPaths`) and collision (`findContact`) use it, so the axolotl collides with exactly the rock you see. It writes into reused typed arrays, so it doesn't allocate.
- Drawing the world: everything is pre-rendered into 400px chunks (`renderChunk`). Chunks are built the first time they're needed and kept in a cache of up to 48, so each frame `drawView` is only a handful of `drawImage` calls.
  - Wall edges use marching squares through the cell centres, so the cave keeps the cell layout while the edges look like rock. Each edge's wobble comes from a hash of its position, so neighbouring chunks line up exactly.
  - Water is one tileable 800px caustic texture, generated once at startup (about 80 ms).
  - Keep new world art inside the chunk renderer, never in the per-frame path.
- `Meeple.js`: the player axolotl.
  - Movement is one signed `velocity` along the facing `angle` (negative means reversing). The player likes this steering, so don't swap it for a momentum model; one was tried and rejected. Top speed is `maxVelocity` (2.5).
  - Controls: the axolotl always faces the mouse pointer (`faceMouse`), overriding the post-bounce swing. There are no turn keys: W (or up arrow) swims towards the pointer and S (or down arrow) backs away. The left mouse button works exactly like W.
  - Kicks: every fresh press of W or the mouse button triggers a kick (`startBurst`/`kick`). It accelerates hard to `BURST_SPEED_MULTIPLIER` (2×) top speed for `BURST_FRAMES`, even if the key is released immediately, then drag eases it back to normal top speed. Rapid tapping being the fastest way to swim is intended, so don't add a cooldown. Each kick also plays a tail whip (`WHIP_FRAMES`, `WHIP_BEATS`, `WHIP_AMPLITUDE`): the swim wave runs fast and wide for a beat or two, then returns to normal.
  - Collision treats the body as three circles (head, body, tail, in `BODY_CIRCLES`) and pushes them out of the rock.
  - Bouncing (`bounce`): the path mirrors off the rock surface at full speed, which is as strong a bounce as the original game had. The axolotl then swings round to the new heading at `BOUNCE_TURN_RATE` per frame instead of snapping. It picks whichever is the smaller turn: swimming forwards along the new path or backing along it.
  - Angle 0 for the facing `angle` points down the screen (+y), and the angle grows towards +x.
  - `draw()` rotates the canvas so the head points along local +x. A single swimming wave (`swimOffset`) moves the head a little, the body more and the tail the most, all in sync; its speed follows `velocity`.
- `Food.js`: seaweed (1 calorie) and worms (2 calories), kept at a fixed count (`SEAWEED_COUNT` 2,400, `WORM_COUNT` 800) in open water.
  - Every seaweed and worm gets its own randomly generated sprite. Seaweed varies in its lumpy outline. Worms keep the same colours and size but vary in how they curve (arc, C or S) and the angle they lie at; each has two small eyes at its head end.
  - Food sits in 400px buckets, so drawing and the eating check only look at food near the axolotl.
  - Food pulses in step with the axolotl, using the axolotl's own `bulgingRadius`.
  - Any of the three body circles touching a piece eats it, so backing into food counts. Eaten food respawns at a random spot in the water at least `FOOD_SPAWN_CLEARANCE` px away from the axolotl.
  - Eating plays a quick open-and-close of the mouth (`MOUTH_OPEN_FRAMES` in `Meeple.js`).
- Side panel (`#side-panel`, HTML, not canvas): spans the area right of the map with everything centred, positioned in `sizeCanvas`.
  - All page text shares one style: the Fredoka Google font (loaded in `index.html`) in white with a subtle teal edge. Only the Calories counter is pink, as the main heading. The player wants it subtle, not flashy.
  - Calories counter (`#calories`): shows `score.calories`, the spendable balance, and bounces slightly on each eat. `score.eaten` is the lifetime total. Page text only updates when something is eaten or bought, never every frame.
- `Upgrades.js`: the "Spend Calories" area. It appears once `score.eaten` reaches `UPGRADES_REVEAL_AT` (5) and stays visible after spending.
  - `UPGRADES` lists each upgrade with its first price (`baseCost`) and `revealAt`, the total calories eaten (`score.eaten`) before it appears. Until then it is hidden completely, and it never depends on other upgrades being bought.
  - Shared rule for every upgrade: each level's effect is 20% stronger than the last (`UPGRADE_EFFECT_GROWTH`), and each level costs 1.5× the previous (`UPGRADE_COST_GROWTH`). Prices round up to whole numbers.
  - Swim faster: from 10 calories, appears at 5 eaten. Speed is 1.2^level via `Meeple.setSpeedMultiplier`, which scales top speed, acceleration and the kick together.
  - Hoover food: from 20 calories, appears at 15 eaten. Food within `hooverRadius` of the head (36px at level 1, +20% per level) is pulled to the mouth (`FoodField.hooverTowards`, faster as it gets closer, `HOOVER_SPEED`) and eaten on touch. A faint white ring around the head shows the reach.
  - Auto swim: 40 calories, appears at 50 eaten, `oneTime`. Bought once, it then becomes a free on/off switch that stays on the page: pressed in (sunk, darker, inner shadow, "on") while on, popped up ("off") while off. While on (`Meeple.setAutoSwim`/`autoPilot`):
    - W, clicks and mouse movement do nothing.
    - It swims forwards at the held-W top speed and turns randomly left, right or straight for random stretches, like random A/D presses.
    - After a wall hit it stops pushing and turns away from the rock (`AUTO_RECOVER_FRAMES`) before carrying on.
  - Improve smell: 80 calories, appears at 150 eaten. `smellRadius` is 4× Hoover's starting reach (144px) at level 1, +20% per level, shown by a dashed pink ring. It only steers during Auto swim (`Meeple.followSmell`):
    - It targets the nearest food in the ring (`FoodField.findNearest`) and turns towards it at the normal A/D rate, never instantly.
    - It stops pushing for tight turns, so it doesn't circle food.
    - It re-sniffs after eating, and wanders when nothing is in range.
    - It gives up on unreachable food after `SMELL_GIVE_UP_FRAMES`.
    - Sniffing only happens every `SMELL_SEARCH_INTERVAL` frames while it has no target and checks only the nearby buckets. Eaten food is flagged `food.eaten` so the chase notices.
  - Buttons get a random colour, a blobby `border-radius` (8 random values), a slight tilt and a raised bottom edge every load. The price sits in a pill beside the name.
  - Every upgrade needs a `blurb`: a very short, qualitative description with no numbers or maths (e.g. "Swim and kick faster", with no full stop at the end). It pops up beside the button on hover, clear of the other buttons and stats: on the right, or on the left when the screen is too narrow (`fitBlurb`). Write one for every new upgrade the player suggests.
  - `#speed` appears near the bottom, left-aligned in the right-hand area, after the first Swim faster. It's display only: the speed multiplier × `SPEED_DISPLAY_BASE` (10), rounded down to a whole number, so it reads 12, 14, 17, 20, 24…
- Dev readouts (`#dev-stats`, stacked at the bottom-right of the right-hand area), refreshed twice a second by `showCalorieRate`, never every frame:
  - `#calorie-rate`: calories eaten in the last 60 seconds, to one decimal place. Meals are kept as [time, calories] pairs in `recentMeals`.
  - `#upgrade-time`: minutes to buy every revealed upgrade one more level at that rate (`UpgradeShop.nextLevelsTotalCost()` ÷ calories/min). It skips owned one-time upgrades and shows "–" before anything has been eaten. It shows how much the game slows down for the player.
- `ScorePopups.js`: a "+N" in bold white Fredoka rises from each eaten piece like a bubble (pop, wobble, fade) and is drawn on the canvas over everything.
- `BiteSounds.js`: every bite plays one underwater bubble pop, synthesized once with no sound files: a sine rising from `BUBBLE_HZ` that dies away fast.
  - The player chose this from 20 candidates; slurps, crunches and gulps were rejected.
  - Keep it a single sound: per-food and randomised variations were also rejected. Browsers only allow audio after a click or key press, so `unlock()` runs on the first mousedown/keydown.
- `canvas.js`: sets up the canvas, the input listeners and the `animate()` loop. The camera keeps the axolotl at the canvas centre, and the terrain is drawn offset around it. The map is always north-up and never rotates: a rotating camera was tried and made the player feel sick, so don't bring it back.
- `responsive.js`: leftover code for an `#info` panel that's commented out, so it throws on load. `main.js` is empty.

## Layout

- The canvas is a square sized by the shorter screen side (normally the height, since the game is mostly played on laptops in landscape). It's pinned to the left with a `CANVAS_PADDING` gap.
- The border (2px black, 5px corners) lives in `styles.css`. `CANVAS_BORDER` in `canvas.js` must match the border width.
- Mouse coordinates are measured from inside the canvas border (`updateMousePosition`).

## Known quirks

- The collision circles don't bend with the swimming wave, so the tail tip can brush slightly into rock while it wiggles.
- Physics advances a fixed amount per frame and doesn't scale by elapsed time, so the game runs faster on high-refresh screens.
