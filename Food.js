// how many of each food are on the map at once; eaten food respawns elsewhere, so these stay constant
const SEAWEED_COUNT = 2400;
const WORM_COUNT = 800;
const SEAWEED_CALORIES = 1 * GAME_SPEED;
const WORM_CALORIES = 2 * GAME_SPEED;

// food is sorted into square buckets, so drawing and eating only look at food near the axolotl
const FOOD_BUCKET_PX = 400;
// how fast the Hoover food upgrade pulls food at the edge of its reach, in px per frame (up to 3× near the mouth)
const HOOVER_SPEED = 1.2 * GAME_SPEED;
// new food never appears this close to the axolotl, so it doesn't pop up right in front of it
const FOOD_SPAWN_CLEARANCE = 50;

function randomBetween(min, max) {
    return min + Math.random() * (max - min);
}

// a roundish, irregular clump of seaweed: random radii around a circle, joined with smooth curves
function makeSeaweedSprite() {
    const size = 32;
    const sprite = document.createElement('canvas');
    sprite.width = size;
    sprite.height = size;
    const g = sprite.getContext('2d');
    g.translate(size / 2, size / 2);

    const hue = randomBetween(100, 145);
    const pointCount = 8 + Math.floor(Math.random() * 5);
    const xs = [];
    const ys = [];
    for (let i = 0; i < pointCount; i++) {
        const angle = (i / pointCount) * Math.PI * 2 + randomBetween(-0.2, 0.2);
        const radius = 9 * randomBetween(0.7, 1.2);
        xs.push(Math.cos(angle) * radius);
        ys.push(Math.sin(angle) * radius);
    }

    // curve through the midpoints between neighbouring points, using the points as control points
    g.beginPath();
    g.moveTo((xs[pointCount - 1] + xs[0]) / 2, (ys[pointCount - 1] + ys[0]) / 2);
    for (let i = 0; i < pointCount; i++) {
        const next = (i + 1) % pointCount;
        g.quadraticCurveTo(xs[i], ys[i], (xs[i] + xs[next]) / 2, (ys[i] + ys[next]) / 2);
    }
    g.closePath();
    g.fillStyle = `hsl(${hue}, 50%, 38%)`;
    g.fill();
    g.lineWidth = 1.5;
    g.strokeStyle = `hsl(${hue}, 55%, 20%)`;
    g.stroke();

    // a few lighter flecks so it reads as leafy rather than a flat blob
    g.fillStyle = `hsla(${hue}, 60%, 62%, 0.7)`;
    for (let i = 0; i < 3; i++) {
        g.beginPath();
        g.arc(randomBetween(-4, 4), randomBetween(-4, 4), randomBetween(1, 2), 0, Math.PI * 2);
        g.fill();
    }

    return sprite;
}

