const MY_SIZE = 20;
const MY_VELOCITY = 2;
// const MY_COLOR = 'hsl(300, 100%, 50%)';
const MY_COLOR = '#ffb6c8';
const GILL_COLOR = '#ff6f91';
const OUTLINE_COLOR = 'hsl(340, 45%, 45%)';
const DEFAULT_ACCELERATION = 0.3;
// slowest speed a bounce sends the axolotl away from a wall at
const MIN_BOUNCE_VELOCITY = 0.4;
// how fast it swings round to its new heading after a bounce, in radians per frame
const BOUNCE_TURN_RATE = 0.12;
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
        this.maxVelocity = 10;
        this.acceleration = DEFAULT_ACCELERATION;
        this.naturalDeceleration = 0.96;
        this.color = color;
        this.angle = Math.random() * 2 * Math.PI;
        this.angleChange = 0.05;
        this.xVelocity = 0;
        this.yVelocity = 0;
        this.overlap = false;
        this.bounceTargetAngle = null; // heading it's swinging round to after a bounce
        this.adjustedX = 0;
        this.adjustedY = 0;
        this.terrain = null;
        this.contact = { depth: 0, normalX: 0, normalY: 0 };
        this.controller = {
            up: false,
            down: false,
            left: false,
            right: false,
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
    // Like before, a bounce stops swimming and mouse steering for one frame so it can get clear.
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

        this.overlap = bounced;
        this.acceleration = bounced ? 0 : DEFAULT_ACCELERATION;
    }

    accelerate() {
        if (this.velocity <= this.maxVelocity) {
            this.velocity += this.acceleration;
        }
    }

    decelerate() {
        if (this.velocity >= -this.maxVelocity) {
            this.velocity -= this.acceleration;
        }
    }

    naturallyDecelerate() {
        this.velocity *= this.naturalDeceleration;
    }

    turnLeft() {
        this.angle =
            this.velocity >= 0 ? this.angle + this.angleChange : this.angle - this.angleChange;
        this.angle = resetWithin2PI(this.angle);
    }

    turnRight() {
        this.angle =
            this.velocity >= 0 ? this.angle - this.angleChange : this.angle + this.angleChange;
        this.angle = resetWithin2PI(this.angle);
    }

    updateAngleAndVelocity() {
        if (this.controller.up) {
            this.accelerate();
        }
        if (this.controller.down) {
            this.decelerate();
        }
        if (this.controller.left) {
            this.turnLeft();
        }
        if (this.controller.right) {
            this.turnRight();
        }
    }

    checkForClick() {
        if (this.controller.mousedown && !this.overlap) {
            // pointing with the mouse takes over from any swing still left from a bounce
            this.bounceTargetAngle = null;
            this.velocity = 5;
            this.angle = this.findAngleFromPoint(mouse.x, mouse.y, this.adjustedX, this.adjustedY);
        }
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
        this.checkForClick();
        this.updateAngleAndVelocity();
        // this.changeAngle();
        this.naturallyDecelerate();
        this.swingAfterBounce();

        this.xVelocity = this.findXVelocity();
        this.yVelocity = this.findYVelocity();
        this.x += this.xVelocity;
        this.y += this.yVelocity;
        this.resolveWallCollisions();

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
