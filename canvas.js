// Dungeon drawing
const CANVAS_PADDING = 3;
const CANVAS_BORDER = 2; // matches the border width in styles.css
let CENTRE_PIXEL_X;
let CENTRE_PIXEL_Y;
const canvas = document.querySelector('canvas');
const canvasContainer = document.querySelector('#canvas-container');
const container = document.querySelector('#container');
const c = canvas.getContext('2d');
const sidePanel = document.querySelector('#side-panel');
const caloriesText = document.querySelector('#calories span');
const gameTitle = document.querySelector('#game-title');
const speedDisplay = document.querySelector('#speed');
const SIDE_PANEL_TOP = 24; // distance from the top of the screen to the calories counter
const SPEED_INSET = 24; // distance of the speed readout from the bottom and from the canvas
const saveControls = document.querySelector('#save-controls');
const SAVE_CONTROLS_BOTTOM = 84; // sits above the speed and dev readouts at the very bottom
// calories: what can be spent right now. eaten: total ever eaten, which unlocks the upgrades area
// spent and startingCalories let a save check that its calories add up
const score = { calories: STARTING_CALORIES, eaten: 0, spent: 0, startingCalories: STARTING_CALORIES };

// room kept clear on each side of the calories counter, so it never runs under the sound button in the
// top-right corner (both sides, so it stays centred)
const CALORIES_SIDE_CLEARANCE = 64;

function showCalories() {
    caloriesText.textContent = `Calories: ${score.calories}`;
    fitCalories();
}

// shrinks the counter's text only when a long number wouldn't otherwise fit, and keeps the Axolotl title the same
// size. Runs when the number changes, the window is resized or Fredoka finishes loading, never every frame.
function fitCalories() {
    caloriesText.style.fontSize = '';
    const available = sidePanel.clientWidth - CALORIES_SIDE_CLEARANCE * 2;
    const width = caloriesText.getBoundingClientRect().width;
    if (width > available && available > 0) {
        let size = Math.floor((parseFloat(getComputedStyle(caloriesText).fontSize) * available) / width);
        caloriesText.style.fontSize = `${size}px`;
        // letter spacing doesn't shrink with the font, so trim a pixel at a time if it's still a touch too wide
        while (size > 12 && caloriesText.getBoundingClientRect().width > available) {
            size--;
            caloriesText.style.fontSize = `${size}px`;
        }
    }
    gameTitle.style.fontSize = caloriesText.style.fontSize;
}

// development readout: calories eaten in the last minute, to see what the upgrades really do.
// Each meal is stored as a [time, calories] pair in one flat array, and the readout refreshes twice a second
// rather than every frame.
const calorieRateDisplay = document.querySelector('#calorie-rate');
const upgradeTimeDisplay = document.querySelector('#upgrade-time');
const CALORIE_RATE_WINDOW_MS = 60000;
const CALORIE_RATE_REFRESH_MS = 500;
const recentMeals = [];

function recordMeal(calories) {
    recentMeals.push(performance.now(), calories);
}

// calories eaten in the last minute of play (also the rate away calories fall back on)
function caloriesInLastMinute() {
    const cutoff = performance.now() - CALORIE_RATE_WINDOW_MS;
    let expired = 0;
    while (expired < recentMeals.length && recentMeals[expired] < cutoff) expired += 2;
    if (expired > 0) recentMeals.splice(0, expired);
    let total = 0;
    for (let i = 1; i < recentMeals.length; i += 2) total += recentMeals[i];
    return total;
}

function showCalorieRate() {
    const total = caloriesInLastMinute();
    calorieRateDisplay.textContent = `Calories/min: ${total.toFixed(1)}`;

    // how long buying every upgrade on show once more would take at this rate: how much the game is slowing down
    const minutes = upgradeShop.nextLevelsTotalCost() / total;
    upgradeTimeDisplay.textContent = `Mins to buy all upgrades: ${Number.isFinite(minutes) ? minutes.toFixed(1) : '–'}`;
}

setInterval(showCalorieRate, CALORIE_RATE_REFRESH_MS);

