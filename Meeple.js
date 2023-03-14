const MY_SIZE = 20;
const MY_VELOCITY = 2;
const MY_COLOR = 'hsl(300, 100%, 50%)';
const BOUNCE_DRAG = 0.66;

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
        this.velocity = velocity;
        this.maxVelocity = 5;
        this.acceleration = 0.15;
        this.naturalDeceleration = 0.98;
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
            up: { pressed: false, func: this.accelerate },
            down: { pressed: false, func: this.decelerate },
            left: { pressed: false, func: this.turnLeft },
            right: { pressed: false, func: this.turnRight },
        };
    }

    resultantVelocity(xVelocity = this.xVelocity, yVelocity = this.yVelocity) {
        return Math.sqrt(Math.pow(xVelocity, 2) + Math.pow(yVelocity, 2));
    }

    angleOfDirection(
        xVelocity = this.xVelocity,
        yVelocity = this.yVelocity,
        velocity = this.velocity
    ) {
        if (xVelocity >= 0 && yVelocity >= 0) {
            return Math.asin(xVelocity / velocity);
        }
        if (xVelocity >= 0 && yVelocity <= 0) {
            return Math.PI / 2 + Math.acos(xVelocity / velocity);
        }
        if (xVelocity <= 0 && yVelocity <= 0) {
            return Math.PI + Math.asin(Math.abs(xVelocity) / velocity);
        }
        if (xVelocity <= 0 && yVelocity >= 0) {
            return (Math.PI * 3) / 2 + Math.asin(yVelocity / velocity);
        }
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

    calcBounceAngle(xWall, yWall) {
        const xDirection = xWall - this.x;
        const yDirection = yWall - this.y;
        const resultantVelocity = this.resultantVelocity(xDirection, yDirection);
        const angleOfDirection = this.angleOfDirection(xDirection, yDirection, resultantVelocity);
        return angleOfDirection;
    }

    changeAngle() {
        this.angle =
            Math.random() < 0.5 ? this.angle + this.angleChange : this.angle - this.angleChange;
        this.angle = this.angle < 0 ? this.angle + Math.PI * 2 : this.angle;
        this.angle = this.angle >= Math.PI * 2 ? this.angle - Math.PI * 2 : this.angle;
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
                    this.velocity = this.velocity * BOUNCE_DRAG;
                    if (this.velocity < 0.3) {
                        this.velocity = 0.3; // necessary to prevent the meeple going into the wall
                    }
                    this.angle = this.calcBounceAngle(
                        this.collisionMap[i][j].x,
                        this.collisionMap[i][j].y
                    );

                    this.velocity = -this.velocity;
                    return;
                }
            }
        }
        this.overlap = false;
    }

    adjustFrame(terrain) {
        const xAdjustment = this.x;
        const yAdjustment = this.y;
        terrain = terrain.map((row) => {
            return row.map((cell) => {
                return {
                    x: cell.x - xAdjustment + this.adjustedX,
                    y: cell.y - yAdjustment + this.adjustedY,
                    wallType: cell.wallType,
                };
            });
        });

        return terrain;
    }

    accelerate() {
        if (Math.abs(this.velocity) <= this.maxVelocity) {
            this.velocity += this.acceleration;
        }
    }

    decelerate() {
        if (Math.abs(this.velocity) <= this.maxVelocity) {
            this.velocity -= this.acceleration;
        }
    }

    naturallyDecelerate() {
        this.velocity *= this.naturalDeceleration;
    }

    turnLeft() {
        this.angle =
            this.velocity >= 0 ? this.angle + this.angleChange : this.angle - this.angleChange;
        this.angle = this.angle < 0 ? this.angle + Math.PI * 2 : this.angle;
        this.angle = this.angle >= Math.PI * 2 ? this.angle - Math.PI * 2 : this.angle;
    }

    turnRight() {
        this.angle =
            this.velocity >= 0 ? this.angle - this.angleChange : this.angle + this.angleChange;
        this.angle = this.angle < 0 ? this.angle + Math.PI * 2 : this.angle;
        this.angle = this.angle >= Math.PI * 2 ? this.angle - Math.PI * 2 : this.angle;
    }

    updateAngleAndVelocity() {
        if (this.controller.up.pressed) {
            this.accelerate();
        }
        if (this.controller.down.pressed) {
            this.decelerate();
        }
        if (this.controller.left.pressed) {
            this.turnLeft();
        }
        if (this.controller.right.pressed) {
            this.turnRight();
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

    draw() {
        c.beginPath();
        c.arc(this.adjustedX, this.adjustedY, this.bulgingRadius.radius, 0, Math.PI * 2);
        c.fillStyle = this.color;
        c.fill();
        c.closePath();
    }

    update() {
        this.bulging();
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
