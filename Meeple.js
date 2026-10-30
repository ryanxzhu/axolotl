const MY_SIZE = 20;
const MY_VELOCITY = 2;
// const MY_COLOR = 'hsl(300, 100%, 50%)';
const MY_COLOR = '#ffb6c8';
const GILL_COLOR = '#ff6f91';
const OUTLINE_COLOR = 'hsl(340, 45%, 45%)';
const MOUTH_COLOR = 'hsl(345, 55%, 30%)';
const MOUTH_OPEN_FRAMES = 7; // length of one open-and-close bite
// where the head centre and the mouth sit, in units of radius forward from the body's centre
const HEAD_FORWARD = 0.55;
const MOUTH_FORWARD = 0.9;
const HOOVER_RING_COLOR = 'rgba(255, 255, 255, 0.4)';
const BASE_MAX_VELOCITY = 2.5 * GAME_SPEED; // top speed before any Swim faster upgrades
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
// Auto swim: the axolotl swims itself at top speed, wandering as if someone were randomly holding A or D
const AUTO_TURN_RATE = 0.05; // radians per frame while "holding" a turn, same as the old A/D keys
const AUTO_MIN_STRETCH_FRAMES = 20; // shortest time it keeps going straight or turning before changing
const AUTO_MAX_STRETCH_FRAMES = 90; // longest
const AUTO_STRAIGHT_CHANCE = 0.5; // chance each new stretch goes straight rather than turning
// after hitting a wall it stops pushing and turns away from the rock for a moment before swimming on
const AUTO_RECOVER_FRAMES = 25;
const AUTO_RECOVER_TURN_RATE = 0.08;
// Improve smell (during Auto swim): heads for the nearest food inside the smell ring
const SMELL_SEARCH_INTERVAL = 8; // frames between sniffs while it has nothing to chase
const SMELL_GIVE_UP_FRAMES = 240; // stop chasing a piece it can't reach (e.g. behind rock) after this long
const SMELL_SLOW_TURN_ANGLE = 0.6; // if the food is this far off to the side (radians)...
const SMELL_SLOW_TURN_DISTANCE = 80; // ...and this close (px), stop pushing so it can turn tighter
const SMELL_RING_COLOR = 'rgba(255, 182, 200, 0.45)';
// made once, so drawing the dashed ring doesn't create arrays every frame
const SMELL_RING_DASH = [6, 7];
const NO_DASH = [];
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
        this.speedMultiplier = 1; // raised by the Swim faster upgrade
        this.hooverRadius = 0; // reach of the Hoover food upgrade around the head; 0 until bought
        this.maxVelocity = BASE_MAX_VELOCITY;
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
        this.autoSwim = false; // Auto swim upgrade switched on: swims itself and ignores the player
        this.autoTurn = 0; // current random turn: -1, 0 (straight) or 1
        this.autoStretchFrames = 0; // frames left before picking a new random turn
        this.autoRecoverFrames = 0; // frames left turning away from a wall it just hit
        this.food = null; // the FoodField, for smelling nearby food
        this.smellRadius = 0; // reach of the Improve smell upgrade around the head; 0 until bought
        this.smellTarget = null; // the piece of food it's currently heading for
        this.smellIgnore = null; // a piece it gave up on, so it doesn't pick it straight back up
        this.smellSearchCooldown = 0;
        this.smellGiveUpFrames = 0;
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

        if (this.autoSwim) {
            // turn towards the open water (the side the wall's normal points) while backing off
            const turningRightway = Math.cos(this.angle) * normalX - Math.sin(this.angle) * normalY;
            this.autoTurn = turningRightway >= 0 ? 1 : -1;
            this.autoRecoverFrames = AUTO_RECOVER_FRAMES;
        }

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
        if (this.autoSwim) this.bounceTargetAngle = null; // the autopilot does its own turning away
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
        this.acceleration = bounced ? 0 : DEFAULT_ACCELERATION * this.speedMultiplier;
    }

    // Swim faster: scales top speed, acceleration and the kick together, so the whole swim feels faster
    setSpeedMultiplier(multiplier) {
        this.speedMultiplier = multiplier;
        this.maxVelocity = BASE_MAX_VELOCITY * multiplier;
        if (this.acceleration !== 0) this.acceleration = DEFAULT_ACCELERATION * multiplier;
    }

    // Hoover food: food within this distance of the head gets pulled to the mouth (see FoodField.hooverTowards)
    setHooverRadius(radius) {
        this.hooverRadius = radius;
    }

    // pulls nearby food towards the mouth each frame, once Hoover food is bought
    hooverFood(food) {
        if (this.hooverRadius === 0) return;
        const facingX = Math.sin(this.angle);
        const facingY = Math.cos(this.angle);
        food.hooverTowards(
            this.x + facingX * HEAD_FORWARD * this.radius,
            this.y + facingY * HEAD_FORWARD * this.radius,
            this.x + facingX * MOUTH_FORWARD * this.radius,
            this.y + facingY * MOUTH_FORWARD * this.radius,
            this.hooverRadius
        );
    }

    // called on every fresh press of W (not key repeat)
    startBurst() {
        if (this.autoSwim) return; // the player's W and clicks do nothing while it swims itself
        this.burstFrames = BURST_FRAMES;
        this.whipFrames = WHIP_FRAMES;
    }

    // a W kick: pushes hard towards the higher kick top speed. Runs for its full length even if W is
    // released straight away, so a quick tap still gets the whole kick.
    kick() {
        if (this.acceleration === 0) return; // just bounced off a wall
        const cap = this.maxVelocity * BURST_SPEED_MULTIPLIER;
        if (this.velocity < cap) {
            this.velocity = Math.min(this.velocity + BURST_ACCELERATION * this.speedMultiplier, cap);
        }
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
        if (this.autoSwim) {
            this.autoPilot();
            return;
        }
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
    // Auto swim on or off. Clears any leftover kick or bounce swing so neither mode inherits the other's state.
    setAutoSwim(on) {
        this.autoSwim = on;
        this.burstFrames = 0;
        this.bounceTargetAngle = null;
        this.autoTurn = 0;
        this.autoStretchFrames = 0;
        this.autoRecoverFrames = 0;
        this.smellTarget = null;
        this.smellIgnore = null;
    }

    // swims itself: forward at the same top speed as holding W, turning left, right or going straight for
    // random stretches. Just after a wall hit it stops pushing and turns away until clear.
    autoPilot() {
        if (this.autoRecoverFrames > 0) {
            this.autoRecoverFrames--;
            this.angle = resetWithin2PI(this.angle + this.autoTurn * AUTO_RECOVER_TURN_RATE);
            if (this.autoRecoverFrames === 0) this.autoStretchFrames = 0;
            return;
        }

        if (this.smellRadius > 0 && this.followSmell()) return;

        if (this.autoStretchFrames <= 0) {
            this.autoTurn = Math.random() < AUTO_STRAIGHT_CHANCE ? 0 : Math.random() < 0.5 ? -1 : 1;
            this.autoStretchFrames = Math.round(randomBetween(AUTO_MIN_STRETCH_FRAMES, AUTO_MAX_STRETCH_FRAMES));
        }
        this.autoStretchFrames--;
        this.angle = resetWithin2PI(this.angle + this.autoTurn * AUTO_TURN_RATE);
        this.accelerate();
    }

    setSmellRadius(radius) {
        this.smellRadius = radius;
    }

    // Improve smell: picks the nearest food inside the smell ring and turns towards it at the normal turn rate
    // (it can't turn instantly), swimming on as it goes. Returns false when there's nothing to smell, so the
    // autopilot just wanders.
    followSmell() {
        const headX = this.x + Math.sin(this.angle) * HEAD_FORWARD * this.radius;
        const headY = this.y + Math.cos(this.angle) * HEAD_FORWARD * this.radius;

        let target = this.smellTarget;
        if (target) {
            const outOfRange = Math.hypot(target.x - headX, target.y - headY) > this.smellRadius * 1.5;
            this.smellGiveUpFrames--;
            if (target.eaten || outOfRange || this.smellGiveUpFrames <= 0) {
                if (!target.eaten) this.smellIgnore = target;
                target = this.smellTarget = null;
                this.autoStretchFrames = 0; // pick a fresh wander once it stops chasing
            }
        }

        if (!target) {
            // only sniff every few frames while there's nothing to chase
            if (this.smellSearchCooldown > 0) {
                this.smellSearchCooldown--;
                return false;
            }
            this.smellSearchCooldown = SMELL_SEARCH_INTERVAL;
            target = this.smellTarget = this.food.findNearest(headX, headY, this.smellRadius, this.smellIgnore);
            if (!target) return false;
            this.smellGiveUpFrames = SMELL_GIVE_UP_FRAMES;
        }

        const dx = target.x - headX;
        const dy = target.y - headY;
        // angle 0 points along +y and grows towards +x, so the heading towards (dx, dy) is atan2(dx, dy)
        const offBy = wrapToPi(Math.atan2(dx, dy) - this.angle);
        this.angle = resetWithin2PI(this.angle + Math.max(-AUTO_TURN_RATE, Math.min(AUTO_TURN_RATE, offBy)));
        // close and well off to the side: stop pushing so drag slows it and it turns tighter instead of circling
        const tightTurn = Math.abs(offBy) > SMELL_SLOW_TURN_ANGLE && dx * dx + dy * dy < SMELL_SLOW_TURN_DISTANCE ** 2;
        if (!tightTurn) this.accelerate();
        return true;
    }

    faceMouse() {
        if (this.autoSwim) return; // the mouse doesn't steer while it swims itself
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

        // the Hoover food reach: a faint ring around the head
        if (this.hooverRadius > 0) {
            c.beginPath();
            c.arc(HEAD_FORWARD * this.radius, 0, this.hooverRadius, 0, Math.PI * 2);
            c.lineWidth = 1.5;
            c.strokeStyle = HOOVER_RING_COLOR;
            c.stroke();
            c.closePath();
        }

        // the Improve smell reach: a wider, faint dashed pink ring around the head
        if (this.smellRadius > 0) {
            c.beginPath();
            c.arc(HEAD_FORWARD * this.radius, 0, this.smellRadius, 0, Math.PI * 2);
            c.setLineDash(SMELL_RING_DASH);
            c.lineWidth = 1.5;
            c.strokeStyle = SMELL_RING_COLOR;
            c.stroke();
            c.setLineDash(NO_DASH);
            c.closePath();
        }

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
