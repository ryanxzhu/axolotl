// fog of war: semi-transparent darkness over the cave, with a soft fade into full light around the axolotl's head.
// The edge of the light is the smell radius (what the axolotl can sense), so no separate smell ring is drawn.
// Before Auto swim brings smell, the light uses smell's starting radius.
//
// The darkness and its fade are drawn once into an image the size of the canvas plus a margin, and only redrawn
// when the radius or canvas size changes. Each frame is then a single drawImage, centred on the head.

const FOG_COLOR = 'rgba(4, 18, 24, 0.62)'; // the darkness beyond the light
const FOG_FADE_START = 0.75; // full light out to this fraction of the radius, fading to full darkness at the radius
const FOG_MARGIN_PX = 40; // spare image around the canvas, so it still covers everything as the head moves off-centre

class FogOfWar {
    constructor() {
        this.image = document.createElement('canvas');
        this.radius = 0; // the radius and canvas size the image was last drawn for
        this.canvasSize = 0;
    }

    // the light reaches as far as the axolotl can smell, and starts at smell's first radius
    lightRadius(meeple) {
        return Math.max(meeple.smellRadius, SMELL_BASE_RADIUS);
    }

    // redraws the darkness image, only when the light radius or canvas size has changed
    prepare(radius) {
        if (radius === this.radius && canvas.width === this.canvasSize) return;
        this.radius = radius;
        this.canvasSize = canvas.width;

        const size = canvas.width + FOG_MARGIN_PX * 2;
        this.image.width = size;
        this.image.height = size;
        const g = this.image.getContext('2d');
        const centre = size / 2;
        const light = g.createRadialGradient(centre, centre, radius * FOG_FADE_START, centre, centre, radius);
        light.addColorStop(0, 'rgba(0, 0, 0, 0)');
        light.addColorStop(1, FOG_COLOR); // beyond the radius the gradient keeps this colour, so it's dark everywhere
        g.fillStyle = light;
        g.fillRect(0, 0, size, size);
    }

    draw(meeple) {
        this.prepare(this.lightRadius(meeple));
        const headX = meeple.adjustedX + Math.sin(meeple.angle) * HEAD_FORWARD * meeple.radius;
        const headY = meeple.adjustedY + Math.cos(meeple.angle) * HEAD_FORWARD * meeple.radius;
        c.drawImage(this.image, Math.round(headX - this.image.width / 2), Math.round(headY - this.image.height / 2));
    }
}
