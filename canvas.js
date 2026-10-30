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
const speedDisplay = document.querySelector('#speed');
const SIDE_PANEL_TOP = 24; // distance from the top of the screen to the calories counter
const SPEED_INSET = 24; // distance of the speed readout from the bottom and from the canvas
// calories: what can be spent right now. eaten: total ever eaten, which unlocks the upgrades area
const score = { calories: STARTING_CALORIES, eaten: 0 };

function showCalories() {
    caloriesText.textContent = `Calories: ${score.calories}`;
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

function showCalorieRate() {
    const cutoff = performance.now() - CALORIE_RATE_WINDOW_MS;
    let expired = 0;
    while (expired < recentMeals.length && recentMeals[expired] < cutoff) expired += 2;
    if (expired > 0) recentMeals.splice(0, expired);
    let total = 0;
    for (let i = 1; i < recentMeals.length; i += 2) total += recentMeals[i];
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

// defined once rather than inline, so the game loop doesn't create a new function every frame
function onFoodEaten(x, y, amount) {
    scorePopups.add(x, y, amount);
    biteSounds.play();
}

function animate() {
    // console.time('animate');

    requestAnimationFrame(animate);
    c.clearRect(0, 0, canvas.width, canvas.height);
    terrain.drawView(me);
    me.hooverFood(food);
    food.drawView(me);
    me.update();

    const gained = food.eatTouching(me, onFoodEaten);
    if (gained > 0) {
        score.calories += gained;
        score.eaten += gained;
        recordMeal(gained);
        showCalories();
        upgradeShop.refresh();
        // a small bounce
        caloriesText.animate(
            [{ transform: 'scale(1)' }, { transform: 'scale(1.07)' }, { transform: 'scale(1)' }],
            { duration: 260, easing: 'ease-out' }
        );
        me.startEating();
    }
    scorePopups.draw(me);

    // drawAtMousePointer(terrain);

    // console.timeEnd('animate');
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
});

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

console.time('terrain generation');
const terrain = new Terrain();
console.timeEnd('terrain generation');

console.time('meeple generation');
const me = generateMeeple(terrain, CANVAS_WIDTH / 5, CANVAS_HEIGHT / 5);
console.timeEnd('meeple generation');

console.time('food generation');
const food = new FoodField(terrain, me);
me.food = food; // so Improve smell can find nearby food
console.timeEnd('food generation');

const scorePopups = new ScorePopups();
const upgradeShop = new UpgradeShop(score, me, showCalories);
showCalories(); // the page's HTML says "Calories: 0", which is wrong if STARTING_CALORIES isn't 0
const biteSounds = new BiteSounds();
// sound can only start after the player interacts with the page
addEventListener('mousedown', () => biteSounds.unlock());
addEventListener('keydown', () => biteSounds.unlock());

init();
animate();
