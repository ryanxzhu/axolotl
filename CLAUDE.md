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
  - The whole map, including the water texture, comes from a seeded random generator (`seededRandom`), so `new Terrain(seed)` always rebuilds the same map. Saves store just the seed.
  - Changing the generation (e.g. `WHITE_LEVEL`, map size, smoothing passes) makes old seeds produce different maps.
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
- `Food.js`: seaweed (1 calorie) and worms (2 calories). The map starts with `SEAWEED_COUNT` and `WORM_COUNT` (2,400 each), all in open water.
  - Shapes are generated per type up to `uniqueShapes` (every starting seaweed gets its own; worms have 20), then reused at random (`spriteFor`), so long games don't keep making new images.
  - Seaweed varies in its lumpy outline. Worms keep the same colours and size but vary in how they curve (arc, C or S) and the angle they lie at; each has two small eyes at its head end.
  - Food sits in 400px buckets, so drawing and the eating check only look at food near the axolotl.
  - Food pulses in step with the axolotl, using the axolotl's own `bulgingRadius`.
  - Any of the three body circles touching a piece eats it, so backing into food counts.
  - Food count rules (`FoodField.update`, called every frame; `count` is kept as a running total):
    - Background spawning adds 1 seaweed and 1 worm per second (`BACKGROUND_SPAWNS_PER_SECOND`), until the map holds `MAX_FOOD_MULTIPLIER` (10×) the starting total.
    - Eaten food is replaced elsewhere only while the map holds no more than the starting total; above it, eating just lowers the count.
    - Food perishes 2 minutes after it appears (`FOOD_LIFETIME_FRAMES`), fading out over its last second, and is replaced by the same type somewhere else.
    - Perishing uses `perishQueue`, kept in perish order, so each frame only checks the front of the queue. The starting food gets random ages so it doesn't all perish at once.
    - Removed food is flagged `gone`, so a smell chase notices.
    - New food never appears within `FOOD_SPAWN_CLEARANCE` px of the axolotl.
  - Eating plays a quick open-and-close of the mouth (`MOUTH_OPEN_FRAMES` in `Meeple.js`).
- Side panel (`#side-panel`, HTML, not canvas): spans the area right of the map with everything centred, positioned in `sizeCanvas`.
  - All page text shares one style: the Fredoka Google font (loaded in `index.html`) in white with a subtle teal edge. Only the Calories counter is pink, as the main heading. The player wants it subtle, not flashy.
  - Calories counter (`#calories`): shows `score.calories`, the spendable balance, and bounces slightly on each eat. `score.eaten` is the lifetime total. Page text only updates when something is eaten or bought, never every frame.
