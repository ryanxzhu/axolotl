const DUNGEON_HEIGHT = 5000;
const DUNGEON_WIDTH = 5000;
const PADDING = 0.1;
const CANVAS_HEIGHT = DUNGEON_HEIGHT * (1 + 2 * PADDING);
const CANVAS_WIDTH = DUNGEON_WIDTH * (1 + 2 * PADDING);
console.log('terrains file:', CANVAS_HEIGHT);
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

class Terrain {
    constructor() {
        // let noiseMatrix = createNoiseMatrix();
        // let terrain = convertNoiseMatrixToTerrain(noiseMatrix);
        // terrain = addPadding(terrain);
        // terrain = convertToPixelObjs(terrain);
        this.full = [];
        this.displayed = [];
    }

    createFull() {
        let noiseMatrix = createNoiseMatrix();
        let terrain = convertNoiseMatrixToTerrain(noiseMatrix);
        terrain = addPadding(terrain);
        terrain = convertToPixelObjs(terrain);
        this.full = terrain;
    }

    findCorners(meeple, xOffset, yOffset) {
        const firstRow = this.full[0].map((pixel) => pixel.x);
        const column = this.full.map((row) => row[0].y);
        const x1 = this.binarySearch(firstRow, meeple.x - xOffset * 1.2, 0);
        const x2 = this.binarySearch(firstRow, meeple.x + xOffset * 1.2, 1);
        const y1 = this.binarySearch(column, meeple.y - yOffset * 1.2, 0);
        const y2 = this.binarySearch(column, meeple.y + yOffset * 1.2, 1);

        return { x1, x2, y1, y2 };
    }

    calcPartial(meeple, xOffset, yOffset) {
        const partialTerrain = [];
        const { x1, x2, y1, y2 } = this.findCorners(meeple, xOffset, yOffset);
        for (let i = y1; i <= y2; i++) {
            const row = [];
            for (let j = x1; j <= x2; j++) {
                row.push(this.full[i][j]);
            }
            partialTerrain.push(row);
        }

        return partialTerrain;
    }

    draw(terrain) {
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

    binarySearch(row, target, offset = 0) {
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
}
