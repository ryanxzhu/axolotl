const DUNGEON_HEIGHT = 5000;
const DUNGEON_WIDTH = 5000;
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

function generateWhiteNoise(size, whiteLevel = 0.55) {
    return new Array(size).fill(0).map(() => (Math.random() >= whiteLevel ? WALL : OPEN_SPACE));
}

function createNoiseMatrix() {
    return new Array(MATRIX_DIMENSIONS.height).fill(0).map(() => {
        return generateWhiteNoise(MATRIX_DIMENSIONS.width, WHITE_LEVEL);
    });
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

function cellularAutomaton(noiseMatrix) {
    noiseMatrix.forEach((row, rowIndex) => {
        row.forEach((pixel, pixelIndex) => {
            noiseMatrix[rowIndex][pixelIndex] = calculatePixelValueByNeighbors(
                rowIndex,
                pixelIndex,
                noiseMatrix
            );
        });
    });

    return noiseMatrix;
}

function convertNoiseMatrixToTerrain(noiseMatrix) {
    for (let i = 0; i < 10; i++) {
        noiseMatrix = cellularAutomaton(noiseMatrix);
    }
    return noiseMatrix;
}

function addPadding(terrain) {
    const lengthToAdd = terrain.length * PADDING;
    terrain = terrain.map((row) => {
        const filler = new Array(lengthToAdd).fill(0);
        return [...filler, ...row, ...filler];
    });
    const topBottomFillerRow = new Array(terrain[0].length).fill(0);
    const topBottomFiller = new Array(lengthToAdd).fill(topBottomFillerRow);

    return [...topBottomFiller, ...terrain, ...topBottomFiller];
}

function convertToPixelObjs(terrain) {
    terrain = terrain.map((row, y) => {
        return row.map((cell, x) => {
            return {
                x: x * PIXEL_RATIO,
                y: y * PIXEL_RATIO,
                wallType: cell,
            };
        });
    });

    return terrain;
}

function createTerrain() {
    let noiseMatrix = createNoiseMatrix();
    let terrain = convertNoiseMatrixToTerrain(noiseMatrix);
    terrain = addPadding(terrain);
    terrain = convertToPixelObjs(terrain);
    return terrain;
}