// a short, fat worm, each one curved a little differently and lying at a random angle. Same colours and
// rough size every time; the body is a curve with two random bend points, so it comes out as a gentle arc,
// a "C" or an "S" wiggle
function makeWormSprite() {
    const size = 40;
    const sprite = document.createElement('canvas');
    sprite.width = size;
    sprite.height = size;
    const g = sprite.getContext('2d');
    g.translate(size / 2, size / 2);
    g.rotate(Math.random() * Math.PI * 2);

    const halfLength = 11 * randomBetween(0.9, 1.1);
    const bendNearHead = randomBetween(-8, 8);
    const bendNearTail = randomBetween(-8, 8);
    const thickness = 9;
    const hue = 8;
    const tracePath = () => {
        g.beginPath();
        g.moveTo(-halfLength, 0);
        g.bezierCurveTo(-halfLength / 3, bendNearHead, halfLength / 3, bendNearTail, halfLength, 0);
    };

    g.lineCap = 'round';
    tracePath();
    g.lineWidth = thickness + 3;
    g.strokeStyle = `hsl(${hue}, 45%, 30%)`;
    g.stroke();
    tracePath();
    g.lineWidth = thickness;
    g.strokeStyle = `hsl(${hue}, 60%, 62%)`;
    g.stroke();

    // the curve's four control points, for finding points along it
    const px = [-halfLength, -halfLength / 3, halfLength / 3, halfLength];
    const py = [0, bendNearHead, bendNearTail, 0];
    // the point at t (0 = head end, 1 = tail end) and a unit vector across the body there
    const along = (t) => {
        const u = 1 - t;
        const x = u * u * u * px[0] + 3 * u * u * t * px[1] + 3 * u * t * t * px[2] + t * t * t * px[3];
        const y = u * u * u * py[0] + 3 * u * u * t * py[1] + 3 * u * t * t * py[2] + t * t * t * py[3];
        const dx = 3 * u * u * (px[1] - px[0]) + 6 * u * t * (px[2] - px[1]) + 3 * t * t * (px[3] - px[2]);
        const dy = 3 * u * u * (py[1] - py[0]) + 6 * u * t * (py[2] - py[1]) + 3 * t * t * (py[3] - py[2]);
        const length = Math.hypot(dx, dy);
        return { x, y, acrossX: -dy / length, acrossY: dx / length };
    };

    // ring segments across the body
    g.lineWidth = 1.2;
    g.strokeStyle = `hsla(${hue}, 45%, 32%, 0.8)`;
    const ringHalfWidth = thickness / 2 - 0.5;
    for (const t of [0.25, 0.4, 0.55, 0.7]) {
        const { x, y, acrossX, acrossY } = along(t);
        g.beginPath();
        g.moveTo(x - acrossX * ringHalfWidth, y - acrossY * ringHalfWidth);
        g.lineTo(x + acrossX * ringHalfWidth, y + acrossY * ringHalfWidth);
        g.stroke();
    }

    // two small eyes near the head end, one either side of the middle, each with a white glint
    const head = along(0.05);
    for (const side of [-1, 1]) {
        const eyeX = head.x + head.acrossX * side * 2.2;
        const eyeY = head.y + head.acrossY * side * 2.2;
        g.beginPath();
        g.arc(eyeX, eyeY, 1.8, 0, Math.PI * 2);
        g.fillStyle = 'black';
        g.fill();
        g.beginPath();
        g.arc(eyeX - 0.5, eyeY - 0.5, 0.7, 0, Math.PI * 2);
        g.fillStyle = 'white';
        g.fill();
    }

    return sprite;
}

// uniqueShape: every piece gets its own freshly generated sprite, so each seaweed and worm looks slightly
// different. Otherwise one sprite is shared and each piece just lies at its own random angle.
const FOOD_TYPES = {
    seaweed: { count: SEAWEED_COUNT, calories: SEAWEED_CALORIES, radius: 9, makeSprite: makeSeaweedSprite, uniqueShape: true },
    worm: { count: WORM_COUNT, calories: WORM_CALORIES, radius: 10, makeSprite: makeWormSprite, uniqueShape: true },
};

class FoodField {
    constructor(terrain, meeple) {
        this.terrain = terrain;
        this.meeple = meeple;
        this.buckets = new Map();
        this.contact = { depth: 0, normalX: 0, normalY: 0 };
        this.hooverTick = 0;
        this.mapWidth = (terrain.full[0].length - 1) * PIXEL_RATIO;
        this.mapHeight = (terrain.full.length - 1) * PIXEL_RATIO;

        this.sharedSprites = {};
        for (const type in FOOD_TYPES) {
            if (!FOOD_TYPES[type].uniqueShape) this.sharedSprites[type] = FOOD_TYPES[type].makeSprite();
        }

        for (const type in FOOD_TYPES) {
            for (let i = 0; i < FOOD_TYPES[type].count; i++) {
                this.spawn(type);
            }
        }
    }

    bucketFor(x, y) {
        const key = Math.floor(y / FOOD_BUCKET_PX) * 100000 + Math.floor(x / FOOD_BUCKET_PX);
        let bucket = this.buckets.get(key);
        if (!bucket) {
            bucket = [];
            this.buckets.set(key, bucket);
        }
        return bucket;
    }

