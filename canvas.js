const DUNGEON_HEIGHT = 10000;
const DUNGEON_WIDTH = 10000;
const PADDING = 0.1;
const CANVAS_HEIGHT = DUNGEON_HEIGHT * (1 + 2 * PADDING);
const CANVAS_WIDTH = DUNGEON_WIDTH * (1 + 2 * PADDING);
console.log(CANVAS_HEIGHT, CANVAS_WIDTH);
const WHITE_LEVEL = 0.55;
const BLACK = 0;
const WHITE = 1;
const COLORS = {
    [BLACK]: '#03332d',
    [WHITE]: 'rgba(255,255,255,0)',
};
const PIXEL_RATIO = 40;
const MATRIX_DIMENSIONS = {
    height: DUNGEON_HEIGHT / PIXEL_RATIO,
    width: DUNGEON_WIDTH / PIXEL_RATIO,
};
const canvas = document.querySelector('canvas');
canvas.height = CANVAS_HEIGHT;
canvas.width = CANVAS_WIDTH;

function generateWhiteNoise(size, whiteLevel = 0.6) {
    return new Array(size).fill(0).map(() => (Math.random() >= whiteLevel ? BLACK : WHITE));
}

function draw(terrain_matrix) {
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, CANVAS_HEIGHT, CANVAS_WIDTH);
    ctx.beginPath();
    terrain_matrix.forEach((pixelsRow, rowIndex) => {
        const y = rowIndex * PIXEL_RATIO;
        pixelsRow.forEach((pixel, pixelIndex) => {
            const x = pixelIndex * PIXEL_RATIO;
            ctx.fillStyle = COLORS[pixel];
            ctx.fillRect(x, y, PIXEL_RATIO, PIXEL_RATIO);
        });
    });
    ctx.closePath();
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
    return sum > 0 ? WHITE : BLACK;
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

function init() {
    let noise_matrix = new Array(MATRIX_DIMENSIONS.height).fill(0).map(() => {
        return generateWhiteNoise(MATRIX_DIMENSIONS.width, WHITE_LEVEL);
    });

    for (let i = 0; i < 10; i++) {
        noise_matrix = cellularAutomaton(noise_matrix);
    }

    noise_matrix = addPadding(noise_matrix);
    draw(noise_matrix);
}

init();
