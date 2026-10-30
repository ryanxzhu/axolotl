// Dungeon drawing
const CANVAS_PADDING = 8;
let CENTRE_PIXEL_X;
let CENTRE_PIXEL_Y;
const canvas = document.querySelector('canvas');
const canvasContainer = document.querySelector('#canvas-container');
const container = document.querySelector('#container');
const c = canvas.getContext('2d');

// square canvas, sized by the shorter screen side (usually height on a laptop) and pinned to the left
function sizeCanvas() {
    const size = Math.min(window.innerHeight, window.innerWidth) - CANVAS_PADDING * 2;
    canvas.height = size;
    canvas.width = size;
    canvas.style.left = CANVAS_PADDING + 'px';
    canvas.style.top = CANVAS_PADDING + 'px';
    canvasContainer.style.height = window.innerHeight + 'px';
    canvasContainer.style.width = window.innerWidth + 'px';
    container.style.height = window.innerHeight + 'px';
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

function animate() {
    // console.time('animate');

    requestAnimationFrame(animate);
    c.clearRect(0, 0, canvas.width, canvas.height);
    terrain.displayed = terrain.calcPartial(me, CENTRE_PIXEL_X, CENTRE_PIXEL_Y);
    me.collisionMap = terrain.calcPartial(me, PIXEL_RATIO + me.radius, PIXEL_RATIO + me.radius);
    terrain.displayed = me.adjustFrame(terrain.displayed);
    terrain.draw(terrain.displayed);
    me.update();

    // drawAtMousePointer(terrain);

    // console.timeEnd('animate');
}

// Excecution

// mouse position relative to the canvas, since the canvas no longer starts at the page origin
function updateMousePosition(e) {
    const rect = canvas.getBoundingClientRect();
    mouse.x = e.clientX - rect.left;
    mouse.y = e.clientY - rect.top;
}

addEventListener('resize', function () {
    sizeCanvas();
    init();
});

addEventListener('mousemove', updateMousePosition);

addEventListener('wheel', updateMousePosition);

addEventListener('mousedown', (e) => {
    updateMousePosition(e);
    me.controller.mousedown = true;
});

addEventListener('mouseup', (e) => {
    me.controller.mousedown = false;
});

addEventListener('keydown', function (e) {
    if (e.key === 'ArrowUp' || e.key === 'w') {
        me.controller.up = true;
    }

    if (e.key === 'ArrowDown' || e.key === 's') {
        me.controller.down = true;
    }

    if (e.key === 'ArrowLeft' || e.key === 'a') {
        me.controller.left = true;
    }

    if (e.key === 'ArrowRight' || e.key === 'd') {
        me.controller.right = true;
    }
});

addEventListener('keyup', function (e) {
    if (e.key === 'ArrowUp' || e.key === 'w') {
        me.controller.up = false;
    }

    if (e.key === 'ArrowDown' || e.key === 's') {
        me.controller.down = false;
    }

    if (e.key === 'ArrowLeft' || e.key === 'a') {
        me.controller.left = false;
    }

    if (e.key === 'ArrowRight' || e.key === 'd') {
        me.controller.right = false;
    }
});

console.time('terrain generation');
const terrain = new Terrain();
console.timeEnd('terrain generation');

console.time('meeple generation');
const me = generateMeeple(terrain, CANVAS_WIDTH / 5, CANVAS_HEIGHT / 5);
console.timeEnd('meeple generation');

init();
animate();