// square canvas, sized by the shorter screen side (usually height on a laptop) and pinned to the left
function sizeCanvas() {
    const size =
        Math.min(window.innerHeight, window.innerWidth) - CANVAS_PADDING * 2 - CANVAS_BORDER * 2;
    canvas.height = size;
    canvas.width = size;
    // the CSS already sizes it for the first paint; pinning it to the exact drawing size here keeps it pixel-sharp
    canvas.style.width = size + 'px';
    canvas.style.height = size + 'px';
    canvas.style.left = CANVAS_PADDING + 'px';
    canvas.style.top = CANVAS_PADDING + 'px';
    canvasContainer.style.height = window.innerHeight + 'px';
    canvasContainer.style.width = window.innerWidth + 'px';
    container.style.height = window.innerHeight + 'px';
    // the side panel spans the whole area right of the canvas, so its centred contents sit in the middle of it
    const canvasRight = CANVAS_PADDING + size + CANVAS_BORDER * 2;
    sidePanel.style.left = canvasRight + 'px';
    sidePanel.style.width = window.innerWidth - canvasRight + 'px';
    sidePanel.style.top = SIDE_PANEL_TOP + 'px';
    speedDisplay.style.left = canvasRight + SPEED_INSET + 'px';
    speedDisplay.style.bottom = SPEED_INSET + 'px';
    saveControls.style.left = canvasRight + 'px';
    saveControls.style.width = window.innerWidth - canvasRight + 'px';
    saveControls.style.bottom = SAVE_CONTROLS_BOTTOM + 'px';
    CENTRE_PIXEL_X = size / 2;
    CENTRE_PIXEL_Y = size / 2;
}

sizeCanvas();

const mouse = {
    x: null,
    y: null,
    radius: 20,
};

function drawAtMousePointer(terrain) {
    c.beginPath();
    const mouseCollisionMap = terrain.calcPartial(
        mouse,
        PIXEL_RATIO + mouse.radius,
        PIXEL_RATIO + mouse.radius
    );
    const color = checkForCollision(mouse.x, mouse.y, mouseCollisionMap);
    c.fillStyle = color;
    // c.fillRect(mouse.x - PIXEL_RATIO, mouse.y - PIXEL_RATIO, PIXEL_RATIO * 2, PIXEL_RATIO * 2);
    // c.ellipse(mouse.x, mouse.y, PIXEL_RATIO * 0.75, PIXEL_RATIO, 0, 0, Math.PI * 2);
    c.arc(mouse.x, mouse.y, mouse.radius, 0, Math.PI * 2);
    c.fill();
    // c.strokeStyle = 'white';
    // c.stroke();
    c.closePath();

    // c.beginPath();
    // c.fillStyle = 'white';
    // c.arc(me.x + 7, me.y - 8, PIXEL_RATIO * 0.2, 0, Math.PI * 2);
    // c.fill();
    // c.closePath();

    // c.beginPath();
    // c.fillStyle = 'white';
    // c.arc(me.x - 7, me.y - 8, PIXEL_RATIO * 0.2, 0, Math.PI * 2);
    // c.fill();
    // c.closePath();
}

function checkForCollision(x, y, terrain) {
    for (let i = 0; i < terrain.length; i++) {
        for (let j = 0; j < terrain[i].length; j++) {
            if (terrain[i][j].wallType === OPEN_SPACE) continue;

            const xDistanceToWall = Math.abs(x - terrain[i][j].x);
            const yDistanceToWall = Math.abs(y - terrain[i][j].y);

            if (
                xDistanceToWall < mouse.radius + PIXEL_RATIO / 2 &&
                yDistanceToWall < mouse.radius + PIXEL_RATIO / 2
            ) {
                return 'red';
            }
        }
    }
    return 'green';
}

function init() {
    me.adjustedX = CENTRE_PIXEL_X;
    me.adjustedY = CENTRE_PIXEL_Y;
}

// true while the game runs unseen in the background (see AwayProgress.js): no sounds or popups then
let runningInBackground = false;

// defined once rather than inline, so the game loop doesn't create a new function every frame
function onFoodEaten(x, y, amount) {
    if (runningInBackground) return;
    scorePopups.add(x, y, amount);
    biteSounds.play();
}