    // picks random spots until one is open water with a little room around it, away from the axolotl
    spawn(type) {
        const { radius, uniqueShape, makeSprite } = FOOD_TYPES[type];
        let x;
        let y;
        do {
            x = Math.random() * this.mapWidth;
            y = Math.random() * this.mapHeight;
        } while (
            Math.hypot(x - this.meeple.x, y - this.meeple.y) < FOOD_SPAWN_CLEARANCE ||
            this.terrain.isRockAt(x, y) ||
            this.terrain.findContact(x, y, radius + 3, this.contact)
        );

        this.bucketFor(x, y).push({
            type,
            x,
            y,
            radius,
            sprite: uniqueShape ? makeSprite() : this.sharedSprites[type],
            // unique shapes are already random, so only shared ones need turning to vary
            angle: uniqueShape ? 0 : Math.random() * Math.PI * 2,
        });
    }

    // the closest food within `radius` of (x, y), or null. Skips `ignore` (a piece it gave up on).
    // Only looks in the buckets the circle overlaps and allocates nothing.
    findNearest(x, y, radius, ignore) {
        const firstBucketX = Math.floor((x - radius) / FOOD_BUCKET_PX);
        const lastBucketX = Math.floor((x + radius) / FOOD_BUCKET_PX);
        const firstBucketY = Math.floor((y - radius) / FOOD_BUCKET_PX);
        const lastBucketY = Math.floor((y + radius) / FOOD_BUCKET_PX);
        let nearest = null;
        let nearestDistanceSquared = radius * radius;

        for (let bucketY = firstBucketY; bucketY <= lastBucketY; bucketY++) {
            for (let bucketX = firstBucketX; bucketX <= lastBucketX; bucketX++) {
                const bucket = this.buckets.get(bucketY * 100000 + bucketX);
                if (!bucket) continue;
                for (let i = 0; i < bucket.length; i++) {
                    const food = bucket[i];
                    if (food === ignore) continue;
                    const dx = food.x - x;
                    const dy = food.y - y;
                    const distanceSquared = dx * dx + dy * dy;
                    if (distanceSquared < nearestDistanceSquared) {
                        nearestDistanceSquared = distanceSquared;
                        nearest = food;
                    }
                }
            }
        }
        return nearest;
    }

    // Hoover food upgrade: food within `radius` of the head drifts towards the mouth, faster as it gets closer,
    // until the body touches it and it's eaten
    hooverTowards(headX, headY, mouthX, mouthY, radius) {
        this.hooverTick++;
        const firstBucketX = Math.floor((headX - radius) / FOOD_BUCKET_PX);
        const lastBucketX = Math.floor((headX + radius) / FOOD_BUCKET_PX);
        const firstBucketY = Math.floor((headY - radius) / FOOD_BUCKET_PX);
        const lastBucketY = Math.floor((headY + radius) / FOOD_BUCKET_PX);

        for (let bucketY = firstBucketY; bucketY <= lastBucketY; bucketY++) {
            for (let bucketX = firstBucketX; bucketX <= lastBucketX; bucketX++) {
                const key = bucketY * 100000 + bucketX;
                const bucket = this.buckets.get(key);
                if (!bucket) continue;
                for (let i = bucket.length - 1; i >= 0; i--) {
                    const food = bucket[i];
                    // food that just moved into a later bucket this frame shouldn't be pulled twice
                    if (food.hooveredTick === this.hooverTick) continue;
                    if (Math.hypot(food.x - headX, food.y - headY) > radius) continue;

                    const dx = mouthX - food.x;
                    const dy = mouthY - food.y;
                    const distance = Math.hypot(dx, dy);
                    if (distance < 0.5) continue;
                    const pull = Math.min(distance, HOOVER_SPEED * (1 + (1 - Math.min(distance / radius, 1)) * 2));
                    food.x += (dx / distance) * pull;
                    food.y += (dy / distance) * pull;
                    food.hooveredTick = this.hooverTick;

                    const newKey =
                        Math.floor(food.y / FOOD_BUCKET_PX) * 100000 + Math.floor(food.x / FOOD_BUCKET_PX);
                    if (newKey !== key) {
                        bucket.splice(i, 1);
                        this.bucketFor(food.x, food.y).push(food);
                    }
                }
            }
        }
    }

