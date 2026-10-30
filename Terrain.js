const DUNGEON_HEIGHT = 20000;
const DUNGEON_WIDTH = 20000;
const PADDING = 0.1;
const CANVAS_HEIGHT = DUNGEON_HEIGHT * (1 + 2 * PADDING);
const CANVAS_WIDTH = DUNGEON_WIDTH * (1 + 2 * PADDING);
const WHITE_LEVEL = 0.53;
const WALL = 0;
const OPEN_SPACE = 1;
const COLORS = {
    // [WALL]: 'hsl(18, 89%, 11%)',
    // [OPEN_SPACE]: 'hsl(18, 100%, 95%)',
    [WALL]: 'hsl(173, 89%, 11%)',
    [OPEN_SPACE]: 'hsl(178, 100%, 95%)',
};
const COLORS2 = {
    [WALL]: 'red',
    [OPEN_SPACE]: 'hsl(18, 100%, 95%)',
};

const WALL_RIM_COLOR = 'hsl(173, 45%, 24%)';
const WALL_SHADOW_COLOR = 'rgba(0, 45, 45, 0.25)';
const WALL_SPECKLE_COLOR = 'rgba(0, 0, 0, 0.18)';
const EDGE_JITTER = 0.3; // how far wall edges wander from the cell midpoints, as a fraction of a cell

const PIXEL_RATIO = 50;
// the world is pre-rendered into square chunks, so each frame is only a few drawImage calls
const CHUNK_CELLS = 8;
const CHUNK_PX = CHUNK_CELLS * PIXEL_RATIO;
const MAX_CACHED_CHUNKS = 48;
const WATER_TILE_PX = CHUNK_PX * 2;
const MATRIX_DIMENSIONS = {
    height: DUNGEON_HEIGHT / PIXEL_RATIO,
    width: DUNGEON_WIDTH / PIXEL_RATIO,
};

