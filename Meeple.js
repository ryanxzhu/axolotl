const MY_SIZE = 20;
const MY_VELOCITY = 2;
// const MY_COLOR = 'hsl(300, 100%, 50%)';
const MY_COLOR = '#ffb6c8';
const GILL_COLOR = '#ff6f91';
const OUTLINE_COLOR = 'hsl(340, 45%, 45%)';
const MOUTH_COLOR = 'hsl(345, 55%, 30%)';
const MOUTH_OPEN_FRAMES = 7; // length of one open-and-close bite
const DEFAULT_ACCELERATION = 0.3 * GAME_SPEED;
// slowest speed a bounce sends the axolotl away from a wall at
const MIN_BOUNCE_VELOCITY = 0.4 * GAME_SPEED;
// how fast it swings round to its new heading after a bounce, in radians per frame
const BOUNCE_TURN_RATE = 0.12 * GAME_SPEED;
// longest single move between rock checks; smaller than the smallest body circle so it can't skip a wall
const COLLISION_STEP_PX = 4;
// every tap of W gives a quick kick: strong acceleration up to a higher top speed for a moment, after which
// water drag eases it back down to the normal top speed. So tapping W repeatedly is deliberately the fastest
// way to swim, faster than holding it.
const BURST_SPEED_MULTIPLIER = 2; // kick top speed, as a multiple of the normal (held) top speed
const BURST_ACCELERATION = 0.6 * GAME_SPEED;
const BURST_FRAMES = 12; // how long each kick keeps pushing
// each kick whips the tail to show the push: a fast, wide beat or two, then back to normal swimming
const WHIP_FRAMES = 16; // how long the whip lasts
const WHIP_BEATS = 1.5; // how many full side-to-side beats fit in it
const WHIP_AMPLITUDE = 1.8; // how wide it swings, as a multiple of the normal widest swing
// the body as a few circles along its length, in local units of radius: [distance forward, circle radius]
const BODY_CIRCLES = [
    [0.55, 0.62], // head
    [-0.2, 0.45], // body
    [-1.1, 0.22], // tail
];

class Meeple {
    constructor(x, y, radius, velocity, color) {
        this.x = x;
        this.y = y;
        this.radius = radius;
        this.bulgingRadius = {
            expanding: true,
            radius: this.radius,
            maxRadius: this.radius * 1.1,
            adjustment: 1.005,
        };
        this.gillColor = GILL_COLOR;
        this.outlineColor = OUTLINE_COLOR;
        this.tail = {
            phase: 0,
            amplitude: 0,
            maxAmplitude: this.radius * 0.35,
            speed: 0.03, // phase advanced per unit of velocity, so a faster swim means a faster wiggle
        };
        this.velocity = velocity;
        this.maxVelocity = 2.5 * GAME_SPEED;
        this.acceleration = DEFAULT_ACCELERATION;
        this.naturalDeceleration = 0.96;
        this.color = color;
        this.angle = Math.random() * 2 * Math.PI;
        this.angleChange = 0.05;
        this.xVelocity = 0;
        this.yVelocity = 0;
        this.bounceTargetAngle = null; // heading it's swinging round to after a bounce
        this.mouthFrames = 0; // counts down while the eating animation plays
        this.burstFrames = 0; // counts down while a W kick is pushing
        this.whipFrames = 0; // counts down while the kick's tail whip plays
        this.adjustedX = 0;
        this.adjustedY = 0;
        this.terrain = null;
        this.contact = { depth: 0, normalX: 0, normalY: 0 };
        this.controller = {
            up: false,
            down: false,
            mousedown: false,
        };
        this.targetX = null;
        this.targetY = null;
    }

    resultantVelocity(xVelocity = this.xVelocity, yVelocity = this.yVelocity) {
        return Math.hypot(xVelocity, yVelocity);
    }

