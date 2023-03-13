const MY_SIZE = 10;
const MY_VELOCITY = 2;
const MY_COLOR = 'orange';

class Meeple {
    constructor(x, y, radius, velocity, color) {
        this.x = x;
        this.y = y;
        this.radius = radius;
        this.velocity = velocity;
        this.minDistanceFromWall = this.radius + PIXEL_RATIO / 2;
        this.angle = Math.random() * 2 * Math.PI;
        this.angleChange = 0.1;
        this.xVelocity = 0;
        this.yVelocity = 0;
        this.overlap = false;
        this.color = color;
        this.adjustedX = 0;
        this.adjustedY = 0;
    }

    resultantVelocity(xVelocity, yVelocity) {
        return Math.sqrt(Math.pow(xVelocity, 2) + Math.pow(yVelocity, 2));
    }

    angleOfDirection(xVelocity, yVelocity, resultantVelocity) {
        if (xVelocity >= 0 && yVelocity >= 0) {
            return Math.asin(xVelocity / resultantVelocity);
        }
        if (xVelocity >= 0 && yVelocity <= 0) {
            return Math.PI / 2 + Math.acos(xVelocity / resultantVelocity);
        }
        if (xVelocity <= 0 && yVelocity <= 0) {
            return Math.PI + Math.asin(Math.abs(xVelocity) / resultantVelocity);
        }
        if (xVelocity <= 0 && yVelocity >= 0) {
            return (Math.PI * 3) / 2 + Math.asin(yVelocity / resultantVelocity);
        }
    }

    findXVelocity(angle, velocity) {
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

    findYVelocity(angle, velocity) {
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

    findCollisionAngleReverse(xWall, yWall) {
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

    checkForCollision(terrain, overlap = false) {
        for (let i = 0; i < terrain.length; i++) {
            for (let j = 0; j < terrain[i].length; j++) {
                if (terrain[i][j].wallType === OPEN_SPACE) continue;

                const xDistanceToWall = Math.abs(this.x - terrain[i][j].x);
                const yDistanceToWall = Math.abs(this.y - terrain[i][j].y);

                if (
                    xDistanceToWall < this.minDistanceFromWall &&
                    yDistanceToWall < this.minDistanceFromWall &&
                    overlap === false
                ) {
                    this.overlap = true;

                    this.angle = this.findCollisionAngleReverse(terrain[i][j].x, terrain[i][j].y);
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

    update(terrain) {
        this.checkForCollision(terrain, this.overlap);
        this.changeAngle();
        this.xVelocity = this.findXVelocity(this.angle, this.velocity);
        this.yVelocity = this.findYVelocity(this.angle, this.velocity);
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
        const partialTerrain = calcPartialTerrain(me, terrain);
        me.checkForCollision(partialTerrain);
    } while (me.overlap === true);
    return me;
}
