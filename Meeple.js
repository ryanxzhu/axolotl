const MY_SIZE = 10;
const MY_VELOCITY = 2;
const MY_COLOR = 'orange';

class Meeple {
    constructor(x, y, radius, velocity, color) {
        this.x = x;
        this.y = y;
        this.radius = radius;
        this.velocity = velocity;
        this.color = color;
        this.minDistanceFromWall = this.radius + PIXEL_RATIO / 2;
        this.angle = Math.random() * 2 * Math.PI;
        this.angleChange = 0.1;
        this.xVelocity = 0;
        this.yVelocity = 0;
        this.overlap = false;
        this.adjustedX = 0;
        this.adjustedY = 0;
        this.collisionMap = [];
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
        const xDirection = this.x - xWall;
        const yDirection = this.y - yWall;
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

                    this.angle = this.calcBounceAngle(
                        this.collisionMap[i][j].x,
                        this.collisionMap[i][j].y
                    );
                    return;
                }
            }
        }
        this.overlap = false;
    }

    draw() {
        c.beginPath();
        c.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        c.fillStyle = this.color;
        c.fill();
        c.closePath();
    }

    update() {
        this.checkForCollision(this.overlap);
        this.changeAngle();
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
        me.collisionMap = terrain.calcPartial(me, PIXEL_RATIO * 2, PIXEL_RATIO * 2);
        me.checkForCollision();
        console.log('generated');
    } while (me.overlap === true);
    return me;
}
