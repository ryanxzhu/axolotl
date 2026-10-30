// little bubbles that rise from the axolotl's mouth. Each one stays where it was released in the cave (it
// doesn't follow the axolotl), drifts upward with a wobble and fades out. The faster it swims, the more bubbles.
// They're drawn on top of everything except the "+N" calorie numbers.

const BUBBLE_CAPACITY = 150; // most bubbles alive at once; they live in fixed arrays, so nothing is allocated per frame
// bubbles per second at the normal top speed; scales with speed, so a kick (double speed) makes twice as many
const BUBBLES_PER_SECOND_AT_TOP_SPEED = 1.25;
// releases come at random intervals (sometimes quick, sometimes a pause), and each release is 1, 2 or 3 bubbles
// with these chances. Releases happen less often to make up for the clusters, so the average rate above holds.
const BUBBLE_CLUSTER_CHANCES = [0.6, 0.3, 0.1];
const BUBBLE_CLUSTER_AVERAGE = BUBBLE_CLUSTER_CHANCES.reduce((sum, chance, i) => sum + chance * (i + 1), 0);
const BUBBLE_LIFE_FRAMES = [120, 150]; // a bubble lasts 2 to 2.5 seconds
const BUBBLE_RADIUS = [2, 4.5];
const BUBBLE_RISE = [0.35, 0.6]; // px per frame upward
const BUBBLE_WOBBLE_PX = 2.5; // widest side-to-side drift
const BUBBLE_GROWTH = 0.3; // grows by this much (30%) as it rises
const BUBBLE_ALPHA = 1; // how visible bubbles are at their peak (1 = fully), before fading out
const BUBBLE_OUTLINE_COLOR = 'rgba(40, 125, 140, 0.85)'; // soft teal-blue, so bubbles stand out on the pale water and the dark rock
const BUBBLE_FILL_COLOR = 'rgba(255, 255, 255, 0.5)';
const BUBBLE_OUTLINE_WIDTH = 1.6;
const BUBBLE_GLINT_COLOR = 'rgba(255, 255, 255, 1)';

// a random wait until the next release, averaging 1 (an exponential spread, the way random events are spaced:
// mostly short gaps, now and then a longer pause)
function randomReleaseGap() {
    return -Math.log(1 - Math.random());
}

function randomClusterSize() {
    let roll = Math.random();
    for (let i = 0; i < BUBBLE_CLUSTER_CHANCES.length; i++) {
        roll -= BUBBLE_CLUSTER_CHANCES[i];
        if (roll < 0) return i + 1;
    }
    return BUBBLE_CLUSTER_CHANCES.length;
}

class Bubbles {
    constructor() {
        this.x = new Float32Array(BUBBLE_CAPACITY);
        this.y = new Float32Array(BUBBLE_CAPACITY);
        this.radius = new Float32Array(BUBBLE_CAPACITY);
        this.rise = new Float32Array(BUBBLE_CAPACITY);
        this.wobblePhase = new Float32Array(BUBBLE_CAPACITY);
        this.age = new Float32Array(BUBBLE_CAPACITY);
        this.life = new Float32Array(BUBBLE_CAPACITY);
        this.count = 0; // live bubbles are kept packed at the front of the arrays
        this.spawnProgress = 0;
        this.nextRelease = randomReleaseGap();
    }

    // releases new bubbles at the mouth in proportion to speed, and moves and ages the rest
    update(meeple) {
        this.spawnProgress +=
            (Math.abs(meeple.velocity) / BASE_MAX_VELOCITY) *
            (BUBBLES_PER_SECOND_AT_TOP_SPEED / BUBBLE_CLUSTER_AVERAGE / FRAMES_PER_SECOND);
        const mouthX = meeple.x + Math.sin(meeple.angle) * MOUTH_FORWARD * meeple.radius;
        const mouthY = meeple.y + Math.cos(meeple.angle) * MOUTH_FORWARD * meeple.radius;
        while (this.spawnProgress >= this.nextRelease) {
            this.spawnProgress -= this.nextRelease;
            this.nextRelease = randomReleaseGap();
            const cluster = randomClusterSize();
            // a cluster's bubbles start a little apart, so they rise as a small group rather than one blob
            for (let k = 0; k < cluster; k++) this.spawn(mouthX, mouthY + k * 3);
        }

        for (let i = this.count - 1; i >= 0; i--) {
            this.age[i]++;
            if (this.age[i] >= this.life[i]) {
                this.removeAt(i);
                continue;
            }
            this.y[i] -= this.rise[i];
        }
    }

    spawn(x, y) {
        if (this.count >= BUBBLE_CAPACITY) return;
        const i = this.count++;
        this.x[i] = x + randomBetween(-2, 2);
        this.y[i] = y + randomBetween(-2, 2);
        this.radius[i] = randomBetween(BUBBLE_RADIUS[0], BUBBLE_RADIUS[1]);
        this.rise[i] = randomBetween(BUBBLE_RISE[0], BUBBLE_RISE[1]);
        this.wobblePhase[i] = Math.random() * Math.PI * 2;
        this.age[i] = 0;
        this.life[i] = randomBetween(BUBBLE_LIFE_FRAMES[0], BUBBLE_LIFE_FRAMES[1]);
    }

    // moves the last live bubble into this slot, keeping the live ones packed at the front
    removeAt(i) {
        const last = --this.count;
        this.x[i] = this.x[last];
        this.y[i] = this.y[last];
        this.radius[i] = this.radius[last];
        this.rise[i] = this.rise[last];
        this.wobblePhase[i] = this.wobblePhase[last];
        this.age[i] = this.age[last];
        this.life[i] = this.life[last];
    }

    draw(meeple) {
        if (this.count === 0) return;
        const offsetX = Math.round(meeple.adjustedX - meeple.x);
        const offsetY = Math.round(meeple.adjustedY - meeple.y);
        c.lineWidth = BUBBLE_OUTLINE_WIDTH;
        c.strokeStyle = BUBBLE_OUTLINE_COLOR;

        for (let i = 0; i < this.count; i++) {
            const t = this.age[i] / this.life[i];
            // a quick fade in, then a slow fade out
            c.globalAlpha = BUBBLE_ALPHA * Math.min(t / 0.1, 1) * (1 - t);
            const radius = this.radius[i] * (1 + BUBBLE_GROWTH * t);
            const wobble = Math.sin(this.wobblePhase[i] + this.age[i] * 0.12) * BUBBLE_WOBBLE_PX * Math.min(t * 3, 1);
            const x = this.x[i] + wobble + offsetX;
            const y = this.y[i] + offsetY;

            c.beginPath();
            c.arc(x, y, radius, 0, Math.PI * 2);
            c.fillStyle = BUBBLE_FILL_COLOR;
            c.fill();
            c.stroke();
            c.beginPath();
            c.arc(x - radius * 0.35, y - radius * 0.35, radius * 0.3, 0, Math.PI * 2);
            c.fillStyle = BUBBLE_GLINT_COLOR;
            c.fill();
        }
        c.globalAlpha = 1;
    }
}
