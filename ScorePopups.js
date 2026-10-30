// "+N" numbers that bubble up from eaten food and fade away
const POPUP_FRAMES = 60; // how long each number lives
const POPUP_RISE_PX = 48; // how far it floats up over its life
const POPUP_WOBBLE_PX = 3; // side-to-side drift, like a rising bubble
const POPUP_FONT = '700 22px Fredoka, system-ui, sans-serif';
const POPUP_OUTLINE_COLOR = 'hsl(173, 60%, 16%)';

class ScorePopups {
    constructor() {
        this.popups = [];
    }

    // x, y are world px of the eaten food
    add(x, y, amount) {
        this.popups.push({
            x,
            y,
            text: `+${amount}`,
            age: 0,
            wobblePhase: Math.random() * Math.PI * 2,
        });
    }

    draw(meeple) {
        if (this.popups.length === 0) return;
        const offsetX = Math.round(meeple.adjustedX - meeple.x);
        const offsetY = Math.round(meeple.adjustedY - meeple.y);

        c.save();
        c.font = POPUP_FONT;
        c.textAlign = 'center';
        c.textBaseline = 'middle';
        c.lineJoin = 'round';
        c.lineWidth = 4;
        c.strokeStyle = POPUP_OUTLINE_COLOR;
        c.fillStyle = 'white';

        for (let i = this.popups.length - 1; i >= 0; i--) {
            const popup = this.popups[i];
            popup.age++;
            if (popup.age >= POPUP_FRAMES) {
                this.popups.splice(i, 1);
                continue;
            }

            const t = popup.age / POPUP_FRAMES;
            // fast at first, then slowing, like a bubble losing momentum
            const rise = POPUP_RISE_PX * (1 - (1 - t) * (1 - t));
            const wobble = Math.sin(popup.wobblePhase + popup.age * 0.18) * POPUP_WOBBLE_PX * t;
            // a quick pop in size at the start, then settling
            const scale = t < 0.15 ? 0.5 + (t / 0.15) * 0.7 : 1.2 - Math.min((t - 0.15) / 0.2, 1) * 0.2;
            // fully visible for the first half, then fading out
            c.globalAlpha = t < 0.5 ? 1 : 1 - (t - 0.5) / 0.5;

            c.setTransform(scale, 0, 0, scale, popup.x + offsetX + wobble, popup.y + offsetY - 16 - rise);
            c.strokeText(popup.text, 0, 0);
            c.fillText(popup.text, 0, 0);
        }

        c.restore();
    }
}