    angleOfDirection(xVelocity = this.xVelocity, yVelocity = this.yVelocity) {
        if (xVelocity >= 0 && yVelocity >= 0) {
            return Math.atan(xVelocity / yVelocity);
        }
        if (xVelocity >= 0 && yVelocity <= 0) {
            return Math.PI / 2 + Math.atan(Math.abs(yVelocity) / xVelocity);
        }
        if (xVelocity <= 0 && yVelocity <= 0) {
            return Math.PI + Math.atan(Math.abs(xVelocity) / Math.abs(yVelocity));
        }
        if (xVelocity <= 0 && yVelocity >= 0) {
            return (Math.PI * 3) / 2 + Math.atan(yVelocity / Math.abs(xVelocity));
        }
    }

    findAngleFromPoint(x1, y1, x2, y2) {
        const angle = this.angleOfDirection(x1 - x2, y1 - y2);
        return resetWithin2PI(angle);
    }

    findXVelocity(angle = this.angle, velocity = this.velocity) {
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

    findYVelocity(angle = this.angle, velocity = this.velocity) {
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

    changeAngle() {
        this.angle =
            Math.random() < 0.5 ? this.angle + this.angleChange : this.angle - this.angleChange;

        this.angle = resetWithin2PI(this.angle);
    }

    // true if any part of the body overlaps rock; used when choosing a spawn point
    touchesWall() {
        const facingX = Math.sin(this.angle);
        const facingY = Math.cos(this.angle);
        for (const [forward, size] of BODY_CIRCLES) {
            const x = this.x + facingX * forward * this.radius;
            const y = this.y + facingY * forward * this.radius;
            if (this.terrain.findContact(x, y, size * this.radius, this.contact)) return true;
        }
        return false;
    }

    // bounces off the rock like light off a mirror, keeping the full speed. Of the two ways to line up with
    // the new path (swimming forwards along it, or backing along it), it picks the one needing the smaller
    // turn, so glancing hits barely change its heading and head-on hits send it backing straight off.
    // It then swings round to that heading over a few frames instead of snapping.
    bounce(normalX, normalY) {
        const direction = this.velocity >= 0 ? 1 : -1;
        const movingX = Math.sin(this.angle) * direction;
        const movingY = Math.cos(this.angle) * direction;
        const intoWall = movingX * normalX + movingY * normalY;
        const reflectedX = movingX - 2 * intoWall * normalX;
        const reflectedY = movingY - 2 * intoWall * normalY;
        const speed = Math.max(Math.abs(this.velocity), MIN_BOUNCE_VELOCITY);

        const facingAlongPath = Math.sin(this.angle) * reflectedX + Math.cos(this.angle) * reflectedY >= 0;
        if (facingAlongPath) {
            this.bounceTargetAngle = resetWithin2PI(Math.atan2(reflectedX, reflectedY));
            this.velocity = speed;
        } else {
            this.bounceTargetAngle = resetWithin2PI(Math.atan2(-reflectedX, -reflectedY));
            this.velocity = -speed;
        }
    }

    swingAfterBounce() {
        if (this.bounceTargetAngle === null) return;
        const remaining = wrapToPi(this.bounceTargetAngle - this.angle);
        if (Math.abs(remaining) <= BOUNCE_TURN_RATE) {
            this.angle = this.bounceTargetAngle;
            this.bounceTargetAngle = null;
            return;
        }
        this.angle = resetWithin2PI(this.angle + Math.sign(remaining) * BOUNCE_TURN_RATE);
    }

    // pushes the body out of the rock it overlaps, bouncing off the first surface it's moving into.
    // Returns whether it bounced.
    resolveWallCollisions() {
        let bounced = false;
        for (let pass = 0; pass < 2; pass++) {
            const facingX = Math.sin(this.angle);
            const facingY = Math.cos(this.angle);
            let touched = false;
            for (const [forward, size] of BODY_CIRCLES) {
                const x = this.x + facingX * forward * this.radius;
                const y = this.y + facingY * forward * this.radius;
                if (!this.terrain.findContact(x, y, size * this.radius, this.contact)) continue;
                touched = true;

                const { depth, normalX, normalY } = this.contact;
                this.x += normalX * depth;
                this.y += normalY * depth;

                const intoWall = (facingX * normalX + facingY * normalY) * this.velocity;
                if (!bounced && intoWall < 0) {
                    this.bounce(normalX, normalY);
                    bounced = true;
                }
            }
            if (!touched) break;
        }
        return bounced;
    }

    // moves this frame's distance in small steps, checking the rock after each, so a high GAME_SPEED can't
    // carry the body straight through a thin wall in one jump. Like before, a bounce stops swimming and
    // swimming for the next frame so it can get clear.
    move() {
        const steps = Math.max(1, Math.ceil(Math.abs(this.velocity) / COLLISION_STEP_PX));
        let bounced = false;
        for (let step = 0; step < steps; step++) {
            this.xVelocity = this.findXVelocity();
            this.yVelocity = this.findYVelocity();
            this.x += this.xVelocity / steps;
            this.y += this.yVelocity / steps;
            if (this.resolveWallCollisions()) bounced = true;
        }
        this.acceleration = bounced ? 0 : DEFAULT_ACCELERATION;
    }

    // called on every fresh press of W (not key repeat)
    startBurst() {
        this.burstFrames = BURST_FRAMES;
        this.whipFrames = WHIP_FRAMES;
    }

    // a W kick: pushes hard towards the higher kick top speed. Runs for its full length even if W is
    // released straight away, so a quick tap still gets the whole kick.
    kick() {
        if (this.acceleration === 0) return; // just bounced off a wall
        const cap = this.maxVelocity * BURST_SPEED_MULTIPLIER;
        if (this.velocity < cap) this.velocity = Math.min(this.velocity + BURST_ACCELERATION, cap);
    }

    accelerate() {
        // only pushes up to the normal top speed; above it (just after a kick) drag slows it rather than
        // snapping it straight down
        if (this.velocity < this.maxVelocity) {
            this.velocity = Math.min(this.velocity + this.acceleration, this.maxVelocity);
        }
    }

    decelerate() {
        this.velocity = Math.max(this.velocity - this.acceleration, -this.maxVelocity);
    }

    naturallyDecelerate() {
        this.velocity *= this.naturalDeceleration;
    }

    // steering comes from the mouse (faceMouse), so the controls only swim forwards and backwards.
    // The left mouse button works exactly like W: each click kicks, holding cruises at top speed.
    updateAngleAndVelocity() {
        if (this.burstFrames > 0) {
            this.kick();
        } else if (this.controller.up || this.controller.mousedown) {
            this.accelerate();
        }
        if (this.controller.down) {
            this.decelerate();
        }
    }

    // always points at the mouse pointer, so W/S swim towards or away from it; overrides turning keys and
    // the swing after a bounce. Waits until the pointer has been seen, and skips if it's dead centre.
    faceMouse() {
        if (mouse.x === null) return;
        if (mouse.x === this.adjustedX && mouse.y === this.adjustedY) return;
        this.bounceTargetAngle = null;
        this.angle = this.findAngleFromPoint(mouse.x, mouse.y, this.adjustedX, this.adjustedY);
    }

    bulging() {
        if (this.bulgingRadius.radius >= this.bulgingRadius.maxRadius) {
            this.bulgingRadius.expanding = false;
        }

        if (this.bulgingRadius.radius <= this.radius) {
            this.bulgingRadius.expanding = true;
        }
        if (this.bulgingRadius.expanding) {
            this.bulgingRadius.radius *= this.bulgingRadius.adjustment;
            return;
        }

        if (this.bulgingRadius.expanding === false) {
            this.bulgingRadius.radius /= this.bulgingRadius.adjustment;
            return;
        }
    }

    wiggleTail() {
        if (this.whipFrames > 0) {
            // a kick's tail whip: a fast, wide beat or two, regardless of speed
            this.whipFrames--;
            this.tail.phase += (Math.PI * 2 * WHIP_BEATS) / WHIP_FRAMES;
            const whipAmplitude = this.tail.maxAmplitude * WHIP_AMPLITUDE;
            this.tail.amplitude += (whipAmplitude - this.tail.amplitude) * 0.35;
            return;
        }
        // wiggle speed follows velocity (negative when swimming backwards), and the wiggle fades out when stopped
        this.tail.phase += this.velocity * this.tail.speed;
        const targetAmplitude =
            Math.min(Math.abs(this.velocity) / 3, 1) * this.tail.maxAmplitude;
        this.tail.amplitude += (targetAmplitude - this.tail.amplitude) * 0.1;
    }

    fillAndOutline(color) {
        c.fillStyle = color;
        c.fill();
        c.lineWidth = 1.5;
        c.strokeStyle = this.outlineColor;
        c.stroke();
    }

    drawEllipse(x, y, radiusX, radiusY, rotation, color) {
        c.beginPath();
        c.ellipse(x, y, radiusX, radiusY, rotation, 0, Math.PI * 2);
        this.fillAndOutline(color);
        c.closePath();
    }

    // everything below is drawn in local coordinates: origin at the meeple, head pointing along +x

    // one swimming wave runs from head to tail: barely moving at the head, swinging most at the tail tip
    swimOffset(x) {
        const r = this.radius;
        const alongBody = (0.9 * r - x) / (2.6 * r); // 0 near the snout, 1 at the tail tip
        const strength = 0.15 + 0.85 * alongBody * alongBody;
        return this.tail.amplitude * strength * Math.sin(this.tail.phase - alongBody * 4);
    }

    // how much a part at x is turned by the wave, from the wave's slope there
    swimTilt(x) {
        return Math.atan((this.swimOffset(x + 1) - this.swimOffset(x - 1)) / 2);
    }

    drawTail() {
        const r = this.radius;
        const baseX = -0.5 * r;
        const length = 1.2 * r;
        const segments = 10;

        c.beginPath();
        // up one edge from base to tip, then back down the other edge
        for (let i = 0; i <= segments; i++) {
            const t = i / segments;
            const x = baseX - t * length;
            const halfWidth = 0.3 * r * (1 - t) + 0.03 * r;
            c.lineTo(x, this.swimOffset(x) - halfWidth);
        }
        for (let i = segments; i >= 0; i--) {
            const t = i / segments;
            const x = baseX - t * length;
            const halfWidth = 0.3 * r * (1 - t) + 0.03 * r;
            c.lineTo(x, this.swimOffset(x) + halfWidth);
        }
        c.closePath();
        this.fillAndOutline(this.color);
    }

    drawLegs() {
        const r = this.radius;
        const frontX = 0.1 * r;
        const backX = -0.55 * r;
        const frontOffset = this.swimOffset(frontX);
        const backOffset = this.swimOffset(backX);
        const frontTilt = this.swimTilt(frontX);
        const backTilt = this.swimTilt(backX);
        for (const side of [-1, 1]) {
            this.drawEllipse(frontX, side * 0.5 * r + frontOffset, 0.22 * r, 0.12 * r, side * -0.7 + frontTilt, this.color);
            this.drawEllipse(backX, side * 0.42 * r + backOffset, 0.22 * r, 0.12 * r, side * -0.9 + backTilt, this.color);
        }
    }

    drawBody() {
        const x = -0.2 * this.radius;
        this.drawEllipse(x, this.swimOffset(x), 0.75 * this.radius, 0.45 * this.radius, this.swimTilt(x), this.color);
    }

    // head, gills and face move together as one piece, following the wave at the head
    drawHead() {
        const r = this.radius;
        const headX = 0.55 * r;
        c.save();
        c.translate(headX, this.swimOffset(headX));
        c.rotate(this.swimTilt(headX));
        c.translate(-headX, 0);
        this.drawGills();
        this.drawEllipse(headX, 0, 0.55 * r, 0.65 * r, 0, this.color);
        this.drawFace();
        c.restore();
    }

    drawGills() {
        const r = this.radius;
        c.lineCap = 'round';
        for (const side of [-1, 1]) {
            // three fronds per side, fanning backwards and outwards from the side of the head
            [2.0, 2.5, 3.0].forEach((angle) => {
                const startX = 0.35 * r;
                const startY = side * 0.5 * r;
                const endX = startX + Math.cos(angle) * 0.5 * r;
                const endY = startY + side * Math.sin(angle) * 0.5 * r;
                c.beginPath();
                c.moveTo(startX, startY);
                c.lineTo(endX, endY);
                c.lineWidth = 0.18 * r;
                c.strokeStyle = this.gillColor;
                c.stroke();
                c.closePath();
            });
        }
    }

    drawFace() {
        const r = this.radius;
        for (const side of [-1, 1]) {
            c.beginPath();
            c.arc(0.75 * r, side * 0.38 * r, 0.11 * r, 0, Math.PI * 2);
            c.fillStyle = 'black';
            c.fill();
            c.closePath();

            c.beginPath();
            c.arc(0.78 * r, side * 0.38 * r - 0.04 * r, 0.04 * r, 0, Math.PI * 2);
            c.fillStyle = 'white';
            c.fill();
            c.closePath();
        }

        // little smile at the front of the head
        c.beginPath();
        c.arc(0.7 * r, 0, 0.28 * r, -0.7, 0.7);
        c.lineWidth = 1.5;
        c.strokeStyle = this.outlineColor;
        c.stroke();
        c.closePath();

        // while eating, the mouth opens and closes once at the tip of the snout
        if (this.mouthFrames > 0) {
            const open = Math.sin(Math.PI * (1 - this.mouthFrames / MOUTH_OPEN_FRAMES));
            c.beginPath();
            c.ellipse(0.9 * r, 0, 0.14 * r * open + 0.5, 0.3 * r * open + 0.5, 0, 0, Math.PI * 2);
            c.fillStyle = MOUTH_COLOR;
            c.fill();
            c.lineWidth = 1.2;
            c.strokeStyle = this.outlineColor;
            c.stroke();
            c.closePath();
        }
    }

    startEating() {
        this.mouthFrames = MOUTH_OPEN_FRAMES;
    }

    draw() {
        const bulgeScale = this.bulgingRadius.radius / this.radius;

        c.save();
        c.translate(this.adjustedX, this.adjustedY);
        // this.angle is measured from +y towards +x, so rotate the local +x axis onto the heading
        c.rotate(Math.PI / 2 - this.angle);
        c.scale(bulgeScale, bulgeScale);

        this.drawTail();
        this.drawLegs();
        this.drawBody();
        this.drawHead();

        c.restore();
    }

    update() {
        this.bulging();
        this.wiggleTail();
        if (this.mouthFrames > 0) this.mouthFrames--;
        if (this.burstFrames > 0) this.burstFrames--;
        this.updateAngleAndVelocity();
        // this.changeAngle();
        this.naturallyDecelerate();
        this.swingAfterBounce();
        this.faceMouse();
        this.move();

        this.draw();
    }
}

function generateMeeple(terrain, startX, startY) {
    let me;
    do {
        const x = startX + Math.random() * 500;
        const y = startY + Math.random() * 500;
        me = new Meeple(x, y, MY_SIZE, MY_VELOCITY, MY_COLOR);
        me.terrain = terrain;
    } while (
        terrain.isWall(Math.round(me.y / PIXEL_RATIO), Math.round(me.x / PIXEL_RATIO)) ||
        me.touchesWall()
    );
    return me;
}
