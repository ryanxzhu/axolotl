// Dungeon drawing
const DUNGEON_HEIGHT = 2000;
const DUNGEON_WIDTH = 2000;
const PADDING = 0.1;
const CANVAS_HEIGHT = DUNGEON_HEIGHT * (1 + 2 * PADDING);
const CANVAS_WIDTH = DUNGEON_WIDTH * (1 + 2 * PADDING);
const WHITE_LEVEL = 0.55;
const WALL = 0;
const OPEN_SPACE = 1;
const COLORS = {
    [WALL]: '#03332d',
    [OPEN_SPACE]: 'rgba(255,255,255,0)',
};
const PIXEL_RATIO = 50;
const MATRIX_DIMENSIONS = {
    height: DUNGEON_HEIGHT / PIXEL_RATIO,
    width: DUNGEON_WIDTH / PIXEL_RATIO,
};
const canvas = document.querySelector('canvas');
const canvasContainer = document.querySelector('#canvas-container');
const c = canvas.getContext('2d');
canvas.height = CANVAS_HEIGHT;
canvas.width = CANVAS_WIDTH;
canvasContainer.style.height = CANVAS_HEIGHT - PIXEL_RATIO / 2 + 'px';
canvasContainer.style.width = CANVAS_WIDTH - PIXEL_RATIO / 2 + 'px';

function generateWhiteNoise(size, whiteLevel = 0.6) {
    return new Array(size).fill(0).map(() => (Math.random() >= whiteLevel ? WALL : OPEN_SPACE));
}