// one step of the game's logic, without drawing anything
function stepGame() {
    food.update(score.eaten);
    me.hooverFood(food);
    me.update();

    const gained = food.eatTouching(me, onFoodEaten);
    if (gained > 0) {
        score.calories += gained;
        score.eaten += gained;
        showCalories();
        upgradeShop.refresh();
        me.startEating();
        if (!runningInBackground) {
            // the Calories/min readout only counts what's eaten while the player is watching
            recordMeal(gained);
            // a small bounce
            caloriesText.animate(
                [{ transform: 'scale(1)' }, { transform: 'scale(1.07)' }, { transform: 'scale(1)' }],
                { duration: 260, easing: 'ease-out' }
            );
        }
    }
}

// marks when the game first appears, readable later with performance.getEntriesByName('game-first-frame')
let drawnFirstFrame = false;

function animate() {
    requestAnimationFrame(animate);
    if (!drawnFirstFrame) {
        drawnFirstFrame = true;
        requestAnimationFrame(() => performance.mark('game-first-frame'));
    }
    // the background run may be finishing its last steps as the page comes back; let it, rather than doubling up
    if (runningInBackground) return;
    stepGame();

    c.clearRect(0, 0, canvas.width, canvas.height);
    terrain.drawView(me);
    food.drawView(me);
    me.draw();
    // bubbles go over the walls, food and axolotl; only the "+N" numbers sit above them
    bubbles.update(me);
    bubbles.draw(me);
    scorePopups.draw(me);
}

// Excecution

// mouse position relative to the canvas, since the canvas no longer starts at the page origin
function updateMousePosition(e) {
    const rect = canvas.getBoundingClientRect();
    mouse.x = e.clientX - rect.left - canvas.clientLeft;
    mouse.y = e.clientY - rect.top - canvas.clientTop;
}

addEventListener('resize', function () {
    sizeCanvas();
    init();
    fitCalories();
});

document.fonts.ready.then(fitCalories);

addEventListener('mousemove', (e) => {
    updateMousePosition(e);
    // the button was let go somewhere we didn't see (e.g. outside the window), so stop swimming
    if (me.controller.mousedown && (e.buttons & 1) === 0) me.controller.mousedown = false;
});

addEventListener('wheel', updateMousePosition);

addEventListener('mousedown', (e) => {
    if (e.button !== 0) return; // only the left button swims
    // stops the browser starting a text selection or drag, which would swallow mouse movement
    e.preventDefault();
    updateMousePosition(e);
    // each click kicks, just like a tap of W
    if (!me.controller.mousedown) me.startBurst();
    me.controller.mousedown = true;
});

addEventListener('mouseup', (e) => {
    if (e.button === 0) me.controller.mousedown = false;
});

// a right-click or two-finger tap would open the browser menu, which takes over the mouse until dismissed
addEventListener('contextmenu', (e) => e.preventDefault());

// switching away (e.g. alt-tab) means we never see the keys or button being released, so let go of everything
addEventListener('blur', () => {
    me.controller.up = false;
    me.controller.down = false;
    me.controller.mousedown = false;
});

// e.code is the physical key, so W still works with caps lock or shift held, and its release is always matched
addEventListener('keydown', function (e) {
    if (e.code === 'ArrowUp' || e.code === 'KeyW') {
        // a fresh press kicks; the keyboard's auto-repeat while held doesn't
        if (!e.repeat && !me.controller.up) me.startBurst();
        me.controller.up = true;
    }

    if (e.code === 'ArrowDown' || e.code === 'KeyS') {
        me.controller.down = true;
    }
});

addEventListener('keyup', function (e) {
    if (e.code === 'ArrowUp' || e.code === 'KeyW') {
        me.controller.up = false;
    }

    if (e.code === 'ArrowDown' || e.code === 'KeyS') {
        me.controller.down = false;
    }
});

// a saved game, if there is one that hasn't been tampered with, picks up where it left off
const savedGame = readSavedGame();
const saved = savedGame.state || null;

console.time('terrain generation');
const terrain = new Terrain(saved ? saved.mapSeed : newMapSeed());
console.timeEnd('terrain generation');

console.time('meeple generation');
const me = generateMeeple(terrain, CANVAS_WIDTH / 5, CANVAS_HEIGHT / 5);
if (saved && saved.axolotl) placeSavedAxolotl(saved.axolotl);
console.timeEnd('meeple generation');

if (saved) {
    score.calories = saved.calories;
    score.eaten = saved.eaten;
    score.spent = saved.spent;
    score.startingCalories = saved.startingCalories;
}