// a small seeded random number generator (mulberry32): the same seed always gives the same sequence, so a
// map can be rebuilt exactly from its seed
function seededRandom(seed) {
    let state = seed | 0;
    return () => {
        state = (state + 0x6d2b79f5) | 0;
        let t = Math.imul(state ^ (state >>> 15), 1 | state);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

// a fresh seed for a new map
function newMapSeed() {
    return crypto.getRandomValues(new Uint32Array(1))[0];
}

function generateWhiteNoise(size, whiteLevel, random) {
    return new Array(size).fill(0).map(() => (random() >= whiteLevel ? WALL : OPEN_SPACE));
}

function createNoiseMatrix(random) {
    return new Array(MATRIX_DIMENSIONS.height).fill(0).map(() => {
        return generateWhiteNoise(MATRIX_DIMENSIONS.width, WHITE_LEVEL, random);
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

// deterministic 0..1 value for a pair of integers, so the same wall edge always gets the same shape
function hash2(a, b) {
    let h = Math.imul(a, 374761393) + Math.imul(b, 668265263);
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
}

function smoothstep(edge0, edge1, x) {
    const t = Math.min(Math.max((x - edge0) / (edge1 - edge0), 0), 1);
    return t * t * (3 - 2 * t);
}

// seamless light-water texture with soft caustic ripples (a warped Voronoi network), made once at startup
function generateWaterTile(random) {
    const size = WATER_TILE_PX;
    const tile = document.createElement('canvas');
    tile.width = size;
    tile.height = size;
    const tileContext = tile.getContext('2d');
    const image = tileContext.createImageData(size, size);

    // one ripple centre per grid cell, so each pixel only has to check the 3x3 cells around it
    const gridCells = 8;
    const cellPx = size / gridCells;
    const seedsX = new Float32Array(gridCells * gridCells);
    const seedsY = new Float32Array(gridCells * gridCells);
    for (let s = 0; s < gridCells * gridCells; s++) {
        seedsX[s] = random() * cellPx;
        seedsY[s] = random() * cellPx;
    }

    const base = [200, 241, 245];
    const deep = [176, 226, 234];
    const highlight = [240, 255, 255];
    const wave = (Math.PI * 2 * 3) / size; // whole number of waves per tile keeps it seamless

    for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
            const warpedX = x + 10 * Math.sin(y * wave);
            const warpedY = y + 10 * Math.sin(x * wave);
            const cellX = Math.floor(warpedX / cellPx);
            const cellY = Math.floor(warpedY / cellPx);
            let nearest = Infinity;
            let secondNearest = Infinity;
            for (let ny = cellY - 1; ny <= cellY + 1; ny++) {
                for (let nx = cellX - 1; nx <= cellX + 1; nx++) {
                    // wrap the cell index so the tile repeats seamlessly
                    const seed =
                        (((ny % gridCells) + gridCells) % gridCells) * gridCells +
                        (((nx % gridCells) + gridCells) % gridCells);
                    const dx = warpedX - (nx * cellPx + seedsX[seed]);
                    const dy = warpedY - (ny * cellPx + seedsY[seed]);
                    const distance = dx * dx + dy * dy;
                    if (distance < nearest) {
                        secondNearest = nearest;
                        nearest = distance;
                    } else if (distance < secondNearest) {
                        secondNearest = distance;
                    }
                }
            }
            const f1 = Math.sqrt(nearest);
            const f2 = Math.sqrt(secondNearest);
            const caustic = 1 - smoothstep(0, 14, f2 - f1);
            const depth = Math.min(f1 / 70, 1) * 0.45;

            const index = (y * size + x) * 4;
            for (let channel = 0; channel < 3; channel++) {
                let value = base[channel] + (deep[channel] - base[channel]) * depth;
                value += (highlight[channel] - value) * caustic * caustic * 0.4;
                image.data[index + channel] = value;
            }
            image.data[index + 3] = 255;
        }
    }

    tileContext.putImageData(image, 0, 0);
    return tile;
}

class Terrain {
    // the whole map (rock layout and water texture) comes from `seed`, so the same seed rebuilds the same map.
    // A save stores just the seed. The wall edges' wobble is already worked out from each edge's position.
    constructor(seed) {
        this.seed = seed;
        const random = seededRandom(seed);
        let noiseMatrix = createNoiseMatrix(random);
        let terrain = convertNoiseMatrixToTerrain(noiseMatrix);
        terrain = addPadding(terrain);
        terrain = convertToPixelObjs(terrain);
        this.full = terrain;
        this.waterTile = generateWaterTile(random);
        this.chunks = new Map();
        // scratch space for squareOutline, reused so collision checks don't allocate every frame
        this.outlineXs = new Float64Array(8);
        this.outlineYs = new Float64Array(8);
        this.outlineCrossings = new Uint8Array(8);
        this.outlinePointCount = 0;
    }

    isWall(row, col) {
        if (row < 0 || col < 0 || row >= this.full.length || col >= this.full[0].length) {
            return true;
        }
        return this.full[row][col].wallType === WALL;
    }

    // where a wall edge crosses the line between two neighbouring cell centres, measured from the top/left one
    edgeCrossing(row, col, vertical) {
        return 0.5 + (hash2(row * 2 + (vertical ? 1 : 0), col) - 0.5) * EDGE_JITTER * 2;
    }

    addOutlinePoint(x, y, crossing) {
        const p = this.outlinePointCount++;
        this.outlineXs[p] = x;
        this.outlineYs[p] = y;
        this.outlineCrossings[p] = crossing;
    }

    // marching squares over the cell centres, shared by drawing and collision so both see the same rock.
    // Fills outlineXs/outlineYs with the wall part of one square (world px), walking its corners clockwise
    // and adding the points where a wall edge crosses the square's sides. Returns the number of points:
    // 0 for open water, 4 corners and no crossings for solid rock.
    squareOutline(row, col) {
        const topLeft = this.isWall(row, col);
        const topRight = this.isWall(row, col + 1);
        const bottomRight = this.isWall(row + 1, col + 1);
        const bottomLeft = this.isWall(row + 1, col);
        const left = col * PIXEL_RATIO;
        const top = row * PIXEL_RATIO;

        this.outlinePointCount = 0;
        if (topLeft) this.addOutlinePoint(left, top, false);
        if (topLeft !== topRight) {
            this.addOutlinePoint(left + this.edgeCrossing(row, col, false) * PIXEL_RATIO, top, true);
        }
        if (topRight) this.addOutlinePoint(left + PIXEL_RATIO, top, false);
        if (topRight !== bottomRight) {
            this.addOutlinePoint(left + PIXEL_RATIO, top + this.edgeCrossing(row, col + 1, true) * PIXEL_RATIO, true);
        }
        if (bottomRight) this.addOutlinePoint(left + PIXEL_RATIO, top + PIXEL_RATIO, false);
        if (bottomRight !== bottomLeft) {
            this.addOutlinePoint(left + this.edgeCrossing(row + 1, col, false) * PIXEL_RATIO, top + PIXEL_RATIO, true);
        }
        if (bottomLeft) this.addOutlinePoint(left, top + PIXEL_RATIO, false);
        if (bottomLeft !== topLeft) {
            this.addOutlinePoint(left, top + this.edgeCrossing(row, col, true) * PIXEL_RATIO, true);
        }
        return this.outlinePointCount;
    }

    buildWallPaths(firstRow, firstCol, rows, cols, originX, originY) {
        const fill = new Path2D();
        const outline = new Path2D();
        const xs = this.outlineXs;
        const ys = this.outlineYs;

        for (let row = firstRow; row < firstRow + rows; row++) {
            for (let col = firstCol; col < firstCol + cols; col++) {
                const count = this.squareOutline(row, col);
                if (count === 0) continue;

                fill.moveTo(xs[0] - originX, ys[0] - originY);
                for (let p = 1; p < count; p++) fill.lineTo(xs[p] - originX, ys[p] - originY);
                fill.closePath();

                // two crossings next to each other in the walk are a piece of the wall's surface
                for (let p = 0; p < count; p++) {
                    const next = (p + 1) % count;
                    if (this.outlineCrossings[p] && this.outlineCrossings[next]) {
                        outline.moveTo(xs[p] - originX, ys[p] - originY);
                        outline.lineTo(xs[next] - originX, ys[next] - originY);
                    }
                }
            }
        }

        return { fill, outline };
    }

    // true if the point is inside the drawn rock (point-in-polygon on that square's wall shape)
    isRockAt(x, y) {
        const count = this.squareOutline(Math.floor(y / PIXEL_RATIO), Math.floor(x / PIXEL_RATIO));
        const xs = this.outlineXs;
        const ys = this.outlineYs;
        let inside = false;
        for (let p = 0, q = count - 1; p < count; q = p++) {
            if (ys[p] > y !== ys[q] > y && x < ((xs[q] - xs[p]) * (y - ys[p])) / (ys[q] - ys[p]) + xs[p]) {
                inside = !inside;
            }
        }
        return inside;
    }

    // finds where a circle overlaps the rock surface, keeping the deepest overlap in `contact`
    // (normal pointing out into the water). Returns false when the circle is clear.
    findContact(x, y, radius, contact) {
        contact.depth = 0;
        const firstRow = Math.floor((y - radius) / PIXEL_RATIO);
        const lastRow = Math.floor((y + radius) / PIXEL_RATIO);
        const firstCol = Math.floor((x - radius) / PIXEL_RATIO);
        const lastCol = Math.floor((x + radius) / PIXEL_RATIO);
        const xs = this.outlineXs;
        const ys = this.outlineYs;

        for (let row = firstRow; row <= lastRow; row++) {
            for (let col = firstCol; col <= lastCol; col++) {
                const count = this.squareOutline(row, col);
                for (let p = 0; p < count; p++) {
                    const next = (p + 1) % count;
                    if (!this.outlineCrossings[p] || !this.outlineCrossings[next]) continue;

                    const ax = xs[p];
                    const ay = ys[p];
                    const dx = xs[next] - ax;
                    const dy = ys[next] - ay;
                    const length = Math.hypot(dx, dy);
                    if (length === 0) continue;
                    // the walk is clockwise round the rock, so the water is on the left of each surface piece
                    const waterNormalX = dy / length;
                    const waterNormalY = -dx / length;

                    const t = Math.min(Math.max(((x - ax) * dx + (y - ay) * dy) / (length * length), 0), 1);
                    const offsetX = x - (ax + t * dx);
                    const offsetY = y - (ay + t * dy);
                    const distance = Math.hypot(offsetX, offsetY);
                    if (distance >= radius) continue;

                    const behindSurface = offsetX * waterNormalX + offsetY * waterNormalY < 0;
                    let depth;
                    let normalX;
                    let normalY;
                    if (behindSurface && t > 0 && t < 1) {
                        // centre has slipped just inside the rock: push straight back out through this surface
                        depth = radius + distance;
                        normalX = waterNormalX;
                        normalY = waterNormalY;
                    } else if (distance > 0) {
                        depth = radius - distance;
                        normalX = offsetX / distance;
                        normalY = offsetY / distance;
                    } else {
                        depth = radius;
                        normalX = waterNormalX;
                        normalY = waterNormalY;
                    }

                    if (depth > contact.depth) {
                        contact.depth = depth;
                        contact.normalX = normalX;
                        contact.normalY = normalY;
                    }
                }
            }
        }
        return contact.depth > 0;
    }

    renderChunk(chunkX, chunkY) {
        const chunk = document.createElement('canvas');
        chunk.width = CHUNK_PX;
        chunk.height = CHUNK_PX;
        const g = chunk.getContext('2d');
        const originX = chunkX * CHUNK_PX;
        const originY = chunkY * CHUNK_PX;

        // pick this chunk's quarter of the water tile, so the texture repeats only every two chunks
        const tileX = (((chunkX % 2) + 2) % 2) * CHUNK_PX;
        const tileY = (((chunkY % 2) + 2) % 2) * CHUNK_PX;
        g.drawImage(this.waterTile, tileX, tileY, CHUNK_PX, CHUNK_PX, 0, 0, CHUNK_PX, CHUNK_PX);

        // include a one-cell margin so strokes that spill over the chunk edge still match the neighbours
        const firstRow = chunkY * CHUNK_CELLS - 1;
        const firstCol = chunkX * CHUNK_CELLS - 1;
        const { fill, outline } = this.buildWallPaths(
            firstRow,
            firstCol,
            CHUNK_CELLS + 2,
            CHUNK_CELLS + 2,
            originX,
            originY
        );

        g.lineCap = 'round';
        g.lineJoin = 'round';
        g.strokeStyle = WALL_SHADOW_COLOR;
        g.lineWidth = 14;
        g.stroke(outline);

        g.fillStyle = COLORS[WALL];
        g.fill(fill);

        // darker flecks inside the rock, kept inside the wall shape
        g.save();
        g.clip(fill);
        g.fillStyle = WALL_SPECKLE_COLOR;
        g.beginPath();
        for (let row = firstRow; row <= firstRow + CHUNK_CELLS + 2; row++) {
            for (let col = firstCol; col <= firstCol + CHUNK_CELLS + 2; col++) {
                if (!this.isWall(row, col)) continue;
                for (let fleck = 0; fleck < 2; fleck++) {
                    const x = col * PIXEL_RATIO - originX + (hash2(row * 7 + fleck, col * 3) - 0.5) * PIXEL_RATIO;
                    const y = row * PIXEL_RATIO - originY + (hash2(col * 5 + fleck, row * 11) - 0.5) * PIXEL_RATIO;
                    const radius = 2 + hash2(row + fleck * 13, col + 17) * 6;
                    g.moveTo(x + radius, y);
                    g.arc(x, y, radius, 0, Math.PI * 2);
                }
            }
        }
        g.fill();
        g.restore();

        g.strokeStyle = WALL_RIM_COLOR;
        g.lineWidth = 4;
        g.stroke(outline);

        return chunk;
    }

    getChunk(chunkX, chunkY) {
        const key = chunkY * 100000 + chunkX;
        let chunk = this.chunks.get(key);
        if (chunk) {
            // re-insert so the Map's order tracks how recently each chunk was used
            this.chunks.delete(key);
            this.chunks.set(key, chunk);
            return chunk;
        }

        chunk = this.renderChunk(chunkX, chunkY);
        this.chunks.set(key, chunk);
        if (this.chunks.size > MAX_CACHED_CHUNKS) {
            this.chunks.delete(this.chunks.keys().next().value);
        }
        return chunk;
    }

    // draws the part of the world around the meeple; whole pixels keep the chunks from showing seams
    drawView(meeple) {
        const offsetX = Math.round(meeple.adjustedX - meeple.x);
        const offsetY = Math.round(meeple.adjustedY - meeple.y);
        const firstChunkX = Math.floor(-offsetX / CHUNK_PX);
        const lastChunkX = Math.floor((canvas.width - offsetX) / CHUNK_PX);
        const firstChunkY = Math.floor(-offsetY / CHUNK_PX);
        const lastChunkY = Math.floor((canvas.height - offsetY) / CHUNK_PX);

        for (let chunkY = firstChunkY; chunkY <= lastChunkY; chunkY++) {
            for (let chunkX = firstChunkX; chunkX <= lastChunkX; chunkX++) {
                c.drawImage(
                    this.getChunk(chunkX, chunkY),
                    chunkX * CHUNK_PX + offsetX,
                    chunkY * CHUNK_PX + offsetY
                );
            }
        }
    }

    findCorners(meeple, xOffset, yOffset) {
        const firstRow = this.full[0].map((pixel) => pixel.x);
        const column = this.full.map((row) => row[0].y);
        const x1 = binarySearch(firstRow, meeple.x - xOffset * 1.1, 0);
        const x2 = binarySearch(firstRow, meeple.x + xOffset * 1.1, 1);
        const y1 = binarySearch(column, meeple.y - yOffset * 1.1, 0);
        const y2 = binarySearch(column, meeple.y + yOffset * 1.1, 1);

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
}