    // draws the food on screen, pulsing in step with the axolotl
    drawView(meeple) {
        const scale = meeple.bulgingRadius.radius / meeple.radius;
        const offsetX = Math.round(meeple.adjustedX - meeple.x);
        const offsetY = Math.round(meeple.adjustedY - meeple.y);
        const margin = 30;
        const firstBucketX = Math.floor((-offsetX - margin) / FOOD_BUCKET_PX);
        const lastBucketX = Math.floor((canvas.width - offsetX + margin) / FOOD_BUCKET_PX);
        const firstBucketY = Math.floor((-offsetY - margin) / FOOD_BUCKET_PX);
        const lastBucketY = Math.floor((canvas.height - offsetY + margin) / FOOD_BUCKET_PX);

        for (let bucketY = firstBucketY; bucketY <= lastBucketY; bucketY++) {
            for (let bucketX = firstBucketX; bucketX <= lastBucketX; bucketX++) {
                const bucket = this.buckets.get(bucketY * 100000 + bucketX);
                if (!bucket) continue;
                for (let i = 0; i < bucket.length; i++) {
                    const food = bucket[i];
                    const drawSize = food.sprite.width * scale;
                    if (food.angle === 0) {
                        c.drawImage(
                            food.sprite,
                            food.x + offsetX - drawSize / 2,
                            food.y + offsetY - drawSize / 2,
                            drawSize,
                            drawSize
                        );
                        continue;
                    }
                    c.save();
                    c.translate(food.x + offsetX, food.y + offsetY);
                    c.rotate(food.angle);
                    c.drawImage(food.sprite, -drawSize / 2, -drawSize / 2, drawSize, drawSize);
                    c.restore();
                }
            }
        }
    }

    // eats any food touching any part of the axolotl's body (head, body or tail, so backing into it counts).
    // Each eaten piece respawns somewhere else, and onEat(x, y, calories) is called for it.
    // Returns the calories gained this frame.
    eatTouching(meeple, onEat) {
        const facingX = Math.sin(meeple.angle);
        const facingY = Math.cos(meeple.angle);
        const reach = meeple.radius * 2 + 12;
        const firstBucketX = Math.floor((meeple.x - reach) / FOOD_BUCKET_PX);
        const lastBucketX = Math.floor((meeple.x + reach) / FOOD_BUCKET_PX);
        const firstBucketY = Math.floor((meeple.y - reach) / FOOD_BUCKET_PX);
        const lastBucketY = Math.floor((meeple.y + reach) / FOOD_BUCKET_PX);
        let calories = 0;

        for (let bucketY = firstBucketY; bucketY <= lastBucketY; bucketY++) {
            for (let bucketX = firstBucketX; bucketX <= lastBucketX; bucketX++) {
                const bucket = this.buckets.get(bucketY * 100000 + bucketX);
                if (!bucket) continue;
                for (let i = bucket.length - 1; i >= 0; i--) {
                    const food = bucket[i];
                    if (!this.touchesBody(food, meeple, facingX, facingY)) continue;
                    bucket.splice(i, 1);
                    food.eaten = true; // lets anything still tracking this piece (e.g. smell) know it's gone
                    const gained = FOOD_TYPES[food.type].calories;
                    calories += gained;
                    onEat(food.x, food.y, gained);
                    this.spawn(food.type);
                }
            }
        }
        return calories;
    }

    touchesBody(food, meeple, facingX, facingY) {
        for (let i = 0; i < BODY_CIRCLES.length; i++) {
            const forward = BODY_CIRCLES[i][0] * meeple.radius;
            const reach = BODY_CIRCLES[i][1] * meeple.radius + food.radius;
            const dx = meeple.x + facingX * forward - food.x;
            const dy = meeple.y + facingY * forward - food.y;
            if (dx * dx + dy * dy < reach * reach) return true;
        }
        return false;
    }
}