// back where it was saved, as long as that spot is still open water; otherwise it keeps its fresh spawn point
function placeSavedAxolotl(position) {
    const fresh = { x: me.x, y: me.y, angle: me.angle };
    me.x = position.x;
    me.y = position.y;
    me.angle = position.angle;
    if (!Number.isFinite(me.x) || !Number.isFinite(me.y) || terrain.isRockAt(me.x, me.y) || me.touchesWall()) {
        me.x = fresh.x;
        me.y = fresh.y;
        me.angle = fresh.angle;
    }
}

console.time('food generation');
const food = new FoodField(terrain, me);
me.food = food; // so Improve smell can find nearby food
console.timeEnd('food generation');

const scorePopups = new ScorePopups();
const bubbles = new Bubbles();
const upgradeShop = new UpgradeShop(score, me, showCalories);
if (saved) upgradeShop.restore(saved.levels, saved.switchedOn);
showCalories(); // the page's HTML says "Calories: 0", which is wrong for a saved game or map hacks
const biteSounds = new BiteSounds();
// sound can only start after the player interacts with the page
addEventListener('mousedown', () => biteSounds.unlock());
addEventListener('keydown', () => biteSounds.unlock());

// --- sound on/off button (top right) ---
// remembered in this browser between visits; it's just a preference, so it isn't part of the game save
const SOUND_SETTING_KEY = 'axolotl-sound';
moveStoredItem('axolotl-dungeon-sound', SOUND_SETTING_KEY); // its name before the game was renamed
const soundToggle = document.querySelector('#sound-toggle');
const SPEAKER_ON_ICON =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
    '<path d="M4 9h4l5-4v14l-5-4H4z" fill="currentColor"/><path d="M16.5 8.5a5 5 0 0 1 0 7"/><path d="M19 6a8.5 8.5 0 0 1 0 12"/></svg>';
const SPEAKER_OFF_ICON =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
    '<path d="M4 9h4l5-4v14l-5-4H4z" fill="currentColor"/><path d="M17 9l5 6"/><path d="M22 9l-5 6"/></svg>';

function showSoundSetting() {
    soundToggle.innerHTML = biteSounds.enabled ? SPEAKER_ON_ICON : SPEAKER_OFF_ICON;
    soundToggle.classList.toggle('muted', !biteSounds.enabled);
    soundToggle.setAttribute('aria-pressed', String(biteSounds.enabled));
    soundToggle.setAttribute('aria-label', biteSounds.enabled ? 'Turn sound off' : 'Turn sound on');
    soundToggle.title = biteSounds.enabled ? 'Sound on' : 'Sound off';
}

try {
    biteSounds.enabled = localStorage.getItem(SOUND_SETTING_KEY) !== 'off';
} catch (error) {
    // storage blocked: just start with sound on
}
showSoundSetting();

soundToggle.addEventListener('click', () => {
    biteSounds.enabled = !biteSounds.enabled;
    try {
        localStorage.setItem(SOUND_SETTING_KEY, biteSounds.enabled ? 'on' : 'off');
    } catch (error) {
        // couldn't remember it; it still applies for this visit
    }
    showSoundSetting();
    soundToggle.blur();
});
// clicking it shouldn't also count as a swim kick on the map
soundToggle.addEventListener('mousedown', (e) => e.stopPropagation());

// --- saving ---

// there's no Save or Load button: the game saves itself every AUTO_SAVE_MS and when the page is left, and a page
// refresh always starts from the latest save
const SAVE_STATUS_MS = 2500; // how long a message about the save stays up
const AUTO_SAVE_MS = 10000;
const saveStatus = document.querySelector('#save-status');
const confirmOverlay = document.querySelector('#confirm-overlay');
let saveStatusTimer = null;
// set while leaving the page for New game, so the save-on-close doesn't write the old game back
let leavingPage = false;

function showSaveStatus(message) {
    saveStatus.textContent = message;
    saveStatus.classList.add('visible');
    clearTimeout(saveStatusTimer);
    saveStatusTimer = setTimeout(() => saveStatus.classList.remove('visible'), SAVE_STATUS_MS);
}