function drawTerrain() {
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

function calculatePixelValueByNeighbors(rowIndex, pixelIndex, matrix) {
    let sum = 0;
    for (let y = -1; y < 2; y++) {
        for (let x = -1; x < 2; x++) {
            if (!matrix[rowIndex + y] || !matrix[rowIndex + y][pixelIndex + x]) {
                sum -= 1;
            } else {
                sum += 1;
            }
        }
    }
    return sum > 0 ? OPEN_SPACE : WALL;
}

function cellularAutomaton(matrix) {
    const tmpMatrix = structuredClone(matrix);
    tmpMatrix.forEach((row, rowIndex) => {
        row.forEach((pixel, pixelIndex) => {
            tmpMatrix[rowIndex][pixelIndex] = calculatePixelValueByNeighbors(
                rowIndex,
                pixelIndex,
                matrix
            );
        });
    });
    return tmpMatrix;
}

function addPadding(matrix) {
    let tmpMatrix = structuredClone(matrix);
    const lengthToAdd = tmpMatrix.length * PADDING;
    tmpMatrix = tmpMatrix.map((row) => {
        const filler = new Array(lengthToAdd).fill(0);
        return [...filler, ...row, ...filler];
    });
    const topBottomFillerRow = new Array(tmpMatrix[0].length).fill(0);
    const topBottomFiller = new Array(lengthToAdd).fill(topBottomFillerRow);

    return [...topBottomFiller, ...tmpMatrix, ...topBottomFiller];
}

// Meeple drawing

addEventListener('mousemove', function (e) {
    mouse.x = e.x;
    mouse.y = e.y;
});

class Meeple {
    constructor(x, y, radius, velocity) {
        this.x = x;
        this.y = y;
        this.radius = radius;
        this.minDistanceFromWall = this.radius + PIXEL_RATIO / 2;
        this.velocity = velocity;
        this.angle = Math.random() * 2 * Math.PI;
        this.angle = Math.PI;
        this.angleChange = 0.1;
        this.xVelocity = 0;
        this.yVelocity = 0;
        this.overlap = false;
        this.color = 'orange';
    }

    resultantVelocity(xVelocity, yVelocity) {
        return Math.sqrt(Math.pow(xVelocity, 2) + Math.pow(yVelocity, 2));
    }

    angleOfDirection(xVelocity, yVelocity, resultantVelocity) {
        if (xVelocity >= 0 && yVelocity >= 0) {
            return Math.asin(xVelocity / resultantVelocity);
        }
        if (xVelocity >= 0 && yVelocity <= 0) {
            return Math.PI / 2 + Math.acos(xVelocity / resultantVelocity);
        }
        if (xVelocity <= 0 && yVelocity <= 0) {
            return Math.PI + Math.asin(Math.abs(xVelocity) / resultantVelocity);
        }
        if (xVelocity <= 0 && yVelocity >= 0) {
            return (Math.PI * 3) / 2 + Math.asin(yVelocity / resultantVelocity);
        }
    }

    findXVelocity(angle, velocity) {
        if (angle <= Math.PI / 2) {
            return Math.sin(angle) * velocity;
        }
        if (angle <= Math.PI) {
            angle = angle - Math.PI / 2;
            return Math.cos(angle) * velocity;
        }
        if (angle <= (Math.PI * 3) / 2) {
            angle = angle - Math.PI;
            return Math.sin(angle) * velocity * -1;
        }
        if (angle <= Math.PI * 2) {
            angle = angle - (Math.PI * 3) / 2;
            return Math.cos(angle) * velocity * -1;
        }
    }

    findYVelocity(angle, velocity) {
        if (angle <= Math.PI / 2) {
            return Math.cos(angle) * velocity;
        }
        if (angle <= Math.PI) {
            angle = angle - Math.PI / 2;
            return Math.sin(angle) * velocity * -1;
        }
        if (angle <= (Math.PI * 3) / 2) {
            angle = angle - Math.PI;
            return Math.cos(angle) * velocity * -1;
        }
        if (angle <= Math.PI * 2) {
            angle = angle - (Math.PI * 3) / 2;
            return Math.sin(angle) * velocity;
        }
    }

    findCollisionAngleReverse(xWall, yWall) {
        const xDirection = this.x - xWall;
        const yDirection = this.y - yWall;
        const resultantVelocity = this.resultantVelocity(xDirection, yDirection);
        const angleOfDirection = this.angleOfDirection(xDirection, yDirection, resultantVelocity);
        return angleOfDirection;
    }

    changeAngle() {
        this.angle =
            Math.random() < 0.5 ? this.angle + this.angleChange : this.angle - this.angleChange;
        this.angle = this.angle < 0 ? Math.PI * 2 + this.angle : this.angle;
        this.angle = this.angle >= Math.PI * 2 ? this.angle - Math.PI * 2 : this.angle;
    }

    startCheckForCollision() {
        for (let i = 0; i < terrain.length; i++) {
            for (let j = 0; j < terrain[i].length; j++) {
                if (terrain[i][j].wallType === OPEN_SPACE) continue;

                const xDistanceToWall = Math.abs(this.x - terrain[i][j].x);
                const yDistanceToWall = Math.abs(this.y - terrain[i][j].y);
                if (
                    xDistanceToWall < this.minDistanceFromWall &&
                    yDistanceToWall < this.minDistanceFromWall
                ) {
                    this.overlap = true;
                    return;
                }
            }
        }
        this.overlap = false;
    }

    checkForCollision() {
        for (let i = 0; i < terrain.length; i++) {
            for (let j = 0; j < terrain[i].length; j++) {
                if (terrain[i][j].wallType === OPEN_SPACE) continue;

                const xDistanceToWall = Math.abs(this.x - terrain[i][j].x);
                const yDistanceToWall = Math.abs(this.y - terrain[i][j].y);

                if (
                    xDistanceToWall < this.minDistanceFromWall &&
                    yDistanceToWall < this.minDistanceFromWall &&
                    this.overlap === false
                ) {
                    this.overlap = true;

                    this.angle = this.findCollisionAngleReverse(terrain[i][j].x, terrain[i][j].y);
                    return;
                }
            }
        }
        this.overlap = false;
    }

    draw() {
        c.beginPath();
        c.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        c.fillStyle = this.color;
        c.fill();
        c.closePath();
    }

    update() {
        this.checkForCollision();
        this.changeAngle();
        this.xVelocity = this.findXVelocity(this.angle, this.velocity);
        this.yVelocity = this.findYVelocity(this.angle, this.velocity);
        this.x += this.xVelocity;
        this.y += this.yVelocity;
        this.draw();
    }
}

function drawAtMousePointer() {
    c.beginPath();
    const color = checkForCollision(mouse.x, mouse.y);
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

function checkForCollision(x, y) {
    for (let i = 0; i < terrain.length; i++) {
        for (let j = 0; j < terrain[i].length; j++) {
            if (terrain[i][j].wallType === OPEN_SPACE) continue;

            const xDistanceToWall = Math.abs(x - terrain[i][j].x);
            const yDistanceToWall = Math.abs(y - terrain[i][j].y);

            if (
                xDistanceToWall < mouse.radius + PIXEL_RATIO / 2 &&
                yDistanceToWall < mouse.radius + PIXEL_RATIO / 2
            ) {
                return 'blue';
            }
        }
    }
    return 'green';
}

function convertToPixels(matrix) {
    const newMatrix = matrix.map((row, y) => {
        return row.map((cell, x) => {
            return {
                x: x * PIXEL_RATIO,
                y: y * PIXEL_RATIO,
                wallType: cell,
            };
        });
    });
    return newMatrix;
}

function createTerrain() {
    let noise_matrix = new Array(MATRIX_DIMENSIONS.height).fill(0).map(() => {
        return generateWhiteNoise(MATRIX_DIMENSIONS.width, WHITE_LEVEL);
    });

    for (let i = 0; i < 10; i++) {
        noise_matrix = cellularAutomaton(noise_matrix);
    }

    noise_matrix = addPadding(noise_matrix);
    noise_matrix = convertToPixels(noise_matrix);

    return noise_matrix;
}

function init() {
    do {
        const startX = 250 + Math.random() * 500;
        const startY = 100 + Math.random() * 400;
        me = new Meeple(startX, startY, 10, 2.5);
        me.startCheckForCollision();
    } while (me.overlap === true);

    drawTerrain();
}

function animate() {
    // console.time('animate');
    requestAnimationFrame(animate);
    c.clearRect(0, 0, CANVAS_HEIGHT, CANVAS_WIDTH);

    drawTerrain();
    me.update();
    drawAtMousePointer();
    // console.timeEnd('animate');
}

// Excecution

const terrain = createTerrain();
let me;
let mouse = {
    x: null,
    y: null,
    radius: 10,
};

init();
animate();