- `Upgrades.js`: the "Spend Calories" area. It appears once `score.eaten` reaches `UPGRADES_REVEAL_AT` (5) and stays visible after spending.
  - `UPGRADES` lists each upgrade with its first price (`baseCost`) and `revealAt`, the total calories eaten (`score.eaten`) before it appears. Until then it is hidden completely. An upgrade can instead use `revealWhen(levels)` to appear when another upgrade is owned (Improve smell does).
  - Shared rule for every upgrade: each level's effect is 20% stronger than the last (`UPGRADE_EFFECT_GROWTH`), and each level costs 1.5× the previous (`UPGRADE_COST_GROWTH`). Prices round up to whole numbers.
  - Swim faster: from 10 calories, appears at 5 eaten. Speed is 1.2^level via `Meeple.setSpeedMultiplier`, which scales top speed, acceleration and the kick together.
  - Hoover food: from 20 calories, appears at 15 eaten. Food within `hooverRadius` of the head (36px at level 1, +20% per level) is pulled to the mouth (`FoodField.hooverTowards`, faster as it gets closer, `HOOVER_SPEED`) and eaten on touch. A faint pink ring with a very light pink fill shows the reach. The Hoover and smell rings both pulse in time with the body at half its strength (`RING_PULSE_STRENGTH`); this is visual only, and the real reach never changes.
  - Auto swim: 40 calories, appears at 50 eaten, `oneTime`. Bought once, it then becomes a free on/off switch that stays on the page: pressed in (sunk, darker, inner shadow, "on") while on, popped up ("off") while off. While on (`Meeple.setAutoSwim`/`autoPilot`):
    - W, clicks and mouse movement do nothing.
    - It swims forwards at the held-W top speed and turns randomly left, right or straight for random stretches, like random A/D presses.
    - After a wall hit it stops pushing and turns away from the rock (`AUTO_RECOVER_FRAMES`) before carrying on.
  - Smell: buying Auto swim also gives the axolotl smell (`owned` sets `smellRadius` to `SMELL_BASE_RADIUS`, 144px, 4× Hoover's starting reach). A faint white ring shows the range. It only steers during Auto swim (`Meeple.followSmell`):
    - It targets the nearest food in the ring (`FoodField.findNearest`) and turns towards it at the normal A/D rate, never instantly.
    - It stops pushing for tight turns, so it doesn't circle food.
    - It re-sniffs after eating, and wanders when nothing is in range.
    - It gives up on unreachable food after `SMELL_GIVE_UP_FRAMES`.
    - Sniffing only happens every `SMELL_SEARCH_INTERVAL` frames while it has no target and checks only the nearby buckets. Removed food is flagged `gone` so the chase notices.
  - Improve smell: 80 calories. It appears as soon as Auto swim is owned (`revealWhen`), not by calories eaten; map hacks show it from the start. Each level adds 20% range on top of Auto swim's base (144 → 173 → 207…).
  - Buttons get a random colour, a blobby `border-radius` (8 random values), a slight tilt and a raised bottom edge every load. The price sits in a pill beside the name.
  - Every upgrade needs a `blurb`: a very short, qualitative description with no numbers or maths (e.g. "Swim and kick faster", with no full stop at the end). It pops up beside the button on hover, clear of the other buttons and stats: on the right, or on the left when the screen is too narrow (`fitBlurb`). Write one for every new upgrade the player suggests.
  - `#speed` appears near the bottom, left-aligned in the right-hand area, after the first Swim faster. It's display only: the speed multiplier × `SPEED_DISPLAY_BASE` (10), rounded down to a whole number, so it reads 12, 14, 17, 20, 24…
- Saving (`SaveGame.js`, wired up at the bottom of `canvas.js`): Save / Load / New game buttons near the bottom of the right-hand area. Auto-save runs every 10 seconds and on `pagehide`.
  - A save holds the map seed, calories, eaten, spent, starting calories, upgrade levels, switch states (Auto swim on/off) and the axolotl's position. Food isn't saved; it spawns fresh.
  - Stored in localStorage, scrambled and signed with HMAC-SHA-256 (a small synchronous SHA-256 lives in `SaveGame.js`). It must also add up: starting calories + eaten - spent = calories. Anything that fails is refused and the game starts fresh with a message.
  - This only deters tampering: the key is in the client code, so a determined developer can still forge saves or edit values in the console. Real protection needs a server.
  - The page always starts from the save, so Load is a reload, and New game wipes the save then reloads (after a Yes / No / ✕ confirm). `leavingPage` stops the save-on-close from overwriting the save during either.
  - Bump `SAVE_VERSION` if the save format changes.
- Sound toggle (`#sound-toggle`): a round speaker button fixed in the top-right corner that turns the bite sound on and off (`biteSounds.enabled`). It's remembered in localStorage as a preference, not part of the game save. The Calories counter keeps `CALORIES_SIDE_CLEARANCE` clear on both sides and shrinks its text to fit (`fitCalories`) so it never runs under the button.
- Away calories (`AwayProgress.js`, wired up at the bottom of `canvas.js`): only while Auto swim is on.
  - When the page is hidden (window covered or minimised, or another tab shown), a small Web Worker keeps ticking `stepGame` (game logic without drawing) for `AWAY_SAMPLE_MINUTES` (3). The calories eaten then ÷ 3 is the away-rate, timestamped. Worker timers aren't throttled like the page's own.
  - On return (`visibilitychange`), minutes since the timestamp × away-rate is paid, rounded down. Backward clock jumps are ignored and the time is capped at 7 days.
  - Coming back within the 3 minutes pays nothing extra, since the simulation already covered it. Auto swim off: nothing runs, nothing is paid.
  - Away calories count towards `score.eaten`. Neither they nor meals eaten during the background run count in the Calories/min readout, and the run plays no sounds or "+N" popups (`runningInBackground`).
  - The save carries `away: { rate, since }`, so closing the tab still pays on the next load. Fallbacks: a partial sample of at least 30s if the tab closed mid-sample, else the last minute's live rate while playing with Auto swim on.
  - A big "While you were away: +N calories" popup appears in the upper centre (`#away-popup`), only when N > 0. N is everything gained while unseen: real meals during the background run (already added as they were eaten) plus the payout. Only the payout is added on return. The save carries the unseen meals as `away.unseen`, so a reopened game shows them too.
  - The game loop is split into `stepGame()` (logic) and drawing in `animate()`; `Meeple.update()` no longer draws itself (call `me.draw()`).
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