// everything a save keeps. Food isn't saved; it spawns fresh when the game loads.
function gatherSaveState() {
    return {
        version: SAVE_VERSION,
        mapSeed: terrain.seed,
        calories: score.calories,
        eaten: score.eaten,
        spent: score.spent,
        startingCalories: score.startingCalories,
        levels: { ...upgradeShop.levels },
        switchedOn: { ...upgradeShop.switchedOn },
        axolotl: { x: me.x, y: me.y, angle: me.angle },
        // away-rate and when it started counting, so time with the game closed pays out on the next load
        away: awayProgress.forSave(),
    };
}

function saveGame() {
    if (leavingPage) return false;
    return writeSavedGame(gatherSaveState());
}

function startNewGame() {
    leavingPage = true;
    wipeSavedGame();
    location.reload();
}

function openNewGameConfirm() {
    confirmOverlay.hidden = false;
    document.querySelector('#confirm-no').focus();
}

function closeNewGameConfirm() {
    confirmOverlay.hidden = true;
}

document.querySelector('#new-game-button').addEventListener('click', (e) => {
    e.currentTarget.blur();
    openNewGameConfirm();
});
document.querySelector('#confirm-yes').addEventListener('click', startNewGame);
document.querySelector('#confirm-no').addEventListener('click', closeNewGameConfirm);
document.querySelector('#confirm-close').addEventListener('click', closeNewGameConfirm);
// clicking the dark area around the popup, or pressing Escape, also counts as No
confirmOverlay.addEventListener('click', (e) => {
    if (e.target === confirmOverlay) closeNewGameConfirm();
});
addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !confirmOverlay.hidden) closeNewGameConfirm();
});
// clicks on these shouldn't also count as a swim kick on the map
for (const element of [saveControls, confirmOverlay]) {
    element.addEventListener('mousedown', (e) => e.stopPropagation());
}

setInterval(saveGame, AUTO_SAVE_MS);
// also save when the tab is closed or the page is left, so at most a few seconds are ever lost
addEventListener('pagehide', saveGame);

if (savedGame.problem === 'tampered') showSaveStatus("The saved game was changed outside the game, so it couldn't be loaded");

// --- away calories (see AwayProgress.js) ---

const awayPopup = document.querySelector('#away-popup');
const AWAY_POPUP_MS = 4200; // how long the "While you were away" popup stays before floating off

const awayProgress = new AwayProgress({
    step: stepGame,
    autoSwimOn: () => me.autoSwim,
    eatenSoFar: () => score.eaten,
    recentRate: caloriesInLastMinute,
    setBackground: (on) => {
        runningInBackground = on;
    },
    award: awardAwayCalories,
    showTotal: showAwayPopup,
});

// away calories count as eaten (so they unlock upgrades) but not towards the Calories/min readout
function awardAwayCalories(calories) {
    score.calories += calories;
    score.eaten += calories;
    showCalories();
    upgradeShop.refresh();
}

function showAwayPopup(calories) {
    awayPopup.querySelector('.away-amount').textContent = `+${calories.toLocaleString()} calories`;
    awayPopup.hidden = false;
    awayPopup.getAnimations().forEach((animation) => animation.cancel());
    // pops in, holds, then floats up and fades away
    const animation = awayPopup.animate(
        [
            { opacity: 0, transform: 'translate(-50%, 10px) scale(0.85)', offset: 0 },
            { opacity: 1, transform: 'translate(-50%, 0) scale(1.05)', offset: 0.07 },
            { opacity: 1, transform: 'translate(-50%, 0) scale(1)', offset: 0.12 },
            { opacity: 1, transform: 'translate(-50%, 0) scale(1)', offset: 0.82 },
            { opacity: 0, transform: 'translate(-50%, -40px) scale(1)', offset: 1 },
        ],
        { duration: AWAY_POPUP_MS, easing: 'ease-out' }
    );
    animation.onfinish = () => {
        awayPopup.hidden = true;
    };
}

document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
        awayProgress.pageHidden();
    } else {
        awayProgress.pageVisible();
    }
});

// time away with the game closed: paid out now, from the rate saved last time
if (saved && saved.away) awayProgress.resumeFromSave(saved.away);
// the game can load in a tab that's already hidden; no visibility change will fire for that
if (document.visibilityState === 'hidden') awayProgress.pageHidden();

init();
animate();
