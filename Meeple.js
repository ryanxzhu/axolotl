const MY_SIZE = 20;
const MY_VELOCITY = 2;
// const MY_COLOR = 'hsl(300, 100%, 50%)';
const MY_COLOR = '#ffbda2';
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
        this.eyeDistanceFromCenterRatio = 0.5;
        this.eyeOffsetAngle = Math.PI / 4;
        this.eyeSizeRatio = 0.3;
        this.eyeColor = 'white';
        this.pupilDistanceFromCenterRatio = 0.55;
        this.pupilOffsetAngle = Math.PI / 5;
        this.pupilSizeRatio = 0.13;
        this.pupilColor = 'black';
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

    drawCircles(distanceFromCenterRatio, offsetAngle, sizeRatio, color) {
        const distFromCenter = this.radius * distanceFromCenterRatio;
        let angle = this.angle + offsetAngle;
        angle = resetWithin2PI(angle);

        // not actually finding X and Y velocity. Just using the same function to find the X and Y coordinates of the eyes
        const xLocation = this.adjustedX + this.findXVelocity(angle, distFromCenter);
        const yLocation = this.adjustedY + this.findYVelocity(angle, distFromCenter);

        c.beginPath();
        c.arc(xLocation, yLocation, this.radius * sizeRatio, 0, Math.PI * 2);
        c.fillStyle = color;
        c.fill();
        c.closePath();
    }

    drawEyes() {
        this.drawCircles(
            this.eyeDistanceFromCenterRatio,
            this.eyeOffsetAngle,
            this.eyeSizeRatio,
            this.eyeColor
        );
        this.drawCircles(
            this.eyeDistanceFromCenterRatio,
            -this.eyeOffsetAngle,
            this.eyeSizeRatio,
            this.eyeColor
        );

        this.drawCircles(
            this.pupilDistanceFromCenterRatio,
            this.pupilOffsetAngle,
            this.pupilSizeRatio,
            this.pupilColor
        );

        this.drawCircles(
            this.pupilDistanceFromCenterRatio,
            -this.pupilOffsetAngle,
            this.pupilSizeRatio,
            this.pupilColor
        );
    }

    draw() {
        c.beginPath();
        c.arc(this.adjustedX, this.adjustedY, this.bulgingRadius.radius, 0, Math.PI * 2);
        c.fillStyle = this.color;
        c.fill();
        c.closePath();
    }

    update() {
        this.bulging();
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
        this.drawEyes();
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
