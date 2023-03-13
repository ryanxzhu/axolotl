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

function drawAtMousePointer(terrain) {
    c.beginPath();
    const mouseCollisionMap = terrain.calcPartial(mouse, PIXEL_RATIO * 2, PIXEL_RATIO * 2);
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

function animate() {
    console.time('animate');

    requestAnimationFrame(animate);
    c.clearRect(0, 0, canvas.width, canvas.height);
    terrain.displayed = terrain.calcPartial(me, CENTRE_PIXEL_X, CENTRE_PIXEL_Y);
    terrain.draw(terrain.displayed);
    terrain.collisionMap = terrain.calcPartial(me, PIXEL_RATIO * 2, PIXEL_RATIO * 2);
    me.update(terrain.collisionMap);
    // console.log(me);
    drawAtMousePointer(terrain);

    console.timeEnd('animate');
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

const terrain = new Terrain();
const me = generateMeeple(terrain, CANVAS_WIDTH / 5, CANVAS_HEIGHT / 5);
const mouse = {
    x: null,
    y: null,
    radius: 10,
};

animate();
