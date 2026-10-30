const MY_SIZE = 20;
const MY_VELOCITY = 2;
// const MY_COLOR = 'hsl(300, 100%, 50%)';
const MY_COLOR = '#ffb6c8';
const GILL_COLOR = '#ff6f91';
const OUTLINE_COLOR = 'hsl(340, 45%, 45%)';
const BOUNCE_DRAG = 0.66;
const DEFAULT_ACCELERATION = 0.3;

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
            speed: 0.12, // phase advanced per unit of velocity, so a faster swim means a faster wiggle
        };
        this.velocity = velocity;
        this.maxVelocity = 10;
        this.acceleration = DEFAULT_ACCELERATION;
        this.naturalDeceleration = 0.96;
        this.color = color;
        this.minDistanceFromWall = this.radius + PIXEL_RATIO / 2;
        this.angle = Math.random() * 2 * Math.PI;
        this.angleChange = 0.05;
        this.xVelocity = 0;
        this.yVelocity = 0;
        this.overlap = false;
        this.adjustedX = 0;
        this.adjustedY = 0;
        this.collisionMap = [];
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

    calcBounceAngle(xWall, yWall, adjustment = 0) {
        const xDirection = xWall - this.x;
        const yDirection = yWall - this.y;
        const angleOfDirection = this.angleOfDirection(xDirection, yDirection) + adjustment;
        return resetWithin2PI(angleOfDirection);
    }

    changeAngle() {
        this.angle =
            Math.random() < 0.5 ? this.angle + this.angleChange : this.angle - this.angleChange;

        this.angle = resetWithin2PI(this.angle);
    }

    checkForCollision(overlap = false) {
        for (let i = 0; i < this.collisionMap.length; i++) {
            for (let j = 0; j < this.collisionMap[i].length; j++) {
                if (this.collisionMap[i][j].wallType === OPEN_SPACE) continue;

                const xDistanceToWall = Math.abs(this.x - this.collisionMap[i][j].x);
                const yDistanceToWall = Math.abs(this.y - this.collisionMap[i][j].y);
                if (
                    xDistanceToWall < this.minDistanceFromWall &&
                    yDistanceToWall < this.minDistanceFromWall &&
                    overlap === false
                ) {
                    this.overlap = true;
                    this.acceleration = 0;

                    if (this.velocity >= 0) {
                        this.angle = this.calcBounceAngle(
                            this.collisionMap[i][j].x,
                            this.collisionMap[i][j].y
                        );
                        if (this.velocity < 0.4) {
                            this.velocity = 0.4;
                        }
                    } else if (this.velocity < 0) {
                        this.angle = this.calcBounceAngle(
                            this.collisionMap[i][j].x,
                            this.collisionMap[i][j].y,
                            Math.PI
                        );

                        if (this.velocity > -0.4) {
                            this.velocity = -0.4;
                        }
                    }

                    this.angle = resetWithin2PI(this.angle);

                    this.velocity = -this.velocity;

                    this.targetX = null;
                    this.targetY = null;

                    return;
                }
            }
        }
        this.overlap = false;
        this.acceleration = DEFAULT_ACCELERATION;
    }

    adjustFrame(terrain) {
        terrain = terrain.map((row) => {
            return row.map((cell) => {
                return {
                    x: cell.x - this.x + this.adjustedX,
                    y: cell.y - this.y + this.adjustedY,
                    wallType: cell.wallType,
                };
            });
        });

        return terrain;
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
    drawTail() {
        const r = this.radius;
        const baseX = -0.5 * r;
        const length = 1.2 * r;
        const segments = 10;
        const upperEdge = [];
        const lowerEdge = [];
        for (let i = 0; i <= segments; i++) {
            const t = i / segments;
            const x = baseX - t * length;
            // the sideways swing grows towards the tip, and travels down the tail like a wave
            const y = this.tail.amplitude * t * Math.sin(this.tail.phase - t * 2.5);
            const halfWidth = 0.3 * r * (1 - t) + 0.03 * r;
            upperEdge.push([x, y - halfWidth]);
            lowerEdge.push([x, y + halfWidth]);
        }

        c.beginPath();
        c.moveTo(upperEdge[0][0], upperEdge[0][1]);
        upperEdge.forEach(([x, y]) => c.lineTo(x, y));
        lowerEdge.reverse().forEach(([x, y]) => c.lineTo(x, y));
        c.closePath();
        this.fillAndOutline(this.color);
    }

    drawLegs() {
        const r = this.radius;
        for (const side of [-1, 1]) {
            this.drawEllipse(0.1 * r, side * 0.5 * r, 0.22 * r, 0.12 * r, side * -0.7, this.color);
            this.drawEllipse(-0.55 * r, side * 0.42 * r, 0.22 * r, 0.12 * r, side * -0.9, this.color);
        }
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
        const r = this.radius;
        const bulgeScale = this.bulgingRadius.radius / this.radius;

        c.save();
        c.translate(this.adjustedX, this.adjustedY);
        // this.angle is measured from +y towards +x, so rotate the local +x axis onto the heading
        c.rotate(Math.PI / 2 - this.angle);
        c.scale(bulgeScale, bulgeScale);

        this.drawTail();
        this.drawLegs();
        this.drawEllipse(-0.2 * r, 0, 0.75 * r, 0.45 * r, 0, this.color);
        this.drawGills();
        this.drawEllipse(0.55 * r, 0, 0.55 * r, 0.65 * r, 0, this.color);
        this.drawFace();

        c.restore();
    }

    update() {
        this.bulging();
        this.wiggleTail();
        this.checkForClick();
        this.checkForCollision(this.overlap);
        this.updateAngleAndVelocity();
        // this.changeAngle();
        this.naturallyDecelerate();

        this.xVelocity = this.findXVelocity();
        this.yVelocity = this.findYVelocity();
        this.x += this.xVelocity;
        this.y += this.yVelocity;

        this.draw();
    }
}

function generateMeeple(terrain, startX, startY) {
    let me;
    do {
        const x = startX + Math.random() * 500;
        const y = startY + Math.random() * 500;
        me = new Meeple(x, y, MY_SIZE, MY_VELOCITY, MY_COLOR);
        me.collisionMap = terrain.calcPartial(me, PIXEL_RATIO + me.radius, PIXEL_RATIO + me.radius);
        me.checkForCollision();
    } while (me.overlap === true);
    return me;
}
