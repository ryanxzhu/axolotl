// Dungeon drawing
const CENTRE_PIXEL_X = 600;
const CENTRE_PIXEL_Y = 400;
const canvas = document.querySelector('canvas');
const canvasContainer = document.querySelector('#canvas-container');
const c = canvas.getContext('2d');
canvas.height = CANVAS_HEIGHT;
canvas.width = CANVAS_WIDTH;
canvasContainer.style.height = CANVAS_HEIGHT - PIXEL_RATIO / 2 + 'px';
canvasContainer.style.width = CANVAS_WIDTH - PIXEL_RATIO / 2 + 'px';

function calcPartialTerrain(me, terrain, xOffset, yOffset) {
    const partialTerrain = [];
    const { x1, x2, y1, y2 } = findCorners(me, terrain, xOffset, yOffset);
    for (let i = y1; i <= y2; i++) {
        const row = [];
        for (let j = x1; j <= x2; j++) {
            row.push(terrain[i][j]);
        }
        partialTerrain.push(row);
    }
    return partialTerrain;
}

function drawTerrain(terrain) {
    for (let i = 0; i < terrain.length; i++) {
        for (let j = 0; j < terrain[i].length; j++) {
            c.beginPath();
            c.fillStyle = COLORS[terrain[i][j].wallType];
            c.fillRect(
                terrain[i][j].x - PIXEL_RATIO / 2,
                terrain[i][j].y - PIXEL_RATIO / 2,
                PIXEL_RATIO,
                PIXEL_RATIO
            );
            c.closePath();
        }
    }
}

function findCorners(me, terrain, xOffset, yOffset) {
    const firstRow = terrain[0].map((pixel) => pixel.x);
    const column = terrain.map((row) => row[0].y);
    const x1 = binarySearch(firstRow, me.x - xOffset * 1.2, 0);
    const x2 = binarySearch(firstRow, me.x + xOffset * 1.2, 1);
    const y1 = binarySearch(column, me.y - yOffset * 1.2, 0);
    const y2 = binarySearch(column, me.y + yOffset * 1.2, 1);

    return { x1, x2, y1, y2 };
}

function binarySearch(row, target, offset = 0) {
    let left = 0;
    let right = row.length - 1;
    let middle = Math.floor((left + right) / 2);
    while (left < right) {
        if (row[middle] < target) {
            left = middle + 1;
        } else {
            right = middle;
        }
        middle = Math.floor((left + right) / 2);
    }
    return middle - offset;
}

function drawAtMousePointer() {
    c.beginPath();
    const miniTerrain = calcPartialTerrain(mouse, terrain, PIXEL_RATIO * 2, PIXEL_RATIO * 2);
    const color = checkForCollision(mouse.x, mouse.y, miniTerrain);
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
    me = generateMeeple(terrain, CANVAS_WIDTH / 5, CANVAS_HEIGHT / 5);
    // const partialTerrain = calcPartialTerrain(me, terrain, CENTRE_PIXEL_X, CENTRE_PIXEL_Y);
    // drawTerrain(partialTerrain);
    // me.draw();
}

function animate() {
    // console.time('animate');

    requestAnimationFrame(animate);
    c.clearRect(0, 0, canvas.width, canvas.height);
    const partialTerrain = calcPartialTerrain(me, terrain, CENTRE_PIXEL_X, CENTRE_PIXEL_Y);
    drawTerrain(partialTerrain);
    const miniTerrain = calcPartialTerrain(me, terrain, PIXEL_RATIO * 2, PIXEL_RATIO * 2);
    me.update(miniTerrain);
    drawAtMousePointer();

    // console.timeEnd('animate');
}

// Excecution

addEventListener('mousemove', function (e) {
    mouse.x = e.offsetX;
    mouse.y = e.offsetY;
});

addEventListener('wheel', function (e) {
    mouse.x = e.offsetX;
    mouse.y = e.offsetY;
});

const terrain = createTerrain();
let me;
let mouse = {
    x: null,
    y: null,
    radius: 10,
};

init();
animate();
